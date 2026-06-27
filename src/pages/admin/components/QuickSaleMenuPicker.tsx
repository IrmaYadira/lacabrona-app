import { useState, useMemo } from 'react';
import { getPausedProducts } from '@/pages/pos/pausedProducts';
import {
  wingsMenu, bonelessMenu, beerMenu, halfBeersMenu, pacificoBeersMenu,
  ampolletasMenu, nonAlcoholicBeersMenu, micheladaMenu, micheladaConCamaronMenu,
  sidesMenu, hotDogsMenu, burgersMenu, comboMenu, sodasMenu,
  cannedAlcoholicMenu, shotShowsMenu, vasosPreparadosMenu, azulitosMenu, preparadosMenu,
  barrilMenu, cigarettesMenu, caguamasMenu,
} from '@/mocks/menu';

export interface SaleItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  note: string;
}

interface QuickSaleMenuPickerProps {
  items: SaleItem[];
  onChange: (items: SaleItem[]) => void;
  compact?: boolean;
}

interface MenuItem {
  id: string | number;
  name: string;
  price: number;
}

interface Category {
  label: string;
  icon: string;
  group: string;
  items: MenuItem[];
}

function buildCategories(): Category[] {
  const wingItems: MenuItem[] = [
    { id: 'wing-media', name: 'Alitas Media Orden (5 pzas)', price: wingsMenu.prices['Media Orden (5 pzas)'] },
    { id: 'wing-completa', name: 'Alitas Orden Completa (10 pzas)', price: wingsMenu.prices['Orden Completa (10 pzas)'] },
  ];
  const bonelessItems: MenuItem[] = [
    { id: 'boneless-media', name: 'Boneless Media Orden (5 pzas)', price: bonelessMenu.prices['Media Orden (5 pzas)'] },
    { id: 'boneless-completa', name: 'Boneless Orden Completa (10 pzas)', price: bonelessMenu.prices['Orden Completa (10 pzas)'] },
  ];

  return [
    // ── COMIDA ─────────────────────────────────────────────
    { group: 'COMIDA', label: 'Alitas',        icon: 'ri-fire-line',        items: wingItems },
    { group: 'COMIDA', label: 'Boneless',      icon: 'ri-fire-line',        items: bonelessItems },
    { group: 'COMIDA', label: 'Hamburguesas',  icon: 'ri-restaurant-line',  items: burgersMenu.map(i => ({ id: i.id, name: i.name, price: i.price })) },
    { group: 'COMIDA', label: 'Hot Dogs',      icon: 'ri-restaurant-line',  items: hotDogsMenu.map(i => ({ id: i.id, name: i.name, price: i.price })) },
    { group: 'COMIDA', label: 'Entradas',      icon: 'ri-bowl-line',        items: sidesMenu.map(i => ({ id: i.id, name: i.name, price: i.price })) },
    { group: 'COMIDA', label: 'Combos',        icon: 'ri-gift-line',        items: comboMenu.map(i => ({ id: i.id, name: i.name, price: i.price })) },

    // ── BEBIDAS ALCOHÓLICAS ────────────────────────────────
    { group: 'BEBIDAS', label: 'Cerv. Mega',   icon: 'ri-goblet-line',      items: beerMenu.map(i => ({ id: i.id, name: i.name, price: i.price })) },
    { group: 'BEBIDAS', label: 'Cerv. Medio',  icon: 'ri-goblet-line',      items: [{ id: 7999, name: 'CUBETA 10 Cervezas Corona Medio', price: 350 }, ...halfBeersMenu.map(i => ({ id: i.id, name: i.name, price: i.price }))] },
    { group: 'BEBIDAS', label: 'Pacífico',     icon: 'ri-goblet-line',      items: pacificoBeersMenu.map(i => ({ id: i.id, name: i.name, price: i.price })) },
    { group: 'BEBIDAS', label: 'Ampolletas',   icon: 'ri-goblet-line',      items: ampolletasMenu.map(i => ({ id: i.id, name: i.name, price: i.price })) },
    { group: 'BEBIDAS', label: 'Barril',       icon: 'ri-goblet-fill',      items: barrilMenu.map(i => ({ id: i.id, name: i.name, price: i.price })) },
    { group: 'BEBIDAS', label: 'Caguamas',     icon: 'ri-goblet-fill',      items: caguamasMenu.map(i => ({ id: i.id, name: i.name, price: i.price })) },
    { group: 'BEBIDAS', label: 'Micheladas',   icon: 'ri-cup-line',         items: [
      { id: micheladaMenu.id, name: micheladaMenu.name, price: micheladaMenu.price },
      { id: micheladaConCamaronMenu.id, name: micheladaConCamaronMenu.name, price: micheladaConCamaronMenu.price },
    ]},
    { group: 'BEBIDAS', label: 'Shots',        icon: 'ri-flask-line',       items: shotShowsMenu.map(i => ({ id: i.id, name: i.name, price: i.price })) },
    { group: 'BEBIDAS', label: 'Preparados',   icon: 'ri-cup-fill',         items: preparadosMenu.flatMap(i => [
      { id: `prep-${i.id}-sencillo`, name: `${i.name} (Sencillo)`, price: i.basePrice },
      { id: `prep-${i.id}-doble`,    name: `${i.name} (Doble)`,    price: i.basePrice + i.showPrice },
    ])},
    { group: 'BEBIDAS', label: 'Azulitos',     icon: 'ri-cup-line',         items: azulitosMenu.map(i => ({ id: i.id, name: i.name, price: i.price })) },
    { group: 'BEBIDAS', label: 'Vasos Prep.',  icon: 'ri-cup-line',         items: vasosPreparadosMenu.map(i => ({ id: i.id, name: i.name, price: i.price })) },
    { group: 'BEBIDAS', label: 'Latas Alc.',   icon: 'ri-beer-line',        items: cannedAlcoholicMenu.map(i => ({ id: i.id, name: i.name, price: i.price })) },

    // ── SIN ALCOHOL ────────────────────────────────────────
    { group: 'SIN ALC', label: 'Refrescos',    icon: 'ri-cup-line',         items: sodasMenu.map(i => ({ id: i.id, name: i.name, price: i.price })) },
    { group: 'SIN ALC', label: 'Sin Alcohol',  icon: 'ri-leaf-line',        items: nonAlcoholicBeersMenu.map(i => ({ id: i.id, name: i.name, price: i.price })) },

    // ── EXTRAS ─────────────────────────────────────────────
    { group: 'EXTRAS',  label: 'Cigarros',     icon: 'ri-haze-line',        items: cigarettesMenu.map(i => ({ id: i.id, name: i.name, price: i.price })) },
  ];
}

const ALL_CATEGORIES = buildCategories();

const GROUP_COLORS: Record<string, { header: string; active: string; dot: string }> = {
  COMIDA:    { header: 'text-orange-500 bg-orange-50', active: 'bg-orange-50 text-orange-700 border-r-2 border-orange-400', dot: 'bg-orange-400' },
  BEBIDAS:   { header: 'text-amber-600 bg-amber-50',  active: 'bg-amber-50 text-amber-700 border-r-2 border-amber-500',   dot: 'bg-amber-400' },
  'SIN ALC': { header: 'text-green-600 bg-green-50',  active: 'bg-green-50 text-green-700 border-r-2 border-green-500',   dot: 'bg-green-500' },
  EXTRAS:    { header: 'text-gray-500 bg-gray-50',    active: 'bg-gray-100 text-gray-700 border-r-2 border-gray-400',     dot: 'bg-gray-400' },
};

export default function QuickSaleMenuPicker({ items, onChange, compact = false }: QuickSaleMenuPickerProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState('');
  const [noteItem, setNoteItem] = useState<MenuItem | null>(null);
  const [noteText, setNoteText] = useState('');

  const paused = useMemo(() => getPausedProducts(), []);
  const CATEGORIES = useMemo(() =>
    ALL_CATEGORIES.map(cat => ({
      ...cat,
      items: cat.items.filter(item => !paused.has(String(item.id))),
    })).filter(cat => cat.items.length > 0),
  [paused]);

  const currentItems = search.trim()
    ? CATEGORIES.flatMap(c => c.items).filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : (CATEGORIES[activeCategory]?.items ?? []);

  const addItem = (menuItem: MenuItem, note: string) => {
    const key = `${menuItem.id}||${note}`;
    const existing = items.find(i => i.id === key);
    if (existing) {
      onChange(items.map(i => i.id === key ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      onChange([...items, { id: key, name: menuItem.name, price: menuItem.price, quantity: 1, note }]);
    }
  };

  const handleSelectItem = (item: MenuItem) => { setNoteItem(item); setNoteText(''); };

  const confirmAdd = () => {
    if (!noteItem) return;
    addItem(noteItem, noteText.trim());
    setNoteItem(null);
    setNoteText('');
  };

  const inCartCount = (menuItemId: string | number) =>
    items.filter(i => i.id.startsWith(`${menuItemId}||`)).reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
          <i className="ri-search-line text-gray-400 text-sm" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
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
        {/* Category sidebar with group headers */}
        {!search && (
          <div className="w-28 border-r border-gray-100 overflow-y-auto flex-shrink-0">
            {(() => {
              let lastGroup = '';
              return CATEGORIES.map((cat, idx) => {
                const isNewGroup = cat.group !== lastGroup;
                lastGroup = cat.group;
                const colors = GROUP_COLORS[cat.group] ?? GROUP_COLORS['EXTRAS'];
                const isActive = activeCategory === idx;
                return (
                  <div key={`${cat.group}-${cat.label}`}>
                    {isNewGroup && (
                      <div className={`px-2 pt-2.5 pb-1 text-xs font-black uppercase tracking-widest ${colors.header}`}>
                        {cat.group}
                      </div>
                    )}
                    <button
                      onClick={() => setActiveCategory(idx)}
                      className={`w-full px-2 py-2 text-left text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                        isActive ? colors.active : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {isActive && (
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                      )}
                      <span className="leading-tight">{cat.label}</span>
                    </button>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* Items list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {/* Current group label */}
          {!search && CATEGORIES[activeCategory] && (
            <div className="px-2 pb-1">
              <span className={`text-xs font-black uppercase tracking-widest ${
                GROUP_COLORS[CATEGORIES[activeCategory].group]?.header.split(' ')[0] ?? 'text-gray-400'
              }`}>
                {CATEGORIES[activeCategory].group} · {CATEGORIES[activeCategory].label}
              </span>
            </div>
          )}

          {currentItems.map(item => {
            const count = inCartCount(item.id);
            return (
              <button
                key={item.id}
                onClick={() => handleSelectItem(item)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-all cursor-pointer text-left"
              >
                <span className="text-sm text-gray-800 font-medium leading-tight">{item.name}</span>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  {count > 0 && (
                    <span className="bg-amber-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {count}
                    </span>
                  )}
                  <span className="text-sm font-bold text-amber-600 whitespace-nowrap">${item.price.toFixed(2)}</span>
                </div>
              </button>
            );
          })}
          {currentItems.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">Sin resultados</p>
          )}
        </div>
      </div>

      {/* Note modal */}
      {noteItem && (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-4" style={{ pointerEvents: 'auto' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setNoteItem(null)} />
          <div className="relative bg-white rounded-2xl p-5 w-full max-w-xs shadow-xl">
            <h4 className="font-bold text-gray-900 mb-1 text-sm">{noteItem.name}</h4>
            <p className="text-amber-600 font-bold text-lg mb-3">${noteItem.price.toFixed(2)}</p>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Nota / Especificación (opcional)
            </label>
            <input
              type="text"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Ej: BBQ, sin cebolla..."
              autoFocus
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              onKeyDown={e => e.key === 'Enter' && confirmAdd()}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setNoteItem(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAdd}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
              >
                <i className="ri-add-line mr-1" />
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}