import { useState, useEffect, useCallback } from "react";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";

// ── Banner de partido de fútbol ──────────────────────────────────────────

const FINISHED_BANNER_TTL_MS = 5 * 60 * 1000; // 5 minutos visible después de terminar

interface FutbolBannerData {
  name: string;
  timeStr12: string;
  phase: 'idle' | 'live' | 'finished';
  savedAt: string;
  finishedAt?: string; // ISO timestamp de cuando terminó
}

function FutbolBanner() {
  const [data, setData] = useState<FutbolBannerData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    const check = () => {
      try {
        const raw = localStorage.getItem('lc_futbol_game');
        if (!raw) { setData(null); return; }
        const parsed = JSON.parse(raw) as FutbolBannerData;
        if (parsed.savedAt !== new Date().toDateString()) {
          localStorage.removeItem('lc_futbol_game');
          setData(null);
          return;
        }
        if (parsed.phase === 'finished' && parsed.finishedAt) {
          const elapsed = Date.now() - new Date(parsed.finishedAt).getTime();
          if (elapsed >= FINISHED_BANNER_TTL_MS) {
            localStorage.removeItem('lc_futbol_game');
            setData(null);
            return;
          }
        }
        setData(parsed);
      } catch (_) {
        setData(null);
      }
    };
    check();
    const iv = setInterval(check, 5000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!data || data.phase !== 'finished' || !data.finishedAt || dismissed) {
      setSecondsLeft(null);
      return;
    }
    const calc = () => {
      const elapsed = Date.now() - new Date(data.finishedAt!).getTime();
      const remaining = Math.max(0, Math.ceil((FINISHED_BANNER_TTL_MS - elapsed) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) setDismissed(true);
    };
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [data, dismissed]);

  if (!data || dismissed) return null;
  if (data.phase === 'idle') return null;

  const isLive     = data.phase === 'live';
  const isFinished = data.phase === 'finished';

  const countdownStr = secondsLeft !== null
    ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
    : null;

  return (
    <div
      className={`relative flex items-center justify-center gap-2 sm:gap-3 px-4 py-2.5 text-center flex-wrap transition-all duration-700 ${
        isFinished
          ? 'bg-emerald-700/90 backdrop-blur-sm'
          : isLive
          ? 'bg-green-600/90 backdrop-blur-sm'
          : 'bg-gray-900/80 backdrop-blur-sm'
      }`}
    >
      {isFinished ? (
        <span className="flex items-end gap-[3px] h-4 flex-shrink-0">
          {[4, 7, 5, 9, 6, 8, 4].map((h, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full bg-white/80"
              style={{
                height: `${h}px`,
                animation: `pulse ${0.5 + (i % 3) * 0.15}s ease-in-out infinite alternate`,
              }}
            />
          ))}
        </span>
      ) : (
        <span className={`text-base flex-shrink-0 ${isLive ? 'animate-pulse' : ''}`}>
          &#9917;
        </span>
      )}

      {isFinished ? (
        <p className="text-white text-xs sm:text-sm font-bold leading-tight">
          <span className="inline-block bg-white/20 text-white font-black px-2 py-0.5 rounded-full text-[11px] mr-1.5">
            PARTIDO TERMINADO
          </span>
          <span className="text-emerald-100">La m&uacute;sica regresa</span>
          {countdownStr && (
            <span className="text-white/60 text-[11px] ml-2">({countdownStr})</span>
          )}
        </p>
      ) : isLive ? (
        <p className="text-white text-xs sm:text-sm font-bold leading-tight">
          <span className="inline-block bg-white/20 text-white font-black px-2 py-0.5 rounded-full text-[11px] mr-1.5 animate-pulse">
            EN VIVO
          </span>
          {data.name} &#8212; La m&uacute;sica est&aacute; apagada
        </p>
      ) : (
        <p className="text-white text-xs sm:text-sm font-medium leading-tight">
          <strong className="text-amber-400 font-black">Esta noche: partido a las {data.timeStr12}</strong>
          <span className="text-white/80 ml-1.5">&#8212; {data.name}</span>
        </p>
      )}

      {isFinished && secondsLeft !== null && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10">
          <div
            className="h-full bg-emerald-300/70 transition-all duration-1000"
            style={{ width: `${(secondsLeft / (FINISHED_BANNER_TTL_MS / 1000)) * 100}%` }}
          />
        </div>
      )}

      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/20 cursor-pointer transition-colors flex-shrink-0"
        aria-label="Cerrar aviso"
      >
        <i className="ri-close-line text-xs" />
      </button>
    </div>
  );
}

interface HeroProps {
  logoUrl: string;
  showLogo?: boolean;
}

export default function HeroSection({ logoUrl, showLogo = true }: HeroProps) {
  const { setIsOpen } = useCart();
  const navigate = useNavigate();
  const loaded = true;

  const goToMenu = useCallback(() => {
    navigate("/menu");
  }, [navigate]);

  const openCart = useCallback(() => {
    setIsOpen(true);
  }, [setIsOpen]);

  return (
    <section
      id="hero"
      className="relative min-h-[600px] md:min-h-[700px] flex flex-col overflow-hidden"
    >
      <div className="flex-1 flex items-center justify-center relative">
      <div className="absolute inset-0">
        <img
          src="https://readdy.ai/api/search-image?query=delicious%20crispy%20chicken%20wings%20with%20fiery%20hot%20sauce%20flames%20dramatic%20dark%20restaurant%20background%20professional%20food%20photography%20warm%20amber%20lighting%20close%20up&width=800&height=500&seq=hero-la-cabrona-v3&orientation=landscape"
          loading="eager"
          decoding="async"
          fetchpriority="high"
          width="800"
          height="500"
          alt="La Cabrona Alitas"
          title="La Cabrona Alitas & Beer — Zapopan, Jalisco"
          className="w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />
      </div>

      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        {showLogo && (
          <div
            className={`mb-3 md:mb-6 transition-all duration-1000 ease-out ${
              loaded ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-90"
            }`}
          >
            <img
              src={logoUrl}
              alt="La Cabrona Alitas & Beer"
              title="La Cabrona Alitas & Beer"
              className="h-24 sm:h-36 md:h-52 lg:h-60 w-auto mx-auto object-contain drop-shadow-2xl"
              loading="eager"
              decoding="async"
              fetchpriority="high"
              width="240"
              height="240"
            />
          </div>
        )}

        <h1
          className={`font-[Bebas_Neue] text-white drop-shadow-lg transition-all duration-1000 delay-200 ease-out ${
            loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="block text-4xl sm:text-5xl md:text-7xl lg:text-8xl tracking-[0.12em] leading-none">
            LA CABRONA
          </span>
          <span className="block text-lg sm:text-xl md:text-3xl lg:text-4xl text-amber-400 tracking-[0.25em] mt-1">
            ALITAS & BEER
          </span>
        </h1>

        <p
          className={`text-sm md:text-lg text-white/80 mt-3 mb-2 font-light transition-all duration-1000 delay-600 ease-out px-2 ${
            loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          Las mejores <strong className="text-amber-400 font-semibold">alitas en Zapopan</strong>, con la actitud que te merecés
        </p>

        <p
          className={`text-xs sm:text-sm text-white/50 mt-1 font-light transition-all duration-1000 delay-700 ease-out ${
            loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
          aria-label="Ubicación del bar"
        >
          <i className="ri-map-pin-line mr-1" />
          Sinaloa 690, Col. El Mante, Zapopan, Jalisco
        </p>

        <div
          className={`flex items-center justify-center gap-3 text-amber-400 text-xs sm:text-sm md:text-base font-medium mt-3 transition-all duration-1000 delay-700 ease-out ${
            loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="flex items-center gap-1">
            <i className="ri-fire-line" />
            Picantes
          </span>
          <span className="w-1 h-1 rounded-full bg-amber-400" />
          <span className="flex items-center gap-1">
            <i className="ri-star-line" />
            Sabor Único
          </span>
        </div>

        <div
          className={`mt-6 md:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 transition-all duration-1000 delay-900 ease-out ${
            loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <button
            onClick={goToMenu}
            className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 hover:scale-105 active:scale-95 text-white px-8 py-3.5 rounded-md text-sm sm:text-base font-semibold uppercase tracking-wide transition-all cursor-pointer whitespace-nowrap shadow-lg"
          >
            <i className="ri-menu-2-line mr-2" />
            Ver Menú
          </button>
          <button
            onClick={openCart}
            className="w-full sm:w-auto border-2 border-white/70 hover:border-white hover:bg-white/10 hover:scale-105 active:scale-95 text-white px-8 py-3.5 rounded-md text-sm sm:text-base font-semibold uppercase tracking-wide transition-all cursor-pointer whitespace-nowrap"
          >
            Ordenar
          </button>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
        <button
          onClick={goToMenu}
          className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors cursor-pointer group"
        >
          <span className="text-xs font-medium tracking-wider">VER MENÚ</span>
          <i className="ri-arrow-down-line text-lg animate-bounce" />
        </button>
      </div>
      </div>
    </section>
  );
}