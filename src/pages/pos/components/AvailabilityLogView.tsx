import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface LogEntry {
  id: number;
  product_id: string;
  product_name: string;
  category: string;
  action: 'paused' | 'resumed' | 'resumed_all';
  changed_at: string;
  note: string | null;
}

interface AvailabilityLogViewProps {
  onBack: () => void;
}

const ACTION_META = {
  paused: {
    label: 'Marcado Agotado',
    icon: 'ri-close-circle-line',
    bg: 'bg-red-50',
    border: 'border-red-200',
    dot: 'bg-red-400',
    text: 'text-red-600',
    badge: 'bg-red-100 text-red-600',
  },
  resumed: {
    label: 'Reactivado',
    icon: 'ri-checkbox-circle-line',
    bg: 'bg-green-50',
    border: 'border-green-200',
    dot: 'bg-green-400',
    text: 'text-green-600',
    badge: 'bg-green-100 text-green-700',
  },
  resumed_all: {
    label: 'Activar Todo',
    icon: 'ri-refresh-line',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    dot: 'bg-blue-400',
    text: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-700',
  },
} as const;

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const timeStr = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  if (d.toDateString() === today.toDateString()) return `Hoy ${timeStr}`;
  if (d.toDateString() === yesterday.toDateString()) return `Ayer ${timeStr}`;

  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  }) + ` ${timeStr}`;
}

function groupByDate(entries: LogEntry[]): { label: string; items: LogEntry[] }[] {
  const groups = new Map<string, LogEntry[]>();
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  for (const entry of entries) {
    const d = new Date(entry.changed_at);
    let label: string;
    if (d.toDateString() === today.toDateString()) label = 'Hoy';
    else if (d.toDateString() === yesterday.toDateString()) label = 'Ayer';
    else label = d.toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long' });

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(entry);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

export default function AvailabilityLogView({ onBack }: AvailabilityLogViewProps) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState<'all' | 'paused' | 'resumed' | 'resumed_all'>('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const fetchLog = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('product_availability_log')
      .select('*')
      .order('changed_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filterAction !== 'all') query = query.eq('action', filterAction);
    if (search.trim()) query = query.ilike('product_name', `%${search.trim()}%`);

    const { data } = await query;
    setEntries(data ?? []);
    setLoading(false);
  }, [page, filterAction, search]);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  // Realtime updates
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;

    const setupChannel = () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* ignore */ }
        channel = null;
      }
      const ch = supabase
        .channel('avail-log-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'product_availability_log' }, () => {
          if (page === 0) fetchLog();
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            retries = 0;
          } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            channel = null;
            if (retries < 3) {
              retries += 1;
              retryTimer = setTimeout(setupChannel, Math.min(3000 * retries, 12000));
            }
          }
        });
      channel = ch;
    };

    setupChannel();
    return () => {
      if (channel) { try { supabase.removeChannel(channel); } catch { /* ignore */ } }
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [fetchLog, page]);

  const grouped = groupByDate(entries);

  const pausedToday = entries.filter(e => {
    const d = new Date(e.changed_at);
    return d.toDateString() === new Date().toDateString() && e.action === 'paused';
  }).length;

  const resumedToday = entries.filter(e => {
    const d = new Date(e.changed_at);
    return d.toDateString() === new Date().toDateString() && (e.action === 'resumed' || e.action === 'resumed_all');
  }).length;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
        >
          <i className="ri-arrow-left-line text-gray-600" />
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-gray-900">Historial de Disponibilidad</h2>
          <p className="text-xs text-gray-500">Registro de pausas y reactivaciones</p>
        </div>
        <button
          onClick={fetchLog}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer text-gray-500"
          title="Actualizar"
        >
          <i className="ri-refresh-line text-sm" />
        </button>
      </div>

      {/* Stats banner */}
      <div className="px-4 py-2.5 bg-white border-b border-gray-100 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-xs text-gray-600 font-medium">Pausados hoy: <strong className="text-red-600">{pausedToday}</strong></span>
        </div>
        <div className="w-px h-4 bg-gray-200" />
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-xs text-gray-600 font-medium">Reactivados hoy: <strong className="text-green-600">{resumedToday}</strong></span>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-2.5 bg-white border-b border-gray-100 flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
          <i className="ri-search-line text-gray-400 text-sm" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar producto..."
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(0); }} className="text-gray-400 cursor-pointer">
              <i className="ri-close-line text-sm" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {(['all', 'paused', 'resumed', 'resumed_all'] as const).map(f => (
            <button
              key={f}
              onClick={() => { setFilterAction(f); setPage(0); }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                filterAction === f
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' && 'Todos'}
              {f === 'paused' && <><i className="ri-close-circle-line mr-1" />Agotados</>}
              {f === 'resumed' && <><i className="ri-checkbox-circle-line mr-1" />Reactivados</>}
              {f === 'resumed_all' && <><i className="ri-refresh-line mr-1" />Activar Todo</>}
            </button>
          ))}
        </div>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-14 h-14 flex items-center justify-center bg-gray-100 rounded-full mb-3">
              <i className="ri-history-line text-2xl text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm font-medium">Sin registros aún</p>
            <p className="text-gray-400 text-xs mt-1">
              {search || filterAction !== 'all'
                ? 'Prueba con otros filtros'
                : 'El historial aparecerá aquí cuando se pause o reactive un producto'}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-5">
            {grouped.map(group => (
              <div key={group.label}>
                {/* Day divider */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2">{group.label}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                <div className="space-y-2">
                  {group.items.map(entry => {
                    const meta = ACTION_META[entry.action];
                    return (
                      <div
                        key={entry.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border ${meta.bg} ${meta.border}`}
                      >
                        {/* Timeline dot */}
                        <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0">
                          <div className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${meta.badge}`}>
                              <i className={`${meta.icon} mr-1`} />
                              {meta.label}
                            </span>
                            <span className="text-xs text-gray-400">{formatDate(entry.changed_at)}</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 mt-1 leading-tight truncate">
                            {entry.product_name}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{entry.category}</p>
                          {entry.note && (
                            <p className="text-xs text-gray-500 mt-1 italic">{entry.note}</p>
                          )}
                        </div>

                        {/* Product ID chip */}
                        <span className="text-xs text-gray-400 font-mono bg-gray-100 px-2 py-0.5 rounded flex-shrink-0">
                          #{entry.product_id}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Pagination */}
            <div className="flex items-center justify-center gap-3 py-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                <i className="ri-arrow-left-s-line" />
                Anterior
              </button>
              <span className="text-xs text-gray-400 font-medium">Pág. {page + 1}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={entries.length < PAGE_SIZE}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                Siguiente
                <i className="ri-arrow-right-s-line" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}