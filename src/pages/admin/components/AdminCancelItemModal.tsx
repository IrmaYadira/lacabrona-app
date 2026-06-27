import { useState, useRef, useEffect, useMemo } from 'react';
import { supabasePos } from '@/pages/pos/supabasePos';
import { sendPushNotification } from '@/hooks/usePushNotifications';
import {
  wingsMenu, bonelessMenu, beerMenu, halfBeersMenu, pacificoBeersMenu,
  ampolletasMenu, nonAlcoholicBeersMenu, micheladaMenu, micheladaConCamaronMenu,
  sidesMenu, hotDogsMenu, burgersMenu, comboMenu, sodasMenu,
  cannedAlcoholicMenu, shotShowsMenu, vasosPreparadosMenu, azulitosMenu, preparadosMenu,
  barrilMenu, cigarettesMenu,
} from '@/mocks/menu';

const ADMIN_PIN = 'Irmabar2016*';

interface AccountItem {
  id: number;
  product_name: string;
  size?: string;
  quantity: number;
  unit_price: number;
  folio_number: number;
}

interface Props {
  accountId: number;
  spot: string;
  items: AccountItem[];
  onClose: () => void;
  onCancelled: () => void;
  initialTab?: Tab;
  targetFolio?: number;
}

type Tab = 'quitar' | 'modificar' | 'pago' | 'agregar';
type Step = 'main' | 'confirm-pin' | 'done';

type PayMethod = 'cash' | 'transfer' | 'credit_card' | 'debit_card';

const PAYMENT_OPTIONS: { id: PayMethod; label: string; icon: string; color: string }[] = [
  { id: 'cash', label: 'Efectivo', icon: 'ri-money-dollar-circle-line', color: 'text-green-600' },
  { id: 'transfer', label: 'Transferencia', icon: 'ri-bank-line', color: 'text-amber-600' },
  { id: 'credit_card', label: 'Tarjeta Crédito', icon: 'ri-bank-card-line', color: 'text-rose-600' },
  { id: 'debit_card', label: 'Tarjeta Débito', icon: 'ri-bank-card-2-line', color: 'text-indigo-600' },
];

const TAB_CONFIG: { id: Tab; label: string; icon: string; color: string; activeColor: string }[] = [
  { id: 'quitar', label: 'Quitar Ítems', icon: 'ri-delete-bin-line', color: 'text-gray-500', activeColor: 'text-red-600 border-red-500' },
  { id: 'modificar', label: 'Modificar Cant.', icon: 'ri-edit-line', color: 'text-gray-500', activeColor: 'text-amber-600 border-amber-500' },
  { id: 'pago', label: 'Cambiar Pago', icon: 'ri-bank-card-line', color: 'text-gray-500', activeColor: 'text-indigo-600 border-indigo-500' },
  { id: 'agregar', label: 'Agregar Prod.', icon: 'ri-add-circle-line', color: 'text-gray-500', activeColor: 'text-green-600 border-green-500' },
];

// ─── Menú para el tab Agregar ───
interface MenuItem {
  id: string;
  name: string;
  price: number;
}

interface MenuCartEntry {
  menuItem: MenuItem;
  quantity: number;
  note: string;
}

function buildMenuCategories(): { label: string; icon: string; items: MenuItem[] }[] {
  const wingItems: MenuItem[] = [
    { id: 'wing-media', name: 'Alitas Media Orden (5 pzas)', price: wingsMenu.prices['Media Orden (5 pzas)'] },
    { id: 'wing-completa', name: 'Alitas Orden Completa (10 pzas)', price: wingsMenu.prices['Orden Completa (10 pzas)'] },
    { id: 'boneless-media', name: 'Boneless Media Orden (5 pzas)', price: bonelessMenu.prices['Media Orden (5 pzas)'] },
    { id: 'boneless-completa', name: 'Boneless Orden Completa (10 pzas)', price: bonelessMenu.prices['Orden Completa (10 pzas)'] },
  ];

  return [
    { label: 'Alitas & Boneless', icon: 'ri-fire-line', items: wingItems },
    { label: 'Cervezas Mega', icon: 'ri-goblet-line', items: beerMenu.map(i => ({ id: String(i.id), name: i.name, price: i.price })) },
    {
      label: 'Cervezas Medio', icon: 'ri-goblet-line', items: [
        { id: '7999', name: 'CUBETA 10 Cervezas Corona de Medio', price: 350 },
        ...halfBeersMenu.map(i => ({ id: `half-${i.id}`, name: i.name, price: i.price })),
      ]
    },
    { label: 'Pacífico', icon: 'ri-goblet-line', items: pacificoBeersMenu.map(i => ({ id: `pac-${i.id}`, name: i.name, price: i.price })) },
    { label: 'Ampolletas', icon: 'ri-goblet-line', items: ampolletasMenu.map(i => ({ id: `amp-${i.id}`, name: i.name, price: i.price })) },
    { label: 'Sin Alcohol', icon: 'ri-leaf-line', items: nonAlcoholicBeersMenu.map(i => ({ id: `na-${i.id}`, name: i.name, price: i.price })) },
    {
      label: 'Micheladas', icon: 'ri-cup-line', items: [
        { id: String(micheladaMenu.id), name: micheladaMenu.name, price: micheladaMenu.price },
        { id: String(micheladaConCamaronMenu.id), name: micheladaConCamaronMenu.name, price: micheladaConCamaronMenu.price },
      ]
    },
    { label: 'Shots', icon: 'ri-flask-line', items: shotShowsMenu.map(i => ({ id: `shot-${i.id}`, name: i.name, price: i.price })) },
    {
      label: 'Preparados', icon: 'ri-cup-fill', items: preparadosMenu.flatMap(i => [
        { id: `prep-${i.id}-sencillo`, name: `${i.name} (Sencillo)`, price: i.basePrice },
        { id: `prep-${i.id}-doble`, name: `${i.name} (Doble)`, price: i.basePrice + i.showPrice },
      ])
    },
    { label: 'Azulitos', icon: 'ri-cup-line', items: azulitosMenu.map(i => ({ id: `azul-${i.id}`, name: i.name, price: i.price })) },
    { label: 'Vasos Preparados', icon: 'ri-cup-line', items: vasosPreparadosMenu.map(i => ({ id: `vaso-${i.id}`, name: i.name, price: i.price })) },
    { label: 'Latas Alcohólicas', icon: 'ri-beer-line', items: cannedAlcoholicMenu.map(i => ({ id: `can-${i.id}`, name: i.name, price: i.price })) },
    { label: 'Barril', icon: 'ri-goblet-fill', items: barrilMenu.map(i => ({ id: `barril-${i.id}`, name: i.name, price: i.price })) },
    { label: 'Refrescos & Bebidas', icon: 'ri-cup-line', items: sodasMenu.map(i => ({ id: `soda-${i.id}`, name: i.name, price: i.price })) },
    { label: 'Hamburguesas', icon: 'ri-restaurant-line', items: burgersMenu.map(i => ({ id: `burg-${i.id}`, name: i.name, price: i.price })) },
    { label: 'Hot Dogs', icon: 'ri-restaurant-line', items: hotDogsMenu.map(i => ({ id: `hdog-${i.id}`, name: i.name, price: i.price })) },
    { label: 'Botanas & Lados', icon: 'ri-restaurant-line', items: sidesMenu.map(i => ({ id: `side-${i.id}`, name: i.name, price: i.price })) },
    { label: 'Combos', icon: 'ri-gift-line', items: comboMenu.map(i => ({ id: `combo-${i.id}`, name: i.name, price: i.price })) },
    { label: 'Cigarros', icon: 'ri-haze-line', items: cigarettesMenu.map(i => ({ id: `cig-${i.id}`, name: i.name, price: i.price })) },
  ];
}

const ALL_MENU_CATEGORIES = buildMenuCategories();

export default function AdminCancelItemModal({ accountId, spot, items, onClose, onCancelled, initialTab, targetFolio }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'quitar');
  const [step, setStep] = useState<Step>('main');

  // — Quitar ítems state —
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [cancelQtys, setCancelQtys] = useState<Record<number, number>>({});

  // — Modificar cantidades state —
  const [modQtys, setModQtys] = useState<Record<number, number>>(() =>
    Object.fromEntries(items.map(i => [i.id, i.quantity]))
  );

  // — Cambiar pago state —
  const [newPayMethod, setNewPayMethod] = useState<PayMethod>('cash');

  // — Agregar productos state —
  const menuCategories = useMemo(() => ALL_MENU_CATEGORIES, []);
  const [agregarActiveCat, setAgregarActiveCat] = useState(0);
  const [agregarSearch, setAgregarSearch] = useState('');
  const [agregarCart, setAgregarCart] = useState<MenuCartEntry[]>([]);
  const [agregarNoteItem, setAgregarNoteItem] = useState<MenuItem | null>(null);
  const [agregarNoteText, setAgregarNoteText] = useState('');
  const [agregarMode, setAgregarMode] = useState<'current' | 'new'>('current');
  const currentFolioNum = items.reduce((max, i) => Math.max(max, i.folio_number), 0);

  const agregarCurrentItems = agregarSearch.trim()
    ? menuCategories.flatMap(c => c.items).filter(i =>
        i.name.toLowerCase().includes(agregarSearch.toLowerCase())
      )
    : (menuCategories[agregarActiveCat]?.items ?? []);

  const agregarCartTotal = agregarCart.reduce((s, e) => s + e.menuItem.price * e.quantity, 0);
  const agregarCartCount = agregarCart.reduce((s, e) => s + e.quantity, 0);

  const handleAgregarSelect = (item: MenuItem) => {
    setAgregarNoteItem(item);
    setAgregarNoteText('');
  };

  const handleAgregarConfirmNote = () => {
    if (!agregarNoteItem) return;
    const key = `${agregarNoteItem.id}-${agregarNoteText}`;
    setAgregarCart(prev => {
      const existing = prev.find(e => `${e.menuItem.id}-${e.note}` === key);
      if (existing) {
        return prev.map(e => `${e.menuItem.id}-${e.note}` === key ? { ...e, quantity: e.quantity + 1 } : e);
      }
      return [...prev, { menuItem: agregarNoteItem, quantity: 1, note: agregarNoteText.trim() }];
    });
    setAgregarNoteItem(null);
  };

  const updateAgregarCartQty = (idx: number, qty: number) => {
    if (qty <= 0) {
      setAgregarCart(prev => prev.filter((_, i) => i !== idx));
    } else {
      setAgregarCart(prev => prev.map((e, i) => i === idx ? { ...e, quantity: qty } : e));
    }
  };

  // — PIN / shared —
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [shake, setShake] = useState(false);
  const [saving, setSaving] = useState(false);
  const [doneMessage, setDoneMessage] = useState('');
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'confirm-pin') {
      setTimeout(() => pinRef.current?.focus(), 100);
    }
  }, [step]);

  const folios = [...new Set(items.map(i => i.folio_number))].sort((a, b) => a - b);

  // ─── Quitar ítems helpers ───
  const toggleItem = (itemId: number, maxQty: number) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
        setCancelQtys(q => { const n = { ...q }; delete n[itemId]; return n; });
      } else {
        next.add(itemId);
        setCancelQtys(q => ({ ...q, [itemId]: maxQty }));
      }
      return next;
    });
  };

  const updateCancelQty = (itemId: number, qty: number, maxQty: number) => {
    setCancelQtys(q => ({ ...q, [itemId]: Math.max(1, Math.min(qty, maxQty)) }));
  };

  const cancelSelectedTotal = items
    .filter(i => selectedItems.has(i.id))
    .reduce((s, i) => s + i.unit_price * (cancelQtys[i.id] ?? i.quantity), 0);

  // ─── Modificar cantidades helpers ───
  const updateModQty = (itemId: number, delta: number) => {
    setModQtys(prev => ({ ...prev, [itemId]: Math.max(1, (prev[itemId] ?? 1) + delta) }));
  };

  const modHasChanges = items.some(i => modQtys[i.id] !== i.quantity);

  // ─── Validar y avanzar al PIN ───
  const handleContinue = () => {
    if (activeTab === 'quitar' && selectedItems.size === 0) return;
    if (activeTab === 'modificar' && !modHasChanges) return;
    if (activeTab === 'agregar' && agregarCart.length === 0) return;
    setPin('');
    setPinError(false);
    setStep('confirm-pin');
  };

  // ─── Confirmar PIN para Agregar ───
  const handleAgregarPinConfirm = async () => {
    if (agregarCart.length === 0) return;

    let folioNumber: number;
    if (targetFolio !== undefined) {
      folioNumber = targetFolio;
    } else if (agregarMode === 'new' || currentFolioNum === 0) {
      folioNumber = currentFolioNum + 1;
      await supabasePos
        .from('pos_accounts')
        .update({ folio_counter: folioNumber, updated_at: new Date().toISOString() })
        .eq('id', accountId);
    } else {
      folioNumber = currentFolioNum;
    }

    const inserts = agregarCart.map(entry => ({
      account_id: accountId,
      product_name: entry.menuItem.name,
      size: entry.note || null,
      quantity: entry.quantity,
      unit_price: entry.menuItem.price,
      folio_number: folioNumber,
    }));

    await supabasePos.from('pos_account_items').insert(inserts);

    // Push notification al cliente
    const folioTotal = agregarCart.reduce((s, e) => s + e.menuItem.price * e.quantity, 0);
    const isAddition = targetFolio !== undefined ? true : !(agregarMode === 'new' || currentFolioNum === 0);
    const prefix = targetFolio !== undefined
      ? 'Se agregó a tu ronda actual 🍺'
      : isAddition
        ? 'Se agregó a tu ronda actual 🍺'
        : 'Nueva ronda agregada 🍗';
    const waPrefix = isAddition
      ? `➕ *AGREGA A RONDA #${String(folioNumber).padStart(2, '0')}*`
      : `🍗 *NUEVA RONDA #${String(folioNumber).padStart(2, '0')}*`;
    sendPushNotification(
      accountId,
      prefix,
      `Ronda #${String(folioNumber).padStart(2, '0')}: ${agregarCart.map(e => `${e.quantity}x ${e.menuItem.name}`).join(', ')} · Subtotal MXN$${folioTotal.toFixed(2)}`,
      { tag: `admin-add-${accountId}-${Date.now()}`, data: { url: `/cuenta?id=${accountId}` } }
    ).catch(() => {});

    // ── Enviar comanda por WhatsApp al bar (igual que el POS) ──
    const barPhone = '5213348567795';
    const backupPhone = '523316108329';

    // Fetch account data para el mensaje
    const { data: acctData } = await supabasePos
      .from('pos_accounts')
      .select('spot, area, customer_name, zona')
      .eq('id', accountId)
      .maybeSingle();

    const acctSpot = acctData?.spot ?? spot;
    const acctArea = acctData?.area ?? '';
    const acctCustomerName = acctData?.customer_name ?? null;
    const acctZona = acctData?.zona ?? null;

    const areaLabels: Record<string, string> = {
      barra: 'Barra', terraza: 'Terraza', salon: 'Salón',
      vip: 'VIP', patio: 'Patio', principal: 'Principal',
    };
    const areaLabel = areaLabels[acctArea] ?? acctArea;

    let waMsg = `${waPrefix}\n`;
    waMsg += `📍 *${acctSpot}* (${areaLabel})${acctZona ? ` · ${acctZona}` : ''}\n`;
    waMsg += `👤 *Admin* agregó productos\n`;
    if (acctCustomerName) waMsg += `👤 *Cliente:* ${acctCustomerName}\n`;
    waMsg += `\n`;
    agregarCart.forEach(e => {
      waMsg += `  • ${e.quantity}x ${e.menuItem.name}`;
      if (e.note) waMsg += ` _(${e.note})_`;
      waMsg += ` — MXN$${(e.menuItem.price * e.quantity).toFixed(2)}\n`;
    });
    waMsg += `\n*Subtotal: MXN$${folioTotal.toFixed(2)}*\n`;
    waMsg += `⏰ ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}\n`;
    waMsg += `\n_La Cabrona POS · Admin_`;

    window.open(`https://wa.me/${barPhone}?text=${encodeURIComponent(waMsg)}`, '_blank');
    setTimeout(() => {
      window.open(`https://wa.me/${backupPhone}?text=${encodeURIComponent(waMsg)}`, '_blank');
    }, 800);

    // Guardar log del ticket enviado
    const ticketDesc = targetFolio !== undefined
      ? `Admin agrega a Ronda #${String(folioNumber).padStart(2, '0')} — ${acctCustomerName || acctSpot}`
      : isAddition
        ? `Admin agrega a Ronda #${String(folioNumber).padStart(2, '0')} — ${acctCustomerName || acctSpot}`
        : `Admin: Nueva Ronda #${String(folioNumber).padStart(2, '0')} — ${acctCustomerName || acctSpot}`;
    await supabasePos.from('pos_account_events').insert({
      account_id: accountId,
      event_type: 'whatsapp_ticket',
      description: ticketDesc,
      metadata: {
        folio_number: folioNumber,
        is_addition: isAddition,
        spot: acctSpot,
        area: acctArea,
        area_label: areaLabel,
        customer_name: acctCustomerName ?? null,
        zona: acctZona ?? null,
        subtotal: folioTotal,
        added_by: 'admin',
        items: agregarCart.map(e => ({
          name: e.menuItem.name,
          quantity: e.quantity,
          unit_price: e.menuItem.price,
          note: e.note || null,
        })),
        message_text: waMsg,
        sent_at: new Date().toISOString(),
      },
    });

    // ── Registrar evento de admin ──
    const rondaDesc = targetFolio !== undefined
      ? `Admin: Agregado ${agregarCart.length} producto${agregarCart.length !== 1 ? 's' : ''} a Ronda #${String(folioNumber).padStart(2, '0')} — Subtotal MXN$${folioTotal.toFixed(2)}`
      : `Admin: Agregado ${agregarCart.length} producto${agregarCart.length !== 1 ? 's' : ''} a Ronda #${String(folioNumber).padStart(2, '0')} — Subtotal MXN$${folioTotal.toFixed(2)}`;
    await supabasePos.from('pos_account_events').insert({
      account_id: accountId,
      event_type: 'item_added_manual',
      description: rondaDesc,
      metadata: {
        folio_number: folioNumber,
        is_new_round: targetFolio !== undefined ? false : (agregarMode === 'new' || currentFolioNum === 0),
        items: agregarCart.map(e => ({ name: e.menuItem.name, quantity: e.quantity, unit_price: e.menuItem.price, note: e.note || null })),
        subtotal: folioTotal,
        added_by: 'admin',
      },
    });

    setAgregarCart([]);
    setAgregarSearch('');
    setAgregarActiveCat(0);
    setDoneMessage(`Se agregaron ${agregarCart.length} producto${agregarCart.length !== 1 ? 's' : ''} a ${spot} — Ronda #${String(folioNumber).padStart(2, '0')} · MXN$${folioTotal.toFixed(2)} · 📱 Comanda enviada al bar`);
  };

  // ─── Confirmar PIN y ejecutar acción ───
  const handleConfirmPin = async () => {
    if (pin !== ADMIN_PIN) {
      setPinError(true);
      setShake(true);
      setTimeout(() => { setPin(''); setShake(false); setPinError(false); }, 700);
      return;
    }

    setSaving(true);

    if (activeTab === 'agregar') {
      await handleAgregarPinConfirm();
      setSaving(false);
      setStep('done');
      return;
    }

    if (activeTab === 'quitar') {
      const toCancel = items.filter(i => selectedItems.has(i.id));
      for (const item of toCancel) {
        const cancelQty = cancelQtys[item.id] ?? item.quantity;
        if (cancelQty >= item.quantity) {
          await supabasePos.from('pos_account_items').delete().eq('id', item.id);
        } else {
          await supabasePos
            .from('pos_account_items')
            .update({ quantity: item.quantity - cancelQty })
            .eq('id', item.id);
        }
      }
      setDoneMessage(`Se quitaron ${selectedItems.size} ítem${selectedItems.size !== 1 ? 's' : ''} de ${spot}`);
    }

    if (activeTab === 'modificar') {
      const changed = items.filter(i => modQtys[i.id] !== i.quantity);
      for (const item of changed) {
        await supabasePos
          .from('pos_account_items')
          .update({ quantity: modQtys[item.id] })
          .eq('id', item.id);
      }
      setDoneMessage(`Se actualizaron las cantidades de ${changed.length} producto${changed.length !== 1 ? 's' : ''}`);
    }

    if (activeTab === 'pago') {
      // Buscar el último pago de esta cuenta y actualizar
      const { data: payments } = await supabasePos
        .from('pos_payments')
        .select('id, subtotal, card_fee')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (payments && payments.length > 0) {
        const pay = payments[0];
        const hasCardFee = newPayMethod === 'credit_card' || newPayMethod === 'debit_card';
        const cardFee = hasCardFee ? pay.subtotal * 0.03 : 0;
        const total = pay.subtotal + cardFee;
        await supabasePos
          .from('pos_payments')
          .update({ payment_method: newPayMethod, card_fee: cardFee, total })
          .eq('id', pay.id);
        setDoneMessage(`Forma de pago actualizada a ${PAYMENT_OPTIONS.find(p => p.id === newPayMethod)?.label}`);
      } else {
        setDoneMessage('No se encontró un pago registrado para esta cuenta');
      }
    }

    setSaving(false);
    setStep('done');
  };

  const canContinue =
    (activeTab === 'quitar' && selectedItems.size > 0) ||
    (activeTab === 'modificar' && modHasChanges) ||
    (activeTab === 'agregar' && agregarCart.length > 0) ||
    activeTab === 'pago';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">

        {/* ── Header ── */}
        <div className="bg-gray-900 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center bg-amber-500 rounded-xl">
              <i className="ri-edit-box-line text-white text-lg" />
            </div>
            <div>
              <h3 className="text-white font-black text-sm">Gestionar Cuenta</h3>
              <p className="text-gray-400 text-xs">{spot}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-700 cursor-pointer transition-colors">
            <i className="ri-close-line text-gray-300" />
          </button>
        </div>

        {/* ── Aviso admin ── */}
        <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-100">
          <p className="text-xs text-amber-700 flex items-center gap-1.5 font-medium">
            <i className="ri-shield-keyhole-line text-amber-500" />
            Acción exclusiva para administrador — se solicitará contraseña
          </p>
        </div>

        {/* ── Tabs ── */}
        {step === 'main' && (
          <div className="flex border-b border-gray-100">
            {TAB_CONFIG.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-semibold border-b-2 cursor-pointer transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? tab.activeColor
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <i className={`${tab.icon} text-base`} />
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* ════════════════════════════════════════
            PASO MAIN
        ════════════════════════════════════════ */}
        {step === 'main' && (
          <>
            {/* ── TAB: QUITAR ÍTEMS ── */}
            {activeTab === 'quitar' && (
              <>
                <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-100 px-1">
                  {items.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-8">Esta cuenta no tiene productos</p>
                  ) : (
                    folios.map(folio => {
                      const folioItems = items.filter(i => i.folio_number === folio);
                      return (
                        <div key={folio}>
                          <div className="px-4 py-2 bg-gray-50 sticky top-0">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                              Ronda #{String(folio).padStart(2, '0')}
                            </span>
                          </div>
                          {folioItems.map(item => {
                            const isSelected = selectedItems.has(item.id);
                            const cancelQty = cancelQtys[item.id] ?? item.quantity;
                            return (
                              <div
                                key={item.id}
                                className={`flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer ${isSelected ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                                onClick={() => toggleItem(item.id, item.quantity)}
                              >
                                <div className={`w-5 h-5 flex items-center justify-center rounded-md border-2 flex-shrink-0 transition-all ${isSelected ? 'bg-red-500 border-red-500' : 'border-gray-300'}`}>
                                  {isSelected && <i className="ri-check-line text-white text-xs" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-semibold leading-tight ${isSelected ? 'text-red-700 line-through' : 'text-gray-900'}`}>
                                    {item.product_name}
                                  </p>
                                  {item.size && <p className="text-xs text-amber-600">{item.size}</p>}
                                  <p className="text-xs text-gray-400">MXN${item.unit_price.toFixed(2)} c/u</p>
                                </div>
                                {isSelected ? (
                                  <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => updateCancelQty(item.id, cancelQty - 1, item.quantity)} className="w-6 h-6 flex items-center justify-center rounded-full border border-red-200 text-red-500 hover:bg-red-100 cursor-pointer">
                                      <i className="ri-subtract-line text-xs" />
                                    </button>
                                    <div className="text-center min-w-[40px]">
                                      <span className="text-sm font-black text-red-600">{cancelQty}</span>
                                      <span className="text-xs text-gray-400">/{item.quantity}</span>
                                    </div>
                                    <button onClick={() => updateCancelQty(item.id, cancelQty + 1, item.quantity)} className="w-6 h-6 flex items-center justify-center rounded-full border border-red-200 text-red-500 hover:bg-red-100 cursor-pointer">
                                      <i className="ri-add-line text-xs" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-sm font-bold text-gray-700 flex-shrink-0">
                                    {item.quantity}x MXN${(item.unit_price * item.quantity).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 space-y-3">
                  {selectedItems.size > 0 && (
                    <div className="flex items-center justify-between text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                      <span className="text-red-700 font-medium">{selectedItems.size} ítem{selectedItems.size !== 1 ? 's' : ''} seleccionado{selectedItems.size !== 1 ? 's' : ''}</span>
                      <span className="text-red-700 font-black">-MXN${cancelSelectedTotal.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors whitespace-nowrap">
                      Cerrar
                    </button>
                    <button
                      disabled={selectedItems.size === 0}
                      onClick={handleContinue}
                      className="flex-1 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <i className="ri-shield-keyhole-line mr-1.5" />
                      Continuar
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── TAB: MODIFICAR CANTIDADES ── */}
            {activeTab === 'modificar' && (
              <>
                <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-100 px-1">
                  {items.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-8">Esta cuenta no tiene productos</p>
                  ) : (
                    folios.map(folio => {
                      const folioItems = items.filter(i => i.folio_number === folio);
                      return (
                        <div key={folio}>
                          <div className="px-4 py-2 bg-gray-50 sticky top-0">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                              Ronda #{String(folio).padStart(2, '0')}
                            </span>
                          </div>
                          {folioItems.map(item => {
                            const currentQty = modQtys[item.id] ?? item.quantity;
                            const changed = currentQty !== item.quantity;
                            return (
                              <div key={item.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${changed ? 'bg-amber-50' : ''}`}>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 leading-tight">{item.product_name}</p>
                                  {item.size && <p className="text-xs text-amber-600">{item.size}</p>}
                                  <p className="text-xs text-gray-400">MXN${item.unit_price.toFixed(2)} c/u</p>
                                </div>
                                {changed && (
                                  <span className="text-xs text-amber-600 font-bold flex-shrink-0">
                                    era {item.quantity}
                                  </span>
                                )}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <button
                                    onClick={() => updateModQty(item.id, -1)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 hover:border-amber-400 hover:text-amber-600 text-gray-500 cursor-pointer transition-colors"
                                  >
                                    <i className="ri-subtract-line text-sm" />
                                  </button>
                                  <span className={`text-base font-black w-8 text-center ${changed ? 'text-amber-600' : 'text-gray-900'}`}>
                                    {currentQty}
                                  </span>
                                  <button
                                    onClick={() => updateModQty(item.id, 1)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 hover:border-amber-400 hover:text-amber-600 text-gray-500 cursor-pointer transition-colors"
                                  >
                                    <i className="ri-add-line text-sm" />
                                  </button>
                                </div>
                                <div className="w-20 text-right flex-shrink-0">
                                  <p className={`text-sm font-bold ${changed ? 'text-amber-600' : 'text-gray-700'}`}>
                                    MXN${(item.unit_price * currentQty).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Totales comparativos */}
                {modHasChanges && (
                  <div className="px-5 py-3 bg-amber-50 border-t border-amber-100">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Total anterior</span>
                      <span className="text-gray-500 line-through">
                        MXN$${items.reduce((s, i) => s + i.unit_price * i.quantity, 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-amber-700 font-bold">Nuevo total</span>
                      <span className="text-amber-700 font-black">
                        ${items.reduce((s, i) => s + i.unit_price * (modQtys[i.id] ?? i.quantity), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
                  <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors whitespace-nowrap">
                      Cerrar
                    </button>
                    <button
                      disabled={!modHasChanges}
                      onClick={handleContinue}
                      className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <i className="ri-shield-keyhole-line mr-1.5" />
                      Guardar Cambios
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── TAB: CAMBIAR FORMA DE PAGO ── */}
            {activeTab === 'pago' && (
              <>
                <div className="px-5 py-5 space-y-4">
                  <p className="text-xs text-gray-500">
                    Actualiza la forma de pago registrada para esta cuenta. Solo afecta al registro — no realiza ningún cobro.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {PAYMENT_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setNewPayMethod(opt.id)}
                        className={`flex items-center gap-2.5 px-4 py-4 rounded-xl border-2 cursor-pointer transition-all text-left ${
                          newPayMethod === opt.id
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <i className={`${opt.icon} text-xl ${newPayMethod === opt.id ? 'text-amber-600' : opt.color}`} />
                        <span className={`text-sm font-semibold ${newPayMethod === opt.id ? 'text-amber-700' : 'text-gray-700'}`}>
                          {opt.label}
                        </span>
                      </button>
                    ))}
                  </div>

                  {(newPayMethod === 'credit_card' || newPayMethod === 'debit_card') && (
                    <div className="bg-rose-50 rounded-xl border border-rose-200 px-4 py-3 text-xs text-rose-600 font-medium flex items-center gap-1.5">
                      <i className="ri-information-line text-rose-500" />
                      Se recalculará el cargo por terminal (3%) automáticamente
                    </div>
                  )}

                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 rounded-xl">
                      <i className={`${PAYMENT_OPTIONS.find(p => p.id === newPayMethod)?.icon} text-lg ${PAYMENT_OPTIONS.find(p => p.id === newPayMethod)?.color}`} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Nuevo método</p>
                      <p className="text-sm font-black text-gray-900">{PAYMENT_OPTIONS.find(p => p.id === newPayMethod)?.label}</p>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
                  <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors whitespace-nowrap">
                      Cerrar
                    </button>
                    <button
                      onClick={handleContinue}
                      className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <i className="ri-shield-keyhole-line mr-1.5" />
                      Actualizar Pago
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── TAB: AGREGAR PRODUCTOS ── */}
            {activeTab === 'agregar' && (
              <>
                {/* Selector de ronda — cuando hay targetFolio se muestra fijo */}
                {targetFolio !== undefined ? (
                  <div className="px-5 pt-3 pb-2">
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <i className="ri-add-circle-line text-amber-600" />
                      <span className="text-xs font-bold text-amber-700">
                        Agregando a Ronda #{String(targetFolio).padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                ) : currentFolioNum > 0 ? (
                  <div className="px-5 pt-3 pb-2 flex items-center gap-2">
                    <button
                      onClick={() => setAgregarMode('current')}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all whitespace-nowrap border ${
                        agregarMode === 'current'
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-green-300'
                      }`}
                    >
                      <i className={agregarMode === 'current' ? 'ri-checkbox-circle-fill mr-1' : 'ri-checkbox-blank-circle-line mr-1'} />
                      Ronda actual (#{String(currentFolioNum).padStart(2, '0')})
                    </button>
                    <button
                      onClick={() => setAgregarMode('new')}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all whitespace-nowrap border ${
                        agregarMode === 'new'
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-amber-300'
                      }`}
                    >
                      <i className={agregarMode === 'new' ? 'ri-add-circle-fill mr-1' : 'ri-add-circle-line mr-1'} />
                      Nueva ronda (#{String(currentFolioNum + 1).padStart(2, '0')})
                    </button>
                  </div>
                ) : null}

                {/* Search */}
                <div className="px-5 py-2">
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                    <i className="ri-search-line text-gray-400 text-sm" />
                    <input
                      type="text"
                      value={agregarSearch}
                      onChange={e => setAgregarSearch(e.target.value)}
                      placeholder="Buscar producto..."
                      className="flex-1 bg-transparent text-sm focus:outline-none"
                    />
                    {agregarSearch && (
                      <button onClick={() => setAgregarSearch('')} className="text-gray-400 cursor-pointer">
                        <i className="ri-close-line text-sm" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Contenido: categorías + items */}
                <div className="flex max-h-[40vh] overflow-hidden">
                  {/* Sidebar categorías */}
                  {!agregarSearch && (
                    <div className="w-28 border-r border-gray-100 overflow-y-auto flex-shrink-0">
                      {menuCategories.map((cat, idx) => (
                        <button
                          key={cat.label}
                          onClick={() => setAgregarActiveCat(idx)}
                          className={`w-full px-2 py-2.5 text-left text-xs font-medium transition-colors cursor-pointer ${
                            agregarActiveCat === idx
                              ? 'bg-green-50 text-green-700 border-r-2 border-green-500'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <i className={`${cat.icon} block text-sm mb-0.5`} />
                          <span className="leading-tight">{cat.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Lista de items */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {agregarCurrentItems.length === 0 ? (
                      <p className="text-center text-gray-400 text-sm py-8">Sin resultados</p>
                    ) : (
                      agregarCurrentItems.map(item => {
                        const inCart = agregarCart.filter(e => e.menuItem.id === item.id).reduce((s, e) => s + e.quantity, 0);
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleAgregarSelect(item)}
                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-green-50 border border-transparent hover:border-green-200 transition-all cursor-pointer text-left"
                          >
                            <span className="text-sm text-gray-800 font-medium truncate">{item.name}</span>
                            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                              {inCart > 0 && (
                                <span className="bg-green-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                                  {inCart}
                                </span>
                              )}
                              <span className="text-sm font-bold text-green-600 whitespace-nowrap">MXN${item.price.toFixed(2)}</span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Carrito */}
                {agregarCart.length > 0 && (
                  <div className="border-t border-gray-100 bg-green-50 px-5 py-3 space-y-1.5 max-h-32 overflow-y-auto">
                    <p className="text-xs font-bold text-green-700 uppercase tracking-wide">Carrito</p>
                    {agregarCart.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateAgregarCartQty(idx, entry.quantity - 1)} className="w-5 h-5 flex items-center justify-center rounded-full border border-green-300 text-green-700 cursor-pointer text-xs">
                            <i className="ri-subtract-line" />
                          </button>
                          <span className="w-5 text-center text-xs font-bold text-gray-900">{entry.quantity}</span>
                          <button onClick={() => updateAgregarCartQty(idx, entry.quantity + 1)} className="w-5 h-5 flex items-center justify-center rounded-full border border-green-300 text-green-700 cursor-pointer text-xs">
                            <i className="ri-add-line" />
                          </button>
                        </div>
                        <span className="flex-1 text-xs text-gray-800 truncate">
                          {entry.menuItem.name}{entry.note ? ` (${entry.note})` : ''}
                        </span>
                        <button
                          onClick={() => updateAgregarCartQty(idx, 0)}
                          className="w-5 h-5 flex items-center justify-center rounded-full border border-red-200 text-red-400 hover:bg-red-50 cursor-pointer"
                        >
                          <i className="ri-close-line text-xs" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer con total */}
                <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
                  {agregarCart.length > 0 && (
                    <div className="flex items-center justify-between text-sm bg-green-50 border border-green-200 rounded-xl px-3 py-2 mb-3">
                      <span className="text-green-700 font-medium">{agregarCartCount} producto{agregarCartCount !== 1 ? 's' : ''}</span>
                      <span className="text-green-700 font-black">MXN${agregarCartTotal.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors whitespace-nowrap">
                      Cerrar
                    </button>
                    <button
                      disabled={agregarCart.length === 0}
                      onClick={handleContinue}
                      className="flex-1 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <i className="ri-shield-keyhole-line mr-1.5" />
                      Agregar a Cuenta
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Modal de nota para Agregar Producto ── */}
        {agregarNoteItem && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setAgregarNoteItem(null)} />
            <div className="relative bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
              <h4 className="font-bold text-gray-900 mb-1">{agregarNoteItem.name}</h4>
              <p className="text-green-600 font-bold text-lg mb-3">MXN${agregarNoteItem.price.toFixed(2)}</p>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Nota / Especificación (opcional)
              </label>
              <input
                type="text"
                value={agregarNoteText}
                onChange={e => setAgregarNoteText(e.target.value)}
                placeholder="Ej: BBQ, sin cebolla, extra picante..."
                autoFocus
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-500"
                onKeyDown={e => { if (e.key === 'Enter') handleAgregarConfirmNote(); }}
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setAgregarNoteItem(null)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAgregarConfirmNote}
                  className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-add-line mr-1" />
                  Al Carrito
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
            PASO: CONFIRMAR PIN
        ════════════════════════════════════════ */}
        {step === 'confirm-pin' && (
          <div className="px-6 py-6">
            <button
              onClick={() => setStep('main')}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 cursor-pointer mb-5 transition-colors"
            >
              <i className="ri-arrow-left-s-line text-lg" />
              Volver
            </button>

            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-shield-keyhole-fill text-gray-600 text-2xl" />
              </div>
              <h3 className="text-base font-black text-gray-900 mb-1">Confirmar con contraseña</h3>
              <p className="text-sm text-gray-500">
                {activeTab === 'quitar' && (
                  <>Se quitarán <strong className="text-red-600">{selectedItems.size} ítem{selectedItems.size !== 1 ? 's' : ''}</strong> — <strong className="text-red-600">-MXN${cancelSelectedTotal.toFixed(2)}</strong></>
                )}
                {activeTab === 'modificar' && (
                  <>Se actualizarán las cantidades de <strong className="text-amber-600">{items.filter(i => modQtys[i.id] !== i.quantity).length} producto{items.filter(i => modQtys[i.id] !== i.quantity).length !== 1 ? 's' : ''}</strong></>
                )}
                {activeTab === 'pago' && (
                  <>Se cambiará la forma de pago a <strong className="text-indigo-600">{PAYMENT_OPTIONS.find(p => p.id === newPayMethod)?.label}</strong></>
                )}
                {activeTab === 'agregar' && (
                  <>Se agregarán <strong className="text-green-600">{agregarCartCount} producto{agregarCartCount !== 1 ? 's' : ''}</strong> — <strong className="text-green-600">+MXN${agregarCartTotal.toFixed(2)}</strong> a {agregarMode === 'new' || currentFolioNum === 0 ? `Ronda #${String(currentFolioNum + 1).padStart(2, '0')} (nueva)` : `Ronda #${String(currentFolioNum).padStart(2, '0')} (actual)`}</>
                )}
              </p>
            </div>

            {/* Resumen */}
            {activeTab === 'quitar' && (
              <div className="bg-red-50 rounded-xl border border-red-200 px-4 py-3 mb-5 space-y-1 max-h-32 overflow-y-auto">
                {items.filter(i => selectedItems.has(i.id)).map(i => (
                  <div key={i.id} className="flex items-center justify-between text-xs">
                    <span className="text-red-700 font-medium truncate">
                      <i className="ri-close-circle-line mr-1" />
                      {cancelQtys[i.id] ?? i.quantity}x {i.product_name}
                    </span>
                    <span className="text-red-600 font-bold flex-shrink-0 ml-2">
                      -MXN${(i.unit_price * (cancelQtys[i.id] ?? i.quantity)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'modificar' && (
              <div className="bg-amber-50 rounded-xl border border-amber-200 px-4 py-3 mb-5 space-y-1 max-h-32 overflow-y-auto">
                {items.filter(i => modQtys[i.id] !== i.quantity).map(i => (
                  <div key={i.id} className="flex items-center justify-between text-xs">
                    <span className="text-amber-700 font-medium truncate">
                      <i className="ri-edit-line mr-1" />
                      {i.product_name}
                    </span>
                    <span className="text-amber-600 font-bold flex-shrink-0 ml-2">
                      {i.quantity} → {modQtys[i.id]}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'agregar' && (
              <div className="bg-green-50 rounded-xl border border-green-200 px-4 py-3 mb-5 space-y-1 max-h-32 overflow-y-auto">
                {agregarCart.map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-green-700 font-medium truncate">
                      <i className="ri-add-circle-line mr-1" />
                      {entry.quantity}x {entry.menuItem.name}{entry.note ? ` (${entry.note})` : ''}
                    </span>
                    <span className="text-green-600 font-bold flex-shrink-0 ml-2">
                      +MXN${(entry.menuItem.price * entry.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Input PIN */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                Contraseña de administrador
              </label>
              <div className={`relative transition-all ${shake ? 'animate-bounce' : ''}`}>
                <input
                  ref={pinRef}
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={e => { setPin(e.target.value); setPinError(false); }}
                  onKeyDown={e => e.key === 'Enter' && handleConfirmPin()}
                  placeholder="Ingresa la contraseña"
                  className={`w-full px-4 py-3 pr-11 bg-gray-50 border-2 rounded-xl text-sm font-medium focus:outline-none transition-all ${
                    pinError ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-amber-400'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <i className={showPin ? 'ri-eye-off-line' : 'ri-eye-line'} />
                </button>
              </div>
              {pinError && (
                <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                  <i className="ri-error-warning-line" />
                  Contraseña incorrecta
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                Cerrar
              </button>
              <button
                onClick={handleConfirmPin}
                disabled={!pin || saving}
                className={`flex-1 py-3 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap ${
                  activeTab === 'quitar' ? 'bg-red-500 hover:bg-red-600' :
                  activeTab === 'modificar' ? 'bg-amber-500 hover:bg-amber-600' :
                  activeTab === 'agregar' ? 'bg-green-500 hover:bg-green-600' :
                  'bg-indigo-500 hover:bg-indigo-600'
                }`}
              >
                {saving
                  ? <><i className="ri-loader-4-line animate-spin mr-1" />Guardando...</>
                  : <><i className="ri-check-line mr-1.5" />Confirmar</>}
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
            PASO: DONE
        ════════════════════════════════════════ */}
        {step === 'done' && (
          <div className="px-6 py-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-checkbox-circle-fill text-green-500 text-3xl" />
            </div>
            <h3 className="text-base font-black text-gray-900 mb-2">¡Listo!</h3>
            <p className="text-sm text-gray-500 mb-6">{doneMessage}</p>
            <button
              onClick={() => { onCancelled(); onClose(); }}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-check-line mr-2" />
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}