import { useState } from 'react';
import { supabasePos } from '@/pages/pos/supabasePos';
import type { PaymentMethod } from '@/pages/pos/types';

interface PaymentRecord {
  id: number;
  payment_method: string;
  subtotal: number;
  card_fee: number;
  total: number;
  split_count: number;
  tip: number;
  mixed_payments?: { method: string; amount: number }[] | null;
  closed_by?: string;
}

interface EditPaymentModalProps {
  accountId: number;
  spot: string;
  customerName?: string;
  payments: PaymentRecord[];
  subtotalItems: number;
  onClose: () => void;
  onSaved: () => void;
}

const PAYMENT_OPTIONS: { id: PaymentMethod; label: string; icon: string; hasCardFee: boolean }[] = [
  { id: 'cash', label: 'Efectivo', icon: 'ri-money-dollar-circle-line', hasCardFee: false },
  { id: 'transfer', label: 'Transferencia', icon: 'ri-bank-line', hasCardFee: false },
  { id: 'credit_card', label: 'Tarjeta Crédito', icon: 'ri-bank-card-line', hasCardFee: true },
  { id: 'debit_card', label: 'Tarjeta Débito', icon: 'ri-bank-card-2-line', hasCardFee: true },
];

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  credit_card: 'Tarjeta de Crédito',
  debit_card: 'Tarjeta de Débito',
};

const METHOD_COLORS: Record<string, string> = {
  cash: 'bg-green-100 text-green-700 border-green-200',
  transfer: 'bg-amber-100 text-amber-700 border-amber-200',
  credit_card: 'bg-rose-100 text-rose-700 border-rose-200',
  debit_card: 'bg-orange-100 text-orange-700 border-orange-200',
};

const METHOD_ICONS: Record<string, string> = {
  cash: 'ri-money-dollar-circle-line',
  transfer: 'ri-bank-line',
  credit_card: 'ri-bank-card-line',
  debit_card: 'ri-bank-card-2-line',
};

export default function EditPaymentModal({
  accountId, spot, customerName, payments, subtotalItems, onClose, onSaved,
}: EditPaymentModalProps) {
  const [editedPayments, setEditedPayments] = useState(
    payments.map(p => ({
      ...p,
      payment_method: p.payment_method as PaymentMethod,
      subtotal: Number(p.subtotal),
      card_fee: Number(p.card_fee),
      total: Number(p.total),
      tip: Number(p.tip ?? 0),
    }))
  );
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const handleMethodChange = (idx: number, newMethod: PaymentMethod) => {
    setEditedPayments(prev => prev.map((p, i) => {
      if (i !== idx) return p;
      const newOpt = PAYMENT_OPTIONS.find(o => o.id === newMethod)!;
      const oldOpt = PAYMENT_OPTIONS.find(o => o.id === p.payment_method)!;
      
      let newCardFee = p.card_fee;
      let newTotal = p.total;
      
      // Remover fee viejo si tenía
      if (oldOpt.hasCardFee) {
        newTotal -= newCardFee;
        newCardFee = 0;
      }
      
      // Agregar fee nuevo si aplica
      if (newOpt.hasCardFee) {
        newCardFee = Number((p.subtotal * 0.03).toFixed(2));
        newTotal += newCardFee;
      }
      
      return {
        ...p,
        payment_method: newMethod,
        card_fee: newCardFee,
        total: Number(newTotal.toFixed(2)),
      };
    }));
  };

  const newTotalGlobal = editedPayments.reduce((s, p) => s + p.total, 0);
  const newTotalFees = editedPayments.reduce((s, p) => s + p.card_fee, 0);
  const oldTotalGlobal = payments.reduce((s, p) => s + Number(p.total), 0);
  const hasChanges = editedPayments.some((p, i) => p.payment_method !== payments[i].payment_method);

  const handleSave = async () => {
    setLoading(true);
    setErrorMsg('');
    
    try {
      // Actualizar cada pago individualmente
      for (const ep of editedPayments) {
        const original = payments.find(p => p.id === ep.id);
        if (!original) continue;
        
        const methodChanged = ep.payment_method !== original.payment_method;
        const feeChanged = ep.card_fee !== Number(original.card_fee);
        const totalChanged = ep.total !== Number(original.total);
        
        if (methodChanged || feeChanged || totalChanged) {
          const { error } = await supabasePos
            .from('pos_payments')
            .update({
              payment_method: ep.payment_method,
              card_fee: ep.card_fee,
              total: ep.total,
            })
            .eq('id', ep.id);
          
          if (error) throw new Error(`Error actualizando pago #${ep.id}: ${error.message}`);
        }
      }

      // Registrar evento
      const oldMethods = payments.map(p => METHOD_LABELS[p.payment_method] ?? p.payment_method).join(' + ');
      const newMethods = editedPayments.map(p => METHOD_LABELS[p.payment_method] ?? p.payment_method).join(' + ');
      
      await supabasePos.from('pos_account_events').insert({
        account_id: accountId,
        event_type: 'payment_edited',
        description: `Forma de pago editada (Admin): "${oldMethods}" → "${newMethods}" · Total: MXN$${oldTotalGlobal.toFixed(2)} → MXN$${newTotalGlobal.toFixed(2)}${newTotalFees > 0 ? ` · +MXN$${newTotalFees.toFixed(2)} cargo terminal` : ''}`,
        metadata: {
          spot,
          old_methods: payments.map(p => ({ method: p.payment_method, total: Number(p.total), card_fee: Number(p.card_fee) })),
          new_methods: editedPayments.map(p => ({ method: p.payment_method, total: p.total, card_fee: p.card_fee })),
          old_total: oldTotalGlobal,
          new_total: newTotalGlobal,
          edited_from: 'admin',
        },
      });

      setSuccess(true);
      setLoading(false);
      setTimeout(() => {
        onSaved();
      }, 800);
    } catch (err: unknown) {
      setLoading(false);
      const message = err instanceof Error ? err.message : 'Error desconocido al actualizar pago';
      setErrorMsg(message);
      console.error('EditPaymentModal error:', err);
    }
  };

  const isMixed = payments.length > 1;

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-black/60" onClick={onSaved} />
        <div className="relative bg-white rounded-2xl w-full max-w-sm p-8 text-center shadow-2xl">
          <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center bg-green-100 rounded-full">
            <i className="ri-check-double-line text-green-600 text-2xl" />
          </div>
          <h3 className="text-lg font-black text-gray-900 mb-2">Pago Actualizado</h3>
          <p className="text-sm text-gray-500">
            {isMixed
              ? 'Las formas de pago se actualizaron correctamente.'
              : `Se cambió a ${METHOD_LABELS[editedPayments[0].payment_method] ?? editedPayments[0].payment_method}.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h3 className="font-bold text-gray-900">Editar Forma de Pago</h3>
            <p className="text-xs text-gray-500">{spot}{customerName ? ` · ${customerName}` : ''}</p>
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
                <p className="text-xs font-bold text-red-700">No se pudo actualizar</p>
                <p className="text-xs text-red-600 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Info: subtotal de consumos (no cambia) */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Subtotal Consumos</span>
            <span className="text-sm font-bold text-gray-900">MXN${subtotalItems.toFixed(2)}</span>
          </div>

          {/* Cada pago */}
          {editedPayments.map((pay, idx) => {
            const currentOpt = PAYMENT_OPTIONS.find(o => o.id === pay.payment_method);
            const originalPay = payments[idx];
            const methodChanged = pay.payment_method !== originalPay?.payment_method;

            return (
              <div key={pay.id} className="border border-gray-100 rounded-xl overflow-hidden">
                {/* Header del pago */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    {isMixed && (
                      <span className="text-xs font-bold text-gray-400">Pago #{idx + 1}</span>
                    )}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${METHOD_COLORS[pay.payment_method] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      <i className={`${METHOD_ICONS[pay.payment_method] ?? 'ri-money-dollar-circle-line'} mr-1`} />
                      {METHOD_LABELS[pay.payment_method] ?? pay.payment_method}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${methodChanged ? 'text-amber-600' : 'text-gray-900'}`}>
                      MXN${pay.total.toFixed(2)}
                      {methodChanged && (
                        <span className="text-xs text-amber-500 ml-1">
                          (era MXN${Number(originalPay?.total ?? 0).toFixed(2)})
                        </span>
                      )}
                    </p>
                    {pay.card_fee > 0 && (
                      <p className="text-xs text-rose-500">+MXN${pay.card_fee.toFixed(2)} terminal</p>
                    )}
                  </div>
                </div>

                {/* Selector de método */}
                <div className="p-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2.5">
                    Cambiar a:
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {PAYMENT_OPTIONS.map(opt => {
                      const isSelected = pay.payment_method === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleMethodChange(idx, opt.id)}
                          className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-gray-200 hover:border-amber-200 hover:bg-amber-50/40'
                          }`}
                        >
                          <i className={`${opt.icon} text-base ${isSelected ? 'text-amber-600' : 'text-gray-400'}`} />
                          <span className={`text-[10px] font-semibold text-center leading-tight ${isSelected ? 'text-amber-700' : 'text-gray-500'}`}>
                            {opt.label.split(' ')[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Preview del cambio de fee */}
                  {methodChanged && (
                    <div className="mt-2.5 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-center gap-2">
                      <i className="ri-information-line text-amber-500 text-sm flex-shrink-0" />
                      <div className="text-xs text-amber-700">
                        {currentOpt?.hasCardFee ? (
                          <span>Se agrega <strong>3% de cargo terminal</strong>: +MXN${pay.card_fee.toFixed(2)}</span>
                        ) : (
                          <span>Se elimina el cargo terminal de <strong>-MXN${Number(originalPay?.card_fee ?? 0).toFixed(2)}</strong></span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Resumen del total */}
          <div className="bg-gray-900 rounded-2xl px-5 py-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-sm">Subtotal consumos</span>
              <span className="text-white font-semibold">MXN${subtotalItems.toFixed(2)}</span>
            </div>
            {newTotalFees > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400 text-sm">Cargo terminal (3%)</span>
                <span className="text-rose-400 font-semibold">+MXN${newTotalFees.toFixed(2)}</span>
              </div>
            )}
            {isMixed && editedPayments.length > 1 && (
              <div className="border-t border-gray-700 pt-2 mb-2">
                <p className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Desglose</p>
                {editedPayments.map((p, i) => (
                  <div key={p.id} className="flex justify-between text-xs text-gray-400 mb-1">
                    <span className="flex items-center gap-1">
                      <i className={METHOD_ICONS[p.payment_method] ?? 'ri-money-dollar-circle-line'} />
                      {METHOD_LABELS[p.payment_method] ?? p.payment_method}
                    </span>
                    <span>MXN${p.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-gray-700 pt-2 mt-1 flex justify-between items-center">
              <span className="text-gray-300 text-sm font-semibold uppercase tracking-wide">Total</span>
              <div className="text-right">
                {hasChanges && (
                  <span className="text-gray-500 text-xs line-through mr-2">MXN${oldTotalGlobal.toFixed(2)}</span>
                )}
                <span className={`text-xl font-black ${hasChanges ? 'text-amber-400' : 'text-amber-400'}`}>
                  MXN${newTotalGlobal.toFixed(2)}
                </span>
              </div>
            </div>
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
              onClick={handleSave}
              disabled={loading || !hasChanges}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <i className="ri-save-line" />
                  Guardar Cambio
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}