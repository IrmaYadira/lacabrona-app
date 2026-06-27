import { useState } from 'react';
import { Link } from 'react-router-dom';

interface AccountActionFloatingProps {
  menuUrl: string;
  spot?: string;
  area?: string;
  total: number;
  onConfirmBill: (tipPct: number, paymentMethod: string, note: string) => Promise<boolean>;
  pendingItems: number;
  billStatus?: 'idle' | 'sent';
  onCancelBillRequest?: () => void;
}

const TIP_OPTIONS = [
  { label: 'Sin propina', pct: 0 },
  { label: '10%', pct: 10 },
  { label: '15%', pct: 15 },
  { label: '20%', pct: 20 },
];

const PAYMENT_METHODS = [
  { id: 'efectivo', label: 'Efectivo', icon: 'ri-money-dollar-circle-line' },
  { id: 'tarjeta', label: 'Tarjeta', icon: 'ri-bank-card-line' },
  { id: 'transferencia', label: 'Transferencia', icon: 'ri-exchange-funds-line' },
];

export default function AccountActionFloating({
  menuUrl,
  spot,
  total,
  onConfirmBill,
  pendingItems,
  billStatus,
  onCancelBillRequest,
}: AccountActionFloatingProps) {
  const [phase, setPhase] = useState<'bar' | 'confirm' | 'sending' | 'sent'>('bar');
  const [selectedTip, setSelectedTip] = useState(0);
  const [selectedPayment, setSelectedPayment] = useState('efectivo');
  const [customerNote, setCustomerNote] = useState('');

  const tipAmount = total * (selectedTip / 100);
  const grandTotal = total + tipAmount;
  const billWasSent = billStatus === 'sent' || phase === 'sent';

  const handleCerrarCuenta = () => {
    if (navigator.vibrate) navigator.vibrate(50);
    setPhase('confirm');
  };

  const handleConfirm = async () => {
    setPhase('sending');
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    const success = await onConfirmBill(selectedTip, selectedPayment, customerNote);
    if (success) {
      setPhase('sent');
    } else {
      setPhase('bar');
    }
  };

  const handleCancelConfirm = () => {
    setPhase('bar');
  };

  const handleCancelRequest = () => {
    onCancelBillRequest?.();
    setPhase('bar');
  };

  const handleOutsideClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setPhase('bar');
    }
  };

  return (
    <>
      {/* Panel de confirmación — ocupa toda la parte baja */}
      {phase === 'confirm' && (
        <div
          className="fixed inset-0 z-[10001] flex items-end justify-center bg-black/60"
          onClick={handleOutsideClick}
        >
          <div
            className="w-full max-w-lg bg-gray-900 border-t-4 border-green-500 rounded-t-3xl overflow-hidden"
            style={{ filter: 'drop-shadow(0 -12px 40px rgba(34,197,94,0.3))' }}
          >
            {/* Handle visual */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-700 rounded-full" />
            </div>

            <div className="px-5 pt-2 pb-6">
              {/* Header */}
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <i className="ri-receipt-line text-white text-2xl" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xl font-black uppercase tracking-wider leading-tight">
                    CERRAR CUENTA
                  </p>
                  <p className="text-gray-400 text-sm mt-0.5">
                    El mesero se acercará a {spot || 'tu mesa'} para cobrar
                  </p>
                </div>
                <button
                  onClick={handleCancelConfirm}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400 cursor-pointer transition-colors flex-shrink-0"
                >
                  <i className="ri-close-line text-lg" />
                </button>
              </div>

              {/* Desglose */}
              <div className="bg-gray-800 rounded-2xl px-5 py-4 mb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-base">Consumo</span>
                  <span className="text-white text-base font-bold">${total.toFixed(2)}</span>
                </div>
                {selectedTip > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-base">Propina ({selectedTip}%)</span>
                    <span className="text-green-400 text-base font-bold">+${tipAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                  <span className="text-white text-lg font-black">TOTAL A PAGAR</span>
                  <span className="text-green-400 text-3xl font-black">${grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Propina rápida */}
              <div className="mb-4">
                <p className="text-gray-500 text-sm font-bold mb-3">¿Dejar propina?</p>
                <div className="grid grid-cols-4 gap-2">
                  {TIP_OPTIONS.map(opt => (
                    <button
                      key={opt.pct}
                      onClick={() => setSelectedTip(opt.pct)}
                      className={`py-3 rounded-xl text-base font-black cursor-pointer transition-all active:scale-95 whitespace-nowrap ${
                        selectedTip === opt.pct
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Forma de pago */}
              <div className="mb-4">
                <p className="text-gray-500 text-sm font-bold mb-3">Forma de pago</p>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map(pm => (
                    <button
                      key={pm.id}
                      onClick={() => setSelectedPayment(pm.id)}
                      className={`flex flex-col items-center gap-1.5 py-3.5 rounded-xl border-2 text-sm font-bold cursor-pointer transition-all active:scale-95 whitespace-nowrap ${
                        selectedPayment === pm.id
                          ? 'bg-green-500/10 border-green-500 text-green-400'
                          : 'bg-gray-800 text-gray-500 border-gray-700 hover:bg-gray-700 hover:text-gray-300 hover:border-gray-600'
                      }`}
                    >
                      <i className={`${pm.icon} text-xl`} />
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nota opcional */}
              <div className="mb-5">
                <textarea
                  value={customerNote}
                  onChange={e => setCustomerNote(e.target.value)}
                  placeholder="Nota para el mesero (opcional)..."
                  rows={2}
                  maxLength={200}
                  className="w-full bg-gray-800 border-2 border-gray-700 focus:border-green-500 rounded-xl px-4 py-3 text-base text-white placeholder-gray-600 resize-none outline-none transition-colors"
                />
              </div>

              {/* Botones de confirmación */}
              <button
                onClick={handleConfirm}
                disabled={phase === 'sending'}
                className="w-full py-4 rounded-2xl bg-green-500 hover:bg-green-400 active:bg-green-600 disabled:opacity-60 text-white text-lg font-black cursor-pointer transition-all whitespace-nowrap flex items-center justify-center gap-3 mb-3"
              >
                {phase === 'sending' ? (
                  <><i className="ri-loader-4-line animate-spin text-xl" /> Enviando solicitud...</>
                ) : (
                  <><i className="ri-checkbox-circle-fill text-xl" /> SÍ, CERRAR CUENTA — ${grandTotal.toFixed(0)}</>
                )}
              </button>

              <button
                onClick={handleCancelConfirm}
                className="w-full py-3.5 rounded-xl border-2 border-gray-700 text-gray-400 text-base font-bold cursor-pointer hover:bg-gray-800 transition-colors whitespace-nowrap"
              >
                Cancelar, seguir pidiendo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra principal — SIEMPRE visible, estilo admin */}
      <div className="fixed bottom-0 left-0 right-0 z-[10000]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {/* Somos verdes y grandes cuando la cuenta ya está solicitada */}
        {billWasSent ? (
          <div className="bg-green-600 border-t-4 border-green-400 px-4 pt-4 pb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                <i className="ri-checkbox-circle-fill text-white text-2xl" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-lg font-black uppercase tracking-wide leading-tight">
                  ¡CUENTA SOLICITADA!
                </p>
                <p className="text-green-100 text-sm mt-1">
                  El mesero ya va a {spot || 'tu mesa'} a cobrar
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white text-3xl font-black">${grandTotal.toFixed(0)}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Link
                to={menuUrl}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white/20 hover:bg-white/30 rounded-xl text-white font-black text-sm cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className="ri-add-circle-fill" />
                SEGUIR PIDIENDO
              </Link>
              <button
                onClick={handleCancelRequest}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white/10 hover:bg-red-500/30 rounded-xl text-white font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className="ri-close-circle-line" />
                Cancelar solicitud
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-900 border-t-4 border-amber-500 px-4 pt-4 pb-6">
            {/* Fila 1: TU CUENTA + Total */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <i className="ri-receipt-line text-white text-lg" />
                </div>
                <div>
                  <p className="text-amber-400 font-black text-sm uppercase tracking-widest leading-tight">
                    TU CUENTA
                  </p>
                  {spot && (
                    <p className="text-gray-500 text-xs font-bold leading-tight">
                      {spot}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-white text-4xl font-black leading-none tabular-nums">
                  ${total.toFixed(0)}
                </p>
                {pendingItems > 0 && (
                  <p className="text-amber-400 text-xs font-bold mt-1 flex items-center justify-end gap-1">
                    <i className="ri-loader-2-line animate-spin" />
                    {pendingItems} en camino
                  </p>
                )}
              </div>
            </div>

            {/* Fila 2: Botones GRANDES */}
            <div className="flex gap-3">
              <Link
                to={menuUrl}
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 rounded-2xl text-gray-900 font-black text-base cursor-pointer transition-all active:scale-[0.97] whitespace-nowrap"
              >
                <i className="ri-add-circle-fill text-lg" />
                SEGUIR PIDIENDO
              </Link>
              <button
                onClick={handleCerrarCuenta}
                className="flex-[1.3] flex items-center justify-center gap-2 py-4 bg-green-500 hover:bg-green-400 active:bg-green-600 rounded-2xl text-white font-black text-base cursor-pointer transition-all active:scale-[0.97] whitespace-nowrap"
                style={{ animation: 'pulse 2s ease-in-out infinite' }}
              >
                <i className="ri-checkbox-circle-fill text-lg" />
                CERRAR CUENTA
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Keyframes para el pulso del botón verde */}
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
          50% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
        }
      `}</style>
    </>
  );
}