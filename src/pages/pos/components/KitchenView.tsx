import { useState, useEffect, useCallback, useRef } from 'react';
import { supabasePos } from '../supabasePos';
import { detectExtras } from '../utils/extrasPrice';
import { sendPushNotification } from '@/hooks/usePushNotifications';
import { isBarItem } from '../utils/isBarItem';

interface KitchenViewProps {
  onBack: () => void;
}

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
  customer_phone?: string;
  zona?: string;
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

export default function KitchenView({ onBack }: KitchenViewProps) {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [lastCount, setLastCount] = useState(0);
  const [onlySpecial, setOnlySpecial] = useState(false);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [stationFilter, setStationFilter] = useState<'all' | 'kitchen' | 'bar'>('all');
  const [completionToasts, setCompletionToasts] = useState<Array<{ id: string; accountId: number; spot: string; accountName: string }>>([]);
  const [markingCustomerDelivered, setMarkingCustomerDelivered] = useState<Set<number>>(new Set());
  const notifiedAccountsRef = useRef<Set<number>>(new Set());
  const isFirstMountRef = useRef(true);
  const audioRef = useRef<AudioContext | null>(null);
  const prevOrderIdsRef = useRef<Set<number>>(new Set());
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  // Beep para nuevas comandas
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

  const playCompletionSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.15 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.5);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.5);
      });
    } catch {
      // Audio not available
    }
  }, []);

  const buildOrders = useCallback((rawAccounts: {
    id: number;
    area: string;
    spot: string;
    customer_name?: string;
    customer_phone?: string;
    zona?: string;
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
          customer_phone: account.customer_phone,
          zona: account.zona,
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
        setOrders(prev => built.map(o => ({
          ...o,
          isNew: !prev.find(p => p.id === o.id),
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
    setLastCount(built.length);
    setLoading(false);
  }, [buildOrders, playBeep]);

  useEffect(() => {
    fetchOrders();
    let channel: ReturnType<typeof supabasePos.channel> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;

    const setupChannel = () => {
      if (channel) {
        try { supabasePos.removeChannel(channel); } catch { /* ignore */ }
        channel = null;
      }
      const ch = supabasePos
        .channel('kitchen-view')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_accounts' }, fetchOrders)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_account_items' }, fetchOrders)
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            retries = 0;
            setIsRealtimeConnected(true);
          } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            channel = null;
            setIsRealtimeConnected(false);
            if (retries < 10) {
              retries += 1;
              const delay = Math.min(2000 * retries, 15000);
              retryTimer = setTimeout(setupChannel, delay);
            }
          }
        });
      channel = ch;
    };

    setupChannel();
    // Polling fallback cada 8s para cocina
    const pollInterval = setInterval(fetchOrders, 8_000);
    return () => {
      if (channel) { try { supabasePos.removeChannel(channel); } catch { /* ignore */ } }
      if (retryTimer) clearTimeout(retryTimer);
      clearInterval(pollInterval);
    };
  }, [fetchOrders]);

  // Toggle delivered en la BD — persiste aunque recargue
  const toggleItem = useCallback(async (item: KitchenItem) => {
    if (togglingIds.has(item.id)) return;
    setTogglingIds(prev => new Set(prev).add(item.id));

    // Optimista: actualizar local inmediatamente
    setOrders(prev => prev.map(order => ({
      ...order,
      items: order.items.map(i =>
        i.id === item.id ? { ...i, delivered: !i.delivered } : i
      ),
    })));

    await supabasePos
      .from('pos_account_items')
      .update({ delivered: !item.delivered })
      .eq('id', item.id);

    setTogglingIds(prev => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  }, [togglingIds]);

  // Marcar toda la comanda como lista o pendiente
  const toggleOrder = useCallback(async (order: KitchenOrder) => {
    const allDone = order.items.every(i => i.delivered);
    const newDelivered = !allDone;
    const ids = order.items.map(i => i.id);

    // Optimista
    setOrders(prev => prev.map(o =>
      o.id === order.id
        ? { ...o, items: o.items.map(i => ({ ...i, delivered: newDelivered })) }
        : o
    ));

    await supabasePos
      .from('pos_account_items')
      .update({ delivered: newDelivered })
      .in('id', ids);

    if (newDelivered) {
      const accountId = Math.floor(order.id / 1000);
      const itemsList = order.items.map(i => `${i.quantity}x ${i.product_name}`).join(', ');
      sendPushNotification(
        accountId,
        '¡Tu pedido está listo! 🍗',
        `Ronda #${String(order.folio_number).padStart(2, '0')} lista en tu mesa ${order.spot}: ${itemsList}`,
        { tag: `delivered-${accountId}-${order.folio_number}`, data: { url: `/cuenta?id=${accountId}` } }
      ).catch(() => {});
    }
  }, []);

  // Marcar una comanda completa como entregada al cliente desde la cocina
  const handleCustomerDelivered = useCallback(async (order: KitchenOrder) => {
    const orderKey = order.id;
    if (markingCustomerDelivered.has(orderKey)) return;
    setMarkingCustomerDelivered(prev => new Set(prev).add(orderKey));
    const ids = order.items.filter(i => !i.customer_delivered).map(i => i.id);
    if (ids.length === 0) {
      setMarkingCustomerDelivered(prev => { const n = new Set(prev); n.delete(orderKey); return n; });
      return;
    }
    const { error } = await supabasePos
      .from('pos_account_items')
      .update({ customer_delivered: true })
      .in('id', ids);
    if (error) {
      console.error('Error marcando entregado al cliente:', error);
      alert('No se pudo marcar como entregado. Intenta de nuevo.\n\nError: ' + error.message);
      setMarkingCustomerDelivered(prev => { const n = new Set(prev); n.delete(orderKey); return n; });
      return;
    }
    await supabasePos.from('pos_account_events').insert({
      account_id: Math.floor(order.id / 1000),
      event_type: 'ronda_delivered',
      description: `Ronda #${String(order.folio_number).padStart(2, '0')} entregada al cliente (desde cocina)`,
      metadata: { folio_number: order.folio_number, item_ids: ids, source: 'kitchen_view' },
    });
    setMarkingCustomerDelivered(prev => { const n = new Set(prev); n.delete(orderKey); return n; });
    fetchOrders();
  }, [fetchOrders, markingCustomerDelivered]);

  const allItemsDone = (order: KitchenOrder) =>
    order.items.length > 0 && order.items.every(i => i.delivered);

  // Detectar cuentas que acaban de quedar 100% entregadas (sonido + toast)
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      orders.forEach(order => {
        const accountId = Math.floor(order.id / 1000);
        const accountOrders = orders.filter(o => Math.floor(o.id / 1000) === accountId);
        const allItems = accountOrders.flatMap(o => o.items);
        if (allItems.length > 0 && allItems.every(i => i.delivered)) {
          notifiedAccountsRef.current.add(accountId);
        }
      });
      return;
    }

    const currentAccountIds = new Set<number>();
    orders.forEach(order => {
      const accountId = Math.floor(order.id / 1000);
      if (currentAccountIds.has(accountId)) return;
      currentAccountIds.add(accountId);

      const accountOrders = orders.filter(o => Math.floor(o.id / 1000) === accountId);
      const allItems = accountOrders.flatMap(o => o.items);
      const allDelivered = allItems.length > 0 && allItems.every(i => i.delivered);

      if (allDelivered && !notifiedAccountsRef.current.has(accountId)) {
        notifiedAccountsRef.current.add(accountId);
        playCompletionSound();
        const spot = order.spot;
        const accountName = order.customer_name || spot || 'Mesa';
        setCompletionToasts(prev => [...prev, { id: `toast-${accountId}-${Date.now()}`, accountId, spot, accountName }]);

        const itemsList = allItems.slice(0, 5).map(i => `${i.quantity}x ${i.product_name}`).join(', ');
        const more = allItems.length > 5 ? ` y ${allItems.length - 5} más` : '';
        sendPushNotification(
          accountId,
          '¡Todo servido! 🎉',
          `Tu mesa ${spot} tiene todo entregado: ${itemsList}${more}`,
          { tag: `all-delivered-${accountId}`, data: { url: `/cuenta?id=${accountId}` } }
        ).catch(() => {});

        setTimeout(() => {
          setCompletionToasts(prev => prev.filter(t => t.accountId !== accountId));
        }, 6000);
      } else if (!allDelivered && notifiedAccountsRef.current.has(accountId)) {
        notifiedAccountsRef.current.delete(accountId);
      }
    });
  }, [orders, playCompletionSound]);

  const hasSpecialItems = (o: KitchenOrder) => o.items.some(i => i.notes && i.notes.trim());

  const filterItemsByStation = (items: KitchenItem[]) => {
    if (stationFilter === 'all') return items;
    if (stationFilter === 'bar') return items.filter(i => isBarItem(i.product_name));
    return items.filter(i => !isBarItem(i.product_name));
  };

  const pendingOrders = orders.filter(o => !allItemsDone(o)).map(o => ({
    ...o,
    items: filterItemsByStation(o.items),
  })).filter(o => o.items.length > 0);

  const completedOrders = orders.filter(o => allItemsDone(o) && o.items.length > 0).map(o => ({
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
  const visibleCompleted = applyFilters(completedOrders);

  const getStationCounts = () => {
    const allItems = orders.flatMap(o => o.items);
    return {
      kitchen: allItems.filter(i => !isBarItem(i.product_name)).length,
      bar: allItems.filter(i => isBarItem(i.product_name)).length,
    };
  };
  const stationCounts = getStationCounts();

  const getElapsed = (createdAt: string) => {
    const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}min`;
  };

  const getElapsedColor = (createdAt: string) => {
    const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (mins < 5) return 'text-green-600 bg-green-50';
    if (mins < 10) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const renderItem = (item: KitchenItem) => {
    const isToggling = togglingIds.has(item.id);
    return (
      <button
        key={item.id}
        onClick={() => toggleItem(item)}
        disabled={isToggling}
        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all text-left ${
          item.delivered
            ? 'bg-green-900/30 border-green-700/50'
            : 'bg-gray-800 border-gray-700 hover:border-gray-500'
        }`}
      >
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
          isToggling
            ? 'border-gray-500'
            : item.delivered
              ? 'bg-green-500 border-green-500'
              : 'border-gray-500'
        }`}>
          {isToggling
            ? <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
            : item.delivered && <i className="ri-check-line text-white text-xs" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold leading-tight ${
            item.delivered ? 'line-through text-gray-500' : 'text-white'
          }`}>
            {item.product_name}
          </p>
          {item.size && (
            <p className="text-xs text-gray-400 mt-0.5">{item.size}</p>
          )}
          {item.notes && (
            <p className={`text-xs mt-1 font-medium flex items-start gap-1 ${
              item.delivered ? 'text-gray-600' : 'text-amber-400'
            }`}>
              <i className="ri-sticky-note-line flex-shrink-0 mt-0.5" />
              {item.notes}
            </p>
          )}
          {/* Badges de extras con cobro */}
          {(() => {
            const extras = detectExtras(item.notes ?? item.size ?? '');
            if (extras.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {extras.map((ex, idx) => (
                  <span key={idx} className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 whitespace-nowrap">
                    +{ex.label} ${ex.price}
                  </span>
                ))}
              </div>
            );
          })()}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {item.origin === 'web' && (
            <span className="text-xs bg-green-800 text-green-300 px-1.5 py-0.5 rounded font-bold">
              WEB
            </span>
          )}
          <span className={`text-lg font-bold ${item.delivered ? 'text-gray-600' : 'text-amber-400'}`}>
            ×{item.quantity}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 flex-wrap">
        {/* Botón Panel Principal — grande e imposible de no ver */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white px-5 py-2.5 rounded-xl text-sm font-black cursor-pointer transition-all whitespace-nowrap border-2 border-amber-400"
        >
          <i className="ri-arrow-left-line text-base" />
          <i className="ri-layout-grid-line text-base" />
          Panel Principal
        </button>

        <div className="flex items-center gap-2 ml-1">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <i className="ri-fire-line text-white text-sm" />
          </div>
          <div>
            <h2 className="font-bold text-white text-sm">Pantalla de Cocina</h2>
            <p className="text-gray-400 text-xs">
              {pendingOrders.length} comanda{pendingOrders.length !== 1 ? 's' : ''} pendiente{pendingOrders.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Filtros de área */}
        <div className="flex items-center gap-1">
          {(['principal', 'af1', 'af2', 'llevar'] as const).map(area => {
            const areaCounts = {
              principal: pendingOrders.filter(o => o.area === 'principal').length,
              af1: pendingOrders.filter(o => o.area === 'af1').length,
              af2: pendingOrders.filter(o => o.area === 'af2').length,
              llevar: pendingOrders.filter(o => o.area === 'llevar').length,
            };
            const isActive = areaFilter === area;
            const colorMap: Record<string, string> = {
              principal: isActive ? 'bg-amber-500 border-amber-500 text-white' : 'bg-gray-800 border-gray-700 hover:border-amber-400 text-gray-400 hover:text-amber-300',
              af1: isActive ? 'bg-orange-500 border-orange-500 text-white' : 'bg-gray-800 border-gray-700 hover:border-orange-400 text-gray-400 hover:text-orange-300',
              af2: isActive ? 'bg-rose-500 border-rose-500 text-white' : 'bg-gray-800 border-gray-700 hover:border-rose-400 text-gray-400 hover:text-rose-300',
              llevar: isActive ? 'bg-green-600 border-green-600 text-white' : 'bg-gray-800 border-gray-700 hover:border-green-500 text-gray-400 hover:text-green-300',
            };
            const badgeMap: Record<string, string> = {
              principal: isActive ? 'bg-white/25 text-white' : 'bg-amber-500/20 text-amber-400',
              af1: isActive ? 'bg-white/25 text-white' : 'bg-orange-500/20 text-orange-400',
              af2: isActive ? 'bg-white/25 text-white' : 'bg-rose-500/20 text-rose-400',
              llevar: isActive ? 'bg-white/25 text-white' : 'bg-green-500/20 text-green-400',
            };
            return (
              <button
                key={area}
                onClick={() => setAreaFilter(prev => prev === area ? null : area)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all whitespace-nowrap border ${colorMap[area]}`}
              >
                {AREA_LABELS[area]}
                {areaCounts[area] > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${badgeMap[area]}`}>
                    {areaCounts[area]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Filtro especiales */}
        <button
          onClick={() => setOnlySpecial(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap border ${
            onlySpecial
              ? 'bg-yellow-400 border-yellow-400 text-yellow-900'
              : 'bg-gray-800 border-gray-700 hover:border-yellow-500 text-gray-400 hover:text-yellow-400'
          }`}
        >
          <i className="ri-sticky-note-line" />
          Solo especiales
          {specialCount > 0 && (
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${
              onlySpecial ? 'bg-yellow-900/30 text-yellow-900' : 'bg-yellow-400 text-yellow-900'
            }`}>
              {specialCount}
            </span>
          )}
        </button>

        {/* Filtro estación: Barra / Cocina */}
        <div className="flex items-center gap-1 bg-gray-800/50 rounded-xl p-1 border border-gray-700">
          {(['all', 'kitchen', 'bar'] as const).map(st => {
            const isActive = stationFilter === st;
            const labels: Record<string, string> = {
              all: 'Todo',
              kitchen: 'Cocina',
              bar: 'Barra',
            };
            const counts: Record<string, number> = {
              all: stationCounts.kitchen + stationCounts.bar,
              kitchen: stationCounts.kitchen,
              bar: stationCounts.bar,
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
                  isActive ? activeClass : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <i className={
                  st === 'kitchen' ? 'ri-restaurant-line' : st === 'bar' ? 'ri-goblet-line' : 'ri-apps-line'
                } />
                {labels[st]}
                {counts[st] > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${
                    isActive ? 'bg-white/25 text-white' : 'bg-gray-700 text-gray-400'
                  }`}>
                    {counts[st]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* Stats rápidas */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-orange-500/20 border border-orange-500/30 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            <span className="text-orange-300 text-xs font-bold">{stationCounts.kitchen} cocina</span>
          </div>
          <div className="flex items-center gap-1.5 bg-sky-500/20 border border-sky-500/30 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <span className="text-sky-300 text-xs font-bold">{stationCounts.bar} barra</span>
          </div>
          <div className="flex items-center gap-1.5 bg-green-500/20 border border-green-500/30 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-green-300 text-xs font-bold">{completedOrders.length} listos</span>
          </div>
        </div>

        {/* Live indicator */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${isRealtimeConnected ? 'bg-green-900/50 border-green-700' : 'bg-amber-900/50 border-amber-700'}`}>
          <span className={`w-2 h-2 rounded-full ${isRealtimeConnected ? 'bg-green-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
          <span className={`text-xs font-semibold ${isRealtimeConnected ? 'text-green-400' : 'text-amber-400'}`}>
            {isRealtimeConnected ? 'Realtime' : 'Polling'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : onlySpecial && specialCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <i className="ri-sticky-note-line text-4xl text-yellow-600" />
            </div>
            <p className="text-gray-400 text-lg font-semibold">Sin comandas especiales</p>
            <p className="text-gray-500 text-sm mt-1">Todas las comandas activas son estándar</p>
            <button
              onClick={() => setOnlySpecial(false)}
              className="mt-4 text-sm text-amber-500 hover:text-amber-400 font-semibold cursor-pointer underline"
            >
              Ver todas las comandas
            </button>
          </div>
        ) : pendingOrders.length === 0 && completedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <i className="ri-restaurant-line text-4xl text-gray-600" />
            </div>
            <p className="text-gray-400 text-lg font-semibold">Sin comandas pendientes</p>
            <p className="text-gray-600 text-sm mt-1">Las nuevas comandas aparecerán aquí automáticamente</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pending orders */}
            {visiblePending.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <i className="ri-fire-line text-orange-400" />
                  <h3 className="text-orange-400 font-bold text-sm uppercase tracking-widest">
                    Pendientes ({visiblePending.length}{onlySpecial && pendingOrders.length !== visiblePending.length ? ` de ${pendingOrders.length}` : ''})
                  </h3>
                  {onlySpecial && (
                    <span className="text-xs bg-yellow-400/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full font-semibold">
                      Solo especiales
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {visiblePending.map(order => {
                    const doneCount = order.items.filter(i => i.delivered).length;
                    const totalCount = order.items.length;
                    const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

                    return (
                      <div
                        key={order.id}
                        className={`bg-gray-900 rounded-2xl border overflow-hidden transition-all ${
                          order.isNew
                            ? 'border-green-500 shadow-lg shadow-green-500/20 animate-pulse'
                            : 'border-gray-700'
                        }`}
                      >
                        {/* Order header */}
                        <div className={`px-4 pt-3 pb-2.5 ${AREA_COLORS[order.area] ?? 'bg-gray-700'}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0 pr-2">
                              {/* Nombre del cliente como título principal */}
                              <p className="font-black text-white text-base leading-tight truncate">
                                {order.customer_name || order.spot || 'Cliente'}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <p className="text-white/70 text-xs">
                                  {AREA_LABELS[order.area] ?? order.area}
                                </p>
                                {order.zona && (
                                  <span className="text-xs bg-white/20 text-white px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                                    <i className="ri-map-pin-2-line text-[10px]" />
                                    {order.zona}
                                  </span>
                                )}
                                {order.customer_phone && (
                                  <p className="text-white/60 text-xs flex items-center gap-0.5">
                                    <i className="ri-phone-line text-[10px]" />
                                    {order.customer_phone}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                              <div className={`text-xs font-bold px-2 py-1 rounded-full ${getElapsedColor(order.created_at)}`}>
                                {getElapsed(order.created_at)}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-white/60 text-xs">
                                  #{String(order.folio_number).padStart(2, '0')}
                                </p>
                                {(() => {
                                  const noteCount = order.items.filter(i => i.notes && i.notes.trim()).length;
                                  return noteCount > 0 ? (
                                    <span className="flex items-center gap-0.5 bg-yellow-400 text-yellow-900 text-xs font-black px-1.5 py-0.5 rounded-full leading-none">
                                      <i className="ri-sticky-note-line text-[10px]" />
                                      {noteCount}
                                    </span>
                                  ) : null;
                                })()}
                              </div>
                            </div>
                          </div>
                          {/* Contador de ítems prominente */}
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 bg-black/25 rounded-lg px-2.5 py-1">
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

                        {/* Items — cada uno persiste en BD */}
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
                                    <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Cocina</span>
                                    <div className="flex-1 h-px bg-orange-500/20" />
                                  </div>
                                  <div className="space-y-2">
                                    {order.items.filter(i => !isBarItem(i.product_name)).map(item => renderItem(item))}
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
                                    <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">Barra</span>
                                    <div className="flex-1 h-px bg-sky-500/20" />
                                  </div>
                                  <div className="space-y-2">
                                    {order.items.filter(i => isBarItem(i.product_name)).map(item => renderItem(item))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                          {stationFilter !== 'all' && (
                            <div className="space-y-2">
                              {order.items.map(item => renderItem(item))}
                            </div>
                          )}
                        </div>

                        {/* Progress bar + botón "Todo listo" */}
                        <div className="px-3 pb-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 tabular-nums flex-shrink-0">
                              {doneCount}/{totalCount}
                            </span>
                          </div>
                          <button
                            onClick={() => toggleOrder(order)}
                            className="w-full py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors whitespace-nowrap border border-gray-600 text-gray-400 hover:border-amber-500 hover:text-amber-400"
                          >
                            <i className="ri-check-double-line mr-1" />
                            Marcar todo como listo
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Completed orders — permanecen hasta entregado al cliente */}
            {visibleCompleted.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <i className="ri-check-double-line text-green-400" />
                  <h3 className="text-green-400 font-bold text-sm uppercase tracking-widest">
                    Listos para Entregar ({visibleCompleted.length}{onlySpecial && completedOrders.length !== visibleCompleted.length ? ` de ${completedOrders.length}` : ''})
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {visibleCompleted.map(order => (
                    <div
                      key={order.id}
                      className="bg-gray-900/50 rounded-2xl border border-green-800/40 overflow-hidden"
                    >
                      <div className="px-4 py-3 bg-green-900/40 flex items-center justify-between">
                        <div className="flex-1 min-w-0 pr-2">
                          {/* Nombre del cliente como título principal */}
                          <p className="font-bold text-green-300 text-sm truncate">
                            {order.customer_name || order.spot || 'Cliente'}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <p className="text-green-400/60 text-xs">
                              {AREA_LABELS[order.area] ?? order.area}
                              {' · '}Comanda #{String(order.folio_number).padStart(2, '0')}
                            </p>
                            {order.zona && (
                              <span className="text-xs bg-green-800/60 text-green-300 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                                <i className="ri-map-pin-2-line text-[10px]" />
                                {order.zona}
                              </span>
                            )}
                          </div>
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
                          <div className="flex items-center gap-1 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                            <i className="ri-check-double-line" />
                            LISTO
                          </div>
                          <button
                            onClick={() => toggleOrder(order)}
                            className="text-xs text-green-700 hover:text-green-400 cursor-pointer transition-colors whitespace-nowrap"
                          >
                            Deshacer
                          </button>
                        </div>
                      </div>
                      <div className="p-3 space-y-1">
                        {order.items.map(item => (
                          <div key={item.id} className="text-sm text-gray-500">
                            <div className="flex items-center gap-2">
                              <i className="ri-check-line text-green-600 text-xs flex-shrink-0" />
                              <span className="line-through">{item.quantity}x {item.product_name}</span>
                              {item.origin === 'web' && (
                                <span className="text-xs bg-green-900 text-green-400 px-1 rounded font-bold">WEB</span>
                              )}
                            </div>
                            {item.notes && (
                              <p className="text-xs text-gray-600 ml-5 mt-0.5 flex items-start gap-1 line-through">
                                <i className="ri-sticky-note-line flex-shrink-0 mt-0.5" />
                                {item.notes}
                              </p>
                            )}
                            {/* Badges de extras con cobro (completados) */}
                            {(() => {
                              const extras = detectExtras(item.notes ?? item.size ?? '');
                              if (extras.length === 0) return null;
                              return (
                                <div className="flex flex-wrap gap-1 ml-5 mt-1">
                                  {extras.map((ex, idx) => (
                                    <span key={idx} className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 whitespace-nowrap">
                                      +{ex.label} ${ex.price}
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                      {/* Tiempo transcurrido desde que quedó listo */}
                      <div className="px-3 pb-3">
                        <div className="flex items-center justify-between bg-green-900/20 rounded-lg px-3 py-2 gap-2">
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <i className="ri-time-line text-green-500 text-xs" />
                            <span className="text-xs text-green-400 font-semibold whitespace-nowrap">
                              Esperando entrega desde hace {getElapsed(order.created_at)}
                            </span>
                          </div>
                          {markingCustomerDelivered.has(order.id) ? (
                            <span className="flex items-center gap-1 text-[10px] text-green-300 font-medium whitespace-nowrap">
                              <span className="w-3 h-3 border border-green-400 border-t-transparent rounded-full animate-spin" />
                              Marcando...
                            </span>
                          ) : (
                            <button
                              onClick={() => handleCustomerDelivered(order)}
                              className="flex items-center gap-1 bg-green-500 hover:bg-green-400 active:scale-95 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer transition-all whitespace-nowrap"
                            >
                              <i className="ri-user-received-2-line text-xs" />
                              Entregado al Cliente
                            </button>
                          )}
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

      {/* Botón inferior siempre visible para regresar */}
      <div className="bg-gray-900 border-t border-gray-800 px-4 py-3">
        <button
          onClick={onBack}
          className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white py-3 rounded-xl font-black text-sm cursor-pointer transition-all whitespace-nowrap"
        >
          <i className="ri-arrow-left-line" />
          Volver al Panel Principal
        </button>
      </div>

      {/* Toasts de cuenta completamente entregada */}
      {completionToasts.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
          {completionToasts.map(toast => (
            <div
              key={toast.id}
              className="pointer-events-auto bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg shadow-green-900/30 flex items-center gap-3 animate-bounce"
              style={{ animationDuration: '0.5s', animationIterationCount: '2' }}
            >
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <i className="ri-check-double-line text-xl" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">¡{toast.accountName} completamente servida!</p>
                <p className="text-xs text-green-100">Todos los pedidos han sido entregados</p>
              </div>
              <button
                onClick={() => setCompletionToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 cursor-pointer transition-colors flex-shrink-0"
              >
                <i className="ri-close-line" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}