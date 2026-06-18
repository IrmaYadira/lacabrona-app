import { useState, useEffect, useCallback } from 'react';
import { supabasePos } from '../supabasePos';

interface TicketItem {
  name: string;
  quantity: number;
  unit_price: number;
  note?: string | null;
}

interface TicketEvent {
  id: number;
  account_id: number;
  description: string;
  created_at: string;
  metadata: {
    folio_number: number;
    is_addition: boolean;
    spot: string;
    area: string;
    area_label: string;
    customer_name: string | null;
    zona: string | null;
    subtotal: number;
    items: TicketItem[];
    message_text: string;
    sent_at: string;
  };
}

interface GroupedAccount {
  account_id: number;
  customer_name: string | null;
  spot: string;
  area_label: string;
  zona: string | null;
  tickets: TicketEvent[];
  total: number;
  lastSentAt: string;
}

interface WhatsAppTicketsViewProps {
  onBack: () => void;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'Ahora mismo';
  if (diff < 60) return `Hace ${diff}m`;
  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;
  return mins > 0 ? `Hace ${hrs}h ${mins}m` : `Hace ${hrs}h`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

export default function WhatsAppTicketsView({ onBack }: WhatsAppTicketsViewProps) {
  const [tickets, setTickets] = useState<TicketEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAccount, setExpandedAccount] = useState<number | null>(null);
  const [expandedTicket, setExpandedTicket] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'today'>('today');
  const [searchQ, setSearchQ] = useState('');

  const fetchTickets = useCallback(async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let query = supabasePos
      .from('pos_account_events')
      .select('id, account_id, description, created_at, metadata')
      .eq('event_type', 'whatsapp_ticket')
      .order('created_at', { ascending: false })
      .limit(200);

    if (filter === 'today') {
      query = query.gte('created_at', todayStart.toISOString());
    }

    const { data } = await query;
    setTickets((data ?? []) as TicketEvent[]);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    let channel: ReturnType<typeof supabasePos.channel> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;

    const setupChannel = () => {
      if (channel) {
        try { supabasePos.removeChannel(channel); } catch { /* ignore */ }
        channel = null;
      }
      const ch = supabasePos
        .channel('wa-tickets-live')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'pos_account_events' },
          (payload) => {
            if ((payload.new as { event_type: string }).event_type === 'whatsapp_ticket') {
              fetchTickets();
            }
          }
        )
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

    // Fallback polling cada 10 segundos
    const pollInterval = setInterval(fetchTickets, 10_000);

    return () => {
      if (channel) { try { supabasePos.removeChannel(channel); } catch { /* ignore */ } }
      if (retryTimer) clearTimeout(retryTimer);
      clearInterval(pollInterval);
    };
  }, [fetchTickets]);

  // Agrupar por account_id
  const grouped = tickets.reduce<GroupedAccount[]>((acc, ticket) => {
    const existing = acc.find(g => g.account_id === ticket.account_id);
    const meta = ticket.metadata;
    if (existing) {
      existing.tickets.push(ticket);
      existing.total += meta.subtotal ?? 0;
      if (ticket.created_at > existing.lastSentAt) existing.lastSentAt = ticket.created_at;
    } else {
      acc.push({
        account_id: ticket.account_id,
        customer_name: meta.customer_name,
        spot: meta.spot,
        area_label: meta.area_label,
        zona: meta.zona,
        tickets: [ticket],
        total: meta.subtotal ?? 0,
        lastSentAt: ticket.created_at,
      });
    }
    return acc;
  }, []);

  // Ordenar por último ticket más reciente
  const sortedGroups = [...grouped].sort(
    (a, b) => new Date(b.lastSentAt).getTime() - new Date(a.lastSentAt).getTime()
  );

  // Filtrar por búsqueda
  const searchLower = searchQ.trim().toLowerCase();
  const filteredGroups = searchLower
    ? sortedGroups.filter(
        g =>
          (g.customer_name ?? '').toLowerCase().includes(searchLower) ||
          g.spot.toLowerCase().includes(searchLower) ||
          g.area_label.toLowerCase().includes(searchLower)
      )
    : sortedGroups;

  const totalTickets = tickets.length;
  const totalAmount = grouped.reduce((s, g) => s + g.total, 0);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-700 cursor-pointer transition-colors flex-shrink-0"
        >
          <i className="ri-arrow-left-line text-gray-300" />
        </button>
        <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <i className="ri-whatsapp-line text-white text-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-base text-white leading-tight">Tickets por WhatsApp</h1>
          <p className="text-gray-400 text-xs">
            {totalTickets} ticket{totalTickets !== 1 ? 's' : ''} enviado{totalTickets !== 1 ? 's' : ''}
            {filter === 'today' ? ' hoy' : ''}
            {' · '}
            <span className="text-amber-400 font-bold">${totalAmount.toFixed(2)}</span> total
          </p>
        </div>
        {/* Recargar */}
        <button
          onClick={fetchTickets}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-700 cursor-pointer transition-colors flex-shrink-0"
          title="Actualizar"
        >
          <i className="ri-refresh-line text-gray-400" />
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center gap-3">
        {/* Búsqueda */}
        <div className="relative flex-1">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            type="text"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Buscar por mesa o cliente..."
            className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-400 transition-colors"
          />
        </div>
        {/* Toggle hoy / todo */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5 flex-shrink-0">
          {(['today', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${
                filter === f
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f === 'today' ? 'Hoy' : 'Todo'}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <i className="ri-whatsapp-line text-3xl text-gray-300" />
            </div>
            <h3 className="text-base font-bold text-gray-600 mb-1">Sin tickets aún</h3>
            <p className="text-gray-400 text-sm max-w-xs">
              {filter === 'today'
                ? 'No se han enviado tickets por WhatsApp hoy. Prueba cambiando a "Todo".'
                : 'Cuando se envíen comandas por WhatsApp, aparecerán aquí.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Resumen rápido */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
                <p className="text-xl font-black text-gray-900">{filteredGroups.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">Mesa{filteredGroups.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
                <p className="text-xl font-black text-green-600">{totalTickets}</p>
                <p className="text-xs text-gray-500 mt-0.5">Ticket{totalTickets !== 1 ? 's' : ''}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
                <p className="text-xl font-black text-amber-600">${totalAmount.toFixed(0)}</p>
                <p className="text-xs text-gray-500 mt-0.5">Total</p>
              </div>
            </div>

            {filteredGroups.map((group) => {
              const isExpanded = expandedAccount === group.account_id;
              const lastTicket = group.tickets[0];

              return (
                <div
                  key={group.account_id}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
                >
                  {/* Header de la mesa */}
                  <button
                    onClick={() => setExpandedAccount(isExpanded ? null : group.account_id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-xl bg-green-100 border border-green-200 flex items-center justify-center flex-shrink-0">
                      <i className="ri-store-3-line text-green-600 text-lg" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900 text-sm">
                          {group.customer_name || group.spot}
                        </p>
                        {group.customer_name && group.customer_name !== group.spot && (
                          <span className="text-xs text-gray-400">· {group.spot}</span>
                        )}
                        <span className="text-xs bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">
                          {group.tickets.length} ronda{group.tickets.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <i className="ri-map-pin-line text-[10px]" />
                          {group.area_label}{group.zona ? ` · ${group.zona}` : ''}
                        </span>
                        <span className="text-xs text-gray-400">
                          {timeAgo(group.lastSentAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-black text-amber-600">${group.total.toFixed(2)}</p>
                        <p className="text-[10px] text-gray-400">acumulado</p>
                      </div>
                      <i className={`text-gray-400 text-sm transition-transform duration-200 ${
                        isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'
                      }`} />
                    </div>
                  </button>

                  {/* Tickets expandidos */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {group.tickets.map((ticket) => {
                        const meta = ticket.metadata;
                        const isTicketExpanded = expandedTicket === ticket.id;
                        return (
                          <div key={ticket.id} className="bg-gray-50/50">
                            {/* Ticket header */}
                            <button
                              onClick={() => setExpandedTicket(isTicketExpanded ? null : ticket.id)}
                              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-green-50/50 cursor-pointer transition-colors"
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                meta.is_addition ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'
                              }`}>
                                <i className={meta.is_addition ? 'ri-add-line text-sm' : 'ri-restaurant-line text-sm'} />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-gray-800">
                                    {meta.is_addition
                                      ? `Agrega a Ronda #${String(meta.folio_number).padStart(2, '0')}`
                                      : `Ronda #${String(meta.folio_number).padStart(2, '0')}`}
                                  </p>
                                  <span className="text-xs text-gray-400">{formatTime(ticket.created_at)}</span>
                                </div>
                                {/* Preview de items */}
                                <p className="text-xs text-gray-500 mt-0.5 truncate">
                                  {meta.items?.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-sm font-bold text-gray-700">${meta.subtotal?.toFixed(2)}</span>
                                <i className={`text-gray-400 text-xs transition-transform duration-200 ${
                                  isTicketExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'
                                }`} />
                              </div>
                            </button>

                            {/* Detalle del ticket */}
                            {isTicketExpanded && (
                              <div className="px-4 pb-4">
                                {/* Lista de items */}
                                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-3">
                                  <div className="bg-gray-50 border-b border-gray-100 px-3 py-2 flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                                      Productos enviados
                                    </span>
                                    <span className="text-xs text-gray-400">{formatTime(meta.sent_at)}</span>
                                  </div>
                                  <div className="divide-y divide-gray-50">
                                    {meta.items?.map((item, idx) => (
                                      <div key={idx} className="flex items-center gap-2 px-3 py-2">
                                        <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                          <span className="text-[10px] font-black text-amber-600">{item.quantity}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm text-gray-800 font-medium">{item.name}</p>
                                          {item.note && (
                                            <p className="text-xs text-amber-600 italic">{item.note}</p>
                                          )}
                                          {/* Badges de extras con cobro para el POS */}
                                          {item.note && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                              {item.note.includes("extra ranch (+$15)") && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200">
                                                  <i className="ri-add-line" />
                                                  Extra ranch +$15
                                                </span>
                                              )}
                                              {item.note.includes("Extra queso (+$10)") && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200">
                                                  <i className="ri-add-line" />
                                                  Extra queso +$10
                                                </span>
                                              )}
                                              {item.note.includes("Extra salsa BBQ (+$10)") && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200">
                                                  <i className="ri-add-line" />
                                                  Extra salsa BBQ +$10
                                                </span>
                                              )}
                                              {item.note.includes("Extra aderezo ranch (+$15)") && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200">
                                                  <i className="ri-add-line" />
                                                  Extra ranch +$15
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        <span className="text-sm font-bold text-gray-700 flex-shrink-0">
                                          ${(item.unit_price * item.quantity).toFixed(2)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="px-3 py-2 bg-amber-50 border-t border-amber-100 flex justify-between">
                                    <span className="text-xs font-bold text-gray-600">Subtotal</span>
                                    <span className="text-sm font-black text-amber-600">${meta.subtotal?.toFixed(2)}</span>
                                  </div>
                                </div>

                                {/* Ver mensaje completo */}
                                <details className="group">
                                  <summary className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 cursor-pointer select-none list-none transition-colors">
                                    <i className="ri-message-3-line" />
                                    Ver texto enviado al bar
                                    <i className="ri-arrow-down-s-line group-open:rotate-180 transition-transform" />
                                  </summary>
                                  <div className="mt-2 bg-gray-900 rounded-xl p-3 font-mono text-xs text-green-400 whitespace-pre-wrap leading-relaxed overflow-auto max-h-48">
                                    {meta.message_text}
                                  </div>
                                  <button
                                    onClick={() => {
                                      const phone = '5213348567795';
                                      window.open(
                                        `https://wa.me/${phone}?text=${encodeURIComponent(meta.message_text)}`,
                                        '_blank'
                                      );
                                    }}
                                    className="mt-2 w-full flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
                                  >
                                    <i className="ri-whatsapp-line" />
                                    Reenviar al bar
                                  </button>
                                </details>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Resumen de la mesa */}
                      <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <i className="ri-receipt-line text-gray-400 text-sm" />
                          <span className="text-xs text-gray-500">
                            {group.tickets.reduce((s, t) => s + (t.metadata.items?.length ?? 0), 0)} tipos de producto
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">Total rondas:</span>
                          <span className="text-sm font-black text-amber-600">${group.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}