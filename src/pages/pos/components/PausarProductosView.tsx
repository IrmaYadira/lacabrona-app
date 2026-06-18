import { useState, useMemo } from 'react';
import {
  wingsMenu, bonelessMenu, beerMenu, halfBeersMenu, pacificoBeersMenu,
  ampolletasMenu, nonAlcoholicBeersMenu, micheladaMenu, micheladaConCamaronMenu,
  sidesMenu, hotDogsMenu, burgersMenu, comboMenu, sodasMenu,
  cannedAlcoholicMenu, shotShowsMenu, vasosPreparadosMenu, azulitosMenu, preparadosMenu,
  barrilMenu, cigarettesMenu,
} from '@/mocks/menu';
import { usePausedProducts } from '@/hooks/usePausedProducts';
import AvailabilityLogView from '@/pages/pos/components/AvailabilityLogView';

interface PausarProductosViewProps {
  onBack: () => void;
}

interface ProductEntry {
  id: string;
  name: string;
  price: number;
  category: string;
}

function buildAllProducts(): ProductEntry[] {
  const list: ProductEntry[] = [];

  list.push({ id: 'wing-media', name: 'Alitas Media Orden (5 pzas)', price: wingsMenu.prices['Media Orden (5 pzas)'], category: 'Alitas & Boneless' });
  list.push({ id: 'wing-completa', name: 'Alitas Orden Completa (10 pzas)', price: wingsMenu.prices['Orden Completa (10 pzas)'], category: 'Alitas & Boneless' });
  list.push({ id: 'boneless-main', name: 'Boneless', price: bonelessMenu.prices['Media Orden (5 pzas)'], category: 'Alitas & Boneless' });

  beerMenu.forEach(i => list.push({ id: String(i.id), name: i.name, price: i.price, category: 'Cervezas Mega' }));
  halfBeersMenu.forEach(i => list.push({ id: `half-${i.id}`, name: i.name, price: i.price, category: 'Cervezas Medio' }));
  pacificoBeersMenu.forEach(i => list.push({ id: `pac-${i.id}`, name: i.name, price: i.price, category: 'Pacífico' }));
  ampolletasMenu.forEach(i => list.push({ id: `amp-${i.id}`, name: i.name, price: i.price, category: 'Ampolletas' }));
  nonAlcoholicBeersMenu.forEach(i => list.push({ id: `na-${i.id}`, name: i.name, price: i.price, category: 'Sin Alcohol' }));
  barrilMenu.forEach(i => list.push({ id: `barril-${i.id}`, name: i.name, price: i.price, category: 'Barril' }));

  list.push({ id: `michelada-${micheladaMenu.id}`, name: micheladaMenu.name, price: micheladaMenu.price, category: 'Micheladas' });
  list.push({ id: `michelada-${micheladaConCamaronMenu.id}`, name: micheladaConCamaronMenu.name, price: micheladaConCamaronMenu.price, category: 'Micheladas' });

  shotShowsMenu.forEach(i => list.push({ id: `shot-${i.id}`, name: i.name, price: i.price, category: 'Shots' }));

  preparadosMenu.forEach(i => {
    list.push({ id: `prep-${i.id}`, name: i.name, price: i.basePrice, category: 'Preparados' });
  });

  azulitosMenu.forEach(i => list.push({ id: `azul-${i.id}`, name: i.name, price: i.price, category: 'Azulitos' }));
  vasosPreparadosMenu.forEach(i => list.push({ id: `vaso-${i.id}`, name: i.name, price: i.price, category: 'Vasos Preparados' }));
  cannedAlcoholicMenu.forEach(i => list.push({ id: `canned-${i.id}`, name: i.name, price: i.price, category: 'Latas Alcohólicas' }));
  sodasMenu.forEach(i => list.push({ id: `soda-${i.id}`, name: i.name, price: i.price, category: 'Refrescos & Bebidas' }));
  burgersMenu.forEach(i => list.push({ id: `burg-${i.id}`, name: i.name, price: i.price, category: 'Hamburguesas' }));
  hotDogsMenu.forEach(i => list.push({ id: `hdog-${i.id}`, name: i.name, price: i.price, category: 'Hot Dogs' }));
  sidesMenu.forEach(i => list.push({ id: `side-${i.id}`, name: i.name, price: i.price, category: 'Botanas & Lados' }));
  comboMenu.forEach(i => list.push({ id: `combo-${i.id}`, name: i.name, price: i.price, category: 'Combos' }));
  cigarettesMenu.filter(c => c.id <= 3).forEach(i => list.push({ id: `cig-${i.id}`, name: i.name, price: i.price, category: 'Cigarros' }));
  list.push({ id: 'cig-cajetilla', name: 'Cajetilla Completa', price: 115, category: 'Cigarros' });

  return list;
}

const ALL_PRODUCTS = buildAllProducts();

export default function PausarProductosView({ onBack }: PausarProductosViewProps) {
  const { paused, loading, toggleProduct, resumeAll } = usePausedProducts();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);

  const categories = useMemo(() => {
    return ['Todos', ...Array.from(new Set(ALL_PRODUCTS.map(p => p.category)))];
  }, []);

  const filtered = useMemo(() => {
    let list = ALL_PRODUCTS;
    if (activeCategory !== 'Todos') list = list.filter(p => p.category === activeCategory);
    if (search.trim()) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [activeCategory, search]);

  const pausedCount = paused.size;

  const handleToggle = async (product: ProductEntry) => {
    setSavingId(product.id);
    await toggleProduct({ id: product.id, name: product.name, category: product.category });
    setSavingId(null);
  };

  const handleReactivateAll = async () => {
    // Pasar la lista de productos actualmente pausados para el log
    const pausedList = ALL_PRODUCTS.filter(p => paused.has(p.id)).map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
    }));
    await resumeAll(pausedList);
  };

  if (showLog) {
    return <AvailabilityLogView onBack={() => setShowLog(false)} />;
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer">
          <i className="ri-arrow-left-line text-gray-600" />
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-gray-900">Disponibilidad de Productos</h2>
          <p className="text-xs text-gray-500">
            {loading
              ? 'Cargando...'
              : pausedCount === 0
                ? 'Todos disponibles'
                : `${pausedCount} producto(s) marcado(s) como agotado`}
          </p>
        </div>
        {/* Botón historial */}
        <button
          onClick={() => setShowLog(true)}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer text-gray-500"
          title="Ver historial"
        >
          <i className="ri-history-line text-lg" />
        </button>
        {pausedCount > 0 && (
          <button
            onClick={handleReactivateAll}
            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-refresh-line" />
            Activar Todo
          </button>
        )}
      </div>

      {/* Info banner */}
      <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
        <i className="ri-global-line text-amber-600 text-sm flex-shrink-0" />
        <p className="text-xs text-amber-700 font-medium">
          Los productos marcados como agotados se ocultan del menú web <strong>en tiempo real</strong>
        </p>
      </div>

      {/* Search */}
      <div className="px-4 py-2 bg-white border-b border-gray-100">
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
        {/* Category sidebar */}
        <div className="w-32 bg-white border-r border-gray-100 overflow-y-auto flex-shrink-0">
          {categories.map(cat => {
            const catPaused = cat === 'Todos'
              ? pausedCount
              : ALL_PRODUCTS.filter(p => p.category === cat && paused.has(p.id)).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`w-full px-3 py-3 text-left text-xs font-medium transition-colors cursor-pointer flex items-center justify-between gap-1 ${
                  activeCategory === cat
                    ? 'bg-amber-50 text-amber-700 border-r-2 border-amber-500'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="truncate">{cat}</span>
                {catPaused > 0 && (
                  <span className="bg-red-100 text-red-600 text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
                    {catPaused}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Products list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">Sin resultados</p>
          ) : (
            filtered.map(product => {
              const isPaused = paused.has(product.id);
              const isSaving = savingId === product.id;
              return (
                <div
                  key={product.id}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl border transition-all ${
                    isPaused ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
                  }`}
                >
                  {/* Estado visual */}
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isPaused ? 'bg-red-400' : 'bg-green-400'}`} />

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-tight ${isPaused ? 'text-red-400 line-through' : 'text-gray-900'}`}>
                      {product.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{product.category}</span>
                      <span className="text-xs font-semibold text-amber-600">${product.price.toFixed(2)}</span>
                    </div>
                  </div>

                  {isPaused && (
                    <span className="text-xs font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                      <i className="ri-error-warning-line mr-0.5" />
                      Agotado
                    </span>
                  )}

                  {/* Toggle switch */}
                  <button
                    onClick={() => handleToggle(product)}
                    disabled={isSaving}
                    className={`flex-shrink-0 w-12 h-6 rounded-full transition-all cursor-pointer relative disabled:opacity-60 ${
                      isPaused ? 'bg-red-400' : 'bg-green-400'
                    }`}
                    title={isPaused ? 'Marcar como disponible' : 'Marcar como agotado'}
                  >
                    {isSaving ? (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <i className="ri-loader-4-line text-white text-xs animate-spin" />
                      </span>
                    ) : (
                      <span
                        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                          isPaused ? 'left-0.5' : 'left-6'
                        }`}
                      />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom info */}
      {pausedCount > 0 && (
        <div className="px-4 py-3 bg-red-50 border-t border-red-100">
          <p className="text-xs text-red-600 font-semibold text-center">
            <i className="ri-error-warning-line mr-1" />
            {pausedCount} producto(s) marcado(s) como agotado en el menú web y el POS
          </p>
        </div>
      )}
    </div>
  );
}