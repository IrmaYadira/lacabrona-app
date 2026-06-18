import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ScrollReveal from "@/components/base/ScrollReveal";

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

interface EventoEspecial {
  id: number;
  fecha: string;
  titulo: string;
  descripcion: string;
  horario: string;
  tipo: string;
  tipo_color: string;
  tipo_bg: string;
  icon: string;
  activo: boolean;
  sede: string | null;
}

const DIAS_NOMBRE = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function getTodayDiaSemana() {
  return new Date().getDay();
}

/** Determina si un evento ya terminó combinando fecha + horario */
function isEventoTerminado(fecha: string, horario: string): boolean {
  const now = new Date();
  if (!horario) return fecha < now.toISOString().split('T')[0];

  let endTimeStr: string;

  if (horario.includes('-')) {
    // Rango: "1:00 PM - 8:00 PM" → usar hora de fin
    endTimeStr = horario.split('-')[1].trim();
  } else {
    // Hora simple: "7:00 PM" → sumar 2h de duración estimada
    const m = horario.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!m) return fecha < now.toISOString().split('T')[0];
    let h = parseInt(m[1]);
    const min = parseInt(m[2]);
    const ap = m[3].toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    h += 2; // duración por defecto: 2 horas
    endTimeStr = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  }

  // Parsear hora de fin (acepta 24h y 12h AM/PM)
  let hours: number;
  let minutes: number;
  const m24 = endTimeStr.match(/^(\d{1,2}):(\d{2})$/);
  const m12 = endTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);

  if (m24) {
    hours = parseInt(m24[1]);
    minutes = parseInt(m24[2]);
  } else if (m12) {
    hours = parseInt(m12[1]);
    minutes = parseInt(m12[2]);
    const ap = m12[3].toUpperCase();
    if (ap === 'PM' && hours !== 12) hours += 12;
    if (ap === 'AM' && hours === 12) hours = 0;
  } else {
    return fecha < now.toISOString().split('T')[0];
  }

  const eventEnd = new Date(fecha + 'T' + hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0') + ':00');
  return eventEnd < now;
}

export default function EventosSection() {
  const [promos, setPromos] = useState<PromoSemana[]>([]);
  const [eventos, setEventos] = useState<EventoEspecial[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePromoId, setActivePromoId] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: pData }, { data: eData }] = await Promise.all([
        supabase.from('promos_semana').select('*').eq('activo', true).is('deleted_at', null).order('dia_semana'),
        supabase.from('eventos_especiales').select('*').eq('activo', true).is('deleted_at', null).order('fecha'),
      ]);

      const promosData = (pData as PromoSemana[]) ?? [];
      setPromos(promosData);

      const todayDia = getTodayDiaSemana();
      const todayPromo = promosData.find(p => p.dia_semana === todayDia);
      setActivePromoId(todayPromo?.id ?? promosData[0]?.id ?? null);

      // Filtrar: solo eventos de hoy (que no hayan terminado) o futuros
      const today = new Date().toISOString().split('T')[0];
      const futureEventos = ((eData as EventoEspecial[]) ?? []).filter(
        e => e.fecha >= today && !isEventoTerminado(e.fecha, e.horario)
      );
      setEventos(futureEventos);

      setLoading(false);
    };

    fetchData();
  }, []);

  const selectedPromo = promos.find(p => p.id === activePromoId) ?? promos[0];
  const todayDia = getTodayDiaSemana();

  if (loading) return null;
  if (promos.length === 0 && eventos.length === 0) return null;

  const prevPromo = () => {
    const idx = promos.findIndex(p => p.id === activePromoId);
    setActivePromoId(promos[(idx - 1 + promos.length) % promos.length].id);
  };
  const nextPromo = () => {
    const idx = promos.findIndex(p => p.id === activePromoId);
    setActivePromoId(promos[(idx + 1) % promos.length].id);
  };

  return (
    <section id="eventos-promociones" className="py-14 md:py-20 bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 md:px-6">

        {/* ── Encabezado ── */}
        <ScrollReveal>
          <div className="text-center mb-10 md:mb-14">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-black uppercase tracking-widest mb-4">
              <i className="ri-calendar-event-line" />
              Semana de Ofertas
            </span>
            <h2 className="text-3xl md:text-5xl font-[Bebas_Neue] text-white tracking-wide leading-none mb-3">
              PROMOS Y EVENTOS
            </h2>
            <p className="text-gray-400 text-sm md:text-base max-w-xl mx-auto">
              Cada día hay una razón para venir. Promociones únicas y eventos que hacen la noche memorable.
            </p>
          </div>
        </ScrollReveal>

        {/* ── Promos de la semana ── */}
        {promos.length > 0 && (
          <div className="mb-16">
            {/* Selector de días */}
            <ScrollReveal>
              <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 mb-6 justify-start sm:justify-center">
                {promos.map(promo => {
                  const isToday = promo.dia_semana === todayDia;
                  const isActive = promo.id === activePromoId;
                  return (
                    <button
                      key={promo.id}
                      onClick={() => setActivePromoId(promo.id)}
                      className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all border text-center ${
                        isActive
                          ? "bg-amber-500 border-amber-500 text-white"
                          : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200"
                      }`}
                    >
                      <span className="text-[10px] font-black uppercase tracking-wider whitespace-nowrap leading-none">
                        {DIAS_CORTO[promo.dia_semana]}
                      </span>
                      {isToday && (
                        <span className={`text-[8px] font-black uppercase tracking-wider ${isActive ? "text-white/80" : "text-amber-400"}`}>
                          HOY
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </ScrollReveal>

            {/* Tarjeta de promo seleccionada */}
            {selectedPromo && (
              <ScrollReveal>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 rounded-2xl overflow-hidden border border-gray-800">
                  {/* Imagen */}
                  <div className="relative h-56 sm:h-72 lg:h-auto min-h-[260px]">
                    <img
                      key={selectedPromo.id}
                      src={selectedPromo.imagen_url}
                      alt={selectedPromo.titulo}
                      title={selectedPromo.titulo}
                      className="w-full h-full object-cover object-top"
                      loading="lazy"
                      decoding="async"
                      fetchpriority="low"
                      width="800"
                      height="450"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-gray-950/60 hidden lg:block" />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-950/80 to-transparent lg:hidden" />
                    {selectedPromo.badge && (
                      <div className={`absolute top-4 left-4 px-3 py-1.5 rounded-full text-white text-sm font-black ${selectedPromo.badge_color}`}>
                        {selectedPromo.badge}
                      </div>
                    )}
                  </div>

                  {/* Contenido */}
                  <div className="bg-gray-900 p-6 md:p-8 flex flex-col justify-center">
                    <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest mb-3 w-fit px-3 py-1 rounded-full bg-amber-100 text-amber-700">
                      <i className={selectedPromo.icon} />
                      {DIAS_NOMBRE[selectedPromo.dia_semana]}
                    </span>

                    <h3 className="text-2xl md:text-3xl font-[Bebas_Neue] text-white tracking-wide mb-2 leading-none">
                      {selectedPromo.titulo}
                    </h3>

                    <p className="text-gray-300 text-sm md:text-base leading-relaxed mb-4">
                      {selectedPromo.descripcion}
                    </p>

                    {selectedPromo.detalle && (
                      <p className="text-gray-500 text-xs mb-4 flex items-start gap-1.5">
                        <i className="ri-information-line text-amber-500 flex-shrink-0 mt-0.5" />
                        {selectedPromo.detalle}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold mb-6">
                      <i className="ri-time-line" />
                      <span>{selectedPromo.horario}</span>
                    </div>

                    {/* Navegación */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={prevPromo}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white cursor-pointer transition-colors"
                      >
                        <i className="ri-arrow-left-s-line text-lg" />
                      </button>
                      <div className="flex gap-1.5 flex-1 justify-center">
                        {promos.map(p => (
                          <button
                            key={p.id}
                            onClick={() => setActivePromoId(p.id)}
                            className={`h-1.5 rounded-full cursor-pointer transition-all ${
                              p.id === activePromoId ? "bg-amber-500 w-6" : "bg-gray-700 hover:bg-gray-500 w-1.5"
                            }`}
                          />
                        ))}
                      </div>
                      <button
                        onClick={nextPromo}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white cursor-pointer transition-colors"
                      >
                        <i className="ri-arrow-right-s-line text-lg" />
                      </button>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            )}
          </div>
        )}

        {/* ── Próximos eventos ── */}
        {eventos.length > 0 && (
          <>
            <ScrollReveal>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl md:text-2xl font-[Bebas_Neue] text-white tracking-wide leading-none">
                    PRÓXIMOS EVENTOS
                  </h3>
                  <p className="text-gray-500 text-xs mt-0.5">No te pierdas lo que viene esta semana</p>
                </div>
                <div className="flex items-center gap-1.5 text-amber-500 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Esta semana
                </div>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {eventos.slice(0, 6).map((evento, i) => {
                const fechaObj = new Date(evento.fecha + 'T12:00:00');
                return (
                  <ScrollReveal key={evento.id} delay={i * 80}>
                    <div className={`rounded-2xl border p-5 ${evento.tipo_bg} hover:shadow-none transition-all group cursor-default`}>
                      {/* Fecha */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="text-center bg-white rounded-xl px-3 py-2 border border-gray-200 min-w-[52px]">
                          <p className="text-[10px] font-black text-gray-400 uppercase leading-none">
                            {fechaObj.toLocaleDateString('es-MX', { weekday: 'short' })}
                          </p>
                          <p className="text-2xl font-black text-gray-900 leading-none my-0.5">{fechaObj.getDate()}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">
                            {fechaObj.toLocaleDateString('es-MX', { month: 'short' })}
                          </p>
                        </div>
                        <div className={`w-10 h-10 flex items-center justify-center rounded-xl border ${evento.tipo_bg}`}>
                          <i className={`${evento.icon} ${evento.tipo_color} text-xl`} />
                        </div>
                      </div>

                      {/* Info */}
                      <span className={`inline-block text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border mb-2 ${evento.tipo_bg} ${evento.tipo_color}`}>
                        {evento.tipo}
                      </span>
                      <h4 className="text-base font-black text-gray-900 mb-1.5 leading-tight">{evento.titulo}</h4>
                      <p className="text-gray-600 text-xs leading-relaxed mb-3">{evento.descripcion}</p>

                      <div className="flex items-center gap-1.5 text-gray-500 text-xs font-semibold">
                        <i className="ri-time-line text-sm" />
                        {evento.horario}
                        {evento.sede && (
                          <>
                            <span className="text-gray-300 mx-0.5">·</span>
                            <i className="ri-map-pin-line text-[11px]" />
                            <span>{evento.sede}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>
          </>
        )}

        {/* ── CTA bottom ── */}
        <ScrollReveal>
          <div className="mt-10 text-center">
            <p className="text-gray-500 text-sm mb-4">
              ¿Tienes grupo? Reserva tu lugar para no quedarte sin mesa en los eventos especiales.
            </p>
            <a
              href="#reservaciones"
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl cursor-pointer transition-all active:scale-95 text-sm whitespace-nowrap"
            >
              <i className="ri-calendar-check-line" />
              Reservar para el evento
            </a>
          </div>
        </ScrollReveal>

      </div>
    </section>
  );
}