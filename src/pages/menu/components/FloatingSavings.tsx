import { useState, useEffect, useCallback } from 'react';

interface FloatingItem {
  id: string;
  amount: number;
  x: number;
  y: number;
}

let globalTrigger: ((amount: number, x?: number, y?: number) => void) | null = null;

export function showFloatingSavings(amount: number, x?: number, y?: number) {
  globalTrigger?.(amount, x, y);
}

export default function FloatingSavings() {
  const [items, setItems] = useState<FloatingItem[]>([]);

  const addItem = useCallback((amount: number, x?: number, y?: number) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const finalX = x ?? window.innerWidth / 2;
    const finalY = y ?? window.innerHeight - 140;
    setItems(prev => [...prev, { id, amount, x: finalX, y: finalY }]);

    setTimeout(() => {
      setItems(prev => prev.filter(i => i.id !== id));
    }, 1700);
  }, []);

  useEffect(() => {
    globalTrigger = addItem;
    return () => { globalTrigger = null; };
  }, [addItem]);

  if (items.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[80]">
      {items.map(item => (
        <div
          key={item.id}
          className="absolute"
          style={{
            left: item.x,
            top: item.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className="flex items-center gap-1.5 bg-green-600 text-white font-black text-xs px-3 py-1.5 rounded-full shadow-lg border border-green-400 whitespace-nowrap"
            style={{
              animation: 'floatSavings 1.5s cubic-bezier(0.22, 1, 0.36, 1) forwards',
            }}
          >
            <i className="ri-arrow-up-circle-fill text-green-300 text-sm" />
            +${item.amount.toFixed(2)}
          </div>
        </div>
      ))}
      <style>{`
        @keyframes floatSavings {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.7);
          }
          12% {
            opacity: 1;
            transform: translateY(-4px) scale(1.08);
          }
          25% {
            transform: translateY(-14px) scale(1);
          }
          75% {
            opacity: 1;
            transform: translateY(-70px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-100px) scale(0.85);
          }
        }
      `}</style>
    </div>
  );
}