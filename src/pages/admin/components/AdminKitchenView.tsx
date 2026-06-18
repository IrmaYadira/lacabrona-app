import { useState, useEffect, useCallback, useRef } from 'react';
import { supabasePos } from '@/pages/pos/supabasePos';
import { isBarItem } from '@/pages/pos/utils/isBarItem';

interface KitchenItem {
  id: number;
  product_name: string;
  quantity: number;
  size?: string;
  notes?: string;
  folio_number: number;
  created_at: string;
  delivered: boolean;
  customer_delivered?: boolean;
  origin?: string;
}

interface KitchenOrder {
  id: number;
  area: string;
  spot: string;
  customer_name?: string;
  folio_number: number;
  created_at: string;
  items: KitchenItem[];
  isNew?: boolean;
}

const AREA_LABELS: Record<string, string> = {
  principal: 'Principal',
  af1: 'AF1',
  af2: 'AF2',
  llevar: 'Para Llevar',
};

const AREA_COLORS: Record<string, string> = {
  principal: 'bg-amber-500',
  af1: 'bg-orange-500',
  af2: 'bg-rose-500',
  llevar: 'bg-green-500',
};

function getElapsed(createdAt: string) {
  const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}min`;
}

function getElapsedColor(createdAt: string) {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (mins < 5) return 'text-green-600 bg-green-50';
  if (mins < 10) return 'text-amber-600 bg-amber-50';
  return 'text-red-600 bg-red-50';
}

export default function AdminKitchenView() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [, setTick] = useState(0);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const [onlySpecial, setOnlySpecial] = useState(false);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [stationFilter, setStationFilter] = useState<'all' | 'kitchen' | 'bar'>('all');
  const prevOrderIdsRef = useRef<Set<number>>(new Set());
  const audioRef = useRef<AudioContext | null>(null);
  const prevCountRef = useRef(0);

  // Beep igual al POS kitchen
  const playBeep = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
      audioRef.current = ctx;
    } catch {
      // Audio not available
    }
  }, []);

  const buildOrders = useCallback((rawAccounts: {
    id: number;
    area: string;
    spot: string;
    customer_name?: string;
    folio_counter: number;
    created_at: string;
    pos_account_items: KitchenItem[];
  }[]): KitchenOrder[] => {
    const result: KitchenOrder[] = [];
    rawAccounts.forEach(account => {
      const folioMap: Record<number, KitchenItem[]> = {};
      (account.pos_account_items ?? [])
        .filter(item => !item.customer_delivered)
        .forEach(item => {
          const folio = item.folio_number ?? 1;
          if (!folioMap[folio]) folioMap[folio] = [];
          folioMap[folio].push(item);
        });
      Object.entries(folioMap).forEach(([folio, items]) => {
        if (items.length === 0) return;
        result.push({
          id: account.id * 1000 + Number(folio),
          area: account.area,
          spot: account.spot,
          customer_name: account.customer_name,
          folio_number: Number(folio),
          created_at: items[0]?.created_at ?? account.created_at,
          items,
        });
      });
    });
    return result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, []);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabasePos
      .from('pos_accounts')
      .select('*, pos_account_items(*)')
      .eq('status', 'open')
      .order('created_at', { ascending: true });

    const built = buildOrders((data ?? []) as Parameters<typeof buildOrders>[0]);
    const newIds = new Set(built.map(o => o.id));
    const isFirstLoad = prevOrderIdsRef.current.size === 0;

    if (!isFirstLoad) {
      const hasNew = built.some(o => !prevOrderIdsRef.current.has(o.id));
      if (hasNew) {
        playBeep();
        setNewOrderFlash(true);
        setTimeout(() => setNewOrderFlash(false), 4000);
        setOrders(built.map(o => ({
          ...o,
          isNew: !prevOrderIdsRef.current.has(o.id),
        })));
        setTimeout(() => {
          setOrders(prev => prev.map(o => ({ ...o, isNew: false })));
        }, 3000);
      } else {
        setOrders(built);
      }
    } else {
      setOrders(built);
    }

    prevOrderIdsRef.current = newIds;
    prevCountRef.current = built.length;
    setLastUpdated(new Date());
    setLoading(false);
  }, [buildOrders, playBeep]);

  useEffect(() => {
    fetchOrders();
    const channel = supabasePos
      .channel('admin-kitchen-view')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_accounts' }, fetchOrders)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_account_items' }, fetchOrders)
      .subscribe();
    // Reloj para actualizar tiempos en pantalla
    const ticker = setInterval(() => setTick(t => t + 1), 10000);
    return () => {
      supabasePos.removeChannel(channel);
      clearInterval(ticker);
    };
  }, [fetchOrders]);

  const hasSpecialItems = (o: KitchenOrder) => o.items.some(i => i.notes && i.notes.trim());

  const filterItemsByStation = (items: KitchenItem[]) => {
    if (stationFilter === 'all') return items;
    if (stationFilter === 'bar') return items.filter(i => isBarItem(i.product_name));
    return items.filter(i => !isBarItem(i.product_name));
  };

  const pendingOrders = orders.filter(o => !o.items.every(i => i.delivered) || o.items.length === 0).map(o => ({
    ...o,
    items: filterItemsByStation(o.items),
  })).filter(o => o.items.length > 0);

  const doneOrders = orders.filter(o => o.items.length > 0 && o.items.every(i => i.delivered)).map(o => ({
    ...o,
    items: filterItemsByStation(o.items),
  })).filter(o => o.items.length > 0);

  const specialCount = pendingOrders.filter(hasSpecialItems).length;

  const applyFilters = (list: KitchenOrder[]) => {
    let result = list;
    if (areaFilter) result = result.filter(o => o.area === areaFilter);
    if (onlySpecial) result = result.filter(hasSpecialItems);
    return result;
  };

  const visiblePending = applyFilters(pendingOrders);
  const visibleDone = applyFilters(doneOrders);

  const getStationCounts = () => {
    const allItems = orders.flatMap(o => o.items);
    return {
      kitchen: allItems.filter(i => !isBarItem(i.product_name)).length,
      bar: allItems.filter(i => isBarItem(i.product_name)).length,
    };
  };
  const stationCounts = getStationCounts();

  const totalPending = pendingOrders.reduce((s, o) => s + o.items.filter(i => !i.delivered).length, 0);
  const totalDone = doneOrders.reduce((s, o) => s + o.items.length, 0);

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Comandas Pendientes</p>
          <p className="text-2xl font-black text-orange-500 mt-0.5">{pendingOrders.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Ítems Cocina</p>
          <p className="text-2xl font-black text-orange-600 mt-0.5">{stationCounts.kitchen}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Ítems Barra</p>
          <p className="text-2xl font-black text-sky-600 mt-0.5">{stationCounts.bar}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Comandas Listas</p>
          <p className="text-2xl font-black text-green-600 mt-0.5">{doneOrders.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Ítems Listos</p>
          <p className="text-2xl font-black text-gray-700 mt-0.5">{totalDone}</p>
        </div>
      </div>

      {/* Banner informativo: solo lectura */}
      <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 flex items-center justify-center bg-sky-100 rounded-lg flex-shrink-0">
          <i className="ri-eye-line text-sky-600 text-base" />
        </div>
        <div>
          <p className="text-sm font-bold text-sky-800">Vista de monitoreo — Solo lectura</p>
          <p className="text-xs text-sky-600 mt-0.5">
            Para marcar comandas e ítems como entregados, usa la pantalla de <strong>Cocina en el POS</strong>. Las comandas listas permanecen hasta ser entregadas al cliente.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-gray-500">
              Actualizado {lastUpdated.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · En vivo
            </span>
          </div>
          {newOrderFlash && (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-300 text-orange-700 px-3 py-1.5 rounded-xl text-xs font-bold animate-pulse">
              <i className="ri-fire-line text-orange-500" />
              ¡Nueva comanda!
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtros de área */}
          <div className="flex items-center gap-1">
            {(['principal', 'af1', 'af2', 'llevar'] as const).map(area => {
              const counts = {
                principal: pendingOrders.filter(o => o.area === 'principal').length,
                af1: pendingOrders.filter(o => o.area === 'af1').length,
                af2: pendingOrders.filter(o => o.area === 'af2').length,
                llevar: pendingOrders.filter(o => o.area === 'llevar').length,
              };
              const isActive = areaFilter === area;
              const colorMap: Record<string, string> = {
                principal: isActive ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-gray-200 hover:border-amber-400 text-gray-500 hover:text-amber-600',
                af1: isActive ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-gray-200 hover:border-orange-400 text-gray-500 hover:text-orange-600',
                af2: isActive ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white border-gray-200 hover:border-rose-400 text-gray-500 hover:text-rose-600',
                llevar: isActive ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-200 hover:border-green-400 text-gray-500 hover:text-green-600',
              };
              const badgeMap: Record<string, string> = {
                principal: isActive ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-700',
                af1: isActive ? 'bg-white/25 text-white' : 'bg-orange-100 text-orange-700',
                af2: isActive ? 'bg-white/25 text-white' : 'bg-rose-100 text-rose-700',
                llevar: isActive ? 'bg-white/25 text-white' : 'bg-green-100 text-green-700',
              };
              return (
                <button
                  key={area}
                  onClick={() => setAreaFilter(prev => prev === area ? null : area)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all whitespace-nowrap border ${colorMap[area]}`}
                >
                  {AREA_LABELS[area]}
                  {counts[area] > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${badgeMap[area]}`}>
                      {counts[area]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="w-px h-5 bg-gray-200" />
          <button
            onClick={() => setOnlySpecial(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap border ${
              onlySpecial
                ? 'bg-yellow-400 border-yellow-400 text-yellow-900'
                : 'bg-white border-gray-200 hover:border-yellow-400 text-gray-500 hover:text-yellow-700'
            }`}
          >
            <i className="ri-sticky-note-line" />
            Solo especiales
            {specialCount > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${
                onlySpecial ? 'bg-yellow-900/20 text-yellow-900' : 'bg-yellow-400 text-yellow-900'
              }`}>
                {specialCount}
              </span>
            )}
          </button>
          {/* Filtro estación: Barra / Cocina */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 border border-gray-200">
            {(['all', 'kitchen', 'bar'] as const).map(st => {
              const isActive = stationFilter === st;
              const labels: Record<string, string> = {
                all: 'Todo',
                kitchen: 'Cocina',
                bar: 'Barra',
              };
              const activeClass = st === 'kitchen'
                ? 'bg-orange-500 text-white'
                : st === 'bar'
                  ? 'bg-sky-500 text-white'
                  : 'bg-gray-600 text-white';
              return (
                <button
                  key={st}
                  onClick={() => setStationFilter(st)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${
                    isActive ? activeClass : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <i className={
                    st === 'kitchen' ? 'ri-restaurant-line' : st === 'bar' ? 'ri-goblet-line' : 'ri-apps-line'
                  } />
                  {labels[st]}
                </button>
              );
            })}
          </div>
          <button
            onClick={fetchOrders}
            className="flex items-center gap-1.5 bg-white border border-gray-200 hover:border-amber-400 text-gray-600 hover:text-amber-600 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
          >
            <i className="ri-refresh-line" />
            Actualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center">
          <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
            <i className="ri-restaurant-line text-3xl text-gray-300" />
          </div>
          <p className="text-gray-500 font-semibold">Sin comandas activas en cocina</p>
          <p className="text-gray-400 text-sm mt-1">Cuando lleguen pedidos aparecerán aquí en tiempo real</p>
        </div>
      ) : onlySpecial && specialCount === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center">
          <div className="w-16 h-16 mx-auto mb-3 bg-yellow-50 rounded-full flex items-center justify-center">
            <i className="ri-sticky-note-line text-3xl text-yellow-400" />
          </div>
          <p className="text-gray-600 font-semibold">Sin comandas con ítems especiales</p>
          <p className="text-gray-400 text-sm mt-1">Todas las comandas activas son estándar</p>
          <button
            onClick={() => setOnlySpecial(false)}
            className="mt-4 text-xs text-amber-600 hover:text-amber-700 font-semibold cursor-pointer underline"
          >
            Ver todas las comandas
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pendientes */}
          {visiblePending.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-fire-line text-orange-500" />
                </div>
                <h3 className="text-orange-600 font-bold text-sm uppercase tracking-widest">
                  En Preparación ({visiblePending.length}{onlySpecial && pendingOrders.length !== visiblePending.length ? ` de ${pendingOrders.length}` : ''})
                </h3>
                {onlySpecial && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 border border-yellow-300 px-2 py-0.5 rounded-full font-semibold">
                    Filtro activo: solo especiales
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {visiblePending.map(order => {
                  const doneCount = order.items.filter(i => i.delivered).length;
                  const totalCount = order.items.length;
                  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
                  const noteCount = order.items.filter(i => i.notes && i.notes.trim()).length;

                  return (
                    <div
                      key={order.id}
                      className={`bg-white rounded-2xl border overflow-hidden transition-all ${
                        order.isNew
                          ? 'border-orange-400 shadow-lg shadow-orange-200 animate-pulse'
                          : 'border-gray-200'
                      }`}
                    >
                      {/* Header */}
                      <div className={`px-4 pt-3 pb-2.5 ${AREA_COLORS[order.area] ?? 'bg-gray-500'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-white text-sm leading-tight">
                              {order.area === 'llevar'
                                ? order.customer_name ?? 'Para Llevar'
                                : order.spot}
                            </p>
                            <p className="text-white/70 text-xs mt-0.5">
                              {AREA_LABELS[order.area] ?? order.area}
                              {order.area !== 'llevar' && order.customer_name && ` · ${order.customer_name}`}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <div className={`text-xs font-bold px-2 py-1 rounded-full ${getElapsedColor(order.created_at)}`}>
                              {getElapsed(order.created_at)}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-white/60 text-xs">
                                #{String(order.folio_number).padStart(2, '0')}
                              </p>
                              {noteCount > 0 && (
                                <span className="flex items-center gap-0.5 bg-yellow-400 text-yellow-900 text-xs font-black px-1.5 py-0.5 rounded-full leading-none">
                                  <i className="ri-sticky-note-line text-[10px]" />
                                  {noteCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Contador de ítems prominente */}
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 bg-white/25 rounded-lg px-2.5 py-1">
                            <i className="ri-list-check-2 text-white text-xs" />
                            <span className="text-white text-xs font-black tabular-nums">
                              {doneCount} de {totalCount} ítem{totalCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {doneCount > 0 && doneCount < totalCount && (
                            <span className="text-white/80 text-[10px] font-semibold">
                              Faltan {totalCount - doneCount}
                            </span>
                          )}
                          {doneCount === totalCount && totalCount > 0 && (
                            <span className="flex items-center gap-0.5 text-white text-[10px] font-black">
                              <i className="ri-check-double-line" />
                              Todo listo
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="px-3 pt-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 tabular-nums flex-shrink-0">
                            {doneCount}/{totalCount}
                          </span>
                        </div>
                      </div>

                      {/* Items — solo lectura, no clickables */}
                      <div className="p-3 space-y-2">
                        {stationFilter === 'all' && (
                          <>
                            {/* Grupo Cocina */}
                            {order.items.filter(i => !isBarItem(i.product_name)).length > 0 && (
                              <div className="mb-2">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <div className="w-4 h-4 bg-orange-500 rounded flex items-center justify-center">
                                    <i className="ri-restaurant-line text-white text-[10px]" />
                                  </div>
                                  <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Cocina</span>
                                  <div className="flex-1 h-px bg-orange-200" />
                                </div>
                                <div className="space-y-2">
                                  {order.items.filter(i => !isBarItem(i.product_name)).map(item => renderAdminItem(item))}
                                </div>
                              </div>
                            )}
                            {/* Grupo Barra */}
                            {order.items.filter(i => isBarItem(i.product_name)).length > 0 && (
                              <div>
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <div className="w-4 h-4 bg-sky-500 rounded flex items-center justify-center">
                                    <i className="ri-goblet-line text-white text-[10px]" />
                                  </div>
                                  <span className="text-[10px] font-bold text-sky-500 uppercase tracking-wider">Barra</span>
                                  <div className="flex-1 h-px bg-sky-200" />
                                </div>
                                <div className="space-y-2">
                                  {order.items.filter(i => isBarItem(i.product_name)).map(item => renderAdminItem(item))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        {stationFilter !== 'all' && (
                          <div className="space-y-2">
                            {order.items.map(item => renderAdminItem(item))}
                          </div>
                        )}
                      </div>

                      {/* Footer solo lectura */}
                      <div className="px-3 pb-3 pt-1">
                        <div className="w-full py-2 rounded-xl text-xs font-bold text-center border border-gray-200 text-gray-400 bg-gray-50">
                          <i className="ri-lock-line mr-1" />
                          Solo lectura — usa el POS para marcar entregado
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Listos */}
          {visibleDone.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-check-double-line text-green-600" />
                </div>
                <h3 className="text-green-600 font-bold text-sm uppercase tracking-widest">
                  Listos para Entregar ({visibleDone.length}{onlySpecial && doneOrders.length !== visibleDone.length ? ` de ${doneOrders.length}` : ''})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {visibleDone.map(order => (
                  <div
                    key={order.id}
                    className="bg-green-50 rounded-2xl border border-green-200 overflow-hidden"
                  >
                    <div className="px-4 py-3 bg-green-500 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-white text-sm">
                          {order.area === 'llevar'
                            ? order.customer_name ?? 'Para Llevar'
                            : order.spot}
                        </p>
                        <p className="text-white/70 text-xs">
                          {AREA_LABELS[order.area] ?? order.area}
                          {' · '}Comanda #{String(order.folio_number).padStart(2, '0')}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {(() => {
                          const noteCount = order.items.filter(i => i.notes && i.notes.trim()).length;
                          return noteCount > 0 ? (
                            <span className="flex items-center gap-0.5 bg-yellow-400 text-yellow-900 text-xs font-black px-1.5 py-0.5 rounded-full leading-none">
                              <i className="ri-sticky-note-line text-[10px]" />
                              {noteCount}
                            </span>
                          ) : null;
                        })()}
                        <div className="flex items-center gap-1 bg-white text-green-600 text-xs font-black px-2 py-1 rounded-full">
                          <i className="ri-check-double-line" />
                          LISTO
                        </div>
                      </div>
                    </div>
                    <div className="p-3 space-y-1">
                      {order.items.map(item => (
                        <div key={item.id} className="text-sm text-green-700">
                          <div className="flex items-center gap-2">
                            <i className="ri-check-line text-green-500 text-xs flex-shrink-0" />
                            <span>{item.quantity}x {item.product_name}</span>
                            {item.origin === 'web' && (
                              <span className="text-xs bg-green-200 text-green-700 px-1 rounded font-bold">WEB</span>
                            )}
                          </div>
                          {item.notes && (
                            <p className="text-xs text-green-600/70 ml-5 mt-0.5 flex items-start gap-1">
                              <i className="ri-sticky-note-line flex-shrink-0 mt-0.5" />
                              {item.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="px-3 pb-3">
                      <div className="flex items-center gap-1.5 bg-green-100 rounded-lg px-3 py-2">
                        <i className="ri-time-line text-green-600 text-xs" />
                        <span className="text-xs text-green-700 font-semibold">
                          Esperando entrega desde hace {getElapsed(order.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function renderAdminItem(item: KitchenItem) {
  return (
    <div
      key={item.id}
      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
        item.delivered
          ? 'bg-green-50 border-green-200'
          : 'bg-gray-50 border-gray-200'
      }`}
    >
      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
        item.delivered
          ? 'bg-green-500 border-green-500'
          : 'border-gray-300'
      }`}>
        {item.delivered && <i className="ri-check-line text-white text-xs" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-tight ${
          item.delivered ? 'line-through text-gray-400' : 'text-gray-800'
        }`}>
          {item.product_name}
        </p>
        {item.size && (
          <p className="text-xs text-gray-400 mt-0.5">{item.size}</p>
        )}
        {item.notes && (
          <p className={`text-xs mt-1 font-medium flex items-start gap-1 ${
            item.delivered ? 'text-gray-300' : 'text-amber-700'
          }`}>
            <i className="ri-sticky-note-line flex-shrink-0 mt-0.5" />
            {item.notes}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {item.origin === 'web' && (
          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">
            WEB
          </span>
        )}
        <span className={`text-lg font-bold ${item.delivered ? 'text-gray-300' : 'text-amber-500'}`}>
          ×{item.quantity}
        </span>
      </div>
    </div>
  );
}