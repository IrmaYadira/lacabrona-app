import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Reward {
  id: number;
  tier_order: number;
  points_required: number;
  pesos_equivalent: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  items: string[];
  emoji: string | null;
  color: string | null;
  bg_color: string | null;
  border_color: string | null;
  text_color: string | null;
  banner_image: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const COLOR_OPTIONS: { label: string; value: string; bg: string; border: string; text: string; dot: string }[] = [
  { label: 'Ámbar', value: 'amber', bg: 'bg-amber-500/15', border: 'border-amber-500', text: 'text-amber-400', dot: 'bg-amber-500' },
  { label: 'Naranja', value: 'orange', bg: 'bg-orange-500/15', border: 'border-orange-500', text: 'text-orange-400', dot: 'bg-orange-500' },
  { label: 'Rojo', value: 'red', bg: 'bg-red-500/15', border: 'border-red-500', text: 'text-red-400', dot: 'bg-red-500' },
  { label: 'Rosa', value: 'pink', bg: 'bg-pink-500/15', border: 'border-pink-500', text: 'text-pink-400', dot: 'bg-pink-500' },
  { label: 'Verde', value: 'green', bg: 'bg-green-500/15', border: 'border-green-500', text: 'text-green-400', dot: 'bg-green-500' },
  { label: 'Esmeralda', value: 'emerald', bg: 'bg-emerald-500/15', border: 'border-emerald-500', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  { label: 'Lima', value: 'lime', bg: 'bg-lime-500/15', border: 'border-lime-500', text: 'text-lime-400', dot: 'bg-lime-500' },
  { label: 'Amarillo', value: 'yellow', bg: 'bg-yellow-500/15', border: 'border-yellow-500', text: 'text-yellow-400', dot: 'bg-yellow-500' },
  { label: 'Teal', value: 'teal', bg: 'bg-teal-500/15', border: 'border-teal-500', text: 'text-teal-400', dot: 'bg-teal-500' },
  { label: 'Cyan', value: 'cyan', bg: 'bg-cyan-500/15', border: 'border-cyan-500', text: 'text-cyan-400', dot: 'bg-cyan-500' },
];

function getColorStyles(colorValue: string | null) {
  const found = COLOR_OPTIONS.find(c => c.value === colorValue);
  return found ?? COLOR_OPTIONS[0];
}

interface FormData {
  title: string;
  subtitle: string;
  description: string;
  points_required: string;
  pesos_equivalent: string;
  items: string[];
  emoji: string;
  color: string;
  tier_order: string;
  is_active: boolean;
}

const EMPTY_FORM: FormData = {
  title: '',
  subtitle: '',
  description: '',
  points_required: '',
  pesos_equivalent: '',
  items: [''],
  emoji: '🎁',
  color: 'amber',
  tier_order: '',
  is_active: true,
};

export default function LoyaltyRewardsManager() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const fetchRewards = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .order('tier_order', { ascending: true });
    if (err) {
      setError('Error al cargar recompensas');
    } else {
      setRewards((data as Reward[]) ?? []);
      setError('');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRewards(); }, [fetchRewards]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      tier_order: String(rewards.length + 1),
    });
    setShowForm(true);
    setError('');
  };

  const openEdit = (reward: Reward) => {
    setEditingId(reward.id);
    setForm({
      title: reward.title,
      subtitle: reward.subtitle ?? '',
      description: reward.description ?? '',
      points_required: String(reward.points_required),
      pesos_equivalent: String(reward.pesos_equivalent),
      items: reward.items.length > 0 ? [...reward.items] : [''],
      emoji: reward.emoji ?? '🎁',
      color: reward.color ?? 'amber',
      tier_order: String(reward.tier_order),
      is_active: reward.is_active,
    });
    setShowForm(true);
    setError('');
  };

  const handleToggleActive = async (reward: Reward) => {
    const { error: err } = await supabase
      .from('loyalty_rewards')
      .update({ is_active: !reward.is_active, updated_at: new Date().toISOString() })
      .eq('id', reward.id);
    if (err) {
      setError('Error al cambiar estado');
      return;
    }
    setRewards(prev =>
      prev.map(r => r.id === reward.id ? { ...r, is_active: !r.is_active } : r)
    );
  };

  const handleDelete = async (id: number) => {
    const { error: err } = await supabase.from('loyalty_rewards').delete().eq('id', id);
    if (err) {
      setError('Error al eliminar');
      return;
    }
    setRewards(prev => prev.filter(r => r.id !== id));
    setDeleteConfirm(null);
  };

  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, ''] }));
  const removeItem = (idx: number) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };
  const updateItem = (idx: number, val: string) => {
    setForm(prev => {
      const next = [...prev.items];
      next[idx] = val;
      return { ...prev, items: next };
    });
  };

  const validate = (): string | null => {
    if (!form.title.trim()) return 'El título es obligatorio';
    const pts = parseInt(form.points_required, 10);
    if (isNaN(pts) || pts <= 0) return 'Puntos requeridos debe ser mayor a 0';
    const pesos = parseFloat(form.pesos_equivalent);
    if (isNaN(pesos) || pesos < 0) return 'Pesos equivalente inválido';
    const order = parseInt(form.tier_order, 10);
    if (isNaN(order) || order < 0) return 'Orden inválido';
    const validItems = form.items.filter(i => i.trim() !== '');
    if (validItems.length === 0) return 'Agrega al menos un producto incluido';
    return null;
  };

  const handleSubmit = async () => {
    const errMsg = validate();
    if (errMsg) { setError(errMsg); return; }

    setSaving(true);
    setError('');

    const colorOpt = getColorStyles(form.color);
    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      description: form.description.trim() || null,
      points_required: parseInt(form.points_required, 10),
      pesos_equivalent: parseFloat(form.pesos_equivalent),
      items: form.items.filter(i => i.trim() !== ''),
      emoji: form.emoji.trim() || '🎁',
      color: form.color,
      bg_color: colorOpt.bg,
      border_color: colorOpt.border,
      text_color: colorOpt.text,
      tier_order: parseInt(form.tier_order, 10),
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error: err } = await supabase
        .from('loyalty_rewards')
        .update(payload)
        .eq('id', editingId);
      if (err) {
        setError('Error al guardar cambios');
        setSaving(false);
        return;
      }
      setRewards(prev =>
        prev.map(r => r.id === editingId ? { ...r, ...payload, id: r.id } as Reward : r)
      );
    } else {
      const { data, error: err } = await supabase
        .from('loyalty_rewards')
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select()
        .single();
      if (err || !data) {
        setError('Error al crear recompensa');
        setSaving(false);
        return;
      }
      setRewards(prev => [...prev, data as Reward].sort((a, b) => a.tier_order - b.tier_order));
    }

    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const activeCount = rewards.filter(r => r.is_active).length;
  const inactiveCount = rewards.filter(r => !r.is_active).length;

  return (
    <div className="space-y-5">

      {/* Header + botón nuevo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-white font-black text-lg">Recompensas de Lealtad</h2>
          <p className="text-gray-500 text-sm">
            {activeCount} activas · {inactiveCount} inactivas · {rewards.length} total
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-black px-4 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
        >
          <i className="ri-add-line text-lg" />
          Nueva recompensa
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-xl px-4 py-3 flex items-center gap-2 text-red-400 text-sm">
          <i className="ri-error-warning-line text-lg" />
          {error}
        </div>
      )}

      {/* Lista de recompensas */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rewards.length === 0 ? (
        <div className="text-center py-14 bg-gray-900 rounded-xl">
          <i className="ri-gift-line text-4xl text-gray-700 mb-3 block" />
          <p className="text-gray-500 text-sm">No hay recompensas configuradas</p>
          <button
            onClick={openCreate}
            className="mt-3 text-amber-400 text-sm font-bold hover:text-amber-300 cursor-pointer transition-colors"
          >
            Crear la primera
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {rewards.map(reward => {
            const color = getColorStyles(reward.color);
            return (
              <div
                key={reward.id}
                className={`bg-gray-900 rounded-xl border ${reward.is_active ? 'border-gray-700' : 'border-gray-800 opacity-60'} overflow-hidden transition-all`}
              >
                <div className="flex items-start gap-4 p-4">
                  {/* Emoji + color */}
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${color.bg} border ${color.border}`}>
                    <span className="text-3xl">{reward.emoji}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-white font-black text-base">{reward.title}</h3>
                      {!reward.is_active && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-800 text-gray-500 border border-gray-700">
                          Inactiva
                        </span>
                      )}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color.bg} ${color.text} border ${color.border}`}>
                        {reward.points_required} pts
                      </span>
                    </div>
                    {reward.subtitle && (
                      <p className="text-gray-400 text-sm mt-0.5">{reward.subtitle}</p>
                    )}
                    {reward.description && (
                      <p className="text-gray-500 text-xs mt-1">{reward.description}</p>
                    )}
                    <div className="mt-2">
                      <p className="text-gray-500 text-xs mb-1">{reward.items.length > 1 ? 'Elige 1 opción:' : 'Incluye:'}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {reward.items.map((item, i) => (
                          <span
                            key={i}
                            className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-lg border border-gray-700"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                      <span>Orden: {reward.tier_order}</span>
                      <span>·</span>
                      <span>MXN${reward.pesos_equivalent} pesos eq.</span>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleToggleActive(reward)}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${
                        reward.is_active
                          ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                          : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                      }`}
                      title={reward.is_active ? 'Desactivar' : 'Activar'}
                    >
                      <i className={reward.is_active ? 'ri-eye-line' : 'ri-eye-off-line'} />
                    </button>
                    <button
                      onClick={() => openEdit(reward)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 cursor-pointer transition-colors"
                      title="Editar"
                    >
                      <i className="ri-pencil-line" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(reward.id)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-800 text-red-400 hover:bg-red-900/30 cursor-pointer transition-colors"
                      title="Eliminar"
                    >
                      <i className="ri-delete-bin-line" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal formulario */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !saving && setShowForm(false)} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="bg-gradient-to-r from-amber-700 to-amber-500 px-5 pt-5 pb-4 flex items-center gap-3 sticky top-0 z-10">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">{form.emoji}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-amber-100 text-xs font-semibold uppercase tracking-wide">
                  {editingId ? 'Editar recompensa' : 'Nueva recompensa'}
                </p>
                <h3 className="text-white font-black text-lg leading-tight truncate">
                  {form.title || 'Sin título'}
                </h3>
              </div>
              <button
                onClick={() => !saving && setShowForm(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 cursor-pointer transition-colors flex-shrink-0"
              >
                <i className="ri-close-line text-white text-sm" />
              </button>
            </div>

            <div className="p-5 space-y-4">

              {/* Activo */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setForm(prev => ({ ...prev, is_active: !prev.is_active }))}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${form.is_active ? 'bg-amber-500' : 'bg-gray-700'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm text-gray-300 font-semibold">{form.is_active ? 'Activa' : 'Inactiva'}</span>
              </label>

              {/* Título */}
              <div>
                <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5 block">Título *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ej: Premio Nivel 1"
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 placeholder:text-gray-600"
                />
              </div>

              {/* Subtítulo */}
              <div>
                <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5 block">Subtítulo</label>
                <input
                  type="text"
                  value={form.subtitle}
                  onChange={e => setForm(prev => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="Ej: ¡Primera recompensa!"
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 placeholder:text-gray-600"
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5 block">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe qué incluye la recompensa..."
                  rows={2}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 placeholder:text-gray-600 resize-none"
                />
              </div>

              {/* Puntos + Pesos + Orden */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5 block">Puntos *</label>
                  <input
                    type="number"
                    min="1"
                    value={form.points_required}
                    onChange={e => setForm(prev => ({ ...prev, points_required: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5 block">Pesos eq.</label>
                  <input
                    type="number"
                    min="0"
                    value={form.pesos_equivalent}
                    onChange={e => setForm(prev => ({ ...prev, pesos_equivalent: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5 block">Orden</label>
                  <input
                    type="number"
                    min="0"
                    value={form.tier_order}
                    onChange={e => setForm(prev => ({ ...prev, tier_order: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              {/* Emoji */}
              <div>
                <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5 block">Emoji</label>
                <input
                  type="text"
                  value={form.emoji}
                  onChange={e => setForm(prev => ({ ...prev, emoji: e.target.value }))}
                  className="w-24 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-center text-xl focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Color */}
              <div>
                <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5 block">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setForm(prev => ({ ...prev, color: opt.value }))}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border-2 cursor-pointer transition-all whitespace-nowrap ${
                        form.color === opt.value
                          ? `${opt.border} ${opt.bg} ${opt.text}`
                          : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${opt.dot}`} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items incluidos */}
              <div>
                <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5 block">Productos incluidos *</label>
                <div className="space-y-2">
                  {form.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-gray-600 text-xs font-bold w-5">{idx + 1}.</span>
                      <input
                        type="text"
                        value={item}
                        onChange={e => updateItem(idx, e.target.value)}
                        placeholder="Ej: 1 Cerveza de medio"
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 placeholder:text-gray-600"
                      />
                      {form.items.length > 1 && (
                        <button
                          onClick={() => removeItem(idx)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 text-red-400 hover:bg-red-900/20 cursor-pointer transition-colors flex-shrink-0"
                        >
                          <i className="ri-close-line" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={addItem}
                  className="mt-2 flex items-center gap-1.5 text-amber-400 text-xs font-bold hover:text-amber-300 cursor-pointer transition-colors"
                >
                  <i className="ri-add-circle-line" />
                  Agregar producto
                </button>
              </div>

              {error && (
                <div className="bg-red-900/20 border border-red-700/50 rounded-xl px-4 py-3 flex items-center gap-2 text-red-400 text-sm">
                  <i className="ri-error-warning-line text-lg" />
                  {error}
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                  className="flex-1 py-3 border border-gray-700 rounded-xl text-gray-400 text-sm font-medium cursor-pointer hover:bg-gray-800 transition-colors whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-xl text-sm font-black cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <><i className="ri-loader-4-line animate-spin" />Guardando...</>
                  ) : (
                    <><i className="ri-check-double-line" />{editingId ? 'Guardar cambios' : 'Crear recompensa'}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar eliminar */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-5 text-center space-y-4">
            <div className="w-14 h-14 bg-red-500/15 border-2 border-red-500 rounded-full flex items-center justify-center mx-auto">
              <i className="ri-delete-bin-line text-red-400 text-2xl" />
            </div>
            <div>
              <h4 className="text-white font-black text-lg">¿Eliminar recompensa?</h4>
              <p className="text-gray-400 text-sm mt-1">
                Esta acción no se puede deshacer. Los canjes ya realizados no se verán afectados.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 border border-gray-700 rounded-xl text-gray-400 text-sm font-medium cursor-pointer hover:bg-gray-800 transition-colors whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-black cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className="ri-delete-bin-line mr-1" />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}