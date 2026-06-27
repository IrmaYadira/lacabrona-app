import { useState, useEffect } from 'react';

export default function FirstTimeBanner() {
  const [alreadyDismissed, setAlreadyDismissed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('lc_first_time_dismissed');
    if (stored === 'true') {
      setAlreadyDismissed(true);
      return;
    }
    // Trigger slide-down after mount
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setExiting(true);
    sessionStorage.setItem('lc_first_time_dismissed', 'true');
  };

  // Capturar el fin de la animación de salida para ocultar el DOM
  const handleTransitionEnd = () => {
    if (exiting) {
      setAlreadyDismissed(true);
      setExiting(false);
    }
  };

  if (alreadyDismissed) return null;

  return (
    <div
      onTransitionEnd={handleTransitionEnd}
      className={`w-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 shadow-lg transition-all duration-500 ease-out ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
    >
      <div className="px-4 md:px-8 max-w-7xl mx-auto py-3 flex items-center justify-between gap-3">
        <a
          href="/guia"
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer group"
        >
          <div className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-white/20 flex-shrink-0 group-hover:bg-white/30 transition-colors">
            <i className="ri-question-line text-white text-lg" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white text-sm md:text-base font-black leading-tight">
                ¿Primera vez aquí?
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white/90 border border-white/30 whitespace-nowrap">
                Nuevo
              </span>
            </div>
            <p className="text-white/80 text-xs md:text-sm leading-tight mt-0.5">
              Descubre cómo ordenar, reservar y disfrutar La Cabrona al máximo
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-white/90 text-xs font-semibold whitespace-nowrap">Ver guía</span>
            <i className="ri-arrow-right-line text-white text-sm" />
          </div>
        </a>
        <button
          onClick={handleDismiss}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors cursor-pointer flex-shrink-0"
          title="Cerrar"
        >
          <i className="ri-close-line text-sm" />
        </button>
      </div>
    </div>
  );
}