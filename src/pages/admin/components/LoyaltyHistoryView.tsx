import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface RedemptionRecord {
  id: number;
  customer_id: number;
  tier_label: string;
  tier_emoji: string;
  points_redeemed: number;
  items_description: string;
  redeemed_by: string;
  notes: string | null;
  created_at: string;
}

interface AdjustmentRecord {
  id: number;
  customer_id: number;
  delta: number;
  points_before: number;
  points_after: number;
  reason: string;
  adjusted_by: string;
  created_at: string;
}

interface CustomerName {
  id: number;
  name: string;
}

export default function LoyaltyHistoryView() {
  const [redemptions, setRedemptions] = useState<RedemptionRecord[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>([]);
  const [customers, setCustomers] = useState<Record<number, string>>();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todos' | 'canjes' | 'ajustes'>('todos');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  const fetchHistory = useCallback(async () => {
    setLoading(true);

    let dateFilter: string | null = null;
    if (dateRange !== 'all') {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const d = new Date();
      d.setDate(d.getDate() - days);
      dateFilter = d.toISOString();
    }

    const redQuery = supabase
      .from('loyalty_redemptions')
      .select('*')
      .order('created_at', { ascending: false });
    if (dateFilter) redQuery.gte('created_at', dateFilter);

    const adjQuery = supabase
      .from('loyalty_point_adjustments')
      .select('*')
      .order('created_at', { ascending: false });
    if (dateFilter) adjQuery.gte('created_at', dateFilter);

    const [{ data: redData }, { data: adjData }, { data: custData }] = await Promise.all([
      redQuery,
      adjQuery,
      supabase.from('pos_customers').select('id, name'),
    ]);

    setRedemptions((redData ?? []) as RedemptionRecord[]);
    setAdjustments((adjData ?? []) as AdjustmentRecord[]);

    const names: Record<number, string> = {};
    ((custData ?? []) as CustomerName[]).forEach(c => { names[c.id] = c.name; });
    setCustomers(names);
    setLoading(false);
  }, [dateRange]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    const interval = setInterval(() => { fetchHistory(); }, 10000);
    const channel = supabase
      .channel('loyalty-history')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'loyalty_redemptions' }, () => fetchHistory())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'loyalty_point_adjustments' }, () => fetchHistory())
      .subscribe();
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchHistory]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const allEvents = [
    ...redemptions.map(r => ({ type: 'canje' as const, date: r.created_at, data: r })),
    ...adjustments.map(a => ({ type: 'ajuste' as const, date: a.created_at, data: a })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filtered = allEvents.filter(e => {
    const matchType = filter === 'todos' || e.type === filter;
    const custName = customers[(e.data as RedemptionRecord | AdjustmentRecord).customer_id] ?? '';
    const matchSearch = !search.trim() || custName.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const totalRedeemed = redemptions.reduce((s, r) => s + r.points_redeemed, 0);
  const totalAdjusted = adjustments.reduce((s, a) => s + a.delta, 0);
  const totalAjustesPositivos = adjustments.filter(a => a.delta > 0).reduce((s, a) => s + a.delta, 0);
  const totalAjustesNegativos = adjustments.filter(a => a.delta < 0).reduce((s, a) => s + a.delta, 0);

  return (
    <div className="space-y-5">
      {/* Stats globales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: 'ri-gift-line', label: 'Canjes totales', value: redemptions.length, color: 'text-amber-400' },
          { icon: 'ri-coins-line', label: 'Pts canjeados', value: totalRedeemed, color: 'text-red-400' },
          { icon: 'ri-add-circle-line', label: 'Pts agregados', value: totalAjustesPositivos, color: 'text-green-400' },
          { icon: 'ri-indeterminate-circle-line', label: 'Pts quitados', value: Math.abs(totalAjustesNegativos), color: 'text-orange-400' },
        ].map((s, i) => (
          <div key={i} className="bg-gray-900 rounded-xl p-4">
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
            placeholder="Buscar por cliente..."
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
            { id: 'todos', label: 'Todos' },
            { id: 'canjes', label: 'Canjes' },
            { id: 'ajustes', label: 'Ajustes' },
          ] as const).map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
                filter === f.id ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
          {([
            { id: '7d', label: '7 días' },
            { id: '30d', label: '30 días' },
            { id: '90d', label: '90 días' },
            { id: 'all', label: 'Todo' },
          ] as const).map(d => (
            <button
              key={d.id}
              onClick={() => setDateRange(d.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
                dateRange === d.id ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <button
          onClick={fetchHistory}
          className="w-9 h-9 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
          title="Actualizar"
        >
          <i className="ri-refresh-line text-gray-400 text-sm" />
        </button>
      </div>

      <p className="text-xs text-gray-500 px-1">
        Mostrando {filtered.length} de {allEvents.length} movimiento{allEvents.length !== 1 ? 's' : ''}
        {filter !== 'todos' && ` · filtro: ${filter}`}
      </p>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14 bg-gray-900 rounded-xl">
          <i className="ri-file-list-3-line text-4xl text-gray-700 mb-3 block" />
          <p className="text-gray-500 text-sm">No hay movimientos en este período</p>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl overflow-hidden divide-y divide-gray-800">
          {filtered.map((evt, idx) => {
            const custName = customers[(evt.data as RedemptionRecord | AdjustmentRecord).customer_id] ?? `Cliente #${(evt.data as RedemptionRecord | AdjustmentRecord).customer_id}`;
            if (evt.type === 'canje') {
              const r = evt.data as RedemptionRecord;
              return (
                <div key={idx} className="px-4 py-3.5 flex items-start gap-3 hover:bg-gray-800/40 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">{r.tier_emoji}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white text-sm font-bold">Canje: {r.tier_label}</p>
                      <span className="text-xs font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">-{r.points_redeemed} pts</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-1">{r.items_description}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-600">
                      <span className="flex items-center gap-1"><i className="ri-user-line" />{custName}</span>
                      <span className="flex items-center gap-1"><i className="ri-time-line" />{formatDate(r.created_at)}</span>
                      <span className="flex items-center gap-1"><i className="ri-user-settings-line" />{r.redeemed_by}</span>
                    </div>
                  </div>
                </div>
              );
            }
            const a = evt.data as AdjustmentRecord;
            return (
              <div key={idx} className="px-4 py-3.5 flex items-start gap-3 hover:bg-gray-800/40 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                  a.delta >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
                }`}>
                  <i className={`text-lg ${a.delta >= 0 ? 'ri-add-circle-line text-green-400' : 'ri-indeterminate-circle-line text-red-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white text-sm font-bold">Ajuste manual</p>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                      a.delta >= 0 ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'
                    }`}>
                      {a.delta >= 0 ? '+' : ''}{a.delta} pts
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">{a.reason}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-600">
                    <span className="flex items-center gap-1"><i className="ri-user-line" />{custName}</span>
                    <span className="flex items-center gap-1"><i className="ri-time-line" />{formatDate(a.created_at)}</span>
                    <span className="flex items-center gap-1"><i className="ri-user-settings-line" />{a.adjusted_by}</span>
                    <span>{a.points_before} → {a.points_after}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}