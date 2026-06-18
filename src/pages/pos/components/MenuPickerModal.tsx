import { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  wingsMenu, bonelessMenu, beerMenu, halfBeersMenu, pacificoBeersMenu,
  ampolletasMenu, nonAlcoholicBeersMenu, micheladaMenu, micheladaConCamaronMenu,
  sidesMenu, hotDogsMenu, burgersMenu, comboMenu, sodasMenu,
  cannedAlcoholicMenu, shotShowsMenu, vasosPreparadosMenu, azulitosMenu, preparadosMenu,
  barrilMenu, cigarettesMenu,
} from '@/mocks/menu';

interface MenuItem {
  id: string | number;
  name: string;
  price: number;
}

export interface CartEntry {
  menuItem: MenuItem;
  quantity: number;
  note: string;
}

interface MenuPickerModalProps {
  onConfirm: (entries: CartEntry[]) => void;
  onClose: () => void;
  addToFolio?: number;
  nextFolioNumber?: number;
}

type Category = {
  label: string;
  icon: string;
  items: MenuItem[];
};

// IDs deben coincidir EXACTAMENTE con los de PausarProductosView
function buildCategories(): Category[] {
  const wingItems: MenuItem[] = [
    { id: 'wing-media', name: 'Alitas Media Orden (5 pzas)', price: wingsMenu.prices['Media Orden (5 pzas)'] },
    { id: 'wing-completa', name: 'Alitas Orden Completa (10 pzas)', price: wingsMenu.prices['Orden Completa (10 pzas)'] },
    { id: 'boneless-media', name: 'Boneless Media Orden (5 pzas)', price: bonelessMenu.prices['Media Orden (5 pzas)'] },
    { id: 'boneless-completa', name: 'Boneless Orden Completa (10 pzas)', price: bonelessMenu.prices['Orden Completa (10 pzas)'] },
  ];

  return [
    { label: 'Alitas & Boneless', icon: 'ri-fire-line', items: wingItems },
    { label: 'Cervezas Mega', icon: 'ri-goblet-line', items: beerMenu.map(i => ({ id: String(i.id), name: i.name, price: i.price })) },
    {
      label: 'Cervezas Medio', icon: 'ri-goblet-line', items: [
        { id: '7999', name: 'CUBETA 10 Cervezas Corona de Medio', price: 350 },
        ...halfBeersMenu.map(i => ({ id: `half-${i.id}`, name: i.name, price: i.price })),
      ]
    },
    { label: 'Pacífico', icon: 'ri-goblet-line', items: pacificoBeersMenu.map(i => ({ id: `pac-${i.id}`, name: i.name, price: i.price })) },
    { label: 'Ampolletas', icon: 'ri-goblet-line', items: ampolletasMenu.map(i => ({ id: `amp-${i.id}`, name: i.name, price: i.price })) },
    { label: 'Sin Alcohol', icon: 'ri-leaf-line', items: nonAlcoholicBeersMenu.map(i => ({ id: `na-${i.id}`, name: i.name, price: i.price })) },
    {
      label: 'Micheladas', icon: 'ri-cup-line', items: [
        { id: String(micheladaMenu.id), name: micheladaMenu.name, price: micheladaMenu.price },
        { id: String(micheladaConCamaronMenu.id), name: micheladaConCamaronMenu.name, price: micheladaConCamaronMenu.price },
      ]
    },
    { label: 'Shots', icon: 'ri-flask-line', items: shotShowsMenu.map(i => ({ id: `shot-${i.id}`, name: i.name, price: i.price })) },
    {
      label: 'Preparados', icon: 'ri-cup-fill', items: preparadosMenu.flatMap(i => [
        { id: `prep-${i.id}-sencillo`, name: `${i.name} (Sencillo)`, price: i.basePrice },
        { id: `prep-${i.id}-doble`, name: `${i.name} (Doble)`, price: i.doublePrice },
      ])
    },
    { label: 'Azulitos', icon: 'ri-cup-line', items: azulitosMenu.map(i => ({ id: `azul-${i.id}`, name: i.name, price: i.price })) },
    { label: 'Vasos Preparados', icon: 'ri-cup-line', items: vasosPreparadosMenu.map(i => ({ id: `vaso-${i.id}`, name: i.name, price: i.price })) },
    { label: 'Latas Alcohólicas', icon: 'ri-beer-line', items: cannedAlcoholicMenu.map(i => ({ id: `can-${i.id}`, name: i.name, price: i.price })) },
    { label: 'Barril', icon: 'ri-goblet-fill', items: barrilMenu.map(i => ({ id: `barril-${i.id}`, name: i.name, price: i.price })) },
    { label: 'Refrescos & Bebidas', icon: 'ri-cup-line', items: sodasMenu.map(i => ({ id: `soda-${i.id}`, name: i.name, price: i.price })) },
    { label: 'Hamburguesas', icon: 'ri-restaurant-line', items: burgersMenu.map(i => ({ id: `burg-${i.id}`, name: i.name, price: i.price })) },
    { label: 'Hot Dogs', icon: 'ri-restaurant-line', items: hotDogsMenu.map(i => ({ id: `hdog-${i.id}`, name: i.name, price: i.price })) },
    { label: 'Botanas & Lados', icon: 'ri-restaurant-line', items: sidesMenu.map(i => ({ id: `side-${i.id}`, name: i.name, price: i.price })) },
    { label: 'Combos', icon: 'ri-gift-line', items: comboMenu.map(i => ({ id: `combo-${i.id}`, name: i.name, price: i.price })) },
    { label: 'Cigarros', icon: 'ri-haze-line', items: cigarettesMenu.map(i => ({ id: `cig-${i.id}`, name: i.name, price: i.price })) },
  ];
}

const ALL_CATEGORIES = buildCategories();

/** Hook que lee productos pausados directamente de Supabase */
function usePausedFromSupabase(): Set<string> {
  const [paused, setPaused] = useState<Set<string>>(new Set());

  const fetchPaused = useCallback(async () => {
    const { data } = await supabase.from('paused_products').select('id');
    if (data) {
      setPaused(new Set(data.map((r: { id: string }) => r.id)));
    }
  }, []);

  useEffect(() => {
    fetchPaused();
    const channel = supabase
      .channel('menu-picker-paused')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paused_products' }, fetchPaused)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPaused]);

  return paused;
}

export default function MenuPickerModal({ onConfirm, onClose, addToFolio, nextFolioNumber }: MenuPickerModalProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [noteItem, setNoteItem] = useState<MenuItem | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showCart, setShowCart] = useState(false);

  const paused = usePausedFromSupabase();

  const CATEGORIES = useMemo(() =>
    ALL_CATEGORIES.map(cat => ({
      ...cat,
      items: cat.items.filter(item => !paused.has(String(item.id))),
    })).filter(cat => cat.items.length > 0),
  [paused]);

  const currentItems = search.trim()
    ? CATEGORIES.flatMap(c => c.items).filter(i =>
        i.name.toLowerCase().includes(search.toLowerCase())
      )
    : (CATEGORIES[activeCategory]?.items ?? []);

  const cartTotal = cart.reduce((s, e) => s + e.menuItem.price * e.quantity, 0);
  const cartCount = cart.reduce((s, e) => s + e.quantity, 0);

  const handleSelectItem = (item: MenuItem) => {
    setNoteItem(item);
    setNoteText('');
  };

  const confirmAddToCart = () => {
    if (!noteItem) return;
    const key = `${noteItem.id}-${noteText}`;
    setCart(prev => {
      const existing = prev.find(e => `${e.menuItem.id}-${e.note}` === key);
      if (existing) {
        return prev.map(e => `${e.menuItem.id}-${e.note}` === key ? { ...e, quantity: e.quantity + 1 } : e);
      }
      return [...prev, { menuItem: noteItem, quantity: 1, note: noteText.trim() }];
    });
    setNoteItem(null);
  };

  const updateCartQty = (idx: number, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter((_, i) => i !== idx));
    } else {
      setCart(prev => prev.map((e, i) => i === idx ? { ...e, quantity: qty } : e));
    }
  };

  const handleConfirm = () => {
    if (cart.length === 0) return;
    onConfirm(cart);
  };

  const isAddingToExisting = addToFolio !== undefined;
  const folioLabel = isAddingToExisting
    ? `Agregar a Ronda #${String(addToFolio).padStart(2, '0')}`
    : `Nueva Ronda #${String(nextFolioNumber ?? 1).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-2xl sm:rounded-2xl flex flex-col h-[85vh] sm:h-[80vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">{folioLabel}</h3>
            {isAddingToExisting && (
              <p className="text-xs text-amber-600 font-medium">Se agrega a la ronda actual</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {cart.length > 0 && (
              <button
                onClick={() => setShowCart(!showCart)}
                className="flex items-center gap-1.5 bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
              >
                <i className="ri-shopping-cart-line" />
                {cartCount} items · ${cartTotal.toFixed(2)}
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer">
              <i className="ri-close-line text-gray-500" />
            </button>
          </div>
        </div>

        {/* Cart preview */}
        {showCart && cart.length > 0 && (
          <div className="border-b border-gray-100 bg-amber-50 px-4 py-3 space-y-1.5 max-h-40 overflow-y-auto">
            {cart.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <button onClick={() => updateCartQty(idx, entry.quantity - 1)} className="w-5 h-5 flex items-center justify-center rounded-full border border-amber-300 text-amber-700 cursor-pointer text-xs">
                    <i className="ri-subtract-line" />
                  </button>
                  <span className="w-5 text-center text-xs font-bold text-gray-900">{entry.quantity}</span>
                  <button onClick={() => updateCartQty(idx, entry.quantity + 1)} className="w-5 h-5 flex items-center justify-center rounded-full border border-amber-300 text-amber-700 cursor-pointer text-xs">
                    <i className="ri-add-line" />
                  </button>
                </div>
                <span className="flex-1 text-xs text-gray-800 truncate">
                  {entry.menuItem.name}{entry.note ? ` (${entry.note})` : ''}
                </span>
                <span className="text-xs font-bold text-amber-700">${(entry.menuItem.price * entry.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="px-4 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <i className="ri-search-line text-gray-400 text-sm" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-gray-400 cursor-pointer">
                <i className="ri-close-line text-sm" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Category sidebar */}
          {!search && (
            <div className="w-28 border-r border-gray-100 overflow-y-auto flex-shrink-0">
              {CATEGORIES.map((cat, idx) => (
                <button
                  key={cat.label}
                  onClick={() => setActiveCategory(idx)}
                  className={`w-full px-2 py-3 text-left text-xs font-medium transition-colors cursor-pointer ${
                    activeCategory === idx
                      ? 'bg-amber-50 text-amber-700 border-r-2 border-amber-500'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <i className={`${cat.icon} block text-base mb-0.5`} />
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* Items list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {currentItems.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Sin resultados</p>
            ) : (
              currentItems.map((item) => {
                const inCart = cart.filter(e => e.menuItem.id === item.id).reduce((s, e) => s + e.quantity, 0);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-all cursor-pointer text-left"
                  >
                    <span className="text-sm text-gray-800 font-medium">{item.name}</span>
                    <div className="flex items-center gap-2 ml-2">
                      {inCart > 0 && (
                        <span className="bg-amber-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                          {inCart}
                        </span>
                      )}
                      <span className="text-sm font-bold text-amber-600 whitespace-nowrap">${item.price.toFixed(2)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Confirm button */}
        <div className="px-4 py-3 border-t border-gray-100">
          <button
            onClick={handleConfirm}
            disabled={cart.length === 0}
            className={`w-full disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm cursor-pointer transition-colors whitespace-nowrap ${
              isAddingToExisting
                ? 'bg-green-500 hover:bg-green-600'
                : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            {cart.length === 0
              ? 'Selecciona productos'
              : isAddingToExisting
                ? `Agregar a Ronda #${String(addToFolio).padStart(2, '0')} · ${cartCount} items · $${cartTotal.toFixed(2)}`
                : `Enviar Nueva Ronda · ${cartCount} items · $${cartTotal.toFixed(2)}`}
          </button>
        </div>
      </div>

      {/* Note modal */}
      {noteItem && (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNoteItem(null)} />
          <div className="relative bg-white rounded-2xl p-5 w-full max-w-sm">
            <h4 className="font-bold text-gray-900 mb-1">{noteItem.name}</h4>
            <p className="text-amber-600 font-bold text-lg mb-3">${noteItem.price.toFixed(2)}</p>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Nota / Especificación (opcional)
            </label>
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Ej: BBQ, sin cebolla, extra picante..."
              autoFocus
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              onKeyDown={(e) => e.key === 'Enter' && confirmAddToCart()}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setNoteItem(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAddToCart}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
              >
                <i className="ri-add-line mr-1" />
                Al Carrito
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}