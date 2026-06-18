import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { barInfo } from '@/mocks/menu';

type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

interface Reservation {
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
  status: ReservationStatus;
  created_at: string;
}

const STATUS_CONFIG: Record<ReservationStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pendiente', color: 'text-amber-700', bg: 'bg-amber-100' },
  confirmed: { label: 'Confirmada', color: 'text-green-700', bg: 'bg-green-100' },
  cancelled: { label: 'Cancelada', color: 'text-red-700', bg: 'bg-red-100' },
  completed: { label: 'Completada', color: 'text-gray-700', bg: 'bg-gray-100' },
};

const OCCASION_MAP: Record<string, string> = {
  cumpleanos: 'Cumpleaños',
  aniversario: 'Aniversario',
  reunion: 'Reunión de amigos',
  date: 'Cita',
  despedida: 'Despedida',
  otro: 'Otro',
  negocios: 'Negocios',
};

const ZONE_MAP: Record<string, string> = {
  terraza: 'Terraza',
  interior: 'Interior',
  barra: 'Barra',
  vip: 'Zona VIP',
};

// ── WhatsApp helpers ──
function formatWhatsAppPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('52')) return digits;
  if (digits.length === 10) return '52' + digits;
  return digits;
}

function buildConfirmMessage(r: Reservation): string {
  const zone = r.zone ? ` (${ZONE_MAP[r.zone] || r.zone})` : '';
  const table = r.table_number ? `\n🪑 *Mesa asignada:* ${r.table_number}` : '';
  const occasion = r.occasion ? `\n🎉 *Ocasión:* ${OCCASION_MAP[r.occasion] || r.occasion}` : '';
  const notes = r.notes ? `\n📝 *Notas:* ${r.notes}` : '';

  return encodeURIComponent(
    `¡Hola ${r.customer_name}! 👋\n\n` +
    `Tu reserva en *La Cabrona Alitas & Beer* ha sido *CONFIRMADA* ✅\n\n` +
    `📅 *Fecha:* ${r.reservation_date}\n` +
    `⏰ *Hora:* ${r.reservation_time}${zone}\n` +
    `👥 *Personas:* ${r.guests}${table}${occasion}${notes}\n\n` +
    `📍 Sinaloa 690, Col. El Mante, Zapopan\n` +
    `¿Necesitas modificar algo? Responde aquí o llámanos.`
  );
}

function buildTableMessage(r: Reservation): string {
  return encodeURIComponent(
    `¡Hola ${r.customer_name}! 👋\n\n` +
    `Tu reserva del *${r.reservation_date}* a las *${r.reservation_time}* ha sido asignada a la *MESA ${r.table_number}* 🪑\n\n` +
    `Nos vemos pronto en *La Cabrona* 🍗🍺`
  );
}

function openWhatsApp(phone: string, text: string) {
  const url = `https://wa.me/${formatWhatsAppPhone(phone)}?text=${text}`;
  window.open(url, '_blank');
}

function buildCancelStaffMessage(r: Reservation): string {
  const dayLabel = new Date(r.reservation_date + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long' });
  const zoneLabel = r.zone ? (ZONE_MAP[r.zone] || r.zone) : 'Sin preferencia';
  const occasionLabel = r.occasion ? (OCCASION_MAP[r.occasion] || r.occasion) : null;

  let msg = `🚫 *Reserva CANCELADA en La Cabrona*\n\n`;
  msg += `*ID:* #${r.id}\n`;
  msg += `👤 *Cliente:* ${r.customer_name}\n`;
  msg += `📱 *Tel:* ${r.phone}\n`;
  if (r.email) msg += `📧 *Email:* ${r.email}\n`;
  msg += `\n📅 *Fecha:* ${r.reservation_date} (${dayLabel})\n`;
  msg += `⏰ *Hora:* ${r.reservation_time}\n`;
  msg += `👥 *Personas:* ${r.guests}\n`;
  msg += `🪑 *Zona:* ${zoneLabel}\n`;
  if (r.table_number) msg += `🪑 *Mesa asignada:* ${r.table_number}\n`;
  if (occasionLabel) msg += `🎉 *Ocasión:* ${occasionLabel}\n`;
  if (r.notes) msg += `📝 *Notas:* ${r.notes}\n`;
  msg += `\n❌ *Estado:* Cancelada desde el panel de administración`;
  if (r.table_number) msg += `\n⚠️ *Acción:* Liberar mesa ${r.table_number}`;
  msg += `\n\n_Revisar disponibilidad para nuevas reservas._`;

  return encodeURIComponent(msg);
}

/* ── Push notification helpers ── */
function requestNotificationPermission(): void {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

function showReservationPushNotification(r: Reservation) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const dayLabel = new Date(r.reservation_date + 'T00:00:00').toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const body = `👤 ${r.customer_name}\n📅 ${dayLabel} · ⏰ ${r.reservation_time}\n👥 ${r.guests} personas${r.zone ? ` · ${ZONE_MAP[r.zone] || r.zone}` : ''}`;
  try {
    const n = new Notification('🆕 Nueva reserva — La Cabrona', {
      body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: `reservation-${r.id}`,
      requireInteraction: true,
      actions: [
        { action: 'open', title: 'Ver reserva' },
      ],
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch (_) {
    /* Notification API not available or blocked */
  }
}

function playReservationChime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.1;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.01);
      gain.gain.linearRampToValueAtTime(0, t + 0.22);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  } catch (_) { /* browser blocked audio */ }
}

export default function ReservationsAdminView() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<ReservationStatus | 'all'>('all');
  const [filterDate, setFilterDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [tableInput, setTableInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarWeekOffset, setCalendarWeekOffset] = useState(0);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .order('reservation_date', { ascending: true })
      .order('reservation_time', { ascending: true });
    if (!error && data) {
      setReservations(data as Reservation[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReservations();

    // Initialize push permission state
    if ('Notification' in window) {
      setPushEnabled(Notification.permission === 'granted');
      if (Notification.permission === 'default') {
        requestNotificationPermission();
      }
    }

    const channel = supabase
      .channel('reservations-admin')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reservations' }, (payload) => {
        const newReservation = payload.new as Reservation;
        setNewCount(c => c + 1);
        setReservations(prev => [newReservation, ...prev]);
        if (soundEnabled) playReservationChime();
        showReservationPushNotification(newReservation);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reservations' }, (payload) => {
        setReservations(prev => prev.map(r => r.id === (payload.new as Reservation).id ? payload.new as Reservation : r));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchReservations, soundEnabled]);

  const filtered = useMemo(() => {
    return reservations.filter(r => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterDate && r.reservation_date !== filterDate) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          r.customer_name.toLowerCase().includes(term) ||
          r.phone.includes(term) ||
          (r.email?.toLowerCase().includes(term) ?? false)
        );
      }
      return true;
    });
  }, [reservations, filterStatus, filterDate, searchTerm]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      total: reservations.length,
      pending: reservations.filter(r => r.status === 'pending').length,
      confirmed: reservations.filter(r => r.status === 'confirmed').length,
      today: reservations.filter(r => r.reservation_date === today).length,
      upcoming: reservations.filter(r => r.reservation_date >= today && r.status !== 'cancelled').length,
    };
  }, [reservations]);

  const updateStatus = async (id: number, status: ReservationStatus) => {
    setActionLoading(true);
    await supabase.from('reservations').update({ status }).eq('id', id);
    setActionLoading(false);
    setSelected(null);
    await fetchReservations();
  };

  const confirmAndWhatsApp = async (r: Reservation) => {
    setActionLoading(true);
    await supabase.from('reservations').update({ status: 'confirmed' }).eq('id', r.id);
    setActionLoading(false);
    await fetchReservations();
    openWhatsApp(r.phone, buildConfirmMessage({ ...r, status: 'confirmed' }));
  };

  const assignTable = async (id: number) => {
    if (!tableInput.trim()) return;
    setActionLoading(true);
    await supabase.from('reservations').update({ table_number: tableInput.trim() }).eq('id', id);
    setActionLoading(false);
    setTableInput('');
    setSelected(null);
    await fetchReservations();
  };

  const assignTableAndWhatsApp = async (r: Reservation, tableNum: string) => {
    if (!tableNum.trim()) return;
    setActionLoading(true);
    await supabase.from('reservations').update({ table_number: tableNum.trim() }).eq('id', r.id);
    setActionLoading(false);
    setTableInput('');
    setSelected(null);
    await fetchReservations();
    openWhatsApp(r.phone, buildTableMessage({ ...r, table_number: tableNum.trim() }));
  };

  const dismissNew = () => setNewCount(0);

  const cancelAndNotifyStaff = async (r: Reservation) => {
    setActionLoading(true);
    await supabase.from('reservations').update({ status: 'cancelled' }).eq('id', r.id);
    setActionLoading(false);
    setSelected(null);
    await fetchReservations();
    openWhatsApp(barInfo.whatsapp, buildCancelStaffMessage(r));
  };

  /* ── Calendar helpers ── */
  const weekDays = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7) + calendarWeekOffset * 7);
    const days: { date: Date; dateStr: string; label: string; dayNum: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const fullLabels = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      days.push({
        date: d,
        dateStr,
        label: `${dayLabels[d.getDay()]} ${d.getDate()}`,
        dayNum: d.getDay(),
      });
    }
    return days;
  }, [calendarWeekOffset]);

  const isToday = (dateStr: string) => dateStr === new Date().toISOString().split('T')[0];

  const calendarReservations = useMemo(() => {
    const baseFiltered = reservations.filter(r => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      return true;
    });
    const byDay: Record<string, Reservation[]> = {};
    for (const d of weekDays) {
      byDay[d.dateStr] = baseFiltered
        .filter(r => r.reservation_date === d.dateStr)
        .sort((a, b) => a.reservation_time.localeCompare(b.reservation_time));
    }
    return byDay;
  }, [reservations, weekDays, filterStatus]);

  const weekRangeLabel = useMemo(() => {
    const start = weekDays[0]?.date;
    const end = weekDays[6]?.date;
    if (!start || !end) return '';
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return `${start.toLocaleDateString('es-MX', opts)} – ${end.toLocaleDateString('es-MX', opts)}`;
  }, [weekDays]);

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-gray-500 text-xs font-medium uppercase">Total</p>
          <p className="text-2xl font-black text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <p className="text-amber-700 text-xs font-medium uppercase">Pendientes</p>
          <p className="text-2xl font-black text-amber-800">{stats.pending}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <p className="text-green-700 text-xs font-medium uppercase">Confirmadas</p>
          <p className="text-2xl font-black text-green-800">{stats.confirmed}</p>
        </div>
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
          <p className="text-gray-500 text-xs font-medium uppercase">Hoy</p>
          <p className="text-2xl font-black text-gray-900">{stats.today}</p>
        </div>
      </div>

      {/* New reservations alert + controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {newCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3 flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 text-amber-800 text-sm font-semibold">
              <i className="ri-notification-3-line animate-pulse" />
              {newCount} nueva{newCount > 1 ? 's' : ''} reservación{newCount > 1 ? 'es' : ''} recibida{newCount > 1 ? 's' : ''}
            </div>
            <button onClick={dismissNew} className="text-amber-700 hover:text-amber-900 text-xs font-semibold cursor-pointer whitespace-nowrap ml-auto">
              Descartar
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => {
              if ('Notification' in window) {
                if (Notification.permission === 'granted') {
                  setPushEnabled(false);
                  // cannot revoke via API, user must do it in browser settings, but we toggle state for UI
                } else {
                  Notification.requestPermission().then(perm => {
                    setPushEnabled(perm === 'granted');
                  }).catch(() => {});
                }
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer transition-colors whitespace-nowrap ${
              pushEnabled
                ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
            }`}
            title={pushEnabled ? 'Notificaciones push activadas' : 'Activar notificaciones push'}
          >
            <i className={pushEnabled ? 'ri-notification-3-line' : 'ri-notification-off-line'} />
            {pushEnabled ? 'Push ON' : 'Push OFF'}
          </button>
          <button
            onClick={() => setSoundEnabled(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer transition-colors whitespace-nowrap ${
              soundEnabled
                ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
            }`}
            title={soundEnabled ? 'Sonido activado' : 'Silenciar'}
          >
            <i className={soundEnabled ? 'ri-volume-up-line' : 'ri-volume-mute-line'} />
            {soundEnabled ? 'Sonido ON' : 'Mute'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className="ri-list-check mr-1" />
              Lista
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                viewMode === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className="ri-calendar-line mr-1" />
              Calendario
            </button>
          </div>
          {viewMode === 'calendar' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCalendarWeekOffset(o => o - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 cursor-pointer transition-colors"
              >
                <i className="ri-arrow-left-s-line" />
              </button>
              <span className="text-sm font-semibold text-gray-700 whitespace-nowrap min-w-[140px] text-center">
                {weekRangeLabel}
              </span>
              <button
                onClick={() => setCalendarWeekOffset(o => o + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 cursor-pointer transition-colors"
              >
                <i className="ri-arrow-right-s-line" />
              </button>
              <button
                onClick={() => setCalendarWeekOffset(0)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                  calendarWeekOffset === 0 ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Esta semana
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o teléfono..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as ReservationStatus | 'all')}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="all">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="confirmed">Confirmadas</option>
              <option value="completed">Completadas</option>
              <option value="cancelled">Canceladas</option>
            </select>
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500 [color-scheme:light]"
            />
            <button
              onClick={() => setFilterDate(new Date().toISOString().split('T')[0])}
              className={`px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                filterDate === new Date().toISOString().split('T')[0]
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Hoy
            </button>
            {(filterStatus !== 'all' || filterDate || searchTerm) && (
              <button
                onClick={() => { setFilterStatus('all'); setFilterDate(''); setSearchTerm(''); }}
                className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm cursor-pointer whitespace-nowrap"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content: List or Calendar */}
      {viewMode === 'list' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <i className="ri-loader-4-line animate-spin text-2xl" />
              <p className="mt-2 text-sm">Cargando reservaciones...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <i className="ri-calendar-line text-3xl mb-2" />
              <p className="text-sm">No hay reservaciones que coincidan</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase">ID</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase">Cliente</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase">Fecha / Hora</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase">Personas</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase">Zona</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase">Estado</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase">Mesa</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const st = STATUS_CONFIG[r.status];
                    return (
                      <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">#{r.id}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{r.customer_name}</div>
                          <div className="text-gray-500 text-xs">{r.phone}</div>
                          {r.email && <div className="text-gray-400 text-xs">{r.email}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-900 font-medium">{r.reservation_date}</div>
                          <div className="text-gray-500 text-xs">{r.reservation_time}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium">{r.guests}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{r.zone ? ZONE_MAP[r.zone] || r.zone : '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${st.bg} ${st.color}`}>
                            {r.status === 'pending' && <i className="ri-time-line" />}
                            {r.status === 'confirmed' && <i className="ri-check-line" />}
                            {r.status === 'cancelled' && <i className="ri-close-line" />}
                            {r.status === 'completed' && <i className="ri-flag-line" />}
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {r.table_number ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-semibold">
                              <i className="ri-table-line" /> Mesa {r.table_number}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            {r.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => updateStatus(r.id, 'confirmed')}
                                  disabled={actionLoading}
                                  className="px-2.5 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors whitespace-nowrap disabled:opacity-50"
                                >
                                  Confirmar
                                </button>
                                <button
                                  onClick={() => confirmAndWhatsApp(r)}
                                  disabled={actionLoading}
                                  className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors whitespace-nowrap disabled:opacity-50 flex items-center gap-1"
                                >
                                  <i className="ri-whatsapp-line" />
                                  Confirmar + WA
                                </button>
                              </>
                            )}
                            {(r.status === 'pending' || r.status === 'confirmed') && (
                              <button
                                onClick={() => { setSelected(r); setTableInput(r.table_number || ''); }}
                                className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                              >
                                {r.table_number ? 'Cambiar mesa' : 'Asignar mesa'}
                              </button>
                            )}
                            {r.status === 'confirmed' && r.table_number && (
                              <button
                                onClick={() => openWhatsApp(r.phone, buildTableMessage(r))}
                                className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1"
                              >
                                <i className="ri-whatsapp-line" />
                                Mesa WA
                              </button>
                            )}
                            {r.status !== 'cancelled' && r.status !== 'completed' && (
                              <button
                                onClick={() => cancelAndNotifyStaff(r)}
                                disabled={actionLoading}
                                className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors whitespace-nowrap disabled:opacity-50 flex items-center gap-1"
                              >
                                <i className="ri-whatsapp-line" />
                                Cancelar + WA
                              </button>
                            )}
                            {r.status === 'confirmed' && (
                              <button
                                onClick={() => updateStatus(r.id, 'completed')}
                                disabled={actionLoading}
                                className="px-2.5 py-1.5 bg-gray-500 hover:bg-gray-600 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors whitespace-nowrap disabled:opacity-50"
                              >
                                Completar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ── Calendar Weekly View ── */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <i className="ri-loader-4-line animate-spin text-2xl" />
              <p className="mt-2 text-sm">Cargando reservaciones...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[900px] grid grid-cols-7 divide-x divide-gray-100">
                {weekDays.map(day => {
                  const dayReservations = calendarReservations[day.dateStr] || [];
                  const totalGuests = dayReservations.reduce((sum, r) => sum + r.guests, 0);
                  return (
                    <div key={day.dateStr} className="flex flex-col min-h-[320px]">
                      {/* Day header */}
                      <div className={`px-2 py-3 text-center border-b ${isToday(day.dateStr) ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
                        <p className={`text-xs font-bold uppercase tracking-wide ${isToday(day.dateStr) ? 'text-amber-700' : 'text-gray-500'}`}>
                          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][day.dayNum]}
                        </p>
                        <p className={`text-lg font-black mt-0.5 ${isToday(day.dateStr) ? 'text-amber-800' : 'text-gray-900'}`}>
                          {day.date.getDate()}
                        </p>
                        {dayReservations.length > 0 && (
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                              {dayReservations.length} reserva{dayReservations.length > 1 ? 's' : ''}
                            </span>
                            <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                              {totalGuests} px
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Reservations list */}
                      <div className="flex-1 p-2 space-y-1.5">
                        {dayReservations.length === 0 ? (
                          <div className="flex-1 flex items-center justify-center py-8">
                            <p className="text-gray-300 text-[11px] text-center">Sin reservas</p>
                          </div>
                        ) : (
                          dayReservations.map(r => {
                            const st = STATUS_CONFIG[r.status];
                            return (
                              <button
                                key={r.id}
                                onClick={() => { setSelected(r); setTableInput(r.table_number || ''); }}
                                className="w-full text-left rounded-lg border border-gray-100 p-2 hover:border-amber-300 hover:bg-amber-50/40 transition-all cursor-pointer group"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${st.bg} ${st.color}`}>
                                    {r.status === 'pending' && <i className="ri-time-line" />}
                                    {r.status === 'confirmed' && <i className="ri-check-line" />}
                                    {r.status === 'cancelled' && <i className="ri-close-line" />}
                                    {r.status === 'completed' && <i className="ri-flag-line" />}
                                    {st.label}
                                  </span>
                                  {r.table_number && (
                                    <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                      <i className="ri-table-line mr-0.5" />{r.table_number}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs font-bold text-gray-900 group-hover:text-amber-700 transition-colors">
                                  {r.reservation_time}
                                </p>
                                <p className="text-[11px] text-gray-700 font-medium truncate">
                                  {r.customer_name}
                                </p>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-[10px] text-gray-500">
                                    <i className="ri-user-line mr-0.5" />{r.guests}
                                  </span>
                                  {r.zone && (
                                    <span className="text-[10px] text-gray-400">
                                      · {ZONE_MAP[r.zone] || r.zone}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Asignar mesa + detalles */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Reserva #{selected.id}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <i className="ri-close-line text-xl" />
              </button>
            </div>
            <div className="space-y-3 text-sm mb-5">
              <div className="flex justify-between">
                <span className="text-gray-500">Cliente</span>
                <span className="text-gray-900 font-medium">{selected.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Teléfono</span>
                <span className="text-gray-900 font-medium">{selected.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Fecha / Hora</span>
                <span className="text-gray-900 font-medium">{selected.reservation_date} · {selected.reservation_time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Personas</span>
                <span className="text-gray-900 font-medium">{selected.guests}</span>
              </div>
              {selected.occasion && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Ocasión</span>
                  <span className="text-gray-900 font-medium">{OCCASION_MAP[selected.occasion] || selected.occasion}</span>
                </div>
              )}
              {selected.notes && (
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                  <span className="font-semibold text-gray-500">Notas:</span> {selected.notes}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mb-4">
              <input
                type="text"
                value={tableInput}
                onChange={e => setTableInput(e.target.value)}
                placeholder="Número de mesa"
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={() => assignTable(selected.id)}
                disabled={!tableInput.trim() || actionLoading}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg cursor-pointer transition-colors whitespace-nowrap"
              >
                Guardar
              </button>
              <button
                onClick={() => assignTableAndWhatsApp(selected, tableInput)}
                disabled={!tableInput.trim() || actionLoading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1"
              >
                <i className="ri-whatsapp-line" />
                Guardar + WA
              </button>
            </div>

            <div className="flex gap-2">
              {selected.status === 'pending' && (
                <button
                  onClick={() => updateStatus(selected.id, 'confirmed')}
                  disabled={actionLoading}
                  className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                >
                  Confirmar reserva
                </button>
              )}
              {selected.status === 'pending' && (
                <button
                  onClick={() => confirmAndWhatsApp(selected)}
                  disabled={actionLoading}
                  className="flex-1 py-2 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold rounded-lg cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-1"
                >
                  <i className="ri-whatsapp-line" />
                  Confirmar + WhatsApp
                </button>
              )}
              {selected.status !== 'cancelled' && selected.status !== 'completed' && (
                <button
                  onClick={() => cancelAndNotifyStaff(selected)}
                  disabled={actionLoading}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-1"
                >
                  <i className="ri-whatsapp-line" />
                  Cancelar + Notificar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}