import { useState, useEffect } from 'react';
import { getLoyaltyCustomerFromStorage } from '@/hooks/useLoyaltyCustomer';
import { PESOS_PER_POINT } from '@/hooks/useLoyaltyRewards';
import { Link } from 'react-router-dom';

interface LoyaltyPointsBadgeProps {
  cartTotal: number;
}

export default function LoyaltyPointsBadge({ cartTotal }: LoyaltyPointsBadgeProps) {
  const [customer, setCustomer] = useState(() => getLoyaltyCustomerFromStorage());
  const currentPoints = customer?.loyalty_points ?? 0;
  const earnedPoints = Math.floor(cartTotal / PESOS_PER_POINT);
  const newTotal = currentPoints + earnedPoints;

  // Re-sync on focus / storage change
  useEffect(() => {
    const sync = () => setCustomer(getLoyaltyCustomerFromStorage());
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  if (!customer) {
    return (
      <Link
        to="/"
        className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 cursor-pointer hover:bg-amber-500/20 transition-colors"
      >
        <i className="ri-vip-crown-2-line text-amber-400 text-sm" />
        <span className="text-amber-400 text-xs font-bold whitespace-nowrap">Regístrate y gana puntos</span>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2">
        <i className="ri-vip-crown-2-fill text-amber-400 text-sm" />
        <span className="text-gray-400 text-xs">Tienes</span>
        <span className="text-amber-400 text-sm font-black">{currentPoints}</span>
        <span className="text-gray-500 text-xs">pts</span>
      </div>

      {earnedPoints > 0 && (
        <div className="flex items-center gap-1.5 bg-green-900/20 border border-green-500/30 rounded-xl px-3 py-2">
          <i className="ri-add-circle-fill text-green-400 text-sm" />
          <span className="text-green-400 text-xs font-black">+{earnedPoints} pts</span>
          <span className="text-green-600 text-[10px] hidden sm:inline">con este pedido</span>
        </div>
      )}

      {earnedPoints > 0 && (
        <div className="hidden sm:flex items-center gap-1 text-gray-500 text-xs">
          <i className="ri-arrow-right-line" />
          <span className="text-white text-sm font-black">{newTotal}</span>
          <span>pts totales</span>
        </div>
      )}
    </div>
  );
}