import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface PromoSemana {
  id: number;
  dia_semana: number;
  titulo: string;
  descripcion: string;
  detalle: string;
  horario: string;
  badge: string;
  badge_color: string;
  icon: string;
  imagen_url: string;
  activo: boolean;
}

// Mapeo badge_color → estilos del banner oscuro
const COLOR_MAP: Record<string, { bgFrom: string; bgTo: string; textColor: string; borderColor: string }> = {
  'bg-amber-500':  { bgFrom: 'from-amber-900/95',  bgTo: 'to-gray-900/95',  textColor: 'text-amber-300',  borderColor: 'border-amber-700/60' },
  'bg-red-500':    { bgFrom: 'from-red-900/95',    bgTo: 'to-gray-900/95',  textColor: 'text-red-300',    borderColor: 'border-red-700/60' },
  'bg-orange-500': { bgFrom: 'from-orange-900/95', bgTo: 'to-gray-900/95',  textColor: 'text-orange-300', borderColor: 'border-orange-700/60' },
  'bg-yellow-600': { bgFrom: 'from-yellow-900/95', bgTo: 'to-gray-900/95',  textColor: 'text-yellow-300', borderColor: 'border-yellow-700/60' },
  'bg-purple-600': { bgFrom: 'from-purple-900/95', bgTo: 'to-gray-900/95',  textColor: 'text-purple-300', borderColor: 'border-purple-700/60' },
  'bg-green-600':  { bgFrom: 'from-green-900/95',  bgTo: 'to-gray-900/95',  textColor: 'text-green-300',  borderColor: 'border-green-700/60' },
  'bg-pink-500':   { bgFrom: 'from-pink-900/95',   bgTo: 'to-gray-900/95',  textColor: 'text-pink-300',   borderColor: 'border-pink-700/60' },
};

const DEFAULT_STYLE = { bgFrom: 'from-amber-900/95', bgTo: 'to-gray-900/95', textColor: 'text-amber-300', borderColor: 'border-amber-700/60' };

const DIAS_NOMBRE = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const DISMISS_KEY = "lc_promo_dia_dismissed_v2";

function getDismissedDate(): string {
  try { return localStorage.getItem(DISMISS_KEY) ?? ""; } catch { return ""; }
}
function setDismissedToday(): void {
  try { localStorage.setItem(DISMISS_KEY, new Date().toDateString()); } catch { /* noop */ }
}

export default function PromoDiaBanner() {
  const [promo, setPromo] = useState<PromoSemana | null>(null);
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    // Si ya fue cerrado hoy, no mostrarlo
    if (getDismissedDate() === new Date().toDateString()) {
      setDismissed(true);
      return;
    }

    const todayDia = new Date().getDay();

    const fetchPromo = async () => {
      const { data } = await supabase
        .from('promos_semana')
        .select('*')
        .eq('dia_semana', todayDia)
        .eq('activo', true)
        .is('deleted_at', null)
        .maybeSingle();

      if (!data) return; // no hay promo activa hoy

      setPromo(data as PromoSemana);

      // Mostrar con delay suave
      const t1 = setTimeout(() => {
        setVisible(true);
        const t2 = setTimeout(() => setPulse(true), 600);
        const t3 = setTimeout(() => setPulse(false), 2200);
        return () => { clearTimeout(t2); clearTimeout(t3); };
      }, 1800);

      return () => clearTimeout(t1);
    };

    fetchPromo();
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setDismissedToday();
    setTimeout(() => setDismissed(true), 400);
  };

  if (dismissed || !promo) return null;

  const style = COLOR_MAP[promo.badge_color] ?? DEFAULT_STYLE;
  const diaNombre = DIAS_NOMBRE[promo.dia_semana];

  return (
    <>
      {/* Overlay al expandir */}
      {expanded && (
        <div
          className="fixed inset-0 z-[55] bg-black/30"
          onClick={() => setExpanded(false)}
        />
      )}

      {/* Banner flotante */}
      <div
        className={`fixed z-[60] transition-all duration-500 ease-out ${
          expanded
            ? "bottom-0 left-0 right-0 sm:bottom-6 sm:left-auto sm:right-5 sm:w-[360px]"
            : "bottom-20 right-4 sm:bottom-6 sm:right-5"
        } ${visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0 pointer-events-none"}`}
      >
        {expanded ? (
          /* ── Tarjeta expandida ── */
          <div className={`bg-gradient-to-br ${style.bgFrom} ${style.bgTo} backdrop-blur-md border ${style.borderColor} rounded-t-2xl sm:rounded-2xl overflow-hidden`}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 flex-shrink-0">
                  <i className={`${promo.icon} ${style.textColor} text-lg`} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${promo.badge_color} text-white px-2 py-0.5 rounded-full`}>
                      {promo.badge}
                    </span>
                    <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">{diaNombre}</span>
                  </div>
                  <p className={`text-base font-black ${style.textColor} leading-tight mt-0.5`}>{promo.titulo}</p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white cursor-pointer transition-colors flex-shrink-0"
              >
                <i className="ri-close-line text-sm" />
              </button>
            </div>

            {/* Divider */}
            <div className={`h-px mx-4 border-t ${style.borderColor} opacity-40`} />

            {/* Cuerpo */}
            <div className="px-4 py-3">
              <p className="text-gray-200 text-sm leading-relaxed mb-2">{promo.descripcion}</p>

              {promo.detalle && (
                <p className="text-gray-400 text-xs leading-relaxed mb-3 flex items-start gap-1.5">
                  <i className="ri-information-line text-xs flex-shrink-0 mt-0.5" />
                  {promo.detalle}
                </p>
              )}

              <div className="flex items-center gap-1.5 mb-4">
                <i className="ri-time-line text-xs text-gray-400" />
                <span className="text-gray-400 text-xs font-semibold">{promo.horario}</span>
              </div>

              {/* CTAs */}
              <div className="flex gap-2">
                <a
                  href="#entradas"
                  onClick={() => setExpanded(false)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 ${promo.badge_color} text-white text-sm font-black rounded-xl cursor-pointer transition-all active:scale-95 whitespace-nowrap`}
                >
                  <i className="ri-menu-2-line text-sm" />
                  Ver menú
                </a>
                <button
                  onClick={() => setExpanded(false)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-bold rounded-xl cursor-pointer transition-all whitespace-nowrap"
                >
                  <i className="ri-arrow-down-line text-sm" />
                  Cerrar
                </button>
              </div>
            </div>

            {/* Ícono decorativo de fondo */}
            <div className="absolute top-3 right-12 opacity-10 select-none pointer-events-none text-5xl">
              <i className={`${promo.icon}`} />
            </div>
          </div>
        ) : (
          /* ── Chip colapsado ── */
          <button
            onClick={() => setExpanded(true)}
            className={`flex items-center gap-2.5 pl-2.5 pr-4 py-2.5 rounded-2xl cursor-pointer transition-all active:scale-95 border ${style.borderColor} bg-gradient-to-r ${style.bgFrom} ${style.bgTo} backdrop-blur-md ${
              pulse ? "scale-105" : "scale-100"
            }`}
          >
            <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 flex-shrink-0">
              <i className={`${promo.icon} ${style.textColor} text-lg`} />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className={`text-[9px] font-black uppercase tracking-widest ${promo.badge_color} text-white px-1.5 py-0.5 rounded-full leading-none`}>
                  {promo.badge}
                </span>
                <span className="text-gray-400 text-[9px] font-semibold uppercase tracking-wider leading-none">{diaNombre}</span>
              </div>
              <p className={`text-xs font-black ${style.textColor} leading-tight mt-0.5 whitespace-nowrap`}>
                {promo.titulo}
              </p>
            </div>
            <i className="ri-arrow-up-s-line text-gray-500 text-base flex-shrink-0 ml-0.5" />
          </button>
        )}
      </div>
    </>
  );
}