import { useEffect, useState, useCallback } from 'react';
import { PESOS_PER_POINT } from '@/hooks/useLoyaltyRewards';

interface Toast {
  id: string;
  points: number;
  productName: string;
  x: number;
  y: number;
}

let globalAddListener: ((item: { price: number; name: string }) => void) | null = null;

export function notifyPointsEarned(item: { price: number; name: string }) {
  globalAddListener?.(item);
}

export default function PointsToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((item: { price: number; name: string }) => {
    const points = Math.max(Math.floor(item.price / PESOS_PER_POINT), 1);
    const id = `${Date.now()}-${Math.random()}`;
    // Random slight horizontal offset for organic feel
    const x = Math.random() * 40 - 20;
    setToasts(prev => [...prev.slice(-2), { id, points, productName: item.name, x, y: 0 }]);

    // Auto remove
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2500);
  }, []);

  useEffect(() => {
    globalAddListener = addToast;
    return () => { globalAddListener = null; };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] flex items-end justify-center pb-28 sm:pb-32">
      <div className="flex flex-col items-center gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="bg-gray-900 border border-amber-500/50 rounded-2xl px-5 py-3 flex items-center gap-3 shadow-lg"
            style={{
              animation: 'pointsFloatUp 2.4s ease-out forwards',
              transform: `translateX(${toast.x}px)`,
            }}
          >
            <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="ri-vip-crown-2-fill text-amber-400 text-base" />
            </div>
            <div>
              <p className="text-amber-400 text-sm font-black">+{toast.points} puntos</p>
              <p className="text-gray-500 text-xs truncate max-w-[180px]">{toast.productName}</p>
            </div>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes pointsFloatUp {
          0% { opacity: 0; transform: translateY(20px) scale(0.9); }
          12% { opacity: 1; transform: translateY(0) scale(1); }
          75% { opacity: 1; transform: translateY(-10px) scale(1); }
          100% { opacity: 0; transform: translateY(-40px) scale(0.95); }
        }
      `}</style>
    </div>
  );
}