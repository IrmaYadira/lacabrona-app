import { useState, useEffect, useCallback, useRef } from 'react';
import { getLoyaltyCustomerFromStorage, useLoyaltyCustomer } from '@/hooks/useLoyaltyCustomer';
import { REWARD_TIERS } from '@/hooks/useLoyaltyRewards';
import type { LoyaltyCustomer } from '@/hooks/useLoyaltyCustomer';
import { Link } from 'react-router-dom';

interface LoyaltyChipProps {
  scrolled: boolean;
  onOpenModal: () => void;
  /** Modo compacto: solo el ícono/corona, sin texto, para la fila superior del navbar */
  compact?: boolean;
}

function getNextTier(points: number) {
  return REWARD_TIERS.find(t => points < t.points) ?? null;
}

function getProgressPercent(points: number): number {
  const maxTier = REWARD_TIERS[REWARD_TIERS.length - 1];
  return Math.min((points / maxTier.points) * 100, 100);
}

export default function LoyaltyChip({ scrolled, onOpenModal, compact = false }: LoyaltyChipProps) {
  const [customer, setCustomer] = useState<LoyaltyCustomer | null>(() => getLoyaltyCustomerFromStorage());
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { refresh } = useLoyaltyCustomer();
  const panelRef = useRef<HTMLDivElement>(null);

  // Escuchar cambios en localStorage (cuando el hook actualiza los puntos)
  useEffect(() => {
    const syncFromStorage = () => {
      const stored = getLoyaltyCustomerFromStorage();
      setCustomer(stored);
    };
    window.addEventListener('storage', syncFromStorage);
    // Refrescar desde Supabase cada 30s para capturar puntos agregados desde POS/admin
    const interval = setInterval(async () => {
      const stored = getLoyaltyCustomerFromStorage();
      if (stored?.id) {
        await refresh();
        const updated = getLoyaltyCustomerFromStorage();
        setCustomer(updated);
        setLastUpdated(new Date());
      }
    }, 30_000);
    return () => {
      window.removeEventListener('storage', syncFromStorage);
      clearInterval(interval);
    };
  }, [refresh]);

  // Refrescar desde BD al hacer focus en la pestaña
  useEffect(() => {
    const handleFocus = async () => {
      const stored = getLoyaltyCustomerFromStorage();
      if (!stored?.id) return;
      await refresh();
      const updated = getLoyaltyCustomerFromStorage();
      setCustomer(updated);
      setLastUpdated(new Date());
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refresh]);

  // Cerrar panel al hacer click fuera
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expanded]);

  const handleRefresh = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRefreshing(true);
    await refresh();
    const updated = getLoyaltyCustomerFromStorage();
    setCustomer(updated);
    setLastUpdated(new Date());
    setRefreshing(false);
  }, [refresh]);

  // Si no hay cliente registrado → botón para abrir el modal
  if (!customer) {
    if (compact) {
      return (
        <button
          onClick={onOpenModal}
          title="Registrarme para acumular puntos"
          className={`relative w-8 h-8 flex items-center justify-center rounded-lg transition-all cursor-pointer border ${
            scrolled
              ? 'border-amber-300 text-amber-600 hover:bg-amber-50'
              : 'border-white/30 text-amber-200 hover:text-amber-100 hover:bg-white/10'
          }`}
        >
          <i className="ri-vip-crown-2-line text-base" />
          {/* Punto pulsante para llamar la atención */}
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
        </button>
      );
    }
    return (
      <button
        onClick={onOpenModal}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all cursor-pointer whitespace-nowrap border ${
          scrolled
            ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
            : 'border-white/30 text-amber-200 hover:text-amber-100 hover:border-white/50 hover:bg-white/10'
        }`}
      >
        <div className="w-4 h-4 flex items-center justify-center">
          <i className="ri-vip-crown-2-line text-[13px]" />
        </div>
        Puntos
      </button>
    );
  }

  const points = customer.loyalty_points ?? 0;
  const nextTier = getNextTier(points);
  const progress = getProgressPercent(points);
  const unlockedTiers = REWARD_TIERS.filter(t => points >= t.points);
  const hasReward = unlockedTiers.length > 0;

  // Modo compacto con cliente registrado
  if (compact) {
    return (
      <div className="relative flex-shrink-0" ref={panelRef}>
        <button
          onClick={() => setExpanded(v => !v)}
          title={`${customer.name} · ${points} pts`}
          className={`relative w-8 h-8 flex items-center justify-center rounded-lg transition-all cursor-pointer border ${
            hasReward
              ? 'border-amber-500 bg-amber-500 text-white hover:bg-amber-600'
              : scrolled
              ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
              : 'border-white/30 text-amber-200 hover:text-amber-100 hover:bg-white/10'
          }`}
        >
          <i className={hasReward ? 'ri-vip-crown-2-fill text-base' : 'ri-vip-crown-2-line text-base'} />
          {hasReward && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
          )}
        </button>
        {/* Panel expandido igual que el modo normal */}
        {expanded && (
          <div className="absolute top-full right-0 mt-2 w-72 bg-gray-950 rounded-2xl overflow-hidden z-50 border border-gray-800">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 flex items-center justify-center bg-white/20 rounded-lg">
                  <i className="ri-vip-crown-2-fill text-white text-sm" />
                </div>
                <div>
                  <p className="text-white/80 text-[10px] font-semibold uppercase tracking-wider leading-none">Lealtad</p>
                  <p className="text-white font-black text-sm leading-tight truncate max-w-[140px]">{customer.name}</p>
                </div>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors cursor-pointer"
              >
                <i className={`ri-refresh-line text-white text-sm ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider">Puntos disponibles</p>
                  <p className="text-amber-400 text-3xl font-black leading-none mt-0.5">{points}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider">Visitas</p>
                  <p className="text-white text-2xl font-black leading-none mt-0.5">{customer.visit_count}</p>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider">
                    {nextTier ? `Hacia ${nextTier.emoji} ${nextTier.title}` : '¡Todos los premios desbloqueados!'}
                  </span>
                  {nextTier && (
                    <span className="text-amber-400 text-[10px] font-bold">{nextTier.points - points} pts más</span>
                  )}
                </div>
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              {unlockedTiers.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <i className="ri-gift-2-fill text-amber-400 text-sm flex-shrink-0" />
                    <p className="text-amber-300 text-xs font-bold">
                      {unlockedTiers.length === 1 ? '¡Premio disponible!' : `¡${unlockedTiers.length} premios disponibles!`}
                    </p>
                  </div>
                  {unlockedTiers.map(tier => (
                    <div key={tier.id} className="flex items-center gap-1.5 mt-1">
                      <span className="text-sm">{tier.emoji}</span>
                      <span className="text-amber-200 text-[11px] font-semibold">{tier.title}</span>
                    </div>
                  ))}
                  <p className="text-amber-400/70 text-[10px] mt-1.5">Pídele al mesero que lo registre</p>
                </div>
              )}
              <Link
                to="/mi-tarjeta"
                className={`flex items-center justify-center gap-1.5 w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 transition-colors text-gray-950 text-sm font-black cursor-pointer ${hasReward ? 'animate-reward-pulse' : ''}`}
              >
                <i className="ri-external-link-line text-base" />
                Ver premios →
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex-shrink-0" ref={panelRef}>
      {/* ── Chip principal ── */}
      <button
        onClick={() => setExpanded(v => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all cursor-pointer whitespace-nowrap border relative ${
          hasReward
            ? scrolled
              ? 'border-amber-500 bg-amber-500 text-white hover:bg-amber-600'
              : 'border-amber-400 bg-amber-500 text-white hover:bg-amber-600'
            : scrolled
            ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
            : 'border-white/30 text-amber-200 hover:text-amber-100 hover:border-white/50 hover:bg-white/10'
        }`}
      >
        <div className="w-4 h-4 flex items-center justify-center">
          <i className={hasReward ? 'ri-vip-crown-2-fill text-[13px]' : 'ri-vip-crown-2-line text-[13px]'} />
        </div>
        <span>{points} pts</span>
        {hasReward && (
          <span className="w-4 h-4 flex items-center justify-center text-base leading-none">
            {unlockedTiers[unlockedTiers.length - 1].emoji}
          </span>
        )}
        {/* Indicador pulsante cuando hay premio */}
        {hasReward && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
        )}
      </button>

      {/* ── Panel expandido ── */}
      {expanded && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-gray-950 rounded-2xl overflow-hidden z-50 border border-gray-800">
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 flex items-center justify-center bg-white/20 rounded-lg">
                <i className="ri-vip-crown-2-fill text-white text-sm" />
              </div>
              <div>
                <p className="text-white/80 text-[10px] font-semibold uppercase tracking-wider leading-none">Lealtad</p>
                <p className="text-white font-black text-sm leading-tight truncate max-w-[140px]">{customer.name}</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors cursor-pointer"
              title="Actualizar puntos"
            >
              <i className={`ri-refresh-line text-white text-sm ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="px-4 py-4 space-y-3">
            {/* Puntos grandes */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider">Puntos disponibles</p>
                <p className="text-amber-400 text-3xl font-black leading-none mt-0.5">{points}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider">Visitas</p>
                <p className="text-white text-2xl font-black leading-none mt-0.5">{customer.visit_count}</p>
              </div>
            </div>

            {/* Barra de progreso */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider">
                  {nextTier ? `Hacia ${nextTier.emoji} ${nextTier.title}` : '¡Todos los premios desbloqueados!'}
                </span>
                {nextTier && (
                  <span className="text-amber-400 text-[10px] font-bold">{nextTier.points - points} pts más</span>
                )}
              </div>
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {/* Marcadores de nivel */}
              <div className="flex items-center justify-between mt-1">
                {REWARD_TIERS.map(tier => (
                  <div key={tier.id} className="flex items-center gap-1">
                    <span className={`text-[10px] ${points >= tier.points ? 'opacity-100' : 'opacity-40'}`}>
                      {tier.emoji}
                    </span>
                    <span className={`text-[10px] font-bold ${points >= tier.points ? 'text-amber-400' : 'text-gray-600'}`}>
                      {tier.points}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Premios desbloqueados */}
            {unlockedTiers.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <i className="ri-gift-2-fill text-amber-400 text-sm flex-shrink-0" />
                  <p className="text-amber-300 text-xs font-bold">
                    {unlockedTiers.length === 1 ? '¡Premio disponible!' : `¡${unlockedTiers.length} premios disponibles!`}
                  </p>
                </div>
                {unlockedTiers.map(tier => (
                  <div key={tier.id} className="flex items-center gap-1.5 mt-1">
                    <span className="text-sm">{tier.emoji}</span>
                    <span className="text-amber-200 text-[11px] font-semibold">{tier.title}</span>
                  </div>
                ))}
                <p className="text-amber-400/70 text-[10px] mt-1.5">Pídele al mesero que lo registre</p>
              </div>
            )}

            {/* Sin premio aún */}
            {unlockedTiers.length === 0 && nextTier && (
              <div className="bg-gray-900 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <span className="text-2xl opacity-40">{nextTier.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-400 text-[10px] font-semibold">Próximo premio</p>
                  <p className="text-gray-300 text-xs font-bold truncate">{nextTier.title}</p>
                  <p className="text-gray-500 text-[10px]">{nextTier.items[0]}{nextTier.items.length > 1 ? ` +${nextTier.items.length - 1} más` : ''}</p>
                </div>
              </div>
            )}

            {/* Info de actualización */}
            {lastUpdated && (
              <p className="text-gray-700 text-[10px] text-center">
                Actualizado {lastUpdated.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}

            {/* Link a mi tarjeta */}
            <Link
              to="/mi-tarjeta"
              className={`flex items-center justify-center gap-1.5 w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 transition-colors text-gray-950 text-sm font-black cursor-pointer ${hasReward ? 'animate-reward-pulse' : ''}`}
            >
              <i className="ri-external-link-line text-base" />
              Ver premios →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}