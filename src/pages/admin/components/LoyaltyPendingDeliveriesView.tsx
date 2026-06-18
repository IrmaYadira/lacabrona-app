import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface PendingRedemption {
  id: number;
  customer_id: number;
  tier_label: string;
  tier_emoji: string;
  points_redeemed: number;
  items_description: string;
  redeemed_by: string;
  notes: string | null;
  created_at: string;
  delivered: boolean;
}

interface CustomerInfo {
  id: number;
  name: string;
  phone: string | null;
}

export default function LoyaltyPendingDeliveriesView() {
  const [pendings, setPendings] = useState<PendingRedemption[]>([]);
  const [customers, setCustomers] = useState<Record<number, CustomerInfo>>();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'all'>('all');
  const [markingId, setMarkingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);

    let dateFilter: string | null = null;
    if (dateRange !== 'all') {
      const d = new Date();
      if (dateRange === 'today') d.setHours(0, 0, 0, 0);
      else d.setDate(d.getDate() - (dateRange === '7d' ? 7 : 30));
      dateFilter = d.toISOString();
    }

    const query = supabase
      .from('loyalty_redemptions')
      .select('*')
      .eq('delivered', false)
      .order('created_at', { ascending: false });

    if (dateFilter) query.gte('created_at', dateFilter);

    const { data: redData } = await query;

    const allCustomerIds = [...new Set((redData ?? []).map((r: PendingRedemption) => r.customer_id))];

    let custMap: Record<number, CustomerInfo> = {};
    if (allCustomerIds.length > 0) {
      const { data: custData } = await supabase
        .from('pos_customers')
        .select('id, name, phone')
        .in('id', allCustomerIds);
      (custData ?? []).forEach((c: CustomerInfo) => { custMap[c.id] = c; });
    }

    setPendings((redData ?? []) as PendingRedemption[]);
    setCustomers(custMap);
    setLoading(false);
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(() => { fetchData(); }, 10000);
    const channel = supabase
      .channel('loyalty-pending')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'loyalty_redemptions' }, () => fetchData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'loyalty_redemptions' }, () => fetchData())
      .subscribe();
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const markDelivered = async (id: number) => {
    setMarkingId(id);
    const { error } = await supabase
      .from('loyalty_redemptions')
      .update({ delivered: true, notes: 'Entregado desde panel de admin' })
      .eq('id', id);

    if (!error) {
      setPendings(prev => prev.filter(p => p.id !== id));
    }
    setMarkingId(null);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Hace un momento';
    if (mins < 60) return `Hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `Hace ${days}d`;
  };

  const filtered = pendings.filter(p => {
    const c = customers[p.customer_id];
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c?.name?.toLowerCase().includes(q) ||
      (c?.phone ?? '').includes(q) ||
      p.items_description.toLowerCase().includes(q) ||
      p.tier_label.toLowerCase().includes(q)
    );
  });

  const totalPending = pendings.length;
  const todayCount = pendings.filter(p => {
    const d = new Date(p.created_at);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { icon: 'ri-gift-line', label: 'Pendientes totales', value: totalPending, color: 'text-amber-400', bg: 'bg-amber-500/5' },
          { icon: 'ri-time-line', label: 'Hoy', value: todayCount, color: 'text-orange-400', bg: 'bg-orange-500/5' },
          { icon: 'ri-coins-line', label: 'Pts en canjes pend.', value: pendings.reduce((s, p) => s + p.points_redeemed, 0), color: 'text-red-400', bg: 'bg-red-500/5' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-xl p-4 border border-gray-800`}>
            <div className="flex items-center gap-2 mb-1">
              <i className={`${s.icon} ${s.color} text-sm`} />
              <p className="text-gray-500 text-xs">{s.label}</p>
            </div>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-40">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente, premio o item..."
            className="w-full pl-8 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500 placeholder:text-gray-600"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 cursor-pointer">
              <i className="ri-close-line text-sm" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
          {([
            { id: 'today', label: 'Hoy' },
            { id: '7d', label: '7 días' },
            { id: '30d', label: '30 días' },
            { id: 'all', label: 'Todo' },
          ] as const).map(d => (
            <button
              key={d.id}
              onClick={() => setDateRange(d.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
                dateRange === d.id ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <button
          onClick={fetchData}
          className="w-9 h-9 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
          title="Actualizar"
        >
          <i className="ri-refresh-line text-gray-400 text-sm" />
        </button>
      </div>

      <p className="text-xs text-gray-500 px-1">
        Mostrando {filtered.length} de {pendings.length} canje{pendings.length !== 1 ? 's' : ''} pendiente{pendings.length !== 1 ? 's' : ''} de entrega
      </p>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14 bg-gray-900 rounded-xl border border-gray-800">
          <i className="ri-checkbox-circle-line text-4xl text-green-600 mb-3 block" />
          <p className="text-gray-400 text-sm font-bold">¡Todo entregado!</p>
          <p className="text-gray-600 text-xs mt-1">No hay premios de lealtad pendientes de entrega</p>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 divide-y divide-gray-800">
          {filtered.map(p => {
            const c = customers[p.customer_id];
            return (
              <div key={p.id} className="px-4 py-4 flex items-start gap-3 hover:bg-gray-800/40 transition-colors">
                {/* Icono premio */}
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">{p.tier_emoji}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-white text-sm font-bold">{p.tier_label}</p>
                    <span className="text-xs font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">-{p.points_redeemed} pts</span>
                    <span className="text-xs font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                      Pendiente
                    </span>
                  </div>

                  <p className="text-white text-sm font-semibold mt-1">{p.items_description}</p>

                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <i className="ri-user-line" />
                      {c?.name ?? `Cliente #${p.customer_id}`}
                    </span>
                    {c?.phone && (
                      <span className="flex items-center gap-1">
                        <i className="ri-smartphone-line" />
                        {c.phone}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <i className="ri-time-line" />
                      {formatDate(p.created_at)}
                    </span>
                    <span className="flex items-center gap-1 text-orange-400">
                      <i className="ri-hourglass-line" />
                      {timeAgo(p.created_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="ri-user-settings-line" />
                      {p.redeemed_by}
                    </span>
                  </div>
                </div>

                {/* Botón marcar entregado */}
                <div className="flex-shrink-0">
                  <button
                    onClick={() => markDelivered(p.id)}
                    disabled={markingId === p.id}
                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black px-3 py-2 rounded-lg cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                  >
                    {markingId === p.id ? (
                      <>
                        <i className="ri-loader-4-line animate-spin text-sm" />
                        Marcando...
                      </>
                    ) : (
                      <>
                        <i className="ri-check-double-line text-sm" />
                        Entregado
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}