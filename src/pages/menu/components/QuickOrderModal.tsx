import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/pages/home/context/CartContext";
import { findLocalMenuItem, getAllLocalMenuItems, LocalMenuItem } from "@/pages/menu/utils/localMenuMap";

interface SearchResult {
  id: number;
  name: string;
  price: number;
  discount_enabled: boolean;
  discount_price: number | null;
  media: { url: string; type: string }[];
  product_categories: { name: string } | null;
}

interface QuickAddItem {
  product: SearchResult;
  quantity: number;
}

interface RecentSearch {
  query: string;
  qty: number;
  label: string;
  timestamp: number;
}

interface PopularProduct {
  id: number;
  name: string;
  price: number;
  discount_enabled: boolean;
  discount_price: number | null;
  media: { url: string; type: string }[];
  product_categories: { name: string } | null;
  orderCount: number;
}

interface Props {
  onClose: () => void;
}

const RECENT_SEARCHES_KEY = 'quickOrderRecentSearches';
const MAX_RECENT = 10;

/** Detecta cantidad al inicio: "5 alitas" → { qty: 5, term: "alitas" } */
function parseQtyPrefix(raw: string): { qty: number; term: string } {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d+)\s+(.+)$/);
  if (match) {
    const qty = parseInt(match[1], 10);
    if (qty > 0 && qty <= 99) {
      return { qty, term: match[2].trim() };
    }
  }
  return { qty: 1, term: trimmed };
}

function loadRecentSearches(): RecentSearch[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentSearch[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function saveRecentSearches(searches: RecentSearch[]) {
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches.slice(0, MAX_RECENT)));
  } catch {
    // ignore
  }
}

/** Convierte un item local a SearchResult */
function localToSearchResult(item: LocalMenuItem): SearchResult {
  return {
    id: item.id,
    name: item.name,
    price: item.price,
    discount_enabled: false,
    discount_price: null,
    media: [{ url: item.image, type: "image" }],
    product_categories: { name: item.category },
  };
}

export default function QuickOrderModal({ onClose }: Props) {
  const { addItem, setIsOpen: openCart, favorites, toggleFavorite, isFavorite } = useCart();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [quickItems, setQuickItems] = useState<QuickAddItem[]>([]);
  const [freeText, setFreeText] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [detectedQty, setDetectedQty] = useState<number | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(loadRecentSearches);
  const [popularProducts, setPopularProducts] = useState<PopularProduct[]>([]);
  const [popularLoading, setPopularLoading] = useState(true);
  const [favoriteProducts, setFavoriteProducts] = useState<SearchResult[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [pausedIds, setPausedIds] = useState<Set<string>>(new Set());
  const [pausedNames, setPausedNames] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cargar productos pausados desde Supabase en tiempo real
  const fetchPaused = useCallback(async () => {
    const { data } = await supabase.from('paused_products').select('id,name');
    if (data) {
      setPausedIds(new Set(data.map((r: { id: string }) => r.id)));
      setPausedNames(new Set(data.map((r: { name: string }) => r.name.trim().toLowerCase())));
    }
  }, []);

  useEffect(() => {
    fetchPaused();
    const channel = supabase
      .channel('quick-order-paused')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paused_products' }, fetchPaused)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPaused]);

  // Helper: determina si un LocalMenuItem está pausado
  // Los IDs en paused_products usan prefijos como 'burg-', 'hdog-', etc.
  // LocalMenuMap usa IDs numéricos distintos. Comparamos por ID numérico string
  // Y también por nombre normalizado como fallback.
  const isLocalItemPaused = useCallback((item: LocalMenuItem): boolean => {
    return pausedIds.has(String(item.id)) || pausedNames.has(item.name.trim().toLowerCase());
  }, [pausedIds, pausedNames]);

  // Foco automático al input
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Cerrar con Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Cargar productos favoritos desde el menú local (no Supabase)
  const loadFavoriteProducts = useCallback(() => {
    if (favorites.length === 0) {
      setFavoriteProducts([]);
      return;
    }
    setFavoritesLoading(true);
    try {
      const found = favorites
        .map((id) => {
          const local = findLocalMenuItem(id);
          if (!local) return null;
          if (isLocalItemPaused(local)) return null;
          return localToSearchResult(local);
        })
        .filter((p): p is SearchResult => p !== null);
      setFavoriteProducts(found);
    } catch {
      setFavoriteProducts([]);
    } finally {
      setFavoritesLoading(false);
    }
  }, [favorites, isLocalItemPaused]);

  useEffect(() => {
    loadFavoriteProducts();
  }, [loadFavoriteProducts]);

  // Cargar productos populares desde el menú local (no Supabase)
  const loadPopularProducts = useCallback(() => {
    setPopularLoading(true);
    try {
      const popularIds = [1, 2, 101, 401, 402, 10000, 1000, 5001, 5101];
      const allItems = getAllLocalMenuItems();
      const found = popularIds
        .map(id => allItems.find(item => item.id === id))
        .filter((item): item is LocalMenuItem => item !== undefined)
        .filter(item => !isLocalItemPaused(item))
        .map(item => ({ ...localToSearchResult(item), orderCount: 0 }) as PopularProduct);
      setPopularProducts(found);
    } catch {
      setPopularProducts([]);
    } finally {
      setPopularLoading(false);
    }
  }, [isLocalItemPaused]);

  useEffect(() => {
    loadPopularProducts();
  }, [loadPopularProducts]);

  const addRecentSearch = useCallback((rawQuery: string, qty: number) => {
    const label = rawQuery.trim();
    if (!label) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s.label !== label);
      const updated = [{ query: label, qty, label, timestamp: Date.now() }, ...filtered];
      const trimmed = updated.slice(0, MAX_RECENT);
      saveRecentSearches(trimmed);
      return trimmed;
    });
  }, []);

  const removeRecentSearch = useCallback((index: number) => {
    setRecentSearches(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      saveRecentSearches(updated);
      return updated;
    });
  }, []);

  const clearAllRecent = useCallback(() => {
    setRecentSearches([]);
    saveRecentSearches([]);
  }, []);

  // Búsqueda con debounce — ahora en el menú local
  const doSearch = useCallback((q: string) => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const term = q.trim().toLowerCase();
      const allItems = getAllLocalMenuItems();
      const matches = allItems
        .filter(item =>
          (item.name.toLowerCase().includes(term) ||
          item.category.toLowerCase().includes(term)) &&
          !isLocalItemPaused(item)
        )
        .slice(0, 10)
        .map(localToSearchResult);
      setResults(matches);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [isLocalItemPaused]);

  useEffect(() => {
    const { qty, term } = parseQtyPrefix(query);
    setDetectedQty(qty > 1 ? qty : null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(term), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  const toggleQuickItem = (product: SearchResult) => {
    const { qty } = parseQtyPrefix(query);
    setQuickItems(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.filter(i => i.product.id !== product.id);
      }
      return [...prev, { product, quantity: qty > 1 ? qty : 1 }];
    });
  };

  const updateQty = (productId: number, delta: number) => {
    setQuickItems(prev =>
      prev.map(i => {
        if (i.product.id === productId) {
          const newQty = Math.max(1, Math.min(20, i.quantity + delta));
          return { ...i, quantity: newQty };
        }
        return i;
      })
    );
  };

  const getFinalPrice = (p: SearchResult) => {
    if (p.discount_enabled && p.discount_price != null) return p.discount_price;
    return p.price;
  };

  const addPopularToCart = (product: SearchResult) => {
    const img = Array.isArray(product.media) && product.media.length > 0
      ? product.media[0].url
      : 'https://readdy.ai/api/search-image?query=aesthetic%20minimal%20food%20placeholder%20icon%20on%20clean%20white%20background%20simple%20line%20art%20style%20orange%20accent&width=200&height=200&seq=quickorder';

    addItem({
      id: product.id,
      name: product.name,
      description: product.product_categories?.name ?? '',
      price: product.discount_enabled && product.discount_price != null ? product.discount_price : product.price,
      image: img,
      category: product.product_categories?.name ?? 'General',
    });

    openCart(true);

    setAddedIds(prev => {
      const next = new Set(prev);
      next.add(`popular-${product.id}`);
      return next;
    });
    setTimeout(() => {
      setAddedIds(prev => {
        const next = new Set(prev);
        next.delete(`popular-${product.id}`);
        return next;
      });
    }, 1200);
  };

  const handleAddAll = () => {
    // Guardar búsqueda reciente si hay query o items seleccionados
    if (query.trim() && quickItems.length > 0) {
      const { qty } = parseQtyPrefix(query);
      addRecentSearch(query, qty);
    }

    // Agregar productos seleccionados al carrito
    quickItems.forEach(({ product, quantity }) => {
      const img = Array.isArray(product.media) && product.media.length > 0
        ? product.media[0].url
        : 'https://readdy.ai/api/search-image?query=aesthetic%20minimal%20food%20placeholder%20icon%20on%20clean%20white%20background%20simple%20line%20art%20style%20orange%20accent&width=200&height=200&seq=quickorder';

      for (let i = 0; i < quantity; i++) {
        addItem({
          id: product.id,
          name: product.name,
          description: product.product_categories?.name ?? '',
          price: getFinalPrice(product),
          image: img,
          category: product.product_categories?.name ?? 'General',
        });
      }
    });

    // Si hay texto libre, agregar como item especial
    if (freeText.trim()) {
      addItem({
        id: -999,
        name: `Pedido libre: ${freeText.trim()}`,
        description: 'Solicitud escrita por el cliente',
        price: 0,
        image: 'https://readdy.ai/api/search-image?query=minimal%20notepad%20pen%20icon%20clean%20white%20background%20orange%20accent%20line%20art&width=200&height=200&seq=quickorder-note',
        category: 'Solicitud especial',
        notes: freeText.trim(),
      });
    }

    if (quickItems.length > 0 || freeText.trim()) {
      openCart(true);
      // Mostrar feedback visual
      const ids = new Set<string>();
      quickItems.forEach(i => {
        ids.add(`${i.product.id}-${i.quantity}`);
      });
      if (freeText.trim()) ids.add('free-text');
      setAddedIds(ids);
      setTimeout(() => {
        setAddedIds(new Set());
        onClose();
      }, 1200);
    }
  };

  const isSelected = (id: number) => quickItems.some(i => i.product.id === id);

  const totalSelected = quickItems.reduce((sum, i) => sum + getFinalPrice(i.product) * i.quantity, 0);
  const hasSelection = quickItems.length > 0 || freeText.trim().length > 0;

  const renderProductCard = (product: SearchResult, keyPrefix: string, showFavBtn = true) => {
    const price = product.discount_enabled && product.discount_price != null
      ? product.discount_price
      : product.price;
    const hasDiscount = product.discount_enabled && product.discount_price != null && product.discount_price < product.price;
    const img = Array.isArray(product.media) && product.media.length > 0
      ? product.media[0].url
      : 'https://readdy.ai/api/search-image?query=aesthetic%20minimal%20food%20placeholder%20icon%20on%20clean%20white%20background%20simple%20line%20art%20style%20orange%20accent&width=200&height=200&seq=quickorder';
    const wasAdded = addedIds.has(`${keyPrefix}-${product.id}`);
    const fav = isFavorite(product.id);

    return (
      <button
        key={`${keyPrefix}-${product.id}`}
        onClick={() => addPopularToCart(product)}
        className={`relative flex flex-col items-start p-3 rounded-xl border transition-all cursor-pointer text-left active:scale-95 ${
          wasAdded
            ? 'bg-green-100 border-green-400 shadow-sm'
            : 'bg-gray-50 border-gray-200 hover:border-amber-300 hover:bg-amber-50 shadow-sm'
        }`}
      >
        {showFavBtn && (
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id); }}
            className={`absolute top-2 left-2 z-10 w-7 h-7 flex items-center justify-center rounded-full transition-all cursor-pointer ${
              fav ? 'bg-red-50 text-red-500' : 'bg-amber-100 text-amber-500 hover:text-red-400'
            }`}
            title={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          >
            <i className={`${fav ? 'ri-heart-fill' : 'ri-heart-line'} text-sm`} />
          </button>
        )}
        {wasAdded && (
          <div className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full bg-green-500 text-white">
            <i className="ri-check-line text-xs" />
          </div>
        )}
        <div className="w-full h-20 rounded-lg overflow-hidden bg-gray-100 mb-2 flex-shrink-0">
          <img
            src={img}
            alt={product.name}
            title={product.name}
            className="w-full h-full object-cover object-top"
          />
        </div>
        <p className="text-xs font-bold text-gray-900 line-clamp-2 leading-tight min-h-[2rem]">
          {product.name}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-xs font-black text-gray-900">${price.toFixed(2)}</span>
          {hasDiscount && product.price > 0 && (
            <span className="text-[10px] text-gray-400 line-through">${product.price.toFixed(2)}</span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full sm:max-w-md bg-white sm:rounded-3xl rounded-t-3xl overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 duration-200"
        style={{ maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-gray-900 font-black text-lg">⚡ Pedido rápido</p>
              <p className="text-gray-400 text-xs mt-0.5">Escribe y agrega al carrito</p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200 cursor-pointer transition-colors"
            >
              <i className="ri-close-line text-xl" />
            </button>
          </div>

          {/* Search input */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3.5 py-3 border border-transparent focus-within:border-amber-400 focus-within:bg-white transition-all">
            <i className="ri-search-line text-gray-400 text-lg" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej: 5 alitas, cerveza, burger..."
              className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
              >
                <i className="ri-close-circle-fill text-lg" />
              </button>
            )}
          </div>

          {/* Cantidad detectada */}
          {detectedQty && (
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full text-xs font-bold">
                <i className="ri-hashtag text-xs" />
                Cantidad detectada: {detectedQty}
              </span>
              <span className="text-[10px] text-gray-400">Se agregará al seleccionar</span>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-2">
          {loading && (
            <div className="py-8 flex items-center justify-center gap-2 text-gray-400">
              <i className="ri-loader-4-line animate-spin text-lg" />
              <span className="text-sm">Buscando...</span>
            </div>
          )}

          {!loading && query.trim() && results.length === 0 && (
            <div className="py-8 text-center">
              <div className="w-14 h-14 flex items-center justify-center bg-gray-100 rounded-full mx-auto mb-2">
                <i className="ri-restaurant-line text-gray-400 text-2xl" />
              </div>
              <p className="text-gray-500 text-sm font-medium">No encontramos "{parseQtyPrefix(query).term}"</p>
              <p className="text-gray-400 text-xs mt-1">Podés escribirlo abajo como pedido libre</p>
            </div>
          )}

          {/* Estado vacío completo: favoritos + recientes + populares */}
          {!loading && !query.trim() && (
            <div className="py-3 space-y-4">
              {/* Mis Favoritos */}
              {favorites.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-1">
                    <i className="ri-heart-fill text-red-500 text-sm" />
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Mis favoritos
                    </p>
                    <span className="text-[10px] text-gray-400 ml-auto">{favorites.length}</span>
                  </div>
                  {favoritesLoading ? (
                    <div className="px-3 py-2 flex items-center gap-2 text-gray-400">
                      <i className="ri-loader-4-line animate-spin text-sm" />
                      <span className="text-xs">Cargando favoritos...</span>
                    </div>
                  ) : favoriteProducts.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 px-1">
                      {favoriteProducts.map(product => renderProductCard(product, 'fav', false))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 px-3">Algunos favoritos ya no están disponibles</p>
                  )}
                </div>
              )}

              {/* Búsquedas recientes */}
              {recentSearches.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-3 py-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Búsquedas recientes
                    </p>
                    <button
                      onClick={clearAllRecent}
                      className="text-[10px] text-gray-400 hover:text-amber-600 cursor-pointer transition-colors"
                    >
                      Borrar todo
                    </button>
                  </div>
                  {recentSearches.map((recent, idx) => (
                    <button
                      key={`${recent.label}-${recent.timestamp}`}
                      onClick={() => {
                        setQuery(recent.query);
                        inputRef.current?.focus();
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition-all cursor-pointer text-left group shadow-sm"
                    >
                      <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400 group-hover:bg-amber-100 group-hover:text-amber-500 transition-colors flex-shrink-0">
                        <i className="ri-time-line text-sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{recent.label}</p>
                        {recent.qty > 1 && (
                          <p className="text-[10px] text-gray-400">Cantidad: {recent.qty}</p>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRecentSearch(idx);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <i className="ri-close-line text-sm" />
                      </button>
                    </button>
                  ))}
                </div>
              )}

              {/* Productos más pedidos */}
              {popularLoading ? (
                <div className="px-3 py-2 flex items-center gap-2 text-gray-400">
                  <i className="ri-loader-4-line animate-spin text-sm" />
                  <span className="text-xs">Cargando favoritos...</span>
                </div>
              ) : popularProducts.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-1">
                    <i className="ri-fire-line text-amber-500 text-sm" />
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Más pedidos
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 px-1">
                    {popularProducts.map(product => renderProductCard(product, 'popular', true))}
                  </div>
                </div>
              ) : null}

              {/* Estado vacío cuando no hay nada */}
              {recentSearches.length === 0 && popularProducts.length === 0 && favorites.length === 0 && !popularLoading && (
                <div className="py-8 text-center">
                  <div className="w-14 h-14 flex items-center justify-center bg-amber-50 rounded-full mx-auto mb-2">
                    <i className="ri-keyboard-line text-amber-400 text-2xl" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium">Empezá a escribir para buscar</p>
                  <p className="text-gray-400 text-xs mt-1">
                    Tip: escribí <strong>"5 alitas"</strong> para agregar 5 de una
                  </p>
                </div>
              )}
            </div>
          )}

          {results.length > 0 && (
            <div className="py-2 space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 py-1">
                {results.length} producto{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
                {detectedQty ? ` · cantidad: ${detectedQty}` : ''}
              </p>
              {results.map(product => {
                const selected = isSelected(product.id);
                const quickItem = quickItems.find(i => i.product.id === product.id);
                const price = getFinalPrice(product);
                const hasDiscount = product.discount_enabled && product.discount_price != null && product.discount_price < product.price;
                const img = Array.isArray(product.media) && product.media.length > 0
                  ? product.media[0].url
                  : 'https://readdy.ai/api/search-image?query=aesthetic%20minimal%20food%20placeholder%20icon%20on%20clean%20white%20background%20simple%20line%20art%20style%20orange%20accent&width=200&height=200&seq=quickorder';
                const wasAdded = addedIds.has(`${product.id}-${quickItem?.quantity ?? 1}`);
                const fav = isFavorite(product.id);

                return (
                  <div
                    key={product.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all shadow-sm ${
                      wasAdded
                        ? 'bg-green-100 border border-green-300'
                        : selected
                          ? 'bg-amber-50 border border-amber-300'
                          : 'bg-gray-50 border border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {/* Imagen */}
                    <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 relative">
                      <img src={img} alt={product.name} title={product.name} loading="lazy" decoding="async" className="w-full h-full object-cover object-top" />
                      <button
                        onClick={() => toggleFavorite(product.id)}
                        className={`absolute bottom-0.5 right-0.5 w-5 h-5 flex items-center justify-center rounded-full cursor-pointer transition-all ${
                          fav ? 'bg-red-50 text-red-500' : 'bg-amber-100 text-amber-500 hover:text-red-400'
                        }`}
                        title={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                      >
                        <i className={`${fav ? 'ri-heart-fill' : 'ri-heart-line'} text-[10px]`} />
                      </button>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{product.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-black text-gray-900">${price.toFixed(2)}</span>
                        {hasDiscount && product.price > 0 && (
                          <span className="text-xs text-gray-400 line-through">${product.price.toFixed(2)}</span>
                        )}
                        {product.product_categories?.name && (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            {product.product_categories.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Cantidad o Botón */}
                    {selected && quickItem ? (
                      <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-1 py-1 shadow-sm">
                        <button
                          onClick={() => updateQty(product.id, -1)}
                          className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer transition-colors"
                        >
                          <i className="ri-subtract-line text-xs" />
                        </button>
                        <span className="text-sm font-bold text-gray-900 w-5 text-center">{quickItem.quantity}</span>
                        <button
                          onClick={() => updateQty(product.id, 1)}
                          className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer transition-colors"
                        >
                          <i className="ri-add-line text-xs" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => toggleQuickItem(product)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-amber-500 hover:text-white cursor-pointer transition-all active:scale-90 shadow-sm"
                        title={detectedQty ? `Agregar ${detectedQty}` : 'Agregar'}
                      >
                        <i className="ri-add-line text-lg" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pedido libre */}
          <div className="px-3 py-4">
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center gap-2 mb-2">
                <i className="ri-edit-line text-gray-400 text-sm" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">¿Algo que no está en el menú?</p>
              </div>
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="Ej: 5 alitas BBQ, 2 cervezas bien frías, sin hielo..."
                maxLength={200}
                rows={2}
                className="w-full bg-gray-50 rounded-xl px-3.5 py-3 text-sm text-gray-900 placeholder-gray-400 border border-gray-200 focus:border-amber-400 focus:bg-white focus:outline-none resize-none transition-all"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{freeText.length}/200</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500">
                {quickItems.length > 0 && `${quickItems.reduce((s, i) => s + i.quantity, 0)} producto${quickItems.reduce((s, i) => s + i.quantity, 0) !== 1 ? 's' : ''}`}
                {quickItems.length > 0 && freeText.trim() && ' + '}
                {freeText.trim() && 'nota libre'}
                {quickItems.length === 0 && !freeText.trim() && 'Nada seleccionado'}
              </p>
              {totalSelected > 0 && (
                <p className="text-sm font-black text-gray-900">Total: ${totalSelected.toFixed(2)}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-200 cursor-pointer transition-colors whitespace-nowrap"
            >
              Cancelar
            </button>
          </div>
          <button
            onClick={handleAddAll}
            disabled={!hasSelection}
            className={`w-full py-3.5 rounded-xl text-sm font-black flex items-center justify-center gap-2 cursor-pointer transition-all whitespace-nowrap active:scale-[0.98] ${
              hasSelection
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <i className={addedIds.size > 0 ? 'ri-check-line text-lg' : 'ri-shopping-cart-line text-lg'} />
            {addedIds.size > 0 ? '¡Agregado!' : 'Agregar al carrito'}
          </button>
        </div>
      </div>
    </div>
  );
}