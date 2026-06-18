import { useState, useEffect, useCallback } from 'react';
import { supabasePos } from '../supabasePos';

interface ItemEvent {
  id: number;
  item_id: number;
  event_type: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface ItemHistoryPanelProps {
  itemId: number;
  productName: string;
  onClose: () => void;
}

const EVENT_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  qty_changed:  { icon: 'ri-arrow-up-down-line',    color: 'text-blue-500 bg-blue-50',   label: 'Cantidad' },
  note_changed: { icon: 'ri-edit-line',              color: 'text-amber-500 bg-amber-50', label: 'Nota' },
  item_deleted: { icon: 'ri-delete-bin-line',        color: 'text-red-500 bg-red-50',     label: 'Eliminado' },
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return 'Hoy';
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

export default function ItemHistoryPanel({ itemId, productName, onClose }: ItemHistoryPanelProps) {
  const [events, setEvents] = useState<ItemEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { data } = await supabasePos
      .from('pos_account_events')
      .select('*')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false });
    setEvents((data as ItemEvent[]) ?? []);
    setLoading(false);
  }, [itemId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl flex flex-col max-h-[70vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg">
              <i className="ri-history-line text-gray-600 text-sm" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 text-sm leading-tight">Historial de cambios</h4>
              <p className="text-xs text-gray-400 truncate max-w-[200px]">{productName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer transition-colors"
          >
            <i className="ri-close-line text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                <i className="ri-history-line text-xl text-gray-300" />
              </div>
              <p className="text-sm text-gray-400 font-medium">Sin cambios registrados</p>
              <p className="text-xs text-gray-300 mt-1">Los cambios futuros aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((ev, idx) => {
                const cfg = EVENT_CONFIG[ev.event_type] ?? {
                  icon: 'ri-information-line',
                  color: 'text-gray-500 bg-gray-50',
                  label: ev.event_type,
                };
                const meta = ev.metadata ?? {};
                const isFirst = idx === 0;

                return (
                  <div
                    key={ev.id}
                    className={`flex gap-3 p-3 rounded-xl border transition-all ${
                      isFirst ? 'border-amber-200 bg-amber-50/50' : 'border-gray-100 bg-white'
                    }`}
                  >
                    {/* Icono */}
                    <div className={`w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 ${cfg.color}`}>
                      <i className={`${cfg.icon} text-sm`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        {isFirst && (
                          <span className="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                            Último
                          </span>
                        )}
                      </div>

                      {/* Detalle visual según tipo */}
                      {ev.event_type === 'qty_changed' && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-sm font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {String(meta.prev_qty ?? '?')}x
                          </span>
                          <i className="ri-arrow-right-line text-gray-400 text-xs" />
                          <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                            {String(meta.new_qty ?? '?')}x
                          </span>
                        </div>
                      )}

                      {ev.event_type === 'note_changed' && (
                        <div className="mt-1 space-y-1">
                          {meta.prev_note !== null && meta.prev_note !== undefined && (
                            <div className="flex items-start gap-1.5">
                              <span className="text-xs text-gray-400 mt-0.5 flex-shrink-0">Antes:</span>
                              <span className="text-xs text-gray-500 italic bg-gray-50 px-2 py-0.5 rounded line-through decoration-red-300">
                                {String(meta.prev_note) || 'sin nota'}
                              </span>
                            </div>
                          )}
                          {meta.new_note !== null && meta.new_note !== undefined && String(meta.new_note) !== '' && (
                            <div className="flex items-start gap-1.5">
                              <span className="text-xs text-gray-400 mt-0.5 flex-shrink-0">Ahora:</span>
                              <span className="text-xs text-amber-700 italic bg-amber-50 px-2 py-0.5 rounded font-medium">
                                {String(meta.new_note)}
                              </span>
                            </div>
                          )}
                          {(meta.new_note === null || meta.new_note === '' || meta.new_note === undefined) && (
                            <div className="flex items-start gap-1.5">
                              <span className="text-xs text-gray-400 mt-0.5 flex-shrink-0">Ahora:</span>
                              <span className="text-xs text-gray-300 italic px-2 py-0.5">sin nota</span>
                            </div>
                          )}
                        </div>
                      )}

                      {ev.event_type === 'item_deleted' && (
                        <p className="text-xs text-red-500 mt-1 font-medium">
                          Era {String(meta.prev_qty ?? '?')}x en Ronda #{String(meta.folio ?? '?').padStart(2, '0')}
                        </p>
                      )}

                      {/* Timestamp */}
                      <p className="text-xs text-gray-300 mt-1.5 flex items-center gap-1">
                        <i className="ri-time-line" />
                        {formatDate(ev.created_at)} · {formatTime(ev.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 cursor-pointer transition-colors whitespace-nowrap"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}