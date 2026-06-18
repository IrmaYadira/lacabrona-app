import { useEffect, useRef } from 'react';

interface CheckRequestModalProps {
  onWithSelfie: () => void;
  onWithoutSelfie: () => void;
  onCancel: () => void;
}

export default function CheckRequestModal({ onWithSelfie, onWithoutSelfie, onCancel }: CheckRequestModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Cerrar con Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  // Cerrar al hacer clic fuera
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onCancel();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-xs bg-white rounded-3xl overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex flex-col items-center gap-2 pt-6 pb-3 px-6 text-center">
          <div className="w-12 h-12 flex items-center justify-center rounded-full bg-emerald-100">
            <i className="ri-receipt-line text-emerald-600 text-2xl" />
          </div>
          <div>
            <p className="text-gray-900 font-black text-lg leading-tight">¿Pedir la cuenta?</p>
            <p className="text-gray-500 text-sm mt-0.5">
              El mesero vendrá a cobrarte
            </p>
          </div>
        </div>

        {/* Options */}
        <div className="px-5 pb-2 flex flex-col gap-2.5">
          <button
            onClick={onWithSelfie}
            className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl border-2 border-orange-200 bg-orange-50 hover:bg-orange-100 text-left transition-colors cursor-pointer active:scale-[0.98]"
          >
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-orange-500 text-white flex-shrink-0">
              <i className="ri-camera-line text-lg" />
            </div>
            <div className="min-w-0">
              <p className="text-gray-900 font-bold text-sm">Con selfie</p>
              <p className="text-gray-500 text-xs">Para que el mesero te encuentre fácil</p>
            </div>
          </button>

          <button
            onClick={onWithoutSelfie}
            className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl border-2 border-gray-200 bg-gray-50 hover:bg-gray-100 text-left transition-colors cursor-pointer active:scale-[0.98]"
          >
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-400 text-white flex-shrink-0">
              <i className="ri-receipt-line text-lg" />
            </div>
            <div className="min-w-0">
              <p className="text-gray-900 font-bold text-sm">Solo la cuenta</p>
              <p className="text-gray-500 text-xs">Te identificará por tu nombre/mesa</p>
            </div>
          </button>
        </div>

        {/* Cancel */}
        <div className="px-5 pb-5 pt-1">
          <button
            onClick={onCancel}
            className="w-full py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm cursor-pointer transition-colors active:scale-[0.98] whitespace-nowrap"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}