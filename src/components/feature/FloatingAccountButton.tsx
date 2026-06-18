import { useEffect, useRef, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { getActiveAccount, type ActiveAccount } from '@/hooks/useActiveAccount';
import { supabasePos } from '@/pages/pos/supabasePos';

export default function FloatingAccountButton() {
  const location = useLocation();
  const [account, setAccount] = useState<ActiveAccount | null>(null);
  const [visible, setVisible] = useState(false);
  const [total, setTotal] = useState<number>(0);
  const [totalQty, setTotalQty] = useState<number>(0);
  const [totalPulse, setTotalPulse] = useState(false);
  const prevTotal = useRef(0);
  const prevQty = useRef(0);

  // Leer cuenta activa y total en tiempo real
  useEffect(() => {
    const check = async () => {
      const acc = getActiveAccount();
      setAccount(acc);
      if (acc) {
        setTimeout(() => setVisible(true), 300);
        // Fetch total actual de la cuenta
        try {
          const { data: items } = await supabasePos
            .from('pos_account_items')
            .select('unit_price, quantity')
            .eq('account_id', acc.accountId);
          const newTotal = (items ?? []).reduce((s, it) => s + (it.unit_price * it.quantity), 0);
          const newQty = (items ?? []).reduce((s, it) => s + it.quantity, 0);
          setTotal(newTotal);
          setTotalQty(newQty);
          // Pulse anim si el total cambió
          if (newTotal !== prevTotal.current && prevTotal.current > 0) {
            setTotalPulse(true);
            setTimeout(() => setTotalPulse(false), 800);
          }
          prevTotal.current = newTotal;
          prevQty.current = newQty;
        } catch {
          // silencioso
        }
      } else {
        setVisible(false);
        setTotal(0);
        setTotalQty(0);
        prevTotal.current = 0;
        prevQty.current = 0;
      }
    };
    check();
    const iv = setInterval(check, 5000);
    return () => clearInterval(iv);
  }, []);

  // No mostrar si no hay cuenta o ya estamos en /cuenta
  if (!account || !visible) return null;
  if (location.pathname.startsWith('/cuenta')) return null;

  // Calcular si está en página de lealtad para variante estilizada
  const isLoyaltyPage = location.pathname.startsWith('/mi-tarjeta');
  const isAccountHistory = location.pathname.startsWith('/mis-cuentas');
  const isMenu = location.pathname.startsWith('/menu') || location.pathname === '/';

  return (
    <Link
      to={`/cuenta?id=${account.accountId}`}
      className={`fixed bottom-6 z-[60] flex items-center transition-all active:scale-95 group ${
        isLoyaltyPage
          ? 'left-1/2 -translate-x-1/2 bg-gray-900 hover:bg-gray-800 border border-amber-500/60 hover:border-amber-400 text-white px-5 py-3.5 rounded-full shadow-2xl'
          : 'left-4 bg-gray-900 hover:bg-gray-800 border border-amber-500/50 hover:border-amber-400 text-white px-4 py-3 rounded-full shadow-2xl'
      }`}
      style={{ filter: 'drop-shadow(0 6px 20px rgba(0,0,0,0.45))' }}
    >
      {/* Badge animado de pulso */}
      <div className="relative flex-shrink-0 mr-1">
        <div className={`${isLoyaltyPage ? 'w-10 h-10' : 'w-9 h-9'} flex items-center justify-center bg-amber-500 rounded-full`}>
          <i className="ri-receipt-line text-white text-base" />
        </div>
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-900 animate-pulse" />
      </div>

      <div className="leading-tight min-w-0">
        <span className={`font-black block truncate ${isLoyaltyPage ? 'text-sm' : 'text-sm'}`}>
          {isLoyaltyPage ? 'Mi Cuenta' : 'Mi Cuenta'}
        </span>
        <span className={`block truncate ${isLoyaltyPage ? 'text-[11px]' : 'text-[11px]'}`}>
          <span className="text-amber-400">${total.toFixed(2)}</span>
          <span className="text-gray-500 mx-1">·</span>
          <span className="text-gray-400">{totalQty} producto{totalQty !== 1 ? 's' : ''}</span>
          <span className="text-gray-500 mx-1">·</span>
          <span className="text-gray-400">{account.spot}</span>
          {isLoyaltyPage && account.customerName ? (
            <span className="text-gray-500"> · {account.customerName}</span>
          ) : ''}
        </span>
      </div>

      {/* Total badge con pulse anim */}
      {total > 0 && (
        <div className={`flex-shrink-0 ml-2 ${totalPulse ? 'animate-pulse' : ''}`}>
          <span className="bg-amber-500 text-gray-900 text-[11px] font-black px-2.5 py-1 rounded-full whitespace-nowrap">
            ${total.toFixed(0)}
          </span>
        </div>
      )}

      <div className={`flex items-center justify-center flex-shrink-0 ${isLoyaltyPage ? 'w-6 h-6 ml-2' : 'w-5 h-5 ml-1.5'}`}>
        <i className="ri-arrow-right-s-line text-amber-400 text-lg" />
      </div>
    </Link>
  );
}