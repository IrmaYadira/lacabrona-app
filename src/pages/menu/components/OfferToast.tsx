import { useEffect, useState, useCallback } from 'react';

interface Toast {
  id: string;
  offerTitle: string;
  savedAmount?: number;
  x: number;
}

let globalOfferListener: ((offerTitle: string, savedAmount?: number) => void) | null = null;

export function notifyOfferApplied(offerTitle: string, savedAmount?: number) {
  globalOfferListener?.(offerTitle, savedAmount);
}

export default function OfferToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((offerTitle: string, savedAmount?: number) => {
    const id = `${Date.now()}-${Math.random()}`;
    const x = Math.random() * 30 - 15;
    setToasts(prev => [...prev.slice(-1), { id, offerTitle, savedAmount, x }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3200);
  }, []);

  useEffect(() => {
    globalOfferListener = addToast;
    return () => { globalOfferListener = null; };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[70] flex items-start justify-center pt-20 sm:pt-24">
      <div className="flex flex-col items-center gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="relative overflow-hidden rounded-2xl px-6 py-3.5 flex items-center gap-3 shadow-xl border border-amber-300/60"
            style={{
              background: 'linear-gradient(135deg, #92400e 0%, #b45309 50%, #d97706 100%)',
              animation: 'offerToastPop 3s ease-out forwards',
              transform: `translateX(${toast.x}px)`,
            }}
          >
            {/* Shimmer stripe */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                animation: 'offerShimmer 1.8s ease-in-out infinite',
              }}
            />
            <div className="relative w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
              <i className="ri-fire-fill text-amber-200 text-lg" />
            </div>
            <div className="relative">
              <p className="text-white text-sm font-black tracking-wide">¡Oferta aplicada!</p>
              <p className="text-amber-100 text-xs font-medium truncate max-w-[200px]">{toast.offerTitle}</p>
              {typeof toast.savedAmount === 'number' && toast.savedAmount > 0 && (
                <p className="text-green-300 text-[11px] font-bold mt-0.5">
                  Ahorraste ${toast.savedAmount.toFixed(2)}
                </p>
              )}
            </div>
            <div className="relative w-7 h-7 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">🎉</span>
            </div>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes offerToastPop {
          0% { opacity: 0; transform: translateY(-30px) scale(0.85); }
          10% { opacity: 1; transform: translateY(6px) scale(1.02); }
          18% { transform: translateY(0) scale(1); }
          80% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-16px) scale(0.95); }
        }
        @keyframes offerShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}