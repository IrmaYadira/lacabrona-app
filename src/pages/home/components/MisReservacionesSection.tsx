import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { barInfo } from '@/mocks/menu';

const ZONE_LABELS: Record<string, string> = {
  terraza: 'Terraza',
  interior: 'Interior',
  barra: 'Barra',
  vip: 'Zona VIP',
};

const OCCASION_LABELS: Record<string, string> = {
  cumpleanos: 'Cumpleaños 🎂',
  aniversario: 'Aniversario 💑',
  reunion: 'Reunión de amigos 🍻',
  date: 'Cita ❤️',
  despedida: 'Despedida de soltero/a 🎉',
  negocios: 'Negocios 💼',
  otro: 'Otro',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; bg: string }> = {
  pending: {
    label: 'Pendiente de confirmación',
    color: 'text-amber-400',
    icon: 'ri-time-line',
    bg: 'bg-amber-500/10 border-amber-500/30',
  },
  confirmed: {
    label: 'Confirmada',
    color: 'text-green-400',
    icon: 'ri-checkbox-circle-line',
    bg: 'bg-green-500/10 border-green-500/30',
  },
  cancelled: {
    label: 'Cancelada',
    color: 'text-red-400',
    icon: 'ri-close-circle-line',
    bg: 'bg-red-500/10 border-red-500/30',
  },
  completed: {
    label: 'Completada',
    color: 'text-gray-400',
    icon: 'ri-check-double-line',
    bg: 'bg-gray-500/10 border-gray-500/30',
  },
  no_show: {
    label: 'No se presentó',
    color: 'text-gray-500',
    icon: 'ri-user-unfollow-line',
    bg: 'bg-gray-700/40 border-gray-600/20',
  },
};

type Reservation = {
  id: number;
  customer_name: string;
  phone: string;
  email: string | null;
  reservation_date: string;
  reservation_time: string;
  guests: number;
  zone: string | null;
  occasion: string | null;
  notes: string | null;
  table_number: string | null;
  status: string;
  created_at: string;
};

function getDayLabel(dateStr: string): string {
  if (!dateStr) return '';
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[new Date(dateStr + 'T00:00:00').getDay()];
}

function buildCancelRequestMessage(res: Reservation): string {
  const dayLabel = getDayLabel(res.reservation_date);
  let msg = `👋 ¡Hola! Soy *${res.customer_name}*.\n\n`;
  msg += `Solicito *cancelar* mi reserva:`;
  msg += `\n*ID:* #${res.id}`;
  msg += `\n📅 ${res.reservation_date} (${dayLabel}) a las ${res.reservation_time}\n\n`;
  msg += `Por favor confirmen la cancelación. Gracias!`;
  return encodeURIComponent(msg);
}

function buildModifyRequestMessage(res: Reservation): string {
  const dayLabel = getDayLabel(res.reservation_date);
  let msg = `👋 ¡Hola! Soy *${res.customer_name}*.\n\n`;
  msg += `Solicito *modificar* mi reserva:\n`;
  msg += `*ID:* #${res.id}\n`;
  msg += `📅 *Actual:* ${res.reservation_date} (${dayLabel}) a las ${res.reservation_time}\n`;
  msg += `👥 *Personas:* ${res.guests}\n\n`;
  msg += `¿Qué quiero cambiar?\n👉 *(escribe aquí los cambios deseados)*\n\nGracias!`;
  return encodeURIComponent(msg);
}

export default function MisReservacionesSection({ highlight = false }: { highlight?: boolean }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = phone.trim();
    if (cleaned.length < 7) {
      setError('Ingresa al menos 7 dígitos de tu teléfono');
      return;
    }
    setError('');
    setLoading(true);
    setSearched(false);

    const { data, error: dbErr } = await supabase
      .from('reservations')
      .select('*')
      .ilike('phone', `%${cleaned}%`)
      .order('reservation_date', { ascending: false })
      .order('reservation_time', { ascending: false });

    setLoading(false);
    setSearched(true);

    if (dbErr) {
      setError('Error al consultar. Intenta de nuevo.');
      setReservations([]);
      return;
    }
    setReservations((data as Reservation[]) ?? []);
  };

  const handleClear = () => {
    setPhone('');
    setSearched(false);
    setReservations([]);
    setError('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <section id="mis-reservaciones" className={`py-14 md:py-20 bg-gray-950 ${highlight ? 'animate-reservation-highlight' : ''}`}>
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        {/* Encabezado */}
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest mb-3">
            <i className="ri-calendar-check-line text-sm" />
            Consulta tu reservación
          </span>
          <h2 className="font-[Bebas_Neue] text-4xl md:text-5xl text-white tracking-wide mb-3">
            Mis Reservaciones
          </h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed">
            Ingresa tu número de teléfono y consulta el estatus de todas tus reservas en La Cabrona.
          </p>
        </div>

        {/* Formulario de búsqueda */}
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="flex-1 relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
              <i className="ri-phone-line text-gray-400 text-base" />
            </div>
            <input
              ref={inputRef}
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Ej. 33 1234 5678"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-10 py-3.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
            {phone && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-300 cursor-pointer transition-colors"
              >
                <i className="ri-close-line text-base" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 disabled:cursor-not-allowed text-white font-bold px-6 py-3.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-2 text-sm"
          >
            {loading ? (
              <>
                <i className="ri-loader-4-line animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <i className="ri-search-line" />
                Consultar
              </>
            )}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 text-red-400 text-sm flex items-center gap-2 mb-6">
            <i className="ri-error-warning-line flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Resultados */}
        {searched && !loading && (
          <>
            {reservations.length === 0 ? (
              <div className="text-center py-14 bg-gray-900 rounded-2xl border border-gray-800">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="ri-calendar-close-line text-gray-500 text-3xl" />
                </div>
                <p className="text-gray-400 font-semibold mb-1">No encontramos reservaciones</p>
                <p className="text-gray-600 text-sm">
                  No hay reservas registradas con ese número.
                </p>
                <Link
                  to="/reservas"
                  className="inline-flex items-center gap-2 mt-5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                >
                  <i className="ri-calendar-event-line" />
                  Hacer una reserva
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-500 text-xs text-center mb-2">
                  {reservations.length} {reservations.length === 1 ? 'reservación encontrada' : 'reservaciones encontradas'}
                </p>
                {reservations.map(res => {
                  const cfg = STATUS_CONFIG[res.status] ?? {
                    label: res.status,
                    color: 'text-gray-400',
                    icon: 'ri-question-line',
                    bg: 'bg-gray-800 border-gray-700',
                  };
                  const isPast = res.reservation_date < today;
                  const canModify = !isPast && (res.status === 'pending' || res.status === 'confirmed');

                  return (
                    <div
                      key={res.id}
                      className={`rounded-2xl border p-5 transition-all ${cfg.bg} ${isPast ? 'opacity-70' : ''}`}
                    >
                      {/* Cabecera: ID + status */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-white font-bold text-base font-[Bebas_Neue] tracking-wide">
                              Reserva #{res.id}
                            </span>
                            {isPast && (
                              <span className="text-[10px] font-bold uppercase tracking-wide bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
                                Pasada
                              </span>
                            )}
                          </div>
                          <p className="text-gray-500 text-xs">
                            Registrada el {new Date(res.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold whitespace-nowrap ${cfg.bg} ${cfg.color}`}>
                          <i className={`${cfg.icon} text-sm`} />
                          {cfg.label}
                        </div>
                      </div>

                      {/* Detalles */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                        <div className="bg-black/20 rounded-xl p-3">
                          <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-0.5">Fecha</p>
                          <p className="text-white text-sm font-semibold">
                            {getDayLabel(res.reservation_date)}
                          </p>
                          <p className="text-gray-300 text-xs">{res.reservation_date}</p>
                        </div>
                        <div className="bg-black/20 rounded-xl p-3">
                          <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-0.5">Hora</p>
                          <p className="text-white text-sm font-semibold">{res.reservation_time}</p>
                        </div>
                        <div className="bg-black/20 rounded-xl p-3">
                          <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-0.5">Personas</p>
                          <p className="text-white text-sm font-semibold">{res.guests} {res.guests === 1 ? 'persona' : 'personas'}</p>
                        </div>
                        {res.zone && (
                          <div className="bg-black/20 rounded-xl p-3">
                            <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-0.5">Zona</p>
                            <p className="text-white text-sm font-semibold">{ZONE_LABELS[res.zone] ?? res.zone}</p>
                          </div>
                        )}
                        {res.table_number && (
                          <div className="bg-black/20 rounded-xl p-3">
                            <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-0.5">Mesa</p>
                            <p className="text-white text-sm font-semibold">#{res.table_number}</p>
                          </div>
                        )}
                        {res.occasion && (
                          <div className="bg-black/20 rounded-xl p-3">
                            <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-0.5">Ocasión</p>
                            <p className="text-white text-sm font-semibold">{OCCASION_LABELS[res.occasion] ?? res.occasion}</p>
                          </div>
                        )}
                      </div>

                      {/* Nombre del cliente */}
                      <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                        <i className="ri-user-line text-gray-600" />
                        <span>{res.customer_name}</span>
                      </div>

                      {/* Notas */}
                      {res.notes && (
                        <div className="bg-black/20 rounded-xl p-3 mb-4">
                          <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-1">Notas</p>
                          <p className="text-gray-300 text-xs leading-relaxed">{res.notes}</p>
                        </div>
                      )}

                      {/* Acciones (solo reservas futuras activas) */}
                      {canModify && (
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          <a
                            href={`https://wa.me/${barInfo.whatsapp}?text=${buildModifyRequestMessage(res)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                          >
                            <i className="ri-whatsapp-line" />
                            Solicitar modificación
                          </a>
                          <a
                            href={`https://wa.me/${barInfo.whatsapp}?text=${buildCancelRequestMessage(res)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 bg-red-700/60 hover:bg-red-700 text-red-200 text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                          >
                            <i className="ri-close-circle-line" />
                            Cancelar reserva
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* CTA nueva reserva */}
                <div className="text-center pt-4">
                  <Link
                    to="/reservas"
                    className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <i className="ri-calendar-event-line text-amber-400" />
                    Hacer otra reserva
                  </Link>
                </div>
              </div>
            )}
          </>
        )}

        {/* Estado inicial vacío */}
        {!searched && !loading && (
          <div className="text-center py-12 bg-gray-900/50 rounded-2xl border border-gray-800">
            <div className="w-14 h-14 bg-gray-800/80 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-search-2-line text-amber-400 text-2xl" />
            </div>
            <p className="text-gray-400 text-sm">
              Ingresa tu número de teléfono para ver tus reservaciones
            </p>
          </div>
        )}
      </div>
    </section>
  );
}