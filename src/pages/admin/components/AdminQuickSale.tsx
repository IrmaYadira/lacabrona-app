import { useState, useEffect, useCallback, useRef } from 'react';
import { supabasePos } from '@/pages/pos/supabasePos';
import { SPOTS, AREA_LABELS, type Area } from '@/pages/pos/types';
import type { PosAccount, PosAccountItem } from '@/pages/pos/types';
import type { SaleItem } from './QuickSaleMenuPicker';
import QuickSaleMenuPicker from './QuickSaleMenuPicker';
import QuickSaleCart from './QuickSaleCart';
import PrintTicketModal from '@/pages/pos/components/PrintTicketModal';
import { BluetoothPrinterProvider } from '@/pages/pos/context/BluetoothPrinterContext';
import { deductStockOnSale } from '@/pages/pos/utils/inventory';

type PaymentMethod = 'cash' | 'transfer' | 'credit_card' | 'debit_card';

const PAYMENT_OPTIONS: { id: PaymentMethod; label: string; icon: string; color: string }[] = [
  { id: 'cash', label: 'Efectivo', icon: 'ri-money-dollar-circle-line', color: 'text-green-600' },
  { id: 'transfer', label: 'Transferencia', icon: 'ri-bank-line', color: 'text-amber-600' },
  { id: 'credit_card', label: 'Tarjeta Crédito', icon: 'ri-bank-card-line', color: 'text-rose-600' },
  { id: 'debit_card', label: 'Tarjeta Débito', icon: 'ri-bank-card-2-line', color: 'text-indigo-600' },
];

const TRANSFER_DATA = { bank: 'Banco Inbursa', name: 'Irma Leal', clabe: '036320500328209850', whatsapp: '3348567795' };
const CARD_FEE_RATE = 0.03;
const AREA_ORDER: Area[] = ['principal', 'af1', 'af2', 'llevar'];

interface OpenAccount {
  id: number;
  spot: string;
  area: string;
  customer_name?: string;
  customer_phone?: string;
  customer_id?: number | null;
  folio_counter: number;
  total?: number;
}

export default function AdminQuickSale() {
  const [openAccounts, setOpenAccounts] = useState<OpenAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Mesa seleccionada para agregar productos
  const [activeSpotId, setActiveSpotId] = useState<string | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [newRound, setNewRound] = useState(true);
  const [sendingRound, setSendingRound] = useState(false);
  const [roundSuccess, setRoundSuccess] = useState<string | null>(null);

  // Cierre de cuenta
  const [closingAccount, setClosingAccount] = useState<OpenAccount | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [splitCount, setSplitCount] = useState(1);
  const [closingLoading, setClosingLoading] = useState(false);
  const [clabeCopied, setClabeCopied] = useState(false);
  const [accountTotal, setAccountTotal] = useState(0);
  const [tipAmount, setTipAmount] = useState('');

  // Print
  const [printData, setPrintData] = useState<{
    account: PosAccount;
    items: PosAccountItem[];
    paymentMethod?: PaymentMethod;
    splitCount?: number;
    total?: number;
    cardFee?: number;
    tip?: number;
    mode: 'cuenta' | 'comanda';
    folioNumber?: number;
  } | null>(null);

  const [successMsg, setSuccessMsg] = useState('');

  const lastFetchRef = useRef<number>(0);

  const fetchOpenAccounts = useCallback(async (silent = false) => {
    // Evitar fetches simultáneos (debounce 1s)
    const now = Date.now();
    if (now - lastFetchRef.current < 1000) return;
    lastFetchRef.current = now;

    if (!silent) setLoadingAccounts(true);
    const { data } = await supabasePos
      .from('pos_accounts')
      .select('id, spot, area, customer_name, customer_phone, customer_id, folio_counter')
      .eq('status', 'open')
      .order('created_at', { ascending: true });

    if (data) {
      const ids = (data as OpenAccount[]).map(a => a.id);
      if (ids.length > 0) {
        const { data: itemsData } = await supabasePos
          .from('pos_account_items')
          .select('account_id, unit_price, quantity')
          .in('account_id', ids);
        const totalsMap: Record<number, number> = {};
        (itemsData ?? []).forEach((i: { account_id: number; unit_price: number; quantity: number }) => {
          totalsMap[i.account_id] = (totalsMap[i.account_id] ?? 0) + i.unit_price * i.quantity;
        });
        setOpenAccounts((data as OpenAccount[]).map(a => ({ ...a, total: totalsMap[a.id] ?? 0 })));
      } else {
        setOpenAccounts([]);
      }
    }
    if (!silent) setLoadingAccounts(false);
  }, []);

  useEffect(() => {
    fetchOpenAccounts();

    // ── Supabase Realtime: escuchar cambios en pos_accounts y pos_account_items ──
    const channel = supabasePos
      .channel('admin-quicksale-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_accounts' }, () => {
        fetchOpenAccounts(true);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pos_account_items' }, () => {
        fetchOpenAccounts(true);
      })
      .subscribe();

    // ── Polling de respaldo cada 30s (por si el websocket falla) ──
    const interval = setInterval(() => fetchOpenAccounts(true), 30_000);

    return () => {
      supabasePos.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchOpenAccounts]);

  const occupiedMap = new Map<string, OpenAccount>();
  openAccounts.forEach(acc => {
    const spot = SPOTS.find(s => s.label === acc.spot && s.area === acc.area);
    if (spot) occupiedMap.set(spot.id, acc);
  });

  const activeSpot = activeSpotId ? SPOTS.find(s => s.id === activeSpotId) : null;
  const activeAccount = activeSpotId ? occupiedMap.get(activeSpotId) ?? null : null;

  const handleSelectSpot = (spotId: string) => {
    if (activeSpotId === spotId) {
      // Deseleccionar
      setActiveSpotId(null);
      setItems([]);
      setRoundSuccess(null);
      return;
    }
    setActiveSpotId(spotId);
    setItems([]);
    setRoundSuccess(null);
    const acc = occupiedMap.get(spotId);
    setCustomerName(acc?.customer_name ?? '');
    setCustomerPhone(acc?.customer_phone ?? '');
    setNewRound(true);
  };

  const itemTotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  const handleSendRound = async () => {
    if (!activeSpot || items.length === 0) return;
    setSendingRound(true);

    let accountId: number;
    let folioNumber: number;

    if (activeAccount && !newRound) {
      accountId = activeAccount.id;
      folioNumber = activeAccount.folio_counter;
    } else if (activeAccount && newRound) {
      const newFolio = activeAccount.folio_counter + 1;
      await supabasePos.from('pos_accounts').update({ folio_counter: newFolio, updated_at: new Date().toISOString() }).eq('id', activeAccount.id);
      accountId = activeAccount.id;
      folioNumber = newFolio;
    } else {
      const { data: acc } = await supabasePos
        .from('pos_accounts')
        .insert({ area: activeSpot.area, spot: activeSpot.label, customer_name: customerName || null, customer_phone: customerPhone || null, status: 'open', folio_counter: 1 })
        .select('id').maybeSingle();
      if (!acc) { setSendingRound(false); return; }
      accountId = acc.id;
      folioNumber = 1;
    }

    const inserts = items.map(item => ({
      account_id: accountId, product_name: item.name, size: item.note || null,
      quantity: item.quantity, unit_price: item.price, folio_number: folioNumber,
    }));
    await supabasePos.from('pos_account_items').insert(inserts);
    await deductStockOnSale(
      items.map(i => ({ product_name: i.name, quantity: i.quantity })),
      { spot: activeSpot?.label, folio: folioNumber }
    );

    const { data: fullAcc } = await supabasePos.from('pos_accounts').select('*, pos_account_items(*)').eq('id', accountId).maybeSingle();

    setSendingRound(false);
    setItems([]);
    setRoundSuccess(`Ronda #${String(folioNumber).padStart(2, '0')} enviada · MXN$${itemTotal.toFixed(2)}`);
    await fetchOpenAccounts();

    if (fullAcc) {
      const roundItems = inserts.map((ins, idx) => ({
        id: idx, account_id: accountId, product_name: ins.product_name, size: ins.size ?? undefined,
        quantity: ins.quantity, unit_price: ins.unit_price, folio_number: ins.folio_number, created_at: new Date().toISOString(),
      })) as PosAccountItem[];
      setPrintData({ account: fullAcc as PosAccount, items: roundItems, mode: 'comanda', folioNumber });
    }
  };

  const handleOpenCloseModal = async (acc: OpenAccount) => {
    // Obtener total actualizado
    const { data: itemsData } = await supabasePos
      .from('pos_account_items')
      .select('unit_price, quantity')
      .eq('account_id', acc.id);
    const total = (itemsData ?? []).reduce((s: number, i: { unit_price: number; quantity: number }) => s + i.unit_price * i.quantity, 0);
    setAccountTotal(total);
    setClosingAccount(acc);
    setPaymentMethod('cash');
    setSplitCount(1);
    setClabeCopied(false);
    setTipAmount('');
  };

  const cardFee = (paymentMethod === 'credit_card' || paymentMethod === 'debit_card') ? accountTotal * CARD_FEE_RATE : 0;
  const tip = parseFloat(tipAmount) || 0;
  const grandTotal = accountTotal + cardFee + tip;
  const perPerson = splitCount > 1 ? grandTotal / splitCount : grandTotal;

  const handleConfirmClose = async () => {
    if (!closingAccount) return;
    setClosingLoading(true);

    // Si había items nuevos sin enviar, enviarlos primero
    if (activeSpotId && activeAccount?.id === closingAccount.id && items.length > 0) {
      const newFolio = closingAccount.folio_counter + 1;
      await supabasePos.from('pos_accounts').update({ folio_counter: newFolio }).eq('id', closingAccount.id);
      const inserts = items.map(item => ({
        account_id: closingAccount.id, product_name: item.name, size: item.note || null,
        quantity: item.quantity, unit_price: item.price, folio_number: newFolio,
      }));
      await supabasePos.from('pos_account_items').insert(inserts);
    }

    const { error: paymentError } = await supabasePos.from('pos_payments').insert({
      account_id: closingAccount.id, payment_method: paymentMethod,
      subtotal: accountTotal, card_fee: cardFee, tip: tip, total: grandTotal, split_count: splitCount,
    });
    if (paymentError) {
      setClosingLoading(false);
      console.error('Payment error:', paymentError);
      return;
    }

    const { error: accountError } = await supabasePos.from('pos_accounts').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', closingAccount.id);
    if (accountError) {
      setClosingLoading(false);
      console.error('Account close error:', accountError);
      return;
    }

    // ===== PUNTOS DE LEALTAD =====
    let resolvedCustId: number | null = closingAccount.customer_id ?? null;
    const custName = closingAccount.customer_name?.trim();
    const custPhone = closingAccount.customer_phone?.trim();

    // Si no hay customer_id, buscar primero por teléfono (más preciso)
    if (!resolvedCustId && custPhone) {
      const cleanPhone = custPhone.replace(/\D/g, '');
      if (cleanPhone.length >= 7) {
        const { data: foundByPhone } = await supabasePos
          .from('pos_customers')
          .select('id, name')
          .ilike('phone', `%${cleanPhone.slice(-10)}%`)
          .maybeSingle();
        if (foundByPhone?.id) resolvedCustId = foundByPhone.id;
      }
    }

    // Si no hay, buscar por nombre exacto primero, luego parcial
    if (!resolvedCustId && custName) {
      // Búsqueda exacta
      const { data: foundExact } = await supabasePos
        .from('pos_customers')
        .select('id')
        .ilike('name', custName)
        .maybeSingle();
      if (foundExact?.id) {
        resolvedCustId = foundExact.id;
      } else {
        // Búsqueda parcial como fallback
        const { data: foundByName } = await supabasePos
          .from('pos_customers')
          .select('id')
          .ilike('name', `%${custName}%`)
          .maybeSingle();
        if (foundByName?.id) resolvedCustId = foundByName.id;
      }
    }

    if (resolvedCustId) {
      // Leer puntos actuales
      const { data: custData } = await supabasePos
        .from('pos_customers')
        .select('total_spent, loyalty_points')
        .eq('id', resolvedCustId)
        .maybeSingle();
      const prevTotal = Number(custData?.total_spent ?? 0);
      const prevPoints = Number(custData?.loyalty_points ?? 0);
      const newTotal = prevTotal + grandTotal;
      const pointsEarned = Math.floor(grandTotal / 100);
      const newPoints = prevPoints + pointsEarned;

      await supabasePos
        .from('pos_customers')
        .update({
          total_spent: newTotal,
          loyalty_points: newPoints,
          last_visit: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', resolvedCustId);

      // Si la cuenta no tenía customer_id vinculado, guardarlo
      if (!closingAccount.customer_id) {
        await supabasePos
          .from('pos_accounts')
          .update({ customer_id: resolvedCustId })
          .eq('id', closingAccount.id);
      }

      // Registrar ajuste de puntos
      if (pointsEarned > 0) {
        await supabasePos.from('loyalty_point_adjustments').insert({
          customer_id: resolvedCustId,
          delta: pointsEarned,
          points_before: prevPoints,
          points_after: newPoints,
          reason: `Cierre de cuenta (QuickSale) — ${closingAccount.spot} — Total MXN$${grandTotal.toFixed(2)} · Pago: ${PAYMENT_OPTIONS.find(p => p.id === paymentMethod)?.label ?? paymentMethod}`,
          adjusted_by: 'pos_auto',
        });
      }

      // Registrar evento
      await supabasePos.from('pos_account_events').insert({
        account_id: closingAccount.id,
        customer_id: resolvedCustId,
        event_type: 'account_closed',
        description: `Cuenta cerrada (QuickSale) — MXN$${grandTotal.toFixed(2)} · ${PAYMENT_OPTIONS.find(p => p.id === paymentMethod)?.label ?? paymentMethod}${pointsEarned > 0 ? ` · +${pointsEarned} pts (total: ${newPoints})` : ''}`,
        metadata: {
          spot: closingAccount.spot,
          area: closingAccount.area,
          total: grandTotal,
          payment_method: PAYMENT_OPTIONS.find(p => p.id === paymentMethod)?.label ?? paymentMethod,
          split_count: splitCount,
          points_earned: pointsEarned,
          loyalty_points_before: prevPoints,
          loyalty_points_after: newPoints,
          closed_from: 'admin_quicksale',
        },
      });
    } else {
      // Cliente no encontrado — registrar evento de debug
      await supabasePos.from('pos_account_events').insert({
        account_id: closingAccount.id,
        event_type: 'account_closed',
        description: `Cuenta cerrada (QuickSale) — MXN$${grandTotal.toFixed(2)} · ${PAYMENT_OPTIONS.find(p => p.id === paymentMethod)?.label ?? paymentMethod} · ⚠️ Sin cliente vinculado (no se sumaron puntos)`,
        metadata: {
          spot: closingAccount.spot,
          area: closingAccount.area,
          total: grandTotal,
          payment_method: PAYMENT_OPTIONS.find(p => p.id === paymentMethod)?.label ?? paymentMethod,
          split_count: splitCount,
          customer_name: custName ?? null,
          customer_phone: custPhone ?? null,
          customer_id_attempted: closingAccount.customer_id ?? null,
          loyalty_error: 'Cliente no encontrado en pos_customers',
          closed_from: 'admin_quicksale',
        },
      });
    }
    // ===== FIN PUNTOS DE LEALTAD =====

    const { data: fullAccount } = await supabasePos.from('pos_accounts').select('*, pos_account_items(*)').eq('id', closingAccount.id).maybeSingle();

    setClosingLoading(false);
    setSuccessMsg(`Cuenta cerrada · ${closingAccount.spot} · MXN$${grandTotal.toFixed(2)}`);
    setClosingAccount(null);

    if (activeSpotId) {
      const spot = SPOTS.find(s => s.id === activeSpotId);
      if (spot && spot.label === closingAccount.spot && spot.area === closingAccount.area) {
        setActiveSpotId(null);
        setItems([]);
        setRoundSuccess(null);
      }
    }

    if (fullAccount) {
      setPrintData({ account: fullAccount as PosAccount, items: (fullAccount.pos_account_items ?? []) as PosAccountItem[], paymentMethod, splitCount, total: grandTotal, cardFee, tip, mode: 'cuenta' });
    }

    await fetchOpenAccounts();
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const copyClabe = () => {
    navigator.clipboard.writeText(TRANSFER_DATA.clabe);
    setClabeCopied(true);
    setTimeout(() => setClabeCopied(false), 2000);
  };

  return (
    <div className="flex gap-4 h-full min-h-0">

      {/* ══════════ IZQUIERDA: Mapa de mesas ══════════ */}
      <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-y-auto pr-1">

        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2">
            <i className="ri-check-double-line text-green-600" />{successMsg}
          </div>
        )}

        {/* Leyenda */}
        <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gray-200 inline-block" />Libre</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-400 inline-block" />Ocupada</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-teal-400 inline-block" />Para Llevar</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />Seleccionada</span>
          <span className="ml-auto flex items-center gap-2">
            <span className="flex items-center gap-1 text-green-600 font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              En vivo
            </span>
            <span className="text-gray-400">{openAccounts.length} cuenta{openAccounts.length !== 1 ? 's' : ''} abiertas</span>
          </span>
        </div>

        {loadingAccounts ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          AREA_ORDER.map(area => {
            const spots = SPOTS.filter(s => s.area === area);
            const isLlevar = area === 'llevar';
            const areaColor = isLlevar
              ? { bg: 'bg-teal-50', border: 'border-teal-200', header: 'bg-teal-100 border-teal-200', icon: 'ri-shopping-bag-3-line text-teal-600', text: 'text-teal-700' }
              : { bg: 'bg-white', border: 'border-gray-200', header: 'bg-gray-50 border-gray-100', icon: area === 'principal' ? 'ri-store-2-line text-amber-500' : 'ri-cloud-line text-gray-400', text: 'text-gray-700' };

            return (
              <div key={area} className={`rounded-2xl border overflow-hidden ${areaColor.bg} ${areaColor.border}`}>
                {/* Area header */}
                <div className={`px-4 py-2.5 border-b flex items-center justify-between ${areaColor.header}`}>
                  <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 ${areaColor.text}`}>
                    <i className={`${areaColor.icon}`} />
                    {AREA_LABELS[area]}
                    {isLlevar && <span className="ml-1 bg-teal-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">Domicilio / Ventanilla</span>}
                  </h3>
                  <span className="text-xs text-gray-400">
                    {spots.filter(s => occupiedMap.has(s.id)).length}/{spots.length} activos
                  </span>
                </div>

                {/* Spots grid */}
                <div className="p-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {spots.map(spot => {
                    const acc = occupiedMap.get(spot.id);
                    const isOccupied = !!acc;
                    const isActive = activeSpotId === spot.id;

                    const btnBase = isActive
                      ? isLlevar
                        ? 'bg-teal-500 border-teal-500 text-white shadow-md scale-105'
                        : 'bg-amber-500 border-amber-500 text-white shadow-md scale-105'
                      : isOccupied
                        ? isLlevar
                          ? 'bg-teal-100 border-teal-400 text-teal-800 hover:bg-teal-200 hover:scale-105'
                          : 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100 hover:scale-105'
                        : isLlevar
                          ? 'bg-white border-teal-200 text-teal-600 hover:bg-teal-50 hover:border-teal-400 hover:scale-105'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-amber-50 hover:border-amber-300 hover:scale-105';

                    const dotColor = isLlevar ? 'bg-teal-500' : 'bg-rose-400';
                    const iconName = isLlevar ? 'ri-shopping-bag-line'
                      : spot.label.includes('Barra') ? 'ri-cup-line'
                      : spot.label.includes('Sillón') ? 'ri-sofa-line'
                      : spot.label.includes('Periquera') ? 'ri-bar-chart-horizontal-line'
                      : 'ri-layout-grid-line';

                    return (
                      <button
                        key={spot.id}
                        onClick={() => handleSelectSpot(spot.id)}
                        className={`relative flex flex-col items-center justify-center p-2.5 rounded-xl border-2 cursor-pointer transition-all min-h-[72px] ${btnBase}`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center mb-1 ${
                          isActive ? 'bg-white/20' : isOccupied ? (isLlevar ? 'bg-teal-200' : 'bg-rose-100') : 'bg-gray-100'
                        }`}>
                          <i className={`text-sm ${iconName} ${
                            isActive ? 'text-white' : isOccupied ? (isLlevar ? 'text-teal-600' : 'text-rose-500') : (isLlevar ? 'text-teal-400' : 'text-gray-400')
                          }`} />
                        </div>
                        <span className="text-xs font-bold leading-tight text-center">{spot.label}</span>
                        {isOccupied && acc && (
                          <span className={`text-xs mt-0.5 font-semibold ${
                            isActive ? 'text-white/80' : isLlevar ? 'text-teal-700' : 'text-rose-500'
                          }`}>
                            R{acc.folio_counter} · MXN${(acc.total ?? 0).toFixed(0)}
                          </span>
                        )}
                        {isOccupied && !isActive && (
                          <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${dotColor}`} />
                        )}
                        {!isOccupied && isLlevar && (
                          <span className="text-xs text-teal-300 mt-0.5">libre</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ══════════ DERECHA: Panel de pedido ══════════ */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">

        {activeSpot ? (
          <>
            {/* Header mesa/llevar seleccionada */}
            {(() => {
              const isLlevar = activeSpot.area === 'llevar';
              const headerBg = isLlevar
                ? (activeAccount ? 'bg-teal-50 border border-teal-300' : 'bg-teal-50 border border-teal-200')
                : (activeAccount ? 'bg-rose-50 border border-rose-200' : 'bg-amber-50 border border-amber-200');
              const iconColor = isLlevar ? 'bg-teal-100' : (activeAccount ? 'bg-rose-100' : 'bg-amber-100');
              const iconName = isLlevar ? 'ri-shopping-bag-3-line text-teal-600' : (activeAccount ? 'ri-user-voice-line text-rose-600' : 'ri-add-circle-line text-amber-600');
              const roundBtnActive = isLlevar ? 'bg-teal-500 text-white border-teal-500' : 'bg-rose-500 text-white border-rose-500';
              const roundBtnInactive = isLlevar ? 'bg-white text-teal-700 border-teal-200 hover:border-teal-400' : 'bg-white text-rose-600 border-rose-200 hover:border-rose-400';
              const inputBorder = isLlevar ? 'border-teal-200 focus:border-teal-500' : 'border-amber-200 focus:border-amber-500';

              return (
                <div className={`rounded-2xl p-4 ${headerBg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconColor}`}>
                        <i className={`text-sm ${iconName}`} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{activeSpot.label}</p>
                        <p className="text-xs text-gray-500">{AREA_LABELS[activeSpot.area as Area]}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setActiveSpotId(null); setItems([]); setRoundSuccess(null); }}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/10 cursor-pointer transition-colors"
                    >
                      <i className="ri-close-line text-gray-500 text-sm" />
                    </button>
                  </div>

                  {/* Campos nombre/teléfono — siempre visibles para Llevar, solo en nueva cuenta para mesas */}
                  {(isLlevar || !activeAccount) && (
                    <div className={`grid gap-2 mb-2 ${isLlevar ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      <input
                        type="text"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        placeholder={isLlevar ? 'Nombre del cliente *' : 'Nombre (opcional)'}
                        className={`w-full px-2 py-1.5 bg-white border rounded-lg text-xs focus:outline-none ${inputBorder}`}
                      />
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                        placeholder={isLlevar ? 'Teléfono / WhatsApp *' : 'Tel. (opcional)'}
                        className={`w-full px-2 py-1.5 bg-white border rounded-lg text-xs focus:outline-none ${inputBorder}`}
                      />
                    </div>
                  )}

                  {activeAccount && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{activeAccount.folio_counter} ronda{activeAccount.folio_counter !== 1 ? 's' : ''} · MXN${(activeAccount.total ?? 0).toFixed(2)}</span>
                        {activeAccount.customer_name && <span className="font-medium text-gray-700 truncate ml-2">{activeAccount.customer_name}</span>}
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setNewRound(false)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold cursor-pointer border transition-all whitespace-nowrap ${
                            !newRound ? roundBtnActive : roundBtnInactive
                          }`}
                        >
                          Ronda #{activeAccount.folio_counter}
                        </button>
                        <button
                          onClick={() => setNewRound(true)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold cursor-pointer border transition-all whitespace-nowrap ${
                            newRound ? roundBtnActive : roundBtnInactive
                          }`}
                        >
                          Nueva #{activeAccount.folio_counter + 1}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Round success */}
            {roundSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <i className="ri-check-double-line text-green-600 flex-shrink-0" />
                <span className="text-xs font-bold text-green-800 flex-1">{roundSuccess}</span>
                <button onClick={() => setRoundSuccess(null)} className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-green-100 cursor-pointer">
                  <i className="ri-close-line text-green-500 text-xs" />
                </button>
              </div>
            )}

            {/* Menú picker */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex-1" style={{ minHeight: '360px' }}>
              <QuickSaleMenuPicker items={items} onChange={setItems} compact />
            </div>

            {/* Cart */}
            {items.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">Esta ronda</span>
                  <span className="text-xs font-bold text-amber-600">MXN${itemTotal.toFixed(2)}</span>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  <QuickSaleCart
                    items={items}
                    onUpdateQty={(id, qty) => setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i))}
                    onRemove={id => setItems(prev => prev.filter(i => i.id !== id))}
                  />
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="space-y-2">
              {items.length > 0 && (
                <button
                  onClick={handleSendRound}
                  disabled={sendingRound}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
                >
                  {sendingRound ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Enviando...
                    </span>
                  ) : (
                    <><i className="ri-send-plane-line mr-2" />Enviar Ronda · MXN${itemTotal.toFixed(2)}</>
                  )}
                </button>
              )}

              {activeAccount && (
                <button
                  onClick={() => handleOpenCloseModal(activeAccount)}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-xl font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
                >
                  <i className="ri-close-circle-line mr-2" />
                  Cobrar y Cerrar Cuenta · MXN${((activeAccount.total ?? 0) + itemTotal).toFixed(2)}
                </button>
              )}

              <button
                onClick={() => { setActiveSpotId(null); setItems([]); setRoundSuccess(null); }}
                className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
              >
                <i className="ri-arrow-left-line mr-1" />Ir a otra mesa
              </button>
            </div>
          </>
        ) : (
          /* Estado vacío del panel */
          <div className="bg-white rounded-2xl border border-gray-200 flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mb-4">
              <i className="ri-map-pin-line text-amber-600 text-2xl" />
            </div>
            <p className="font-bold text-gray-800 text-sm mb-1">Toca una mesa</p>
            <p className="text-xs text-gray-400">Selecciona una mesa del mapa para agregar productos o cobrar</p>

            {/* Mini resumen de cuentas abiertas */}
            {openAccounts.length > 0 && (
              <div className="mt-6 w-full space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Abiertas ahora</p>
                {openAccounts.map(acc => {
                  const spot = SPOTS.find(s => s.label === acc.spot && s.area === acc.area);
                  return (
                    <button
                      key={acc.id}
                      onClick={() => spot && handleSelectSpot(spot.id)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-100 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 bg-rose-400 rounded-full flex-shrink-0" />
                        <span className="text-xs font-bold text-gray-800 truncate">{acc.spot}</span>
                        <span className="text-xs text-gray-400 truncate">{AREA_LABELS[acc.area as Area]?.split(' ')[0]}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-rose-600 font-bold">MXN${(acc.total ?? 0).toFixed(0)}</span>
                        <i className="ri-arrow-right-s-line text-gray-400 text-sm" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════ MODAL CERRAR CUENTA ══════════ */}
      {closingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setClosingAccount(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between rounded-t-2xl">
              <div>
                <h3 className="font-bold text-gray-900">Cobrar y Cerrar</h3>
                <p className="text-xs text-gray-500">{closingAccount.spot} · {AREA_LABELS[closingAccount.area as Area]}</p>
              </div>
              <button onClick={() => setClosingAccount(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer">
                <i className="ri-close-line text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Total */}
              <div className="bg-gray-900 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-widest">Total consumo</p>
                  <p className="text-3xl font-black text-amber-400 mt-1">MXN${accountTotal.toFixed(2)}</p>
                  <p className="text-gray-500 text-xs mt-1">{closingAccount.folio_counter} ronda{closingAccount.folio_counter !== 1 ? 's' : ''}</p>
                </div>
                {closingAccount.customer_name && (
                  <div className="text-right">
                    <p className="text-gray-400 text-xs">Cliente</p>
                    <p className="text-white text-sm font-bold">{closingAccount.customer_name}</p>
                  </div>
                )}
              </div>

              {/* Forma de pago */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Forma de Pago</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setPaymentMethod(opt.id)}
                      className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 cursor-pointer transition-all whitespace-nowrap ${
                        paymentMethod === opt.id
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-gray-200 text-gray-600 hover:border-amber-300'
                      }`}
                    >
                      <i className={`${opt.icon} text-lg ${opt.color}`} />
                      <span className="text-xs font-semibold">{opt.label}</span>
                    </button>
                  ))}
                </div>
                {(paymentMethod === 'credit_card' || paymentMethod === 'debit_card') && (
                  <p className="text-xs text-rose-600 mt-2 font-medium">
                    <i className="ri-information-line mr-1" />+3% terminal: MXN${cardFee.toFixed(2)}
                  </p>
                )}
                {paymentMethod === 'transfer' && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
                    <div className="px-3 py-2 bg-amber-100 border-b border-amber-200 flex items-center gap-2">
                      <i className="ri-bank-line text-amber-700 text-sm" />
                      <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Datos para Transferencia</span>
                    </div>
                    <div className="px-3 py-2.5 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-amber-700">Banco</span><span className="font-bold text-amber-900">{TRANSFER_DATA.bank}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-amber-700">Titular</span><span className="font-bold text-amber-900">{TRANSFER_DATA.name}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-amber-700">CLABE</span>
                        <button type="button" onClick={copyClabe} className="flex items-center gap-1.5 bg-white border border-amber-300 px-2 py-1 rounded-lg cursor-pointer hover:bg-amber-50">
                          <span className="font-mono font-bold text-amber-900">{TRANSFER_DATA.clabe}</span>
                          <i className={`text-amber-500 text-xs ${clabeCopied ? 'ri-check-line' : 'ri-file-copy-line'}`} />
                        </button>
                      </div>
                      {clabeCopied && <p className="text-xs text-green-600 font-semibold text-center"><i className="ri-check-line mr-1" />CLABE copiada</p>}
                      <div className="flex justify-between text-xs pt-1 border-t border-amber-200">
                        <span className="text-amber-700">Comprobante</span><span className="font-bold text-amber-900">WA {TRANSFER_DATA.whatsapp}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Propina */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Propina (opcional)</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">$</span>
                  <input
                    type="number"
                    value={tipAmount}
                    onChange={e => setTipAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-amber-500 bg-white"
                  />
                </div>
                {tip > 0 && (
                  <p className="text-xs text-emerald-600 mt-1 font-medium">
                    <i className="ri-heart-3-line mr-1" />+MXN${tip.toFixed(2)} propina
                  </p>
                )}
              </div>

              {/* Dividir */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Dividir Cuenta</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setSplitCount(Math.max(1, splitCount - 1))} className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 hover:border-amber-500 hover:text-amber-600 cursor-pointer transition-colors">
                    <i className="ri-subtract-line" />
                  </button>
                  <span className="text-lg font-bold text-gray-900 w-24 text-center">{splitCount === 1 ? '1 sola' : `${splitCount} personas`}</span>
                  <button onClick={() => setSplitCount(splitCount + 1)} className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 hover:border-amber-500 hover:text-amber-600 cursor-pointer transition-colors">
                    <i className="ri-add-line" />
                  </button>
                </div>
              </div>

              {/* Total final */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-600"><span>Consumo</span><span>MXN${accountTotal.toFixed(2)}</span></div>
                {cardFee > 0 && <div className="flex justify-between text-sm text-rose-600"><span>Cargo terminal (3%)</span><span>+MXN${cardFee.toFixed(2)}</span></div>}
                {tip > 0 && <div className="flex justify-between text-sm text-emerald-600"><span>Propina</span><span>+MXN${tip.toFixed(2)}</span></div>}
                <div className="flex justify-between text-xl font-black text-gray-900 pt-2 border-t border-gray-200">
                  <span>TOTAL</span><span className="text-amber-600">MXN${grandTotal.toFixed(2)}</span>
                </div>
                {splitCount > 1 && (
                  <div className="flex justify-between text-sm font-bold text-green-700 bg-green-50 rounded-lg px-3 py-2">
                    <span>Por persona ({splitCount})</span><span>MXN${perPerson.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setClosingAccount(null)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmClose}
                  disabled={closingLoading}
                  className="flex-1 py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold cursor-pointer whitespace-nowrap"
                >
                  {closingLoading ? (
                    <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Cerrando...</span>
                  ) : (
                    <><i className="ri-check-line mr-1" />Confirmar Cobro</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print */}
      {printData && (
        <BluetoothPrinterProvider>
          <PrintTicketModal
            account={printData.account}
            items={printData.items}
            paymentMethod={printData.paymentMethod}
            splitCount={printData.splitCount}
            total={printData.total}
            cardFee={printData.cardFee}
            tip={printData.tip}
            mode={printData.mode}
            folioNumber={printData.folioNumber}
            onClose={() => setPrintData(null)}
          />
        </BluetoothPrinterProvider>
      )}
    </div>
  );
}