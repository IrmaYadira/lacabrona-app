import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { FlashOffer } from "@/types/flash";

interface ProductItem {
  id: number;
  name: string;
  category_id: number;
  price: number;
  status: string;
}

const EMPTY_FORM = {
  title: '',
  subtitle: '',
  description: '',
  discount_pct: 10,
  category_key: '',
  product_ids: [] as number[],
  start_time: '',
  end_time: '',
  is_active: true,
};

const CATEGORIES = [
  { key: '', label: 'Todas las categorías' },
  { key: 'micheladas', label: 'Micheladas' },
  { key: 'medio-cervezas', label: 'Cervezas de medio' },
  { key: 'caguamas', label: 'Caguamas' },
  { key: 'cubetas', label: 'Cubetas' },
  { key: 'barril', label: 'Barril' },
  { key: 'preparados', label: 'Preparados' },
  { key: 'alitas', label: 'Alitas' },
  { key: 'boneless', label: 'Boneless' },
  { key: 'hamburguesas', label: 'Hamburguesas' },
  { key: 'hotdogs', label: 'Hot Dogs' },
  { key: 'combos', label: 'Combos' },
  { key: 'sodas', label: 'Sodas' },
  { key: 'botanas', label: 'Botanas' },
];

function formatLocalInput(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const tzOffset = d.getTimezoneOffset() * 60000;
  const local = new Date(d.getTime() - tzOffset);
  return local.toISOString().slice(0, 16);
}

function toUtcIso(localValue: string): string {
  if (!localValue) return '';
  const d = new Date(localValue);
  if (isNaN(d.getTime())) return '';
  return d.toISOString();
}

function timeRemaining(end: string): string {
  const diff = new Date(end).getTime() - Date.now();
  if (diff <= 0) return 'Expirada';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function statusBadge(offer: FlashOffer): { text: string; color: string } {
  if (!offer.is_active) return { text: 'Inactiva', color: 'bg-gray-200 text-gray-600' };
  const now = Date.now();
  const start = new Date(offer.start_time).getTime();
  const end = new Date(offer.end_time).getTime();
  if (now < start) return { text: 'Pendiente', color: 'bg-blue-100 text-blue-700' };
  if (now > end) return { text: 'Expirada', color: 'bg-red-100 text-red-700' };
  return { text: 'Activa', color: 'bg-green-100 text-green-700' };
}

export default function FlashOffersManager() {
  const [offers, setOffers] = useState<FlashOffer[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [toast, setToast] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('flash_offers')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setOffers((data as FlashOffer[]) ?? []);
    }
    setLoading(false);
  }, []);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from('product_items')
      .select('id, name, category_id, price, status')
      .eq('status', 'active')
      .order('name');
    if (!error && data) {
      setProducts((data as ProductItem[]) ?? []);
    }
  }, []);

  useEffect(() => {
    fetchOffers();
    fetchProducts();
    const channel = supabase
      .channel('flash-offers-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flash_offers' }, fetchOffers)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchOffers, fetchProducts]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.start_time || !form.end_time) {
      showToast('Completa título, inicio y fin');
      return;
    }
    // Validar que al menos tenga categoría o productos
    if (!form.category_key && form.product_ids.length === 0) {
      showToast('Selecciona al menos una categoría o un producto');
      return;
    }

    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      description: form.description.trim() || null,
      discount_pct: form.discount_pct,
      category_key: form.category_key || null,
      product_ids: form.product_ids.length > 0 ? form.product_ids : null,
      start_time: toUtcIso(form.start_time),
      end_time: toUtcIso(form.end_time),
      is_active: form.is_active,
    };

    if (editingId) {
      const { error } = await supabase.from('flash_offers').update(payload).eq('id', editingId);
      if (error) {
        showToast('Error al actualizar');
        return;
      }
      showToast('Oferta actualizada');
    } else {
      const { error } = await supabase.from('flash_offers').insert(payload);
      if (error) {
        showToast('Error al crear');
        return;
      }
      showToast('Oferta creada');
    }
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setProductSearch('');
    fetchOffers();
  };

  const handleToggle = async (id: number, current: boolean) => {
    const { error } = await supabase.from('flash_offers').update({ is_active: !current }).eq('id', id);
    if (error) {
      showToast('Error al cambiar estado');
      return;
    }
    showToast(current ? 'Oferta desactivada' : 'Oferta activada');
    fetchOffers();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta oferta permanentemente?')) return;
    const { error } = await supabase.from('flash_offers').delete().eq('id', id);
    if (error) {
      showToast('Error al eliminar');
      return;
    }
    showToast('Oferta eliminada');
    fetchOffers();
  };

  const toggleProduct = (productId: number) => {
    setForm(f => ({
      ...f,
      product_ids: f.product_ids.includes(productId)
        ? f.product_ids.filter(pid => pid !== productId)
        : [...f.product_ids, productId],
    }));
  };

  const openEdit = (offer: FlashOffer) => {
    setEditingId(offer.id);
    setForm({
      title: offer.title,
      subtitle: offer.subtitle,
      description: offer.description,
      discount_pct: offer.discount_pct,
      category_key: offer.category_key || '',
      product_ids: offer.product_ids ?? [],
      start_time: formatLocalInput(offer.start_time),
      end_time: formatLocalInput(offer.end_time),
      is_active: offer.is_active,
    });
    setProductSearch('');
    setShowForm(true);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setProductSearch('');
    setShowForm(true);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const selectedProducts = products.filter(p => form.product_ids.includes(p.id));

  const isCategoryMode = form.category_key !== '';

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-black text-gray-900">Ofertas Flash</h2>
          <p className="text-sm text-gray-500 mt-1">Crea ofertas con tiempo limitado que aparecen en el menú de los clientes.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap shadow-sm"
        >
          <i className="ri-add-line" />
          Nueva Oferta
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: offers.length, color: 'bg-gray-100 text-gray-800' },
          { label: 'Activas', value: offers.filter(o => o.is_active && new Date(o.end_time).getTime() > Date.now() && new Date(o.start_time).getTime() <= Date.now()).length, color: 'bg-green-100 text-green-700' },
          { label: 'Pendientes', value: offers.filter(o => o.is_active && new Date(o.start_time).getTime() > Date.now()).length, color: 'bg-blue-100 text-blue-700' },
          { label: 'Expiradas', value: offers.filter(o => new Date(o.end_time).getTime() <= Date.now()).length, color: 'bg-red-100 text-red-700' },
        ].map(s => (
          <div key={s.label} className={`${s.color} rounded-xl p-4 text-center`}>
            <div className="text-2xl font-black">{s.value}</div>
            <div className="text-xs font-semibold mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 md:p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-gray-900">
              {editingId ? 'Editar Oferta' : 'Nueva Oferta Flash'}
            </h3>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); setProductSearch(''); }}
              className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors w-8 h-8 flex items-center justify-center"
            >
              <i className="ri-close-line text-lg" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Título *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ej: 2x1 en Micheladas"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Subtítulo</label>
              <input
                type="text"
                value={form.subtitle}
                onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))}
                placeholder="Ej: Solo por hoy"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-700 mb-1.5">Descripción</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe los detalles de la oferta..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Descuento (%)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={form.discount_pct}
                onChange={e => setForm(f => ({ ...f, discount_pct: Math.min(100, Math.max(0, Number(e.target.value))) }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Categoría</label>
              <select
                value={form.category_key}
                onChange={e => {
                  const val = e.target.value;
                  setForm(f => ({
                    ...f,
                    category_key: val,
                    // Si elige categoría, limpia productos
                    product_ids: val ? [] : f.product_ids,
                  }));
                }}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 bg-white"
              >
                {CATEGORIES.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${form.is_active ? 'bg-amber-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="text-sm font-semibold text-gray-700">{form.is_active ? 'Activa' : 'Inactiva'}</span>
            </div>
          </div>

          {/* Selector de productos específicos */}
          <div className={`mb-4 ${isCategoryMode ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-gray-700">Productos específicos</label>
              {isCategoryMode && (
                <span className="text-[10px] text-gray-400 font-medium">Desactivado — estás usando categoría</span>
              )}
            </div>

            {/* Productos seleccionados */}
            {selectedProducts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedProducts.map(p => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-semibold px-2 py-1 rounded-lg border border-amber-200"
                  >
                    {p.name}
                    <button
                      onClick={() => toggleProduct(p.id)}
                      className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-amber-200 cursor-pointer transition-colors"
                    >
                      <i className="ri-close-line text-[10px]" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Buscador + lista */}
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
              <input
                type="text"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Buscar producto por nombre..."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                disabled={isCategoryMode}
              />
            </div>

            {productSearch.trim() && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                {filteredProducts.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-400">Sin resultados</p>
                ) : (
                  filteredProducts.slice(0, 8).map(p => {
                    const isSelected = form.product_ids.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => !isCategoryMode && toggleProduct(p.id)}
                        className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition-colors cursor-pointer ${
                          isSelected ? 'bg-amber-50 text-amber-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <i className={isSelected ? 'ri-checkbox-circle-fill text-amber-500' : 'ri-circle-line text-gray-300'} />
                        <span className="flex-1 min-w-0 truncate">{p.name}</span>
                        <span className="text-gray-400 text-xs">MXN${p.price}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {form.product_ids.length > 0 && (
              <p className="text-xs text-gray-500 mt-1.5">{form.product_ids.length} producto(s) seleccionado(s)</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Inicio *</label>
              <input
                type="datetime-local"
                value={form.start_time}
                onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Fin *</label>
              <input
                type="datetime-local"
                value={form.end_time}
                onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); setProductSearch(''); }}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 cursor-pointer transition-colors whitespace-nowrap shadow-sm"
            >
              {editingId ? 'Guardar Cambios' : 'Crear Oferta'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Cargando ofertas...</div>
      ) : offers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
          <div className="w-14 h-14 flex items-center justify-center bg-gray-100 rounded-full mx-auto mb-3">
            <i className="ri-flashlight-line text-gray-400 text-2xl" />
          </div>
          <p className="text-gray-500 text-sm font-medium">Sin ofertas flash aún</p>
          <p className="text-gray-400 text-xs mt-1">Crea tu primera oferta para que aparezca en el menú de los clientes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map(offer => {
            const badge = statusBadge(offer);
            const remaining = timeRemaining(offer.end_time);
            const offerProductNames = offer.product_ids
              ?.map(pid => products.find(p => p.id === pid)?.name)
              .filter(Boolean) ?? [];
            return (
              <div
                key={offer.id}
                className={`bg-white rounded-xl border p-4 md:p-5 transition-all ${offer.is_active && badge.text === 'Activa' ? 'border-amber-300 shadow-sm' : 'border-gray-200'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge.color}`}>
                        {badge.text}
                      </span>
                      {badge.text === 'Activa' && (
                        <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          <i className="ri-time-line mr-1" />
                          {remaining}
                        </span>
                      )}
                      {offer.discount_pct > 0 && (
                        <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                          -{offer.discount_pct}%
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-gray-900 truncate">{offer.title}</h3>
                    {offer.subtitle && <p className="text-sm text-gray-500">{offer.subtitle}</p>}
                    {offer.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{offer.description}</p>}

                    {/* Aplica a */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {offer.category_key && (
                        <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-1 rounded-md border border-gray-200">
                          <i className="ri-folder-line mr-1" />
                          {CATEGORIES.find(c => c.key === offer.category_key)?.label || offer.category_key}
                        </span>
                      )}
                      {offerProductNames.map((name, i) => (
                        <span
                          key={i}
                          className="bg-amber-50 text-amber-700 text-xs font-semibold px-2 py-1 rounded-md border border-amber-200"
                        >
                          <i className="ri-product-hunt-line mr-1" />
                          {name}
                        </span>
                      ))}
                      {!offer.category_key && offerProductNames.length === 0 && (
                        <span className="bg-red-50 text-red-600 text-xs font-semibold px-2 py-1 rounded-md border border-red-200">
                          Sin productos ni categoría
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span><i className="ri-calendar-line mr-1" />{new Date(offer.start_time).toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      <span><i className="ri-arrow-right-line" /></span>
                      <span>{new Date(offer.end_time).toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(offer.id, offer.is_active)}
                      title={offer.is_active ? 'Desactivar' : 'Activar'}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${offer.is_active ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      <i className={offer.is_active ? 'ri-eye-line' : 'ri-eye-off-line'} />
                    </button>
                    <button
                      onClick={() => openEdit(offer)}
                      title="Editar"
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer transition-colors"
                    >
                      <i className="ri-pencil-line" />
                    </button>
                    <button
                      onClick={() => handleDelete(offer.id)}
                      title="Eliminar"
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-gray-900 text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-lg animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  );
}