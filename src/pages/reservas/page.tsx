import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { barInfo } from "@/mocks/menu";
import { usePageSEO } from "@/hooks/usePageSEO";
import { SITE_URL } from "@/lib/site-url";
import LazyIframe from "@/components/base/LazyIframe";

const LOGO_URL = "https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285";

const ZONES = [
  { value: '', label: 'Sin preferencia' },
  { value: 'terraza', label: 'Terraza' },
  { value: 'interior', label: 'Interior' },
  { value: 'barra', label: 'Barra' },
  { value: 'vip', label: 'Zona VIP' },
];

const OCCASIONS = [
  { value: '', label: 'Ninguna en especial' },
  { value: 'cumpleanos', label: 'Cumpleaños' },
  { value: 'aniversario', label: 'Aniversario' },
  { value: 'reunion', label: 'Reunión de amigos' },
  { value: 'date', label: 'Cita' },
  { value: 'despedida', label: 'Despedida de soltero/a' },
  { value: 'negocios', label: 'Negocios' },
  { value: 'otro', label: 'Otro' },
];

function getOpeningHours(dateStr: string): { open: string; close: string } | null {
  if (!dateStr) return null;
  const day = new Date(dateStr + 'T00:00:00').getDay();
  const map: Record<number, { open: string; close: string }> = {
    0: { open: '14:00', close: '23:00' },
    1: { open: '13:00', close: '00:00' },
    2: { open: '13:00', close: '00:00' },
    3: { open: '13:00', close: '00:00' },
    4: { open: '13:00', close: '00:00' },
    5: { open: '14:00', close: '02:00' },
    6: { open: '14:00', close: '02:00' },
  };
  return map[day] ?? null;
}

function generateTimeSlots(dateStr: string): string[] {
  const hours = getOpeningHours(dateStr);
  if (!hours) return [];
  const slots: string[] = [];
  let [h, m] = hours.open.split(':').map(Number);
  const [closeH, closeM] = hours.close.split(':').map(Number);
  const closeTotal = closeH * 60 + closeM;
  let currentTotal = h * 60 + m;
  // If close is before open (crosses midnight), add 24h
  const maxTotal = closeTotal < currentTotal ? closeTotal + 24 * 60 : closeTotal;
  while (currentTotal <= maxTotal) {
    const hh = String(Math.floor(currentTotal / 60) % 24).padStart(2, '0');
    const mm = String(currentTotal % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
    currentTotal += 30;
  }
  return slots;
}

function getDayLabel(dateStr: string): string {
  if (!dateStr) return '';
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[new Date(dateStr + 'T00:00:00').getDay()];
}

function buildStaffNotificationMessage(
  formData: {
    customer_name: string;
    phone: string;
    email: string;
    reservation_date: string;
    reservation_time: string;
    guests: number;
    zone: string;
    occasion: string;
    notes: string;
  },
  reservationId: number | null,
): string {
  const zoneLabel = formData.zone
    ? (ZONES.find(z => z.value === formData.zone)?.label || formData.zone)
    : 'Sin preferencia';
  const occasionLabel = formData.occasion
    ? (OCCASIONS.find(o => o.value === formData.occasion)?.label || formData.occasion)
    : 'Ninguna';
  const dayLabel = getDayLabel(formData.reservation_date);

  let msg = `🔔 *¡Nueva reserva en La Cabrona!*\n\n`;
  if (reservationId) msg += `*ID:* #${reservationId}\n`;
  msg += `👤 *Cliente:* ${formData.customer_name}\n`;
  msg += `📱 *Tel:* ${formData.phone}\n`;
  if (formData.email) msg += `📧 *Email:* ${formData.email}\n`;
  msg += `\n📅 *Fecha:* ${formData.reservation_date} (${dayLabel})\n`;
  msg += `⏰ *Hora:* ${formData.reservation_time}\n`;
  msg += `👥 *Personas:* ${formData.guests}\n`;
  msg += `🪑 *Zona:* ${zoneLabel}\n`;
  if (formData.occasion) msg += `🎉 *Ocasión:* ${occasionLabel}\n`;
  if (formData.notes) msg += `📝 *Notas:* ${formData.notes}\n`;
  msg += `\n⚠️ *Estado:* Pendiente de confirmación`;

  return encodeURIComponent(msg);
}

function buildModifyRequestMessage(
  reservationId: number | null,
  formData: {
    customer_name: string;
    reservation_date: string;
    reservation_time: string;
    guests: number;
  },
): string {
  const dayLabel = getDayLabel(formData.reservation_date);
  let msg = `👋 ¡Hola! Soy *${formData.customer_name}*.\n\n`;
  msg += `Solicito *modificar* mi reserva:\n`;
  if (reservationId) msg += `*ID:* #${reservationId}\n`;
  msg += `📅 *Actual:* ${formData.reservation_date} (${dayLabel}) a las ${formData.reservation_time}\n`;
  msg += `👥 *Personas:* ${formData.guests}\n\n`;
  msg += `¿Qué quiero cambiar?\n👉 *(escribe aquí los cambios deseados)*\n\n`;
  msg += `Gracias!`;
  return encodeURIComponent(msg);
}

function buildCancelRequestMessage(
  reservationId: number | null,
  formData: {
    customer_name: string;
    reservation_date: string;
    reservation_time: string;
  },
): string {
  const dayLabel = getDayLabel(formData.reservation_date);
  let msg = `👋 ¡Hola! Soy *${formData.customer_name}*.\n\n`;
  msg += `Solicito *cancelar* mi reserva:`;
  if (reservationId) msg += `\n*ID:* #${reservationId}`;
  msg += `\n📅 ${formData.reservation_date} (${dayLabel}) a las ${formData.reservation_time}\n\n`;
  msg += `Por favor confirmen la cancelación. Gracias!`;
  return encodeURIComponent(msg);
}

export default function Reservas() {
  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    email: '',
    reservation_date: '',
    reservation_time: '',
    guests: 2,
    zone: '',
    occasion: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [reservationId, setReservationId] = useState<number | null>(null);

  usePageSEO({
    title: "Reserva tu Mesa | La Cabrona Alitas & Beer Zapopan",
    description: "Reserva tu mesa en La Cabrona Alitas & Beer en Zapopan, El Mante. Aparta con anticipación para cumpleaños, reuniones, citas y ocasiones especiales. Te confirmamos por teléfono.",
    canonicalUrl: `${SITE_URL}/reservas`,
    ogImage: LOGO_URL,
    keywords: "reservar mesa Zapopan, reserva bar El Mante, cumpleaños bar Zapopan, reservación La Cabrona",
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Inicio", "item": `${SITE_URL}/` },
          { "@type": "ListItem", "position": 2, "name": "Reservar Mesa", "item": `${SITE_URL}/reservas` }
        ]
      },
      {
        "@context": "https://schema.org",
        "@type": "FoodEstablishmentReservation",
        "name": "Reserva de Mesa — La Cabrona Alitas & Beer Zapopan",
        "url": `${SITE_URL}/reservas`,
        "provider": { "@id": `${SITE_URL}/#business` },
        "potentialAction": {
          "@type": "ReserveAction",
          "target": { "@type": "EntryPoint", "urlTemplate": `${SITE_URL}/reservas`, "inLanguage": "es", "actionPlatform": ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"] },
          "result": { "@type": "FoodEstablishmentReservation", "name": "Reserva de Mesa — La Cabrona Alitas & Beer Zapopan" }
        }
      }
    ],
  });

  const today = useMemo(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }, []);

  const maxDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 2);
    return d.toISOString().split('T')[0];
  }, []);

  const timeSlots = useMemo(() => generateTimeSlots(form.reservation_date), [form.reservation_date]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.customer_name.trim() || form.customer_name.trim().length < 2) {
      e.customer_name = 'Ingresa tu nombre completo';
    }
    if (!form.phone.trim() || form.phone.trim().length < 8) {
      e.phone = 'Ingresa un teléfono válido';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = 'Correo electrónico inválido';
    }
    if (!form.reservation_date) {
      e.reservation_date = 'Selecciona una fecha';
    }
    if (!form.reservation_time) {
      e.reservation_time = 'Selecciona una hora';
    }
    if (form.guests < 1 || form.guests > 50) {
      e.guests = 'Mínimo 1 persona, máximo 50';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from('reservations')
      .insert({
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        reservation_date: form.reservation_date,
        reservation_time: form.reservation_time,
        guests: form.guests,
        zone: form.zone || null,
        occasion: form.occasion || null,
        notes: form.notes.trim() || null,
        status: 'pending',
      })
      .select('id')
      .single();
    setSubmitting(false);
    if (error) {
      setErrors({ general: 'Hubo un error al guardar tu reserva. Intenta de nuevo.' });
      return;
    }
    setReservationId(data?.id ?? null);

    // Notificar al staff por WhatsApp
    const staffMsg = buildStaffNotificationMessage(form, data?.id ?? null);
    window.open(`https://wa.me/${barInfo.whatsapp}?text=${staffMsg}`, '_blank');

    setSuccess(true);
  };

  if (success) {
    const modifyMsg = buildModifyRequestMessage(reservationId, {
      customer_name: form.customer_name,
      reservation_date: form.reservation_date,
      reservation_time: form.reservation_time,
      guests: form.guests,
    });
    const cancelMsg = buildCancelRequestMessage(reservationId, {
      customer_name: form.customer_name,
      reservation_date: form.reservation_date,
      reservation_time: form.reservation_time,
    });
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
            <i className="ri-check-line text-green-400 text-3xl" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2 font-[Bebas_Neue] tracking-wide">
            ¡Reserva enviada!
          </h1>
          <p className="text-gray-400 text-sm mb-1">
            Tu reserva #{reservationId} está en espera de confirmación.
          </p>
          <p className="text-gray-500 text-xs mb-6">
            El bar fue notificado por WhatsApp. Te contactaremos para confirmar los detalles.
          </p>
          <div className="bg-gray-800/50 rounded-xl p-4 text-left mb-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Nombre</span>
              <span className="text-white font-medium">{form.customer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Fecha</span>
              <span className="text-white font-medium">{form.reservation_date} · {getDayLabel(form.reservation_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Hora</span>
              <span className="text-white font-medium">{form.reservation_time}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Personas</span>
              <span className="text-white font-medium">{form.guests}</span>
            </div>
            {form.zone && (
              <div className="flex justify-between">
                <span className="text-gray-500">Zona</span>
                <span className="text-white font-medium">{ZONES.find(z => z.value === form.zone)?.label}</span>
              </div>
            )}
          </div>

          {/* Botones de modificar/cancelar vía WhatsApp */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <a
              href={`https://wa.me/${barInfo.whatsapp}?text=${modifyMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-whatsapp-line" />
              Modificar
            </a>
            <a
              href={`https://wa.me/${barInfo.whatsapp}?text=${cancelMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-close-circle-line" />
              Cancelar
            </a>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                setSuccess(false);
                setForm({
                  customer_name: '',
                  phone: '',
                  email: '',
                  reservation_date: '',
                  reservation_time: '',
                  guests: 2,
                  zone: '',
                  occasion: '',
                  notes: '',
                });
                setErrors({});
              }}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
            >
              Hacer otra reserva
            </button>
            <Link
              to="/"
              className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-3 rounded-xl cursor-pointer transition-colors whitespace-nowrap text-center"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 cursor-pointer">
            <span className="font-[Bebas_Neue] text-xl text-amber-400 tracking-wide">LA CABRONA</span>
          </Link>
          <Link
            to="/menu"
            className="text-xs font-bold uppercase tracking-wide text-gray-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            Ver Menú
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 md:gap-12">
          {/* Info lateral */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h1 className="font-[Bebas_Neue] text-4xl md:text-5xl text-white tracking-wide mb-2">
                Reserva tu mesa
              </h1>
              <p className="text-gray-400 text-sm leading-relaxed">
                Reserva con anticipación y asegura tu lugar en La Cabrona. 
                Te confirmaremos por teléfono antes de tu visita.
              </p>
            </div>

            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-4">
              <h3 className="font-semibold text-white text-sm uppercase tracking-wide">Horarios</h3>
              <div className="space-y-2 text-sm">
                {Object.entries(barInfo.hours).map(([day, hours]) => (
                  <div key={day} className="flex justify-between text-gray-400">
                    <span className="capitalize">{day}</span>
                    <span className="text-gray-200 font-medium">{hours}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-3">
              <h3 className="font-semibold text-white text-sm uppercase tracking-wide">Contacto</h3>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <i className="ri-phone-line text-amber-400" />
                <span>{barInfo.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <i className="ri-map-pin-line text-amber-400" />
                <span className="text-xs">{barInfo.address}</span>
              </div>
            </div>

            <LazyIframe
              src={barInfo.mapEmbed}
              title="Ubicación La Cabrona"
              className="rounded-xl overflow-hidden border border-gray-800 h-48"
            />
          </div>

          {/* Formulario */}
          <div className="lg:col-span-3">
            <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl p-6 md:p-8 border border-gray-800 space-y-5">
              <h2 className="font-[Bebas_Neue] text-2xl text-white tracking-wide mb-1">
                Datos de la reserva
              </h2>

              {errors.general && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2">
                  <i className="ri-error-warning-line" />
                  {errors.general}
                </div>
              )}

              {/* Nombre */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  Nombre completo <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.customer_name}
                  onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                  placeholder="Ej. Juan Pérez"
                  className={`w-full bg-gray-800 border ${errors.customer_name ? 'border-red-500' : 'border-gray-700'} rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors`}
                />
                {errors.customer_name && <p className="text-red-400 text-xs mt-1">{errors.customer_name}</p>}
              </div>

              {/* Teléfono y Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                    Teléfono <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="33 1234 5678"
                    className={`w-full bg-gray-800 border ${errors.phone ? 'border-red-500' : 'border-gray-700'} rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors`}
                  />
                  {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="opcional"
                    className={`w-full bg-gray-800 border ${errors.email ? 'border-red-500' : 'border-gray-700'} rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors`}
                  />
                  {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                </div>
              </div>

              {/* Fecha y Hora */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                    Fecha <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    min={today}
                    max={maxDate}
                    value={form.reservation_date}
                    onChange={e => {
                      setForm(f => ({ ...f, reservation_date: e.target.value, reservation_time: '' }));
                      if (errors.reservation_date) setErrors(err => { const n = { ...err }; delete n.reservation_date; return n; });
                    }}
                    className={`w-full bg-gray-800 border ${errors.reservation_date ? 'border-red-500' : 'border-gray-700'} rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors [color-scheme:dark]`}
                  />
                  {errors.reservation_date && <p className="text-red-400 text-xs mt-1">{errors.reservation_date}</p>}
                  {form.reservation_date && (
                    <p className="text-gray-500 text-xs mt-1">
                      {getDayLabel(form.reservation_date)} · Horario: {getOpeningHours(form.reservation_date)?.open} - {getOpeningHours(form.reservation_date)?.close}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                    Hora <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={form.reservation_time}
                    onChange={e => setForm(f => ({ ...f, reservation_time: e.target.value }))}
                    disabled={!form.reservation_date || timeSlots.length === 0}
                    className={`w-full bg-gray-800 border ${errors.reservation_time ? 'border-red-500' : 'border-gray-700'} rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed appearance-none`}
                  >
                    <option value="">Selecciona hora</option>
                    {timeSlots.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  {errors.reservation_time && <p className="text-red-400 text-xs mt-1">{errors.reservation_time}</p>}
                </div>
              </div>

              {/* Personas y Zona */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                    Personas <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, guests: Math.max(1, f.guests - 1) }))}
                      className="w-10 h-10 flex items-center justify-center bg-gray-800 border border-gray-700 rounded-lg text-white hover:bg-gray-700 cursor-pointer transition-colors"
                    >
                      <i className="ri-subtract-line" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={form.guests}
                      onChange={e => setForm(f => ({ ...f, guests: Math.max(1, Math.min(50, Number(e.target.value))) }))}
                      className={`w-20 bg-gray-800 border ${errors.guests ? 'border-red-500' : 'border-gray-700'} rounded-lg px-3 py-3 text-white text-sm text-center focus:outline-none focus:border-amber-500 transition-colors`}
                    />
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, guests: Math.min(50, f.guests + 1) }))}
                      className="w-10 h-10 flex items-center justify-center bg-gray-800 border border-gray-700 rounded-lg text-white hover:bg-gray-700 cursor-pointer transition-colors"
                    >
                      <i className="ri-add-line" />
                    </button>
                  </div>
                  {errors.guests && <p className="text-red-400 text-xs mt-1">{errors.guests}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                    Zona preferida
                  </label>
                  <select
                    value={form.zone}
                    onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors appearance-none"
                  >
                    {ZONES.map(z => (
                      <option key={z.value} value={z.value}>{z.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ocasión */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  Ocasión especial
                </label>
                <select
                  value={form.occasion}
                  onChange={e => setForm(f => ({ ...f, occasion: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors appearance-none"
                >
                  {OCCASIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  Notas adicionales
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value.slice(0, 500) }))}
                  placeholder="Alergias, sillas para niños, celebración especial..."
                  rows={3}
                  maxLength={500}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                />
                <p className="text-gray-600 text-xs mt-1 text-right">{form.notes.length}/500</p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <i className="ri-loader-4-line animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <i className="ri-calendar-check-line" />
                    Reservar mesa
                  </>
                )}
              </button>

              <p className="text-gray-600 text-xs text-center">
                Al reservar aceptas que te contactemos por teléfono para confirmar la disponibilidad.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}