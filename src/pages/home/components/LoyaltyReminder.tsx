import { useState, useEffect } from 'react';
import { getLoyaltyCustomerFromStorage } from '@/hooks/useLoyaltyCustomer';
import { Link } from 'react-router-dom';

interface LoyaltyReminderProps {
  onOpenModal: () => void;
}

const SHOW_AFTER_MS = 25_000;
const DISMISSED_KEY = 'lc_loyalty_reminder_dismissed';

type State = 'hidden' | 'banner' | 'mini' | 'gone';

export default function LoyaltyReminder({ onOpenModal }: LoyaltyReminderProps) {
  const [state, setState] = useState<State>('hidden');
  const [animateIn, setAnimateIn] = useState(false);

  // Mostrar banner después de X segundos si no está registrado
  useEffect(() => {
    const stored = getLoyaltyCustomerFromStorage();
    if (stored?.id) return; // ya registrado, nunca mostrar
    const dismissed = sessionStorage.getItem(DISMISSED_KEY);
    if (dismissed) return;

    const timer = setTimeout(() => {
      const storedNow = getLoyaltyCustomerFromStorage();
      if (storedNow?.id) return;
      setState('banner');
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimateIn(true)));
    }, SHOW_AFTER_MS);

    return () => clearTimeout(timer);
  }, []);

  // Detectar cuando se registra → pasar a mini
  useEffect(() => {
    const check = () => {
      const stored = getLoyaltyCustomerFromStorage();
      if (stored?.id && state === 'banner') {
        setState('mini');
      }
    };
    const interval = setInterval(check, 800);
    window.addEventListener('storage', check);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', check);
    };
  }, [state]);

  const handleDismiss = () => {
    setAnimateIn(false);
    sessionStorage.setItem(DISMISSED_KEY, 'true');
    setTimeout(() => setState('gone'), 300);
  };

  const handleJoin = () => {
    handleDismiss();
    setTimeout(onOpenModal, 300);
  };

  const handleMiniDismiss = () => {
    setState('gone');
  };

  if (state === 'hidden' || state === 'gone') return null;

  // ── Chip mini (ya registrado) ──
  if (state === 'mini') {
    const stored = getLoyaltyCustomerFromStorage();
    const points = stored?.loyalty_points ?? 0;
    return (
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 opacity-100 translate-y-0">
        <div className="flex items-center gap-2 bg-gray-950 border border-amber-500/50 rounded-full px-3 py-1.5">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-vip-crown-2-fill text-amber-400 text-sm" />
          </div>
          <span className="text-white text-xs font-bold whitespace-nowrap">
            {stored?.name?.split(' ')[0]} · <span className="text-amber-400">{points} pts</span>
          </span>
          <Link
            to="/mi-tarjeta"
            className="text-[10px] text-amber-400 font-bold hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            Ver tarjeta
          </Link>
          <button
            onClick={handleMiniDismiss}
            className="w-4 h-4 flex items-center justify-center text-gray-600 hover:text-gray-400 cursor-pointer transition-colors ml-1"
          >
            <i className="ri-close-line text-xs" />
          </button>
        </div>
      </div>
    );
  }

  // ── Banner completo (no registrado) ──
  return (
    <div
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ width: 'min(360px, calc(100vw - 32px))' }}
    >
      <div className="bg-gray-950 rounded-2xl overflow-hidden border border-amber-500/40">
        <div className="h-1 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600" />
        <div className="px-4 py-3.5 flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center bg-amber-500 rounded-xl flex-shrink-0">
            <i className="ri-vip-crown-2-fill text-white text-lg" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-black leading-tight">¡Acumula puntos gratis!</p>
            <p className="text-gray-400 text-[11px] mt-0.5 leading-snug">
              Cada $100 pesos = 1 punto. Canjéalos por cervezas o hamburguesas.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-400 cursor-pointer flex-shrink-0 transition-colors"
          >
            <i className="ri-close-line text-lg" />
          </button>
        </div>
        <div className="px-4 pb-3.5">
          <button
            onClick={handleJoin}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-2.5 rounded-xl text-sm transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
          >
            <i className="ri-vip-crown-2-fill" />
            Registrarme y ganar puntos
          </button>
        </div>
      </div>
    </div>
  );
}