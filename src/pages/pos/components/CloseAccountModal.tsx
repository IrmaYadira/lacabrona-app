import { useState } from 'react';
import type { PosAccount, PaymentMethod } from '../types';
import PrintTicketModal from './PrintTicketModal';
import { detectExtras } from '../utils/extrasPrice';

const TRANSFER_DATA = {
  bank: 'Banco Inbursa',
  name: 'Irma Leal',
  clabe: '036320500328209850',
  whatsapp: '3348567795',
};

export interface MixedPaymentEntry {
  method: PaymentMethod;
  amount: number;
}

interface CloseAccountModalProps {
  account: PosAccount;
  closedBy?: string;
  onClose: () => void;
  onConfirm: (
    method: PaymentMethod,
    splitCount: number,
    total: number,
    fee: number,
    mixedPayments?: MixedPaymentEntry[],
    tip?: number,
    closedBy?: string
  ) => void;
}

const CARD_FEE_RATE = 0.03;

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: string; hasCardFee: boolean; color: string }[] = [
  { value: 'cash', label: 'Efectivo', icon: 'ri-money-dollar-circle-line', hasCardFee: false, color: 'text-green-600' },
  { value: 'transfer', label: 'Transferencia', icon: 'ri-bank-line', hasCardFee: false, color: 'text-amber-600' },
  { value: 'credit_card', label: 'Tarjeta Crédito', icon: 'ri-bank-card-line', hasCardFee: true, color: 'text-rose-600' },
  { value: 'debit_card', label: 'Tarjeta Débito', icon: 'ri-bank-card-2-line', hasCardFee: true, color: 'text-indigo-600' },
];

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  credit_card: 'Tarjeta de Crédito',
  debit_card: 'Tarjeta de Débito',
};

export default function CloseAccountModal({ account, closedBy, onClose, onConfirm }: CloseAccountModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [splitCount, setSplitCount] = useState(1);
  const [showPrint, setShowPrint] = useState(false);
  const [clabeCopied, setClabeCopied] = useState(false);
  const [tipAmount, setTipAmount] = useState('');

  // Pagos mixtos
  const [isMixed, setIsMixed] = useState(false);
  const [mixedPayments, setMixedPayments] = useState<MixedPaymentEntry[]>([]);
  const [newMethod, setNewMethod] = useState<PaymentMethod>('cash');
  const [newAmount, setNewAmount] = useState('');

  const copyClabe = () => {
    navigator.clipboard.writeText(TRANSFER_DATA.clabe);
    setClabeCopied(true);
    setTimeout(() => setClabeCopied(false), 2000);
  };

  const items = account.pos_account_items ?? [];

  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  // Fee calculation
  const selectedOption = PAYMENT_OPTIONS.find(o => o.value === paymentMethod)!;
  const cardFee = isMixed
    ? mixedPayments.reduce((fee, p) => {
        const opt = PAYMENT_OPTIONS.find(o => o.value === p.method);
        return fee + (opt?.hasCardFee ? p.amount * CARD_FEE_RATE : 0);
      }, 0)
    : selectedOption.hasCardFee ? subtotal * CARD_FEE_RATE : 0;

  const tip = parseFloat(tipAmount) || 0;
  const total = subtotal + cardFee + tip;
  const perPerson = splitCount > 1 ? total / splitCount : total;

  // Mixed payments
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

  const handleConfirm = () => {
    if (isMixed) {
      const primaryMethod = mixedPayments.length > 0 ? mixedPayments[0].method : 'cash';
      onConfirm(primaryMethod, splitCount, total, cardFee, mixedPayments, tip, closedBy);
    } else {
      onConfirm(paymentMethod, splitCount, total, cardFee, undefined, tip, closedBy);
    }
  };

  const canConfirm = isMixed
    ? mixedPayments.length > 0 && remaining === 0
    : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h3 className="font-bold text-gray-900">Cerrar Cuenta</h3>
            <p className="text-xs text-gray-500">{account.spot} · {account.customer_name || 'Sin nombre'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer">
            <i className="ri-close-line text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Items summary — desglose por ronda con estado entregado/pendiente */}
          {(() => {
            const folios = [...new Set(items.map(i => i.folio_number))].sort((a, b) => a - b);
            const totalDelivered = items.filter(i => i.delivered).length;
            const totalPending = items.filter(i => !i.delivered).length;
            return (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resumen de Consumo</p>
                  <div className="flex items-center gap-2">
                    {totalDelivered > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                        <i className="ri-checkbox-circle-fill text-[10px]" />
                        {totalDelivered} entregado{totalDelivered !== 1 ? 's' : ''}
                      </span>
                    )}
                    {totalPending > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
                        <i className="ri-time-line text-[10px]" />
                        {totalPending} pendiente{totalPending !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-0.5">
                  {folios.map(folio => {
                    const folioItems = items.filter(i => i.folio_number === folio);
                    const folioTotal = folioItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
                    const allDone = folioItems.every(i => i.delivered);
                    const noneDone = folioItems.every(i => !i.delivered);
                    const deliveredCount = folioItems.filter(i => i.delivered).length;
                    const pendingCount = folioItems.filter(i => !i.delivered).length;

                    return (
                      <div
                        key={folio}
                        className={`rounded-xl border overflow-hidden ${
                          allDone
                            ? 'border-green-200'
                            : pendingCount > 0 && deliveredCount > 0
                            ? 'border-amber-200'
                            : 'border-gray-200'
                        }`}
                      >
                        {/* Header ronda */}
                        <div className={`flex items-center justify-between px-3 py-1.5 ${
                          allDone
                            ? 'bg-green-50'
                            : pendingCount > 0 && deliveredCount > 0
                            ? 'bg-amber-50'
                            : 'bg-gray-50'
                        }`}>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full text-white ${
                              allDone ? 'bg-green-500' : noneDone ? 'bg-gray-400' : 'bg-amber-500'
                            }`}>
                              Ronda #{String(folio).padStart(2, '0')}
                            </span>
                            {allDone && (
                              <span className="text-[10px] text-green-600 font-bold flex items-center gap-0.5">
                                <i className="ri-checkbox-circle-fill" />Entregada
                              </span>
                            )}
                            {!allDone && deliveredCount > 0 && (
                              <span className="text-[10px] text-amber-600 font-semibold">
                                {deliveredCount}/{folioItems.length} entregados
                              </span>
                            )}
                            {noneDone && (
                              <span className="text-[10px] text-red-500 font-semibold flex items-center gap-0.5">
                                <i className="ri-time-line" />Sin entregar
                              </span>
                            )}
                          </div>
                          <span className={`text-xs font-bold ${
                            allDone ? 'text-green-600' : 'text-gray-700'
                          }`}>${folioTotal.toFixed(2)}</span>
                        </div>

                        {/* Items de la ronda */}
                        <div className="divide-y divide-gray-50 bg-white">
                          {folioItems.map(item => (
                            <div
                              key={item.id}
                              className={`px-3 py-1.5 ${
                                item.delivered ? 'bg-green-50/40' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {/* Indicador entregado/pendiente */}
                                <div className={`w-4 h-4 flex items-center justify-center rounded-full flex-shrink-0 ${
                                  item.delivered
                                    ? 'bg-green-500'
                                    : 'border-2 border-gray-300'
                                }`}>
                                  {item.delivered && (
                                    <i className="ri-check-line text-white" style={{ fontSize: 9 }} />
                                  )}
                                </div>
                                <span className={`flex-1 text-sm min-w-0 truncate ${
                                  item.delivered ? 'text-gray-400 line-through decoration-gray-300' : 'text-gray-800 font-medium'
                                }`}>
                                  {item.quantity}x {item.product_name}
                                  {item.size && <span className="text-gray-400 text-xs ml-1 not-italic no-underline">({item.size})</span>}
                                </span>
                                <span className={`text-xs font-bold flex-shrink-0 ${
                                  item.delivered ? 'text-gray-400' : 'text-gray-900'
                                }`}>
                                  ${(item.unit_price * item.quantity).toFixed(2)}
                                </span>
                              </div>
                              {/* Badges de extras con cobro en cierre de cuenta */}
                              {(() => {
                                const extras = detectExtras(item.size ?? '');
                                if (extras.length === 0) return null;
                                return (
                                  <div className="flex flex-wrap gap-1 mt-1 ml-5">
                                    {extras.map((ex, idx) => (
                                      <span key={idx} className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 whitespace-nowrap">
                                        +{ex.label} ${ex.price}
                                      </span>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

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
              <i className={`${isMixed ? 'ri-checkbox-circle-fill' : 'ri-split-cells-horizontal'}`} />
              Pago Mixto
            </button>
          </div>

          {/* PAGO SIMPLE */}
          {!isMixed && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPaymentMethod(opt.value)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left cursor-pointer transition-all ${
                      paymentMethod === opt.value
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <i className={`${opt.icon} text-lg ${paymentMethod === opt.value ? 'text-amber-600' : opt.color}`} />
                    <span className={`text-xs font-semibold ${paymentMethod === opt.value ? 'text-amber-700' : 'text-gray-600'}`}>
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>

              {selectedOption.hasCardFee && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <i className="ri-information-line" />
                  Se agrega 3% por uso de terminal (+${cardFee.toFixed(2)})
                </p>
              )}

              {paymentMethod === 'transfer' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
                  <div className="px-3 py-2 bg-amber-100 border-b border-amber-200 flex items-center gap-2">
                    <i className="ri-bank-line text-amber-700 text-sm" />
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Datos para Transferencia</span>
                  </div>
                  <div className="px-3 py-2.5 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-amber-700 font-medium">Banco</span>
                      <span className="text-amber-900 font-bold">{TRANSFER_DATA.bank}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-amber-700 font-medium">Titular</span>
                      <span className="text-amber-900 font-bold">{TRANSFER_DATA.name}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-amber-700 font-medium">CLABE</span>
                      <button
                        type="button"
                        onClick={copyClabe}
                        className="flex items-center gap-1.5 bg-white border border-amber-300 px-2 py-1 rounded-lg hover:bg-amber-50 cursor-pointer transition-colors"
                      >
                        <span className="font-mono font-bold text-amber-900 tracking-wider">{TRANSFER_DATA.clabe}</span>
                        <i className={`text-amber-500 text-xs ${clabeCopied ? 'ri-check-line' : 'ri-file-copy-line'}`} />
                      </button>
                    </div>
                    {clabeCopied && (
                      <p className="text-xs text-green-600 font-semibold text-center">
                        <i className="ri-check-line mr-1" />CLABE copiada
                      </p>
                    )}
                    <div className="flex justify-between items-center text-xs pt-1 border-t border-amber-200">
                      <span className="text-amber-700 font-medium">Comprobante</span>
                      <span className="text-amber-900 font-bold">WA {TRANSFER_DATA.whatsapp}</span>
                    </div>
                  </div>
                </div>
              )}

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
                    <i className="ri-heart-3-line mr-1" />+${tip.toFixed(2)} propina
                  </p>
                )}
              </div>
            </>
          )}

          {/* PAGO MIXTO */}
          {isMixed && (
            <div className="space-y-3">
              {/* Lista de pagos agregados */}
              {mixedPayments.length > 0 && (
                <div className="space-y-2">
                  {mixedPayments.map((p, idx) => {
                    const opt = PAYMENT_OPTIONS.find(o => o.value === p.method)!;
                    const fee = opt.hasCardFee ? p.amount * CARD_FEE_RATE : 0;
                    return (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                        <div className={`w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200`}>
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

              {/* Estado del pago */}
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

              {/* Agregar nuevo pago */}
              {remaining > 0 && (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-3 space-y-3">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                    Agregar Pago {mixedPayments.length + 1}
                  </p>

                  {/* Selección de método */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {PAYMENT_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setNewMethod(opt.value)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 cursor-pointer transition-all ${
                          newMethod === opt.value
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <i className={`${opt.icon} text-base ${newMethod === opt.value ? 'text-amber-600' : opt.color}`} />
                        <span className={`text-[10px] font-semibold text-center leading-tight ${newMethod === opt.value ? 'text-amber-700' : 'text-gray-500'}`}>
                          {opt.label.split(' ')[0]}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Monto */}
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
                      onClick={() => { setNewAmount(remaining.toFixed(2)); }}
                      className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:border-amber-400 hover:text-amber-700 cursor-pointer transition-colors whitespace-nowrap"
                      title="Usar monto restante"
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

                  {PAYMENT_OPTIONS.find(o => o.value === newMethod)?.hasCardFee && newAmount && parseFloat(newAmount) > 0 && (
                    <p className="text-xs text-rose-500 flex items-center gap-1">
                      <i className="ri-information-line" />
                      +3% terminal sobre este monto: +${(parseFloat(newAmount) * CARD_FEE_RATE).toFixed(2)}
                    </p>
                  )}
                </div>
              )}

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
              </div>
            </div>
          )}

          {/* Dividir cuenta */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dividir Cuenta</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSplitCount(Math.max(1, splitCount - 1))}
                className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 hover:border-amber-500 hover:text-amber-600 cursor-pointer transition-colors"
              >
                <i className="ri-subtract-line" />
              </button>
              <span className="text-lg font-bold text-gray-900 w-8 text-center">{splitCount}</span>
              <button
                onClick={() => setSplitCount(splitCount + 1)}
                className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 hover:border-amber-500 hover:text-amber-600 cursor-pointer transition-colors"
              >
                <i className="ri-add-line" />
              </button>
              <span className="text-sm text-gray-500">
                {splitCount === 1 ? 'Sin dividir' : `${splitCount} personas`}
              </span>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-900 rounded-xl px-4 py-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <span>Subtotal</span>
              <span className="text-white">MXN$${subtotal.toFixed(2)}</span>
            </div>
            {cardFee > 0 && (
              <div className="flex justify-between text-sm text-rose-400">
                <span>Cargo terminal (3%)</span>
                <span>+MXN$${cardFee.toFixed(2)}</span>
              </div>
            )}
            {tip > 0 && (
              <div className="flex justify-between text-sm text-emerald-400">
                <span>Propina</span>
                <span>+MXN$${tip.toFixed(2)}</span>
              </div>
            )}
            {isMixed && mixedPayments.length > 0 && (
              <>
                <div className="border-t border-gray-700 pt-2 mt-1">
                  <p className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Desglose de pagos</p>
                  {mixedPayments.map((p, idx) => {
                    const opt = PAYMENT_OPTIONS.find(o => o.value === p.method)!;
                    const fee = opt.hasCardFee ? p.amount * CARD_FEE_RATE : 0;
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
              </>
            )}
            <div className="border-t border-gray-700 pt-2 flex justify-between items-center">
              <span className="text-gray-300 text-sm font-semibold uppercase tracking-wide">Total</span>
              <span className="text-amber-400 text-2xl font-black">MXN$${total.toFixed(2)}</span>
            </div>
            {splitCount > 1 && (
              <div className="flex justify-between text-sm font-semibold text-green-400 bg-gray-800 rounded-lg px-3 py-2">
                <span>Por persona ({splitCount})</span>
                <span>MXN$${perPerson.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={() => setShowPrint(true)}
              className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-2"
            >
              <i className="ri-printer-line" />
              Imprimir Ticket Previo
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={!canConfirm}
                className="flex-1 py-3 bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className="ri-check-line mr-1" />
                {isMixed && remaining > 0 ? `Faltan $${remaining.toFixed(2)}` : 'Cerrar Cuenta'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPrint && (
        <PrintTicketModal
          account={account}
          items={account.pos_account_items ?? []}
          paymentMethod={isMixed ? (mixedPayments[0]?.method ?? 'cash') : paymentMethod}
          mixedPayments={isMixed && mixedPayments.length > 0 ? mixedPayments : undefined}
          splitCount={splitCount}
          total={total}
          cardFee={cardFee}
          tip={tip}
          customerPhone={account.customer_phone || undefined}
          mode="cuenta"
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  );
}