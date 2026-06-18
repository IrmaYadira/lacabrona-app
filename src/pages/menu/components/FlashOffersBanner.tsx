import { useState, useEffect, useCallback } from 'react';
import { useFlashOffers, getTimeRemaining, type FlashOffer } from '@/hooks/useFlashOffers';

function FlashOfferSkeleton({ delay = 0 }: { delay?: number }) {
  const delayClass = delay === 0 ? '' : delay === 1 ? ' animate-shimmer-alt' : ' animate-shimmer-alt-2';
  return (
    <div className={`relative overflow-hidden rounded-2xl border-2 border-gray-800 bg-gray-900 shrink-0 w-[280px] sm:w-[320px] animate-shimmer${delayClass}`}>
      <div className="h-1 w-full bg-gray-800" />
      <div className="px-4 py-3.5 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-20 rounded-full bg-gray-800" />
              <div className="h-5 w-12 rounded-full bg-gray-800" />
            </div>
            <div className="h-4 w-40 rounded bg-gray-800" />
            <div className="h-3 w-28 rounded bg-gray-800" />
          </div>
          <div className="w-6 h-6 rounded-full bg-gray-800 flex-shrink-0 mt-0.5" />
        </div>
        <div className="h-3 w-full rounded bg-gray-800" />
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-16 rounded-md bg-gray-800" />
          <div className="h-4 w-20 rounded-md bg-gray-800" />
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="h-3 w-3 rounded-full bg-gray-800" />
          <div className="h-4 w-16 rounded bg-gray-800" />
          <div className="h-3 w-20 rounded bg-gray-800" />
        </div>
      </div>
    </div>
  );
}

function OfferCard({ offer, onDismiss, onOfferClick }: { offer: FlashOffer; onDismiss: (id: number) => void; onOfferClick?: (offer: FlashOffer) => void }) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeRemaining(offer.end_time));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeRemaining(offer.end_time));
    }, 1000);
    return () => clearInterval(timer);
  }, [offer.end_time]);

  const isUrgent = timeLeft.totalMs < 10 * 60 * 1000; // < 10 min
  const isAlmostDone = timeLeft.totalMs < 30 * 60 * 1000; // < 30 min

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500/60 bg-gray-900 shrink-0 w-[280px] sm:w-[320px] cursor-pointer hover:border-amber-400 hover:bg-gray-800/80 transition-all duration-200">
      {/* Urgency stripe */}
      <div className={`h-1 w-full ${isUrgent ? 'bg-red-500' : isAlmostDone ? 'bg-orange-500' : 'bg-amber-500'}`} />

      <div className="px-4 py-3.5">
        <button
          onClick={() => onOfferClick?.(offer)}
          className="w-full text-left cursor-pointer group/offer"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                  OFERTA FLASH
                </span>
                {offer.discount_pct > 0 && (
                  <span className="text-xs font-black px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 whitespace-nowrap">
                    −{Math.round(offer.discount_pct)}%
                  </span>
                )}
              </div>
              <h3 className="text-white font-black text-sm leading-tight truncate group-hover/offer:text-amber-300 transition-colors">{offer.title}</h3>
              {offer.subtitle && <p className="text-amber-400/80 text-xs font-semibold mt-0.5">{offer.subtitle}</p>}
            </div>
          </div>

          {offer.description && (
            <p className="text-gray-500 text-xs mt-1.5 leading-snug line-clamp-2 group-hover/offer:text-gray-400 transition-colors">{offer.description}</p>
          )}

          {/* Aplica a */}
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-1.5">
              {offer.category_key && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-gray-800 text-gray-400 border border-gray-700 whitespace-nowrap">
                  {offer.category_key}
                </span>
              )}
              {offer.product_ids && offer.product_ids.length > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
                  <i className="ri-product-hunt-line mr-0.5" />
                  {offer.product_ids.length} producto(s)
                </span>
              )}
              {!offer.category_key && (!offer.product_ids || offer.product_ids.length === 0) && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-gray-800 text-gray-500 border border-gray-700 whitespace-nowrap">
                  Todas las categorías
                </span>
              )}
            </div>
            {offer.category_key && (
              <span className="text-[10px] text-amber-400/60 font-semibold flex items-center gap-0.5 opacity-0 group-hover/offer:opacity-100 transition-opacity">
                Ver menú <i className="ri-arrow-right-line" />
              </span>
            )}
          </div>
        </button>

        {/* Countdown + cerrar (fuera del botón para evitar conflictos) */}
        <div className="flex items-center justify-between mt-2.5">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <i className={`ri-time-line text-xs ${isUrgent ? 'text-red-400' : 'text-amber-400'}`} />
              <span className={`text-xs font-black tabular-nums ${isUrgent ? 'text-red-400 animate-pulse' : 'text-amber-400'}`}>
                {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
              </span>
            </div>
            <span className="text-gray-600 text-[10px]">para que termine</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(offer.id);
            }}
            className="w-6 h-6 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer flex-shrink-0"
            title="Cerrar"
          >
            <i className="ri-close-line text-sm" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FlashOffersBanner({ onOfferClick }: { onOfferClick?: (offer: FlashOffer) => void }) {
  const { offers, loading } = useFlashOffers();
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(() => {
    try {
      const raw = sessionStorage.getItem('lc_flash_dismissed');
      return raw ? new Set(JSON.parse(raw)) : new Set<number>();
    } catch {
      return new Set<number>();
    }
  });

  const handleDismiss = useCallback((id: number) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      sessionStorage.setItem('lc_flash_dismissed', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const visibleOffers = offers.filter(o => !dismissedIds.has(o.id));

  // Nunca desaparecer completamente durante loading — eso causa parpadeo
  if (visibleOffers.length === 0 && !loading) return null;

  return (
    <div className="w-full bg-gray-950 border-b border-gray-800">
      <div className="px-4 md:px-8 max-w-7xl mx-auto py-3">
        <div className="flex items-center gap-2 mb-2">
          <i className="ri-flashlight-fill text-amber-400 text-sm" />
          <span className="text-amber-400 text-xs font-black uppercase tracking-widest">Ofertas exclusivas — solo en la app</span>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
          {loading && visibleOffers.length === 0 ? (
            <>
              <FlashOfferSkeleton delay={0} />
              <FlashOfferSkeleton delay={1} />
            </>
          ) : (
            visibleOffers.map(offer => (
              <OfferCard key={offer.id} offer={offer} onDismiss={handleDismiss} onOfferClick={onOfferClick} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}