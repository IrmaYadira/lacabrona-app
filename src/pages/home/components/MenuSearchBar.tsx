import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { usePaused } from '../context/PausedContext';
import {
  beerMenu, halfBeersMenu, pacificoBeersMenu, ampolletasMenu,
  nonAlcoholicBeersMenu, micheladaMenu, micheladaConCamaronMenu,
  sidesMenu, hotDogsMenu, burgersMenu, comboMenu, sodasMenu,
  cannedAlcoholicMenu, shotShowsMenu, vasosPreparadosMenu, azulitosMenu,
  preparadosMenu, barrilMenu, cigarettesMenu, wingsMenu, bonelessMenu,
} from '@/mocks/menu';
import { useCart, getProductFlashOffer, calculateDiscountedPrice, normalizeCat, categoryMatches, type FlashOffer } from '../context/CartContext';

// ── Categorías de navegación rápida ──────────────────────────────────────
const QUICK_CATS = [
  { label: 'Todo', id: null, icon: 'ri-apps-line' },
  { label: 'Alitas', id: 'alitas', icon: 'ri-fire-line' },
  { label: 'Boneless', id: 'boneless', icon: 'ri-fire-line' },
  { label: 'Hamburguesas', id: 'hamburguesas', icon: 'ri-restaurant-2-line' },
  { label: 'Hot Dogs', id: 'hotdogs', icon: 'ri-restaurant-line' },
  { label: 'Entradas', id: 'entradas', icon: 'ri-bowl-line' },
  { label: 'Combos', id: 'combos', icon: 'ri-gift-line' },
  { label: 'Micheladas', id: 'micheladas', icon: 'ri-cup-line' },
  { label: 'Cervezas Mega', id: 'cervezas', icon: 'ri-goblet-line' },
  { label: 'Pacífico', id: 'pacifico', icon: 'ri-goblet-line' },
  { label: 'Medios', id: 'medio-cervezas', icon: 'ri-goblet-line' },
  { label: 'Ampolletas', id: 'ampolletas', icon: 'ri-goblet-line' },
  { label: 'Barril', id: 'barril', icon: 'ri-drop-line' },
  { label: 'Sin Alcohol', id: 'sin-alcohol', icon: 'ri-heart-line' },
  { label: 'Vasos', id: 'vasos', icon: 'ri-cup-line' },
  { label: 'Shots', id: 'caballitos', icon: 'ri-cup-fill' },
  { label: 'Preparados', id: 'preparados', icon: 'ri-test-tube-line' },
  { label: 'Azulitos', id: 'azulitos', icon: 'ri-drop-fill' },
  { label: 'Latas Alc.', id: 'latas-alcohol', icon: 'ri-goblet-fill' },
  { label: 'Refrescos', id: 'refrescos', icon: 'ri-bubble-chart-line' },
  { label: 'Cigarros', id: 'cigarros', icon: 'ri-more-line' },
];

// ── Catálogo plano para búsqueda ──────────────────────────────────────────
interface SearchProduct {
  id: string;
  pausedId: string;
  name: string;
  price: number;
  sectionId: string;
  category: string;
  tags?: string[];
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Mapea sectionId + item.id al pausedId real usado en paused_products */
function getPausedId(sectionId: string, rawId: string | number | undefined): string {
  const id = String(rawId ?? '');
  switch (sectionId) {
    case 'medio-cervezas': return `half-${id}`;
    case 'pacifico': return `pac-${id}`;
    case 'hamburguesas': return `burg-${id}`;
    case 'hotdogs': return `hdog-${id}`;
    case 'entradas': return `side-${id}`;
    case 'ampolletas': return `amp-${id}`;
    case 'barril': return `barril-${id}`;
    case 'caballitos': return `shot-${id}`;
    case 'azulitos': return `azul-${id}`;
    case 'vasos': return `vaso-${id}`;
    case 'latas-alcohol': return `canned-${id}`;
    case 'combos': return `combo-${id}`;
    case 'cigarros': return `cig-${id}`;
    case 'refrescos': return `soda-${id}`;
    case 'sin-alcohol': return `na-${id}`;
    case 'alitas': return id === '1' ? 'wing-media' : `alitas-${id}`;
    case 'boneless': return id === '1' ? 'boneless-main' : `boneless-${id}`;
    case 'preparados': return `prep-${id}`;
    case 'micheladas': return `michelada-${id}`;
    default: return id;
  }
}

function buildSearchCatalog(): SearchProduct[] {
  const list: SearchProduct[] = [];

  const push = (
    items: Record<string, unknown>[],
    sectionId: string,
    category: string,
  ) => {
    items.forEach((item) => {
      const rawId = item.id ?? item.name;
      const price =
        typeof item.price === 'number'
          ? item.price
          : typeof item.basePrice === 'number'
          ? item.basePrice
          : item.prices
          ? Object.values(item.prices as Record<string, number>)[0]
          : 0;
      list.push({
        id: `${sectionId}-${rawId}`,
        pausedId: getPausedId(sectionId, rawId),
        name: String(item.name),
        price,
        sectionId,
        category,
        tags: Array.isArray(item.tags) ? (item.tags as string[]) : [],
      });
    });
  };

  push([wingsMenu as unknown as Record<string, unknown>], 'alitas', 'Alitas');
  push([bonelessMenu as unknown as Record<string, unknown>], 'boneless', 'Boneless');
  push(beerMenu as unknown as Record<string, unknown>[], 'cervezas', 'Cervezas Mega');
  push(halfBeersMenu as unknown as Record<string, unknown>[], 'medio-cervezas', 'Medios');
  push(pacificoBeersMenu as unknown as Record<string, unknown>[], 'pacifico', 'Pacífico');
  push(ampolletasMenu as unknown as Record<string, unknown>[], 'ampolletas', 'Ampolletas');
  push(nonAlcoholicBeersMenu as unknown as Record<string, unknown>[], 'sin-alcohol', 'Sin Alcohol');
  push(
    [micheladaMenu, micheladaConCamaronMenu] as unknown as Record<string, unknown>[],
    'micheladas',
    'Micheladas',
  );
  push(sidesMenu as unknown as Record<string, unknown>[], 'entradas', 'Entradas');
  push(hotDogsMenu as unknown as Record<string, unknown>[], 'hotdogs', 'Hot Dogs');
  push(burgersMenu as unknown as Record<string, unknown>[], 'hamburguesas', 'Hamburguesas');
  push(comboMenu as unknown as Record<string, unknown>[], 'combos', 'Combos');
  push(sodasMenu as unknown as Record<string, unknown>[], 'refrescos', 'Refrescos');
  push(cannedAlcoholicMenu as unknown as Record<string, unknown>[], 'latas-alcohol', 'Latas Alc.');
  push(shotShowsMenu as unknown as Record<string, unknown>[], 'caballitos', 'Shots');
  push(vasosPreparadosMenu as unknown as Record<string, unknown>[], 'vasos', 'Vasos');
  push(azulitosMenu as unknown as Record<string, unknown>[], 'azulitos', 'Azulitos');
  push(preparadosMenu as unknown as Record<string, unknown>[], 'preparados', 'Preparados');
  push(barrilMenu as unknown as Record<string, unknown>[], 'barril', 'Barril');
  push(cigarettesMenu as unknown as Record<string, unknown>[], 'cigarros', 'Cigarros');

  return list;
}

// ── Componente principal ─────────────────────────────────────────────────
export default function MenuSearchBar() {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const catsRef = useRef<HTMLDivElement>(null);
  const { isPaused } = usePaused();
  const { flashOffers, productMap } = useCart();

  // Memoizar catálogo para evitar reconstrucción en cada render
  const SEARCH_CATALOG = useMemo(() => buildSearchCatalog(), []);

  // Scroll spy — detectar sección visible
  useEffect(() => {
    const sectionIds = QUICK_CATS.filter(c => c.id).map(c => c.id as string);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 },
    );
    sectionIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollToSection = useCallback((id: string | null) => {
    if (!id) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setActiveSection(null);
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      const offset = 110; // altura del navbar + search bar
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
    setActiveSection(id);
    setQuery('');
  }, []);

  // Scroll el chip activo al centro del contenedor (solo horizontal, nunca vertical)
  useEffect(() => {
    if (!activeSection || !catsRef.current) return;
    const btn = catsRef.current.querySelector(`[data-sid="${activeSection}"]`) as HTMLElement;
    if (!btn) return;

    const container = catsRef.current;
    const containerWidth = container.clientWidth;
    const btnLeft = btn.offsetLeft;
    const btnWidth = btn.clientWidth;

    // Centrar el botón en el contenedor
    const targetScrollLeft = btnLeft - containerWidth / 2 + btnWidth / 2;

    container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
  }, [activeSection]);

  // Resultados de búsqueda — memoizar para evitar filtrar en cada render
  const results = useMemo(() => {
    if (query.trim().length <= 1) return [];
    const q = normalize(query);
    return SEARCH_CATALOG.filter(p =>
      normalize(p.name).includes(q) ||
      normalize(p.category).includes(q) ||
      (p.tags ?? []).some(t => normalize(t).includes(q)),
    ).slice(0, 12);
  }, [query, SEARCH_CATALOG]);

  const showResults = focused && query.trim().length > 1;

  // ── Detectar categorías con ofertas flash activas ──
  const activeOffers = useMemo(() => {
    const now = Date.now();
    return flashOffers.filter(o => {
      if (!o.is_active) return false;
      const start = new Date(o.start_time).getTime();
      const end = new Date(o.end_time).getTime();
      return now >= start && now <= end;
    });
  }, [flashOffers]);

  const categoryHasOffer = useCallback((catLabel: string) => {
    const catNorm = normalizeCat(catLabel);
    return activeOffers.some(o => {
      if (o.category_key && categoryMatches(catLabel, o.category_key)) return true;
      // también por producto: buscar si algún producto del catálogo en esta categoría coincide
      if (o.product_ids && o.product_ids.length > 0) {
        const catProducts = SEARCH_CATALOG.filter(p => normalizeCat(p.category) === catNorm);
        return catProducts.some(p => {
          const offer = getProductFlashOffer(p.name, p.category, activeOffers, productMap);
          return !!offer;
        });
      }
      return false;
    });
  }, [activeOffers, productMap, SEARCH_CATALOG]);

  const totalActiveOffers = activeOffers.length;

  return (
    <div className="sticky top-[80px] z-30 w-full bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="w-full max-w-6xl mx-auto px-4 md:px-8">
        {/* Barra de búsqueda + chips en una sola fila */}
        <div className="flex items-center gap-3 py-2.5">
          {/* Input de búsqueda */}
          <div className="relative flex-shrink-0 w-48 md:w-64">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 180)}
              placeholder="Buscar en el menú..."
              className="w-full pl-8 pr-8 py-1.5 text-sm bg-gray-100 rounded-full border border-transparent focus:border-amber-400 focus:bg-white focus:outline-none transition-all placeholder-gray-400"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <i className="ri-close-line text-sm" />
              </button>
            )}

            {/* Dropdown de resultados */}
            {showResults && (
              <div className="absolute top-full left-0 mt-1 w-80 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden z-50 max-h-80 overflow-y-auto">
                {results.length === 0 ? (
                  <div className="px-4 py-5 text-center text-gray-400 text-sm">
                    <i className="ri-search-line text-2xl block mb-1 text-gray-300" />
                    Sin resultados para &ldquo;{query}&rdquo;
                  </div>
                ) : (
                  <>
                    <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        {results.length} resultado{results.length !== 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-gray-400">Toca para ir a la sección</span>
                    </div>
                    {results.map(product => {
                      const paused = isPaused(product.pausedId);
                      const offer = getProductFlashOffer(product.name, product.category, flashOffers, productMap);
                      const hasDiscount = !!offer && product.price > 0;
                      const discountPrice = hasDiscount ? calculateDiscountedPrice(product.price, offer.discount_pct) : product.price;
                      return (
                        <button
                          key={product.id}
                          onMouseDown={() => scrollToSection(product.sectionId)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50 transition-colors text-left cursor-pointer border-b border-gray-50 last:border-b-0"
                        >
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${paused ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                              {product.name}
                              {paused && (
                                <span className="ml-1.5 text-[10px] font-bold text-red-400 bg-red-50 px-1.5 py-0.5 rounded-full not-italic no-underline" style={{ textDecoration: 'none' }}>
                                  agotado
                                </span>
                              )}
                              {hasDiscount && (
                                <span className="relative inline-flex items-center group">
                                  <span className="ml-1.5 text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full not-italic no-underline animate-pulse" style={{ textDecoration: 'none' }}>
                                    🔥 -{offer.discount_pct}%
                                  </span>
                                  <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-48 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-normal leading-snug">
                                    <span className="font-semibold block">{offer.title}</span>
                                    {offer.subtitle && <span className="text-gray-300 text-[11px] block mt-0.5">{offer.subtitle}</span>}
                                    <span className="absolute left-1/2 -translate-x-1/2 top-full -mt-1 w-2 h-2 bg-gray-900 rotate-45" />
                                  </span>
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400">{product.category}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {product.price > 0 && (
                              <div className="flex items-center gap-1.5">
                                {hasDiscount ? (
                                  <>
                                    <span className="text-xs text-gray-400 line-through">
                                      ${product.price.toFixed(0)}
                                    </span>
                                    <span className="text-sm font-bold text-amber-600">
                                      ${discountPrice.toFixed(0)}
                                    </span>
                                  </>
                                ) : (
                                  <span className={`text-sm font-bold ${paused ? 'text-gray-300' : 'text-amber-600'}`}>
                                    ${product.price.toFixed(0)}
                                  </span>
                                )}
                              </div>
                            )}
                            <i className="ri-arrow-right-s-line text-gray-300 text-sm" />
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          {totalActiveOffers === 0 && (
            <div className="w-px h-6 bg-gray-200 flex-shrink-0" />
          )}

          {/* Pill de ofertas activas */}
          {totalActiveOffers > 0 && (
            <div className="flex-shrink-0 flex items-center gap-1.5 bg-red-500 text-white px-2.5 py-1 rounded-full text-[11px] font-bold animate-pulse cursor-default select-none">
              <i className="ri-fire-line text-xs" />
              {totalActiveOffers} oferta{totalActiveOffers !== 1 ? 's' : ''}
            </div>
          )}

          {/* Chips de categoría — scroll horizontal */}
          <div
            ref={catsRef}
            className="flex-1 flex items-center gap-1.5 overflow-x-auto"
            style={{ scrollbarWidth: 'none' }}
          >
            {QUICK_CATS.map(cat => {
              const isActive = cat.id === null
                ? activeSection === null
                : activeSection === cat.id;
              const hasFlash = cat.id !== null && categoryHasOffer(cat.label);
              return (
                <button
                  key={cat.id ?? 'all'}
                  data-sid={cat.id ?? 'all'}
                  onClick={() => scrollToSection(cat.id)}
                  className={`relative flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex-shrink-0 ${
                    isActive
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-amber-100 hover:text-amber-700'
                  }`}
                >
                  <i className={`${cat.icon} text-xs`} />
                  {cat.label}
                  {hasFlash && !isActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}