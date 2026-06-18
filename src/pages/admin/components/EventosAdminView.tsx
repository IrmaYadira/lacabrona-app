import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Evento } from "@/types/eventos";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PromoSemana {
  id: number;
  dia_semana: number; // 0=Dom,1=Lun,...,6=Sáb
  titulo: string;
  descripcion: string;
  detalle: string;
  horario: string;
  badge: string;
  badge_color: string;
  icon: string;
  imagen_url: string;
  activo: boolean;
  deleted_at: string | null;
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
  deleted_at: string | null;
  sede: string | null;
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Determina si un evento ya terminó combinando fecha + horario */
function isEventoTerminado(fecha: string, horario: string): boolean {
  const now = new Date();
  if (!horario) return fecha < now.toISOString().split('T')[0];

  let endTimeStr: string;

  if (horario.includes('-')) {
    endTimeStr = horario.split('-')[1].trim();
  } else {
    const m = horario.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!m) return fecha < now.toISOString().split('T')[0];
    let h = parseInt(m[1]);
    const min = parseInt(m[2]);
    const ap = m[3].toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    h += 2;
    endTimeStr = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  }

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

const TIPO_OPCIONES = [
  { label: 'Entretenimiento', color: 'text-pink-600', bg: 'bg-pink-50 border-pink-200' },
  { label: 'Torneo', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  { label: 'Partido', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  { label: 'Música en Vivo', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
  { label: 'Degustación', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' },
  { label: 'Evento', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
];

const ICON_OPCIONES = [
  'ri-mic-line', 'ri-focus-3-line', 'ri-football-line', 'ri-music-line',
  'ri-star-line', 'ri-calendar-event-line', 'ri-award-line', 'ri-beer-line',
  'ri-fire-line', 'ri-goblet-line', 'ri-cup-line', 'ri-heart-line',
  'ri-tv-line', 'ri-trophy-line', 'ri-restaurant-line', 'ri-gamepad-line',
];

// ─── Edit Promo Modal ─────────────────────────────────────────────────────────

interface EditPromoModalProps {
  promo: PromoSemana;
  onClose: () => void;
  onSaved: () => void;
}

function EditPromoModal({ promo, onClose, onSaved }: EditPromoModalProps) {
  const [form, setForm] = useState({ ...promo });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (key: keyof PromoSemana, val: string | boolean) =>
    setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.titulo.trim()) { setErr('El título es obligatorio'); return; }
    setSaving(true);
    const { error } = await supabase
      .from('promos_semana')
      .update({
        titulo: form.titulo,
        descripcion: form.descripcion,
        detalle: form.detalle,
        horario: form.horario,
        badge: form.badge,
        badge_color: form.badge_color,
        icon: form.icon,
        imagen_url: form.imagen_url,
        activo: form.activo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', promo.id);
    setSaving(false);
    if (error) { setErr('Error al guardar: ' + error.message); return; }
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="font-black text-gray-900 text-base">Editar Promo</h2>
            <p className="text-gray-400 text-xs">{DIAS[promo.dia_semana]}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer text-gray-500">
            <i className="ri-close-line" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Título */}
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1.5">Título</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-amber-400"
              value={form.titulo}
              onChange={e => set('titulo', e.target.value)}
              placeholder="Ej: Lunes de Caguamas"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1.5">Descripción</label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-amber-400 resize-none"
              rows={2}
              value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)}
            />
          </div>

          {/* Detalle */}
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1.5">Detalle / Nota</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-amber-400"
              value={form.detalle}
              onChange={e => set('detalle', e.target.value)}
              placeholder="Ej: Válido de 8pm a cierre"
            />
          </div>

          {/* Horario */}
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1.5">Horario</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-amber-400"
              value={form.horario}
              onChange={e => set('horario', e.target.value)}
              placeholder="Ej: 8:00 PM – Cierre"
            />
          </div>

          {/* Badge */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1.5">Badge / Etiqueta</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-amber-400"
                value={form.badge}
                onChange={e => set('badge', e.target.value)}
                placeholder="Ej: 2x1"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1.5">Color badge</label>
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-amber-400 cursor-pointer"
                value={form.badge_color}
                onChange={e => set('badge_color', e.target.value)}
              >
                <option value="bg-amber-500">Amarillo</option>
                <option value="bg-red-500">Rojo</option>
                <option value="bg-orange-500">Naranja</option>
                <option value="bg-yellow-600">Dorado</option>
                <option value="bg-purple-600">Morado</option>
                <option value="bg-green-600">Verde</option>
                <option value="bg-pink-500">Rosa</option>
              </select>
            </div>
          </div>

          {/* Icono */}
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1.5">Ícono</label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPCIONES.map(ic => (
                <button
                  key={ic}
                  onClick={() => set('icon', ic)}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg border cursor-pointer transition-all ${
                    form.icon === ic
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-600'
                  }`}
                >
                  <i className={ic} />
                </button>
              ))}
            </div>
          </div>

          {/* URL imagen */}
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1.5">URL de imagen</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-amber-400"
              value={form.imagen_url}
              onChange={e => set('imagen_url', e.target.value)}
              placeholder="https://..."
            />
            {form.imagen_url && (
              <img src={form.imagen_url} alt="Vista previa de imagen" title="Vista previa de imagen del evento" className="mt-2 w-full h-28 object-cover object-top rounded-xl border border-gray-100" />
            )}
          </div>

          {/* Activo */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <span className="text-sm font-semibold text-gray-700">Mostrar en página web</span>
            <button
              onClick={() => set('activo', !form.activo)}
              className={`relative w-11 h-6 rounded-full cursor-pointer transition-all ${form.activo ? 'bg-amber-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${form.activo ? 'left-5.5' : 'left-0.5'}`} style={{ left: form.activo ? '22px' : '2px' }} />
            </button>
          </div>

          {err && <p className="text-red-500 text-xs bg-red-50 rounded-lg px-3 py-2">{err}</p>}
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold cursor-pointer hover:bg-gray-50 whitespace-nowrap">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit / Add Evento Modal ──────────────────────────────────────────────────

interface EditEventoModalProps {
  evento: Partial<EventoEspecial> | null;
  isNew: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function EditEventoModal({ evento, isNew, onClose, onSaved }: EditEventoModalProps) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState<Partial<EventoEspecial>>(evento ?? {
    fecha: today,
    titulo: '',
    descripcion: '',
    horario: '',
    tipo: 'Evento',
    tipo_color: 'text-amber-600',
    tipo_bg: 'bg-amber-50 border-amber-200',
    icon: 'ri-calendar-event-line',
    activo: true,
    sede: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (key: keyof EventoEspecial, val: string | boolean) =>
    setForm(f => ({ ...f, [key]: val }));

  const handleTipoChange = (tipoLabel: string) => {
    const t = TIPO_OPCIONES.find(o => o.label === tipoLabel);
    if (t) setForm(f => ({ ...f, tipo: t.label, tipo_color: t.color, tipo_bg: t.bg }));
  };

  const handleSave = async () => {
    if (!form.titulo?.trim()) { setErr('El título es obligatorio'); return; }
    if (!form.fecha) { setErr('La fecha es obligatoria'); return; }
    setSaving(true);
    const payload = {
      fecha: form.fecha,
      titulo: form.titulo,
      descripcion: form.descripcion ?? '',
      horario: form.horario ?? '',
      tipo: form.tipo ?? 'Evento',
      tipo_color: form.tipo_color ?? 'text-amber-600',
      tipo_bg: form.tipo_bg ?? 'bg-amber-50 border-amber-200',
      icon: form.icon ?? 'ri-calendar-event-line',
      activo: form.activo ?? true,
      sede: (form as any).sede ?? '',
      updated_at: new Date().toISOString(),
    };

    let error;
    if (isNew) {
      ({ error } = await supabase.from('eventos_especiales').insert(payload));
    } else {
      ({ error } = await supabase.from('eventos_especiales').update(payload).eq('id', form.id!));
    }

    setSaving(false);
    if (error) { setErr('Error: ' + error.message); return; }
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-black text-gray-900 text-base">
            {isNew ? 'Nuevo Evento' : 'Editar Evento'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer text-gray-500">
            <i className="ri-close-line" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Título */}
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1.5">Título del evento</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400"
              value={form.titulo ?? ''}
              onChange={e => set('titulo', e.target.value)}
              placeholder="Ej: Noche de Karaoke"
            />
          </div>

          {/* Fecha + Horario */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1.5">Fecha</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400 cursor-pointer"
                value={form.fecha ?? today}
                onChange={e => set('fecha', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1.5">Horario</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400"
                value={form.horario ?? ''}
                onChange={e => set('horario', e.target.value)}
                placeholder="Ej: 9:00 PM"
              />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1.5">Descripción</label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400 resize-none"
              rows={2}
              value={form.descripcion ?? ''}
              onChange={e => set('descripcion', e.target.value)}
            />
          </div>

          {/* Sede */}
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1.5">Sede / Ubicación</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400"
              value={(form as any).sede ?? ''}
              onChange={e => setForm(f => ({ ...f, sede: e.target.value }))}
              placeholder="Ej: Guadalajara, Zapopan, etc."
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1.5">Tipo de evento</label>
            <div className="flex flex-wrap gap-2">
              {TIPO_OPCIONES.map(t => (
                <button
                  key={t.label}
                  onClick={() => handleTipoChange(t.label)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-all whitespace-nowrap ${
                    form.tipo === t.label
                      ? `${t.bg} ${t.color} border-current`
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ícono */}
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1.5">Ícono</label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPCIONES.map(ic => (
                <button
                  key={ic}
                  onClick={() => set('icon', ic)}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg border cursor-pointer transition-all ${
                    form.icon === ic
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-600'
                  }`}
                >
                  <i className={ic} />
                </button>
              ))}
            </div>
          </div>

          {/* Activo */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <span className="text-sm font-semibold text-gray-700">Visible en página web</span>
            <button
              onClick={() => set('activo', !form.activo)}
              className={`relative w-11 h-6 rounded-full cursor-pointer transition-all ${form.activo ? 'bg-amber-500' : 'bg-gray-300'}`}
            >
              <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all" style={{ left: form.activo ? '22px' : '2px' }} />
            </button>
          </div>

          {err && <p className="text-red-500 text-xs bg-red-50 rounded-lg px-3 py-2">{err}</p>}
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold cursor-pointer hover:bg-gray-50 whitespace-nowrap">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            {saving ? 'Guardando...' : isNew ? 'Crear evento' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EventosAdminView() {
  const [tab, setTab] = useState<'promos' | 'eventos'>('promos');
  const [promos, setPromos] = useState<PromoSemana[]>([]);
  const [eventos, setEventos] = useState<EventoEspecial[]>([]);
  const [loading, setLoading] = useState(true);
  const [editPromo, setEditPromo] = useState<PromoSemana | null>(null);
  const [editEvento, setEditEvento] = useState<EventoEspecial | null>(null);
  const [addEvento, setAddEvento] = useState(false);
  const [toast, setToast] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [trashedPromos, setTrashedPromos] = useState<PromoSemana[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [showTrashEventos, setShowTrashEventos] = useState(false);
  const [trashedEventos, setTrashedEventos] = useState<EventoEspecial[]>([]);
  const [loadingTrashEventos, setLoadingTrashEventos] = useState(false);
  const [showPastEventos, setShowPastEventos] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const showTrashRef = useRef(false);
  const showTrashEventosRef = useRef(false);

  const autoPurgeTrash = useCallback(async () => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: expired } = await supabase
      .from('promos_semana')
      .select('id')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoff);

    if (expired && expired.length > 0) {
      const ids = expired.map((p: { id: number }) => p.id);
      await supabase.from('promos_semana').delete().in('id', ids);
      showToast(`${ids.length} promo${ids.length > 1 ? 's' : ''} borrada${ids.length > 1 ? 's' : ''} automáticamente (30+ días en papelera)`);

      if (showTrashRef.current) {
        const { data } = await supabase.from('promos_semana').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
        setTrashedPromos((data as PromoSemana[]) ?? []);
      }
    }
  }, []);

  // ── Auto-purge eventos en papelera (30+ días) ──
  const autoPurgeEventosTrash = useCallback(async () => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: expired } = await supabase
      .from('eventos_especiales')
      .select('id')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoff);

    if (expired && expired.length > 0) {
      const ids = expired.map((e: { id: number }) => e.id);
      await supabase.from('eventos_especiales').delete().in('id', ids);
      showToast(`${ids.length} evento${ids.length > 1 ? 's' : ''} borrado${ids.length > 1 ? 's' : ''} automáticamente (30+ días en papelera)`);

      if (showTrashEventosRef.current) {
        const { data } = await supabase.from('eventos_especiales').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
        setTrashedEventos((data as EventoEspecial[]) ?? []);
      }
    }
  }, []);

  // ── Auto-purge eventos pasados + ocultos (30+ días desde fecha) ──
  const autoPurgePastHiddenEventos = useCallback(async () => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data: stale } = await supabase
      .from('eventos_especiales')
      .select('id, titulo')
      .eq('activo', false)
      .is('deleted_at', null)
      .lt('fecha', cutoff);

    if (stale && stale.length > 0) {
      const ids = stale.map((e: { id: number; titulo: string }) => e.id);
      await supabase.from('eventos_especiales').update({ deleted_at: new Date().toISOString() }).in('id', ids);
      showToast(`${ids.length} evento${ids.length > 1 ? 's' : ''} pasado${ids.length > 1 ? 's' : ''} y oculto${ids.length > 1 ? 's' : ''} movido${ids.length > 1 ? 's' : ''} a papelera (30+ días desde la fecha)`);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: pData }, { data: eData }] = await Promise.all([
      supabase.from('promos_semana').select('*').is('deleted_at', null).order('dia_semana'),
      supabase.from('eventos_especiales').select('*').is('deleted_at', null).order('fecha'),
    ]);
    setPromos((pData as PromoSemana[]) ?? []);
    setEventos((eData as EventoEspecial[]) ?? []);
    setLoading(false);

    autoPurgeTrash();
    autoPurgeEventosTrash();
    autoPurgePastHiddenEventos();
  }, [autoPurgeTrash, autoPurgeEventosTrash, autoPurgePastHiddenEventos]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaved = () => {
    fetchData();
    showToast('Cambios guardados correctamente');
  };

  const handleTogglePromo = async (promo: PromoSemana) => {
    await supabase.from('promos_semana').update({ activo: !promo.activo, updated_at: new Date().toISOString() }).eq('id', promo.id);
    setPromos(ps => ps.map(p => p.id === promo.id ? { ...p, activo: !p.activo } : p));
  };

  const handleToggleEvento = async (ev: EventoEspecial) => {
    await supabase.from('eventos_especiales').update({ activo: !ev.activo, updated_at: new Date().toISOString() }).eq('id', ev.id);
    setEventos(es => es.map(e => e.id === ev.id ? { ...e, activo: !e.activo } : e));
  };

  const handleDeleteEvento = async (id: number) => {
    setDeletingId(id);
    await supabase.from('eventos_especiales').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    setEventos(es => es.filter(e => e.id !== id));
    setDeletingId(null);
    showToast('Evento movido a la papelera');
  };

  const handleDeletePromo = async (id: number) => {
    setDeletingId(id);
    await supabase.from('promos_semana').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    setPromos(ps => ps.filter(p => p.id !== id));
    setDeletingId(null);
    showToast('Promo movida a la papelera');
  };

  const fetchTrash = async () => {
    setLoadingTrash(true);
    const { data } = await supabase.from('promos_semana').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
    setTrashedPromos((data as PromoSemana[]) ?? []);
    setLoadingTrash(false);
  };

  const handleRestorePromo = async (id: number) => {
    setDeletingId(id);
    await supabase.from('promos_semana').update({ deleted_at: null, updated_at: new Date().toISOString() }).eq('id', id);
    setTrashedPromos(ps => ps.filter(p => p.id !== id));
    setDeletingId(null);
    showToast('Promo restaurada');
    fetchData();
  };

  const handlePurgePromo = async (id: number) => {
    setDeletingId(id);
    await supabase.from('promos_semana').delete().eq('id', id);
    setTrashedPromos(ps => ps.filter(p => p.id !== id));
    setDeletingId(null);
    showToast('Promo eliminada permanentemente');
  };

  // ── Eventos trash handlers ──
  const fetchTrashEventos = async () => {
    setLoadingTrashEventos(true);
    const { data } = await supabase.from('eventos_especiales').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
    setTrashedEventos((data as EventoEspecial[]) ?? []);
    setLoadingTrashEventos(false);
  };

  const handleRestoreEvento = async (id: number) => {
    setDeletingId(id);
    await supabase.from('eventos_especiales').update({ deleted_at: null, updated_at: new Date().toISOString() }).eq('id', id);
    setTrashedEventos(es => es.filter(e => e.id !== id));
    setDeletingId(null);
    showToast('Evento restaurado');
    fetchData();
  };

  const handlePurgeEvento = async (id: number) => {
    setDeletingId(id);
    await supabase.from('eventos_especiales').delete().eq('id', id);
    setTrashedEventos(es => es.filter(e => e.id !== id));
    setDeletingId(null);
    showToast('Evento eliminado permanentemente');
  };

  useEffect(() => {
    showTrashRef.current = showTrash;
  }, [showTrash]);

  useEffect(() => {
    showTrashEventosRef.current = showTrashEventos;
  }, [showTrashEventos]);

  const openTrash = () => {
    setShowTrash(true);
    fetchTrash();
  };

  const closeTrash = () => {
    setShowTrash(false);
    setTrashedPromos([]);
  };

  const openTrashEventos = () => {
    setShowTrashEventos(true);
    fetchTrashEventos();
  };

  const closeTrashEventos = () => {
    setShowTrashEventos(false);
    setTrashedEventos([]);
  };

  const formatFecha = (fechaStr: string) => {
    const d = new Date(fechaStr + 'T12:00:00');
    return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const displayedEventos = showPastEventos
    ? eventos
    : eventos.filter(e => e.fecha >= todayStr && !isEventoTerminado(e.fecha, e.horario));

  return (
    <div className="max-w-4xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2">
          <i className="ri-checkbox-circle-fill text-amber-400" />
          {toast}
        </div>
      )}

      {/* Modales */}
      {editPromo && (
        <EditPromoModal promo={editPromo} onClose={() => setEditPromo(null)} onSaved={handleSaved} />
      )}
      {editEvento && (
        <EditEventoModal evento={editEvento} isNew={false} onClose={() => setEditEvento(null)} onSaved={handleSaved} />
      )}
      {addEvento && (
        <EditEventoModal evento={null} isNew onClose={() => setAddEvento(false)} onSaved={handleSaved} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-black text-gray-900">Eventos y Promociones</h2>
          <p className="text-gray-500 text-sm mt-0.5">Edita en tiempo real lo que ve el cliente en la web</p>
        </div>
        {tab === 'eventos' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => showTrashEventos ? closeTrashEventos() : openTrashEventos()}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all whitespace-nowrap border ${
                showTrashEventos
                  ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              <i className={showTrashEventos ? 'ri-arrow-go-back-line' : 'ri-delete-bin-6-line'} />
              {showTrashEventos ? 'Salir' : 'Papelera'}
            </button>
            <button
              onClick={() => setAddEvento(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl cursor-pointer transition-all whitespace-nowrap"
            >
              <i className="ri-add-line" />
              Nuevo evento
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => { setTab('promos'); closeTrash(); closeTrashEventos(); }}
            className={`px-5 py-2 rounded-lg text-sm font-bold cursor-pointer transition-all whitespace-nowrap ${tab === 'promos' ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <i className="ri-discount-percent-line mr-1.5" />
            Promos semanales
          </button>
          <button
            onClick={() => { setTab('eventos'); closeTrash(); closeTrashEventos(); }}
            className={`px-5 py-2 rounded-lg text-sm font-bold cursor-pointer transition-all whitespace-nowrap ${tab === 'eventos' ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <i className="ri-calendar-event-line mr-1.5" />
            Eventos especiales
          </button>
        </div>
        {tab === 'promos' && (
          <button
            onClick={() => showTrash ? closeTrash() : openTrash()}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-all whitespace-nowrap border ${
              showTrash
                ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <i className={showTrash ? 'ri-arrow-go-back-line' : 'ri-delete-bin-6-line'} />
            {showTrash ? 'Salir de papelera' : 'Papelera'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <i className="ri-loader-4-line animate-spin text-2xl mr-3" />
          Cargando...
        </div>
      ) : (
        <>
          {/* ── PROMOS ── */}
          {tab === 'promos' && (
            <>
              {!showTrash ? (
                <>
                  <p className="text-xs text-gray-400 mb-4">
                    <i className="ri-information-line text-amber-500 mr-1" />
                    Las promos están fijas por día de la semana. Solo edita su contenido, horario y visibilidad.
                  </p>
                  {promos.map(promo => (
                    <div key={promo.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                      <div className="flex items-center gap-4 p-4">
                        {/* Imagen mini */}
                        <div className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100">
                          {promo.imagen_url ? (
                            <img src={promo.imagen_url} alt={promo.titulo} loading="lazy" decoding="async" className="w-full h-full object-cover object-top" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                              <i className={`${promo.icon} text-2xl`} />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider">
                              {DIAS[promo.dia_semana]}
                            </span>
                            {promo.badge && (
                              <span className={`text-[10px] font-black text-white px-2 py-0.5 rounded-full ${promo.badge_color}`}>
                                {promo.badge}
                              </span>
                            )}
                          </div>
                          <p className="font-black text-gray-900 text-sm leading-tight truncate">{promo.titulo}</p>
                          <p className="text-gray-500 text-xs truncate">{promo.descripcion}</p>
                          <div className="flex items-center gap-1 mt-1 text-gray-400 text-xs">
                            <i className="ri-time-line" />
                            {promo.horario}
                          </div>
                        </div>

                        {/* Acciones */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Toggle activo */}
                          <button
                            onClick={() => handleTogglePromo(promo)}
                            className={`relative w-10 h-5 rounded-full cursor-pointer transition-all flex-shrink-0 ${promo.activo ? 'bg-amber-500' : 'bg-gray-200'}`}
                            title={promo.activo ? 'Ocultar' : 'Mostrar'}
                          >
                            <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all" style={{ left: promo.activo ? '21px' : '2px' }} />
                          </button>
                          <button
                            onClick={() => setEditPromo(promo)}
                            className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:text-amber-600 hover:border-amber-300 cursor-pointer transition-all"
                          >
                            <i className="ri-pencil-line text-sm" />
                          </button>
                          <button
                            onClick={() => handleDeletePromo(promo.id)}
                            disabled={deletingId === promo.id}
                            className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 cursor-pointer transition-all disabled:opacity-50"
                          >
                            <i className={`${deletingId === promo.id ? 'ri-loader-4-line animate-spin' : 'ri-delete-bin-line'} text-sm`} />
                          </button>
                        </div>
                      </div>

                      {/* Inactive overlay hint */}
                      {!promo.activo && (
                        <div className="bg-gray-50 border-t border-gray-100 px-4 py-2 flex items-center gap-2 text-gray-400 text-xs">
                          <i className="ri-eye-off-line" />
                          Oculta — los clientes no la ven en la web
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 flex items-center justify-center bg-red-50 rounded-xl">
                      <i className="ri-delete-bin-6-line text-red-500 text-lg" />
                    </div>
                    <div>
                      <h3 className="font-black text-gray-900 text-sm">Papelera de promos</h3>
                      <p className="text-gray-400 text-xs">Promos eliminadas recientemente. Puedes restaurarlas o eliminarlas para siempre.</p>
                    </div>
                  </div>

                  {loadingTrash ? (
                    <div className="flex items-center justify-center py-12 text-gray-400">
                      <i className="ri-loader-4-line animate-spin text-xl mr-2" />
                      Cargando papelera...
                    </div>
                  ) : trashedPromos.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
                      <div className="w-14 h-14 flex items-center justify-center bg-gray-100 rounded-full mx-auto mb-3">
                        <i className="ri-check-double-line text-gray-400 text-2xl" />
                      </div>
                      <p className="text-gray-500 text-sm font-semibold">Papelera vacía</p>
                      <p className="text-gray-400 text-xs mt-1">No hay promos eliminadas. ¡Todo en orden!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {trashedPromos.map(promo => {
                        const deletedDate = promo.deleted_at ? new Date(promo.deleted_at) : null;
                        const daysAgo = deletedDate
                          ? Math.floor((Date.now() - deletedDate.getTime()) / 86400000)
                          : null;
                        return (
                          <div key={promo.id} className="bg-red-50/50 rounded-2xl border border-red-100 overflow-hidden">
                            <div className="flex items-center gap-4 p-4">
                              {/* Imagen mini */}
                              <div className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 opacity-60">
                                {promo.imagen_url ? (
                                  <img src={promo.imagen_url} alt={promo.titulo} loading="lazy" decoding="async" className="w-full h-full object-cover object-top" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                                    <i className={`${promo.icon} text-2xl`} />
                                  </div>
                                )}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider">
                                    {DIAS[promo.dia_semana]}
                                  </span>
                                  <span className="text-[10px] font-semibold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">
                                    Eliminada{typeof daysAgo === 'number' ? ` · hace ${daysAgo === 0 ? 'hoy' : `${daysAgo}d`}` : ''}
                                  </span>
                                </div>
                                <p className="font-black text-gray-900 text-sm leading-tight truncate opacity-70">{promo.titulo}</p>
                                <p className="text-gray-500 text-xs truncate opacity-60">{promo.descripcion}</p>
                              </div>

                              {/* Acciones */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  onClick={() => handleRestorePromo(promo.id)}
                                  disabled={deletingId === promo.id}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:text-green-600 hover:border-green-300 hover:bg-green-50 text-xs font-bold cursor-pointer transition-all disabled:opacity-50 whitespace-nowrap"
                                >
                                  <i className={`${deletingId === promo.id ? 'ri-loader-4-line animate-spin' : 'ri-arrow-go-back-line'} text-sm`} />
                                  Restaurar
                                </button>
                                <button
                                  onClick={() => handlePurgePromo(promo.id)}
                                  disabled={deletingId === promo.id}
                                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-red-100 text-red-400 hover:text-red-600 hover:bg-red-100 cursor-pointer transition-all disabled:opacity-50"
                                  title="Eliminar para siempre"
                                >
                                  <i className="ri-close-circle-line text-sm" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── EVENTOS ── */}
          {tab === 'eventos' && (
            <>
              {showTrashEventos ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 flex items-center justify-center bg-red-50 rounded-xl">
                      <i className="ri-delete-bin-6-line text-red-500 text-lg" />
                    </div>
                    <div>
                      <h3 className="font-black text-gray-900 text-sm">Papelera de eventos</h3>
                      <p className="text-gray-400 text-xs">Eventos eliminados. Restáuralos o bórralos para siempre.</p>
                    </div>
                  </div>

                  {loadingTrashEventos ? (
                    <div className="flex items-center justify-center py-12 text-gray-400">
                      <i className="ri-loader-4-line animate-spin text-xl mr-2" />
                      Cargando papelera...
                    </div>
                  ) : trashedEventos.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
                      <div className="w-14 h-14 flex items-center justify-center bg-gray-100 rounded-full mx-auto mb-3">
                        <i className="ri-check-double-line text-gray-400 text-2xl" />
                      </div>
                      <p className="text-gray-500 text-sm font-semibold">Papelera vacía</p>
                      <p className="text-gray-400 text-xs mt-1">No hay eventos eliminados.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {trashedEventos.map(ev => {
                        const deletedDate = ev.deleted_at ? new Date(ev.deleted_at) : null;
                        const daysAgo = deletedDate
                          ? Math.floor((Date.now() - deletedDate.getTime()) / 86400000)
                          : null;
                        const fechaObj = new Date(ev.fecha + 'T12:00:00');
                        return (
                          <div key={ev.id} className="bg-red-50/50 rounded-2xl border border-red-100 overflow-hidden">
                            <div className="flex items-center gap-4 p-4">
                              <div className="w-14 flex-shrink-0 text-center bg-gray-100 rounded-xl py-2.5 border border-gray-200 opacity-60">
                                <p className="text-[10px] font-black text-gray-400 uppercase leading-none">
                                  {fechaObj.toLocaleDateString('es-MX', { weekday: 'short' })}
                                </p>
                                <p className="text-2xl font-black text-gray-400 leading-none my-0.5">
                                  {fechaObj.getDate()}
                                </p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">
                                  {fechaObj.toLocaleDateString('es-MX', { month: 'short' })}
                                </p>
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${ev.tipo_bg} ${ev.tipo_color} opacity-60`}>
                                    {ev.tipo}
                                  </span>
                                  <span className="text-[10px] font-semibold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">
                                    Eliminado{typeof daysAgo === 'number' ? ` · hace ${daysAgo === 0 ? 'hoy' : `${daysAgo}d`}` : ''}
                                  </span>
                                </div>
                                <p className="font-black text-gray-900 text-sm leading-tight opacity-70">{ev.titulo}</p>
                                <p className="text-gray-500 text-xs truncate opacity-60">{ev.descripcion}</p>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  onClick={() => handleRestoreEvento(ev.id)}
                                  disabled={deletingId === ev.id}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:text-green-600 hover:border-green-300 hover:bg-green-50 text-xs font-bold cursor-pointer transition-all disabled:opacity-50 whitespace-nowrap"
                                >
                                  <i className={`${deletingId === ev.id ? 'ri-loader-4-line animate-spin' : 'ri-arrow-go-back-line'} text-sm`} />
                                  Restaurar
                                </button>
                                <button
                                  onClick={() => handlePurgeEvento(ev.id)}
                                  disabled={deletingId === ev.id}
                                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-red-100 text-red-400 hover:text-red-600 hover:bg-red-100 cursor-pointer transition-all disabled:opacity-50"
                                  title="Eliminar para siempre"
                                >
                                  <i className="ri-close-circle-line text-sm" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {!showTrashEventos && (
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          Mostrando {displayedEventos.length} de {eventos.length} evento{eventos.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Toggle Lista / Calendario */}
                        <div className="flex bg-gray-100 rounded-lg p-1 gap-0.5">
                          <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${
                              viewMode === 'list' ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            <i className="ri-list-check mr-1" />
                            Lista
                          </button>
                          <button
                            onClick={() => setViewMode('calendar')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${
                              viewMode === 'calendar' ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            <i className="ri-calendar-2-line mr-1" />
                            Calendario
                          </button>
                        </div>
                        <button
                          onClick={() => setShowPastEventos(!showPastEventos)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all border whitespace-nowrap ${
                            showPastEventos
                              ? 'bg-amber-50 border-amber-200 text-amber-700'
                              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                          }`}
                        >
                          <i className={`${showPastEventos ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                          {showPastEventos ? 'Ocultar pasados' : 'Ver pasados'}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-3">
                    {viewMode === 'calendar' ? (
                      /* ── VISTA CALENDARIO ── */
                      (() => {
                        const grouped = displayedEventos.reduce((acc: Record<string, EventoEspecial[]>, ev) => {
                          if (!acc[ev.fecha]) acc[ev.fecha] = [];
                          acc[ev.fecha].push(ev);
                          return acc;
                        }, {});
                        const fechas = Object.keys(grouped).sort();
                        if (fechas.length === 0) {
                          return (
                            <div className="text-center py-16 text-gray-400">
                              <div className="w-14 h-14 flex items-center justify-center mx-auto mb-3 bg-gray-100 rounded-2xl">
                                <i className="ri-calendar-event-line text-2xl" />
                              </div>
                              <p className="font-semibold text-sm">Sin eventos próximos</p>
                              <p className="text-xs mt-1">Los eventos pasados se ocultan. Activa "Ver pasados" para verlos.</p>
                            </div>
                          );
                        }
                        return fechas.map(fecha => {
                          const dia = grouped[fecha].sort((a, b) => {
                            const getMinutes = (h: string) => {
                              const m = h.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
                              if (!m) return 9999;
                              let hr = parseInt(m[1]);
                              const mn = parseInt(m[2]);
                              const ap = m[3].toUpperCase();
                              if (ap === 'PM' && hr !== 12) hr += 12;
                              if (ap === 'AM' && hr === 12) hr = 0;
                              return hr * 60 + mn;
                            };
                            return getMinutes(a.horario) - getMinutes(b.horario);
                          });
                          const fechaObj = new Date(fecha + 'T12:00:00');
                          const diaSemana = fechaObj.toLocaleDateString('es-MX', { weekday: 'long' });
                          const mes = fechaObj.toLocaleDateString('es-MX', { month: 'long' });
                          const diaNum = fechaObj.getDate();
                          const isToday = fecha === todayStr;
                          return (
                            <div key={fecha} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                              {/* Encabezado del día */}
                              <div className={`px-5 py-3 flex items-center justify-between ${isToday ? 'bg-amber-50 border-b border-amber-100' : 'bg-gray-50 border-b border-gray-100'}`}>
                                <div className="flex items-center gap-3">
                                  <div className={`w-12 h-12 flex flex-col items-center justify-center rounded-xl ${isToday ? 'bg-amber-500 text-white' : 'bg-white border border-gray-200'}`}>
                                    <span className="text-lg font-black leading-none">{diaNum}</span>
                                    <span className="text-[9px] font-bold uppercase leading-none">{fechaObj.toLocaleDateString('es-MX', { month: 'short' })}</span>
                                  </div>
                                  <div>
                                    <p className={`font-black text-sm leading-tight capitalize ${isToday ? 'text-amber-800' : 'text-gray-900'}`}>
                                      {diaSemana} {diaNum} de {mes}
                                    </p>
                                    <p className="text-xs text-gray-400">{dia.length} evento{dia.length !== 1 ? 's' : ''}</p>
                                  </div>
                                </div>
                                {isToday && (
                                  <span className="px-3 py-1 bg-amber-500 text-white text-[10px] font-black rounded-full uppercase tracking-wider">Hoy</span>
                                )}
                              </div>

                              {/* Partidos del día */}
                              <div className="divide-y divide-gray-50">
                                {dia.map(ev => {
                                  const isPast = isEventoTerminado(ev.fecha, ev.horario);
                                  return (
                                    <div key={ev.id} className={`flex items-center gap-4 px-5 py-3.5 transition-all ${isPast ? 'opacity-50' : 'hover:bg-gray-50/50'}`}>
                                      {/* Hora */}
                                      <div className="w-20 flex-shrink-0">
                                        <div className="flex items-center gap-1.5">
                                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isPast ? 'bg-gray-300' : ev.tipo_color.replace('text-', 'bg-')}`} />
                                          <span className={`text-xs font-bold whitespace-nowrap ${isPast ? 'text-gray-400' : 'text-gray-700'}`}>
                                            {ev.horario.replace(/\s*-\s*.*/, '')}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Info */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${ev.tipo_bg} ${ev.tipo_color}`}>
                                            {ev.tipo}
                                          </span>
                                          {ev.sede && (
                                            <span className="text-[10px] font-semibold text-gray-400 flex items-center gap-1">
                                              <i className="ri-map-pin-line" />
                                              {ev.sede}
                                            </span>
                                          )}
                                          {isPast && <span className="text-[10px] text-gray-400 font-semibold">Finalizado</span>}
                                        </div>
                                        <p className="font-black text-gray-900 text-sm leading-tight">{ev.titulo}</p>
                                        {ev.descripcion && (
                                          <p className="text-gray-500 text-xs truncate mt-0.5">{ev.descripcion}</p>
                                        )}
                                      </div>

                                      {/* Acciones rápidas */}
                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <button
                                          onClick={() => handleToggleEvento(ev)}
                                          className={`relative w-9 h-5 rounded-full cursor-pointer transition-all ${ev.activo ? 'bg-amber-500' : 'bg-gray-200'}`}
                                          title={ev.activo ? 'Ocultar' : 'Mostrar'}
                                        >
                                          <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all" style={{ left: ev.activo ? '18px' : '1px' }} />
                                        </button>
                                        <button
                                          onClick={() => setEditEvento(ev)}
                                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-amber-600 hover:border-amber-300 cursor-pointer transition-all"
                                        >
                                          <i className="ri-pencil-line text-xs" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        });
                      })()
                    ) : (
                      /* ── VISTA LISTA ── */
                      displayedEventos.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <div className="w-14 h-14 flex items-center justify-center mx-auto mb-3 bg-gray-100 rounded-2xl">
                      <i className="ri-calendar-event-line text-2xl" />
                    </div>
                    <p className="font-semibold text-sm">
                      {showPastEventos ? 'Sin eventos programados' : 'Sin eventos próximos'}
                    </p>
                    <p className="text-xs mt-1">
                      {showPastEventos ? 'Agrega el primer evento con el botón de arriba' : 'Los eventos pasados se ocultan. Activa "Ver pasados" para verlos.'}
                    </p>
                  </div>
                ) : (
                  displayedEventos.map(ev => {
                    const fechaObj = new Date(ev.fecha + 'T12:00:00');
                    const isPast = isEventoTerminado(ev.fecha, ev.horario);
                    return (
                      <div key={ev.id} className={`bg-white rounded-2xl border overflow-hidden transition-all ${isPast ? 'border-gray-100 opacity-60' : 'border-gray-100'}`}>
                        <div className="flex items-center gap-4 p-4">
                          {/* Fecha badge */}
                          <div className="w-14 flex-shrink-0 text-center bg-gray-50 rounded-xl py-2.5 border border-gray-100">
                            <p className="text-[10px] font-black text-gray-400 uppercase leading-none">
                              {fechaObj.toLocaleDateString('es-MX', { weekday: 'short' })}
                            </p>
                            <p className="text-2xl font-black text-gray-900 leading-none my-0.5">
                              {fechaObj.getDate()}
                            </p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">
                              {fechaObj.toLocaleDateString('es-MX', { month: 'short' })}
                            </p>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${ev.tipo_bg} ${ev.tipo_color}`}>
                                {ev.tipo}
                              </span>
                              {isPast && <span className="text-[10px] text-gray-400 font-semibold">Pasado</span>}
                            </div>
                            <p className="font-black text-gray-900 text-sm leading-tight">{ev.titulo}</p>
                            <p className="text-gray-500 text-xs truncate">{ev.descripcion}</p>
                            <div className="flex items-center gap-1 mt-1 text-gray-400 text-xs">
                              <i className="ri-time-line" />
                              {ev.horario}
                              {ev.sede && (
                                <>
                                  <span className="text-gray-300 mx-0.5">·</span>
                                  <i className="ri-map-pin-line text-[11px]" />
                                  <span className="text-gray-500">{ev.sede}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Acciones */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleToggleEvento(ev)}
                              className={`relative w-10 h-5 rounded-full cursor-pointer transition-all ${ev.activo ? 'bg-amber-500' : 'bg-gray-200'}`}
                              title={ev.activo ? 'Ocultar' : 'Mostrar'}
                            >
                              <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all" style={{ left: ev.activo ? '21px' : '2px' }} />
                            </button>
                            <button
                              onClick={() => setEditEvento(ev)}
                              className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:text-amber-600 hover:border-amber-300 cursor-pointer transition-all"
                            >
                              <i className="ri-pencil-line text-sm" />
                            </button>
                            <button
                              onClick={() => handleDeleteEvento(ev.id)}
                              disabled={deletingId === ev.id}
                              className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 cursor-pointer transition-all disabled:opacity-50"
                            >
                              <i className={`${deletingId === ev.id ? 'ri-loader-4-line animate-spin' : 'ri-delete-bin-line'} text-sm`} />
                            </button>
                          </div>
                        </div>

                        {!ev.activo && (
                          <div className="bg-gray-50 border-t border-gray-100 px-4 py-2 flex items-center gap-2 text-gray-400 text-xs">
                            <i className="ri-eye-off-line" />
                            Oculto — no aparece en la web
                          </div>
                        )}
                      </div>
                    );
                  })
                ))}

                {/* Summary */}
                {displayedEventos.length > 0 && (
                  <div className="flex items-center gap-4 pt-2 px-1">
                    <span className="text-xs text-gray-400">{displayedEventos.filter(e => e.activo).length} visibles</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{displayedEventos.filter(e => !e.activo).length} ocultos</span>
                    {!showPastEventos && eventos.length > displayedEventos.length && (
                      <>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-400">{eventos.length - displayedEventos.length} pasados ocultos</span>
                      </>
                    )}
                    {showPastEventos && (
                      <>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-400">{eventos.filter(e => isEventoTerminado(e.fecha, e.horario)).length} pasados</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </>
  )}
    </div>
);
}