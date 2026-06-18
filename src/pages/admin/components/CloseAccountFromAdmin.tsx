import { useState } from 'react';
import { supabasePos } from '@/pages/pos/supabasePos';
import type { PosAccount, PosAccountItem, PaymentMethod } from '@/pages/pos/types';
import type { MixedPaymentEntry } from '@/pages/pos/components/CloseAccountModal';
import PrintTicketModal from '@/pages/pos/components/PrintTicketModal';
import { BluetoothPrinterProvider } from '@/pages/pos/context/BluetoothPrinterContext';

interface AccountItem {
  id: number;
  product_name: string;
  size?: string;
  quantity: number;
  unit_price: number;
  folio_number: number;
  created_at: string;
}

interface CloseAccountFromAdminProps {
  accountId: number;
  spot: string;
  area: string;
  customerName?: string;
  items: AccountItem[];
  onClose: () => void;
  onClosed: () => void;
}

type PayMethod = PaymentMethod;

const PAYMENT_OPTIONS: { id: PayMethod; label: string; icon: string; color: string; hasCardFee: boolean }[] = [
  { id: 'cash', label: 'Efectivo', icon: 'ri-money-dollar-circle-line', color: 'text-green-600', hasCardFee: false },
  { id: 'transfer', label: 'Transferencia', icon: 'ri-bank-line', color: 'text-amber-600', hasCardFee: false },
  { id: 'credit_card', label: 'Tarjeta Crédito', icon: 'ri-bank-card-line', color: 'text-rose-600', hasCardFee: true },
  { id: 'debit_card', label: 'Tarjeta Débito', icon: 'ri-bank-card-2-line', color: 'text-indigo-600', hasCardFee: true },
];

const METHOD_LABELS: Record<PayMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  credit_card: 'Tarjeta de Crédito',
  debit_card: 'Tarjeta de Débito',
};

export default function CloseAccountFromAdmin({
  accountId, spot, area, customerName, items, onClose, onClosed,
}: CloseAccountFromAdminProps) {
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>('cash');
  const [splitCount, setSplitCount] = useState(1);
  const [loading, setLoading] = useState(false);

  // Pagos mixtos
  const [isMixed, setIsMixed] = useState(false);
  const [mixedPayments, setMixedPayments] = useState<MixedPaymentEntry[]>([]);
  const [newMethod, setNewMethod] = useState<PayMethod>('cash');
  const [newAmount, setNewAmount] = useState('');

  const [printData, setPrintData] = useState<{
    account: PosAccount;
    items: PosAccountItem[];
    paymentMethod: PayMethod;
    mixedPayments?: MixedPaymentEntry[];
    splitCount: number;
    total: number;
    cardFee: number;
  } | null>(null);

  const [errorMsg, setErrorMsg] = useState('');

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);

  // Fee calculation
  const selectedOpt = PAYMENT_OPTIONS.find(o => o.id === paymentMethod)!;
  const cardFee = isMixed
    ? mixedPayments.reduce((fee, p) => {
        const opt = PAYMENT_OPTIONS.find(o => o.id === p.method);
        return fee + (opt?.hasCardFee ? p.amount * 0.03 : 0);
      }, 0)
    : selectedOpt.hasCardFee ? subtotal * 0.03 : 0;

  const total = subtotal + cardFee;
  const perPerson = splitCount > 1 ? total / splitCount : total;

  const mixedTotal = mixedPayments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, total - mixedTotal);
  const isOverpaid = mixedTotal > total;

  const addMixedPayment = () => {
    const amt = parseFloat(newAmount);
    if (!newAmount || isNaN(amt) || amt <= 0) return;
    setMixedPayments(prev => [...prev, { method: newMethod, amount: amt }]);
    setNewAmount('');
  };

  const removeMixedPayment = (idx: number) => {
    setMixedPayments(prev => prev.filter((_, i) => i !== idx));
  };

  const canConfirm = isMixed ? mixedPayments.length > 0 && remaining === 0 : true;

  const handleConfirm = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const primaryMethod = isMixed && mixedPayments.length > 0 ? mixedPayments[0].method : paymentMethod;

      // ===== BUSCAR CLIENTE ANTES DE CERRAR (cuenta aún 'open') =====
      const { data: accountData } = await supabasePos
        .from('pos_accounts')
        .select('customer_id, customer_name, customer_phone')
        .eq('id', accountId)
        .eq('status', 'open')
        .maybeSingle();

      let resolvedCustId = accountData?.customer_id ?? null;
      const custName = accountData?.customer_name?.trim() || customerName?.trim();
      const custPhone = accountData?.customer_phone?.trim();

      // Orden de búsqueda: teléfono primero (más preciso que nombre)
      if (!resolvedCustId && custPhone) {
        const cleanPhone = custPhone.replace(/\D/g, '');
        if (cleanPhone.length >= 8) {
          // 1) Exacta con número limpio
          const { data: foundExact } = await supabasePos
            .from('pos_customers')
            .select('id')
            .eq('phone', cleanPhone)
            .maybeSingle();
          if (foundExact?.id) {
            resolvedCustId = foundExact.id;
          } else {
            // 2) Exacta con número raw
            const { data: foundRaw } = await supabasePos
              .from('pos_customers')
              .select('id')
              .eq('phone', custPhone)
              .maybeSingle();
            if (foundRaw?.id) {
              resolvedCustId = foundRaw.id;
            } else {
              // 3) Fallback: últimos 10 dígitos
              const last10 = cleanPhone.slice(-10);
              const { data: foundPartial } = await supabasePos
                .from('pos_customers')
                .select('id')
                .ilike('phone', `%${last10}%`)
                .maybeSingle();
              if (foundPartial?.id) resolvedCustId = foundPartial.id;
            }
          }
        }
      }

      // Fallback por nombre si no encontró por teléfono
      if (!resolvedCustId && custName) {
        // 1) Coincidencia exacta (case-insensitive)
        const { data: foundExactName } = await supabasePos
          .from('pos_customers')
          .select('id')
          .ilike('name', custName)
          .maybeSingle();
        if (foundExactName?.id) {
          resolvedCustId = foundExactName.id;
        } else {
          // 2) Coincidencia parcial
          const { data: foundPartialName } = await supabasePos
            .from('pos_customers')
            .select('id')
            .ilike('name', `%${custName}%`)
            .maybeSingle();
          if (foundPartialName?.id) resolvedCustId = foundPartialName.id;
        }
      }

      // Leer puntos actuales del cliente (si se encontró)
      let prevPoints = 0;
      let prevTotal = 0;
      if (resolvedCustId) {
        const { data: custData } = await supabasePos
          .from('pos_customers')
          .select('total_spent, loyalty_points')
          .eq('id', resolvedCustId)
          .maybeSingle();
        prevTotal = Number(custData?.total_spent ?? 0);
        prevPoints = Number(custData?.loyalty_points ?? 0);
      }
      // ===== FIN BÚSQUEDA DE CLIENTE =====

      // Guardar pago
      const paymentPayload: Record<string, unknown> = {
        account_id: accountId,
        payment_method: primaryMethod,
        subtotal,
        card_fee: cardFee,
        total,
        split_count: splitCount,
      };
      if (isMixed && mixedPayments.length > 0) {
        paymentPayload.mixed_payments = mixedPayments;
      }

      const { error: paymentError } = await supabasePos.from('pos_payments').insert(paymentPayload);
      if (paymentError) throw new Error(`Error guardando pago: ${paymentError.message}`);

      // Cerrar cuenta
      const { error: accountError } = await supabasePos
        .from('pos_accounts')
        .update({ status: 'closed', closed_at: new Date().toISOString() })
        .eq('id', accountId);
      if (accountError) throw new Error(`Error cerrando cuenta: ${accountError.message}`);

      // ===== PUNTOS DE LEALTAD (RESOLUCIÓN ROBUSTA + SECUENCIAL) =====
      // Paso 1: Intentar resolver por teléfono si no hay customer_id directo
      if (!resolvedCustId && custPhone) {
        const cleanPhone = custPhone.replace(/\D/g, '');
        if (cleanPhone.length >= 8) {
          let foundId: number | null = null;
          const { data: exact } = await supabasePos.from('pos_customers').select('id').eq('phone', cleanPhone).maybeSingle();
          if (exact?.id) foundId = exact.id;
          if (!foundId) {
            const { data: raw } = await supabasePos.from('pos_customers').select('id').eq('phone', custPhone).maybeSingle();
            if (raw?.id) foundId = raw.id;
          }
          if (!foundId) {
            const last10 = cleanPhone.slice(-10);
            const { data: partial } = await supabasePos.from('pos_customers').select('id').ilike('phone', `%${last10}%`).maybeSingle();
            if (partial?.id) foundId = partial.id;
          }
          if (foundId) resolvedCustId = foundId;
        }
      }

      // Paso 2: Fallback por nombre si no se encontró por teléfono
      if (!resolvedCustId && custName) {
        let foundId: number | null = null;
        const { data: exactName } = await supabasePos.from('pos_customers').select('id').ilike('name', custName).maybeSingle();
        if (exactName?.id) foundId = exactName.id;
        if (!foundId) {
          const { data: partialName } = await supabasePos.from('pos_customers').select('id').ilike('name', `%${custName}%`).maybeSingle();
          if (partialName?.id) foundId = partialName.id;
        }
        if (foundId) resolvedCustId = foundId;
      }

      // Paso 3: Re-leer puntos actuales (frescos después del cierre)
      if (resolvedCustId) {
        const { data: custData } = await supabasePos
          .from('pos_customers')
          .select('total_spent, loyalty_points')
          .eq('id', resolvedCustId)
          .maybeSingle();
        prevTotal = Number(custData?.total_spent ?? 0);
        prevPoints = Number(custData?.loyalty_points ?? 0);
      }

      // Vincular customer_id a la cuenta si se resolvió
      if (resolvedCustId && !accountData?.customer_id) {
        await supabasePos
          .from('pos_accounts')
          .update({ customer_id: resolvedCustId, updated_at: new Date().toISOString() })
          .eq('id', accountId);
      }

      const newTotal = prevTotal + total;
      const pointsEarned = Math.floor(total / 100);
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

      // Registrar en historial de lealtad
      if (pointsEarned > 0) {
        await supabasePos.from('loyalty_point_adjustments').insert({
          customer_id: resolvedCustId,
          delta: pointsEarned,
          points_before: prevPoints,
          points_after: newPoints,
          reason: `Cierre de cuenta (Admin) — ${spot} — Total $${total.toFixed(2)} · Pago: ${METHOD_LABELS[primaryMethod]}`,
          adjusted_by: 'admin_auto',
        });
      }

      // Registrar evento de cierre con puntos
      await supabasePos.from('pos_account_events').insert({
        account_id: accountId,
        customer_id: resolvedCustId,
        event_type: 'account_closed',
        description: `Cuenta cerrada (Admin) — $${total.toFixed(2)} · ${METHOD_LABELS[primaryMethod]}${pointsEarned > 0 ? ` · +${pointsEarned} pts (total: ${newPoints})` : ''}`,
        metadata: {
          spot,
          area,
          total,
          payment_method: METHOD_LABELS[primaryMethod],
          split_count: splitCount,
          points_earned: pointsEarned,
          loyalty_points_before: prevPoints,
          loyalty_points_after: newPoints,
          closed_from: 'admin',
        },
      });
      // ===== FIN PUNTOS DE LEALTAD =====

      const { data: fullAcc, error: fetchError } = await supabasePos
        .from('pos_accounts')
        .select('*, pos_account_items(*)')
        .eq('id', accountId)
        .maybeSingle();
      if (fetchError) throw new Error(`Error recuperando cuenta: ${fetchError.message}`);

      setLoading(false);

      if (fullAcc) {
        setPrintData({
          account: fullAcc as PosAccount,
          items: (fullAcc.pos_account_items ?? []) as PosAccountItem[],
          paymentMethod: primaryMethod,
          mixedPayments: isMixed && mixedPayments.length > 0 ? mixedPayments : undefined,
          splitCount,
          total,
          cardFee,
        });
      } else {
        onClosed();
      }
    } catch (err: unknown) {
      setLoading(false);
      const message = err instanceof Error ? err.message : 'Error desconocido al cerrar cuenta';
      setErrorMsg(message);
      console.error('CloseAccountFromAdmin error:', err);
    }
  };

  const handlePrintClose = () => {
    setPrintData(null);
    onClosed();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div className="relative bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between rounded-t-2xl z-10">
            <div>
              <h3 className="font-bold text-gray-900">Cerrar Cuenta</h3>
              <p className="text-xs text-gray-500">{spot} · {customerName || 'Sin nombre'}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer">
              <i className="ri-close-line text-gray-500" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Error message */}
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
                <i className="ri-error-warning-line text-red-500 text-sm flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-red-700">No se pudo cerrar la cuenta</p>
                  <p className="text-xs text-red-600 mt-0.5">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Resumen */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Resumen de Consumo</p>
              <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 max-h-44 overflow-y-auto">
                {items.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">Sin productos</p>
                ) : (
                  items.map(item => (
                    <div key={item.id} className="flex items-center justify-between px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 leading-tight">
                          <span className="text-amber-600">{item.quantity}x</span> {item.product_name}
                        </p>
                        {item.size && <p className="text-xs text-amber-500">{item.size}</p>}
                      </div>
                      <p className="text-xs font-bold text-gray-900 ml-2 flex-shrink-0">
                        ${(item.unit_price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Toggle pago mixto */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Forma de Pago</p>
                <p className="text-xs text-gray-400 mt-0.5">Activa "mixto" si pagan con varios métodos</p>
              </div>
              <button
                onClick={() => { setIsMixed(!isMixed); setMixedPayments([]); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all border-2 whitespace-nowrap ${
                  isMixed
                    ? 'bg-purple-600 border-purple-600 text-white'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-purple-300 hover:text-purple-600'
                }`}
              >
                <i className={isMixed ? 'ri-checkbox-circle-fill' : 'ri-split-cells-horizontal'} />
                Pago Mixto
              </button>
            </div>

            {/* PAGO SIMPLE */}
            {!isMixed && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setPaymentMethod(opt.id)}
                      className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 cursor-pointer transition-all text-left whitespace-nowrap ${
                        paymentMethod === opt.id
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-gray-200 hover:border-amber-200 hover:bg-amber-50/50'
                      }`}
                    >
                      <i className={`${opt.icon} text-base ${paymentMethod === opt.id ? 'text-amber-600' : opt.color}`} />
                      <span className={`text-xs font-semibold ${paymentMethod === opt.id ? 'text-amber-700' : 'text-gray-700'}`}>
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
                {selectedOpt.hasCardFee && (
                  <div className="bg-rose-50 rounded-lg px-3 py-2 text-xs text-rose-600 font-medium flex items-center gap-1.5">
                    <i className="ri-information-line" />
                    Se agrega 3% de cargo por terminal: +${cardFee.toFixed(2)}
                  </div>
                )}
              </>
            )}

            {/* PAGO MIXTO */}
            {isMixed && (
              <div className="space-y-3">
                {mixedPayments.length > 0 && (
                  <div className="space-y-2">
                    {mixedPayments.map((p, idx) => {
                      const opt = PAYMENT_OPTIONS.find(o => o.id === p.method)!;
                      const fee = opt.hasCardFee ? p.amount * 0.03 : 0;
                      return (
                        <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200">
                            <i className={`${opt.icon} ${opt.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900">${p.amount.toFixed(2)}</p>
                            <p className="text-xs text-gray-500">
                              {METHOD_LABELS[p.method]}
                              {fee > 0 && <span className="text-rose-500 ml-1">(+${fee.toFixed(2)} terminal)</span>}
                            </p>
                          </div>
                          <button
                            onClick={() => removeMixedPayment(idx)}
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 text-red-400 cursor-pointer transition-colors"
                          >
                            <i className="ri-delete-bin-line text-xs" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {mixedPayments.length > 0 && (
                  <div className={`rounded-xl px-3 py-2.5 flex items-center justify-between ${
                    remaining === 0 && !isOverpaid
                      ? 'bg-green-50 border border-green-200'
                      : isOverpaid
                      ? 'bg-orange-50 border border-orange-200'
                      : 'bg-amber-50 border border-amber-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      <i className={`text-base ${
                        remaining === 0 && !isOverpaid
                          ? 'ri-checkbox-circle-fill text-green-500'
                          : isOverpaid
                          ? 'ri-error-warning-fill text-orange-500'
                          : 'ri-time-fill text-amber-500'
                      }`} />
                      <div>
                        <p className={`text-xs font-bold ${
                          remaining === 0 && !isOverpaid ? 'text-green-700' : isOverpaid ? 'text-orange-700' : 'text-amber-700'
                        }`}>
                          {remaining === 0 && !isOverpaid
                            ? 'Pago completo'
                            : isOverpaid
                            ? `Sobrepago: +$${(mixedTotal - total).toFixed(2)}`
                            : `Faltan: $${remaining.toFixed(2)}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          Pagado: ${mixedTotal.toFixed(2)} / Total: ${total.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    {remaining === 0 && !isOverpaid && (
                      <i className="ri-check-double-line text-green-500 text-xl" />
                    )}
                  </div>
                )}

                {remaining > 0 && (
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-3 space-y-3">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      Agregar Pago {mixedPayments.length + 1}
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {PAYMENT_OPTIONS.map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => setNewMethod(opt.id)}
                          className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 cursor-pointer transition-all ${
                            newMethod === opt.id
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <i className={`${opt.icon} text-base ${newMethod === opt.id ? 'text-amber-600' : opt.color}`} />
                          <span className={`text-[10px] font-semibold text-center leading-tight ${newMethod === opt.id ? 'text-amber-700' : 'text-gray-500'}`}>
                            {opt.label.split(' ')[0]}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">$</span>
                        <input
                          type="number"
                          value={newAmount}
                          onChange={e => setNewAmount(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') addMixedPayment(); }}
                          placeholder={remaining > 0 ? remaining.toFixed(2) : '0.00'}
                          className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-amber-500 bg-white"
                          min="0.01"
                          step="0.01"
                        />
                      </div>
                      <button
                        onClick={() => setNewAmount(remaining.toFixed(2))}
                        className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:border-amber-400 hover:text-amber-700 cursor-pointer transition-colors whitespace-nowrap"
                      >
                        Restante
                      </button>
                      <button
                        onClick={addMixedPayment}
                        disabled={!newAmount || parseFloat(newAmount) <= 0}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
                      >
                        <i className="ri-add-line" />
                      </button>
                    </div>
                    {PAYMENT_OPTIONS.find(o => o.id === newMethod)?.hasCardFee && newAmount && parseFloat(newAmount) > 0 && (
                      <p className="text-xs text-rose-500 flex items-center gap-1">
                        <i className="ri-information-line" />
                        +3% terminal: +${(parseFloat(newAmount) * 0.03).toFixed(2)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Dividir cuenta */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Dividir Cuenta</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSplitCount(Math.max(1, splitCount - 1))}
                  className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 hover:border-amber-400 hover:text-amber-600 text-gray-500 cursor-pointer transition-colors"
                >
                  <i className="ri-subtract-line" />
                </button>
                <div className="text-center w-24">
                  <span className="text-lg font-bold text-gray-900">
                    {splitCount === 1 ? '1 persona' : `${splitCount} personas`}
                  </span>
                </div>
                <button
                  onClick={() => setSplitCount(splitCount + 1)}
                  className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 hover:border-amber-400 hover:text-amber-600 text-gray-500 cursor-pointer transition-colors"
                >
                  <i className="ri-add-line" />
                </button>
              </div>
            </div>

            {/* Total */}
            <div className="bg-gray-900 rounded-2xl px-5 py-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400 text-sm">Subtotal</span>
                <span className="text-white font-semibold">${subtotal.toFixed(2)}</span>
              </div>
              {cardFee > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400 text-sm">Cargo terminal (3%)</span>
                  <span className="text-rose-400 font-semibold">+${cardFee.toFixed(2)}</span>
                </div>
              )}
              {isMixed && mixedPayments.length > 0 && (
                <div className="border-t border-gray-700 pt-2 mb-2">
                  <p className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Desglose</p>
                  {mixedPayments.map((p, idx) => {
                    const opt = PAYMENT_OPTIONS.find(o => o.id === p.method)!;
                    const fee = opt.hasCardFee ? p.amount * 0.03 : 0;
                    return (
                      <div key={idx} className="flex justify-between text-xs text-gray-400 mb-1">
                        <span className="flex items-center gap-1">
                          <i className={`${opt.icon} text-xs`} />
                          {METHOD_LABELS[p.method]}
                        </span>
                        <span>${(p.amount + fee).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="border-t border-gray-700 pt-2 mt-1 flex justify-between items-center">
                <span className="text-gray-300 text-sm font-semibold uppercase tracking-wide">Total</span>
                <span className="text-amber-400 text-2xl font-black">${total.toFixed(2)}</span>
              </div>
              {splitCount > 1 && (
                <div className="flex justify-between items-center mt-2 bg-gray-800 rounded-xl px-3 py-2">
                  <span className="text-gray-400 text-xs">Por persona ({splitCount})</span>
                  <span className="text-white font-bold text-sm">${perPerson.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading || !canConfirm}
                className="flex-1 py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Cerrando...
                  </>
                ) : (
                  <>
                    <i className="ri-check-double-line" />
                    {isMixed && remaining > 0 ? `Faltan $${remaining.toFixed(2)}` : 'Confirmar Cierre'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {printData && (
        <BluetoothPrinterProvider>
          <PrintTicketModal
            account={printData.account}
            items={printData.items}
            paymentMethod={printData.paymentMethod}
            mixedPayments={printData.mixedPayments}
            splitCount={printData.splitCount}
            total={printData.total}
            cardFee={printData.cardFee}
            mode="cuenta"
            onClose={handlePrintClose}
          />
        </BluetoothPrinterProvider>
      )}
    </>
  );
}