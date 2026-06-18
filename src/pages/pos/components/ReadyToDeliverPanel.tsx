import { useCallback, useMemo, useState } from 'react';
import { supabasePos } from '../supabasePos';
import type { PosAccount, PosAccountItem } from '../types';
import { AREA_LABELS, type Area } from '../types';

interface ReadyToDeliverPanelProps {
  accounts: PosAccount[];
  onRefresh: () => void;
}

interface ReadyRound {
  accountId: number;
  accountName: string;
  spot: string;
  area: string;
  areaLabel: string;
  folioNumber: number;
  items: PosAccountItem[];
  total: number;
  qty: number;
  oldestCreatedAt: string;
  minutesWaiting: number;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function minutesSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

export default function ReadyToDeliverPanel({ accounts, onRefresh }: ReadyToDeliverPanelProps) {
  const [showModal, setShowModal] = useState(false);

  const readyRounds = useMemo(() => {
    const rounds: ReadyRound[] = [];
    for (const acc of accounts) {
      const items = acc.pos_account_items ?? [];
      const folios = [...new Set(items.map(i => i.folio_number))];
      for (const folio of folios) {
        const folioItems = items.filter(i => i.folio_number === folio);
        const allDelivered = folioItems.length > 0 && folioItems.every(i => i.delivered);
        const anyNotCustomerDelivered = folioItems.some(i => !i.customer_delivered);
        if (allDelivered && anyNotCustomerDelivered) {
          const total = folioItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
          const qty = folioItems.reduce((s, i) => s + i.quantity, 0);
          const oldest = folioItems.reduce((min, i) =>
            new Date(i.created_at).getTime() < new Date(min).getTime() ? i.created_at : min,
            folioItems[0]?.created_at ?? new Date().toISOString()
          );
          rounds.push({
            accountId: acc.id,
            accountName: acc.customer_name || acc.spot || 'Cliente',
            spot: acc.spot || '',
            area: acc.area,
            areaLabel: AREA_LABELS[acc.area as Area] ?? acc.area,
            folioNumber: folio,
            items: folioItems,
            total,
            qty,
            oldestCreatedAt: oldest,
            minutesWaiting: minutesSince(oldest),
          });
        }
      }
    }
    return rounds.sort((a, b) => b.minutesWaiting - a.minutesWaiting);
  }, [accounts]);

  const handleMarkDelivered = useCallback(async (round: ReadyRound) => {
    const ids = round.items.filter(i => !i.customer_delivered).map(i => i.id);
    if (ids.length === 0) return;
    await supabasePos.from('pos_account_items').update({ customer_delivered: true }).in('id', ids);
    await supabasePos.from('pos_account_events').insert({
      account_id: round.accountId,
      event_type: 'ronda_delivered',
      description: `Ronda #${String(round.folioNumber).padStart(2, '0')} entregada al cliente (desde panel)`,
      metadata: { folio_number: round.folioNumber, item_ids: ids, source: 'pos_panel' },
    });
    onRefresh();
  }, [onRefresh]);

  const totalItemsWaiting = useMemo(() => readyRounds.reduce((s, r) => s + r.qty, 0), [readyRounds]);
  const totalMoneyWaiting = useMemo(() => readyRounds.reduce((s, r) => s + r.total, 0), [readyRounds]);

  if (readyRounds.length === 0) return null;

  return (
    <div className="mb-4">
      {/* Header de sección */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 flex items-center justify-center bg-orange-500 rounded-lg flex-shrink-0">
            <i className="ri-user-received-2-line text-white text-sm" />
          </div>
          <h3 className="text-sm font-black text-gray-800">
            Por Entregar
          </h3>
          <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">
            {readyRounds.length} ronda{readyRounds.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
          >
            Ver todo
          </button>
          <span className="text-xs text-gray-400">
            Lista en cocina, esperando mesera
          </span>
        </div>
      </div>

      {/* Tarjetas horizontales scrolleables */}
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
        {readyRounds.map((round) => {
          const urgent = round.minutesWaiting >= 10;
          return (
            <div
              key={`${round.accountId}-${round.folioNumber}`}
              className={`snap-start flex-shrink-0 w-72 rounded-xl border-2 overflow-hidden ${
                urgent ? 'border-red-300 bg-red-50' : 'border-orange-200 bg-white'
              }`}
            >
              {/* Card header */}
              <div className={`px-3 py-2 flex items-center justify-between ${urgent ? 'bg-red-100 border-b border-red-200' : 'bg-orange-50 border-b border-orange-100'}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 ${urgent ? 'bg-red-500' : 'bg-orange-500'}`}>
                    <span className="text-white font-bold text-xs">
                      {round.accountName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate leading-tight">
                      {round.accountName}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {round.areaLabel} · {round.spot}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${urgent ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}`}>
                    #{String(round.folioNumber).padStart(2, '0')}
                  </span>
                  {urgent && (
                    <span className="text-[10px] text-red-600 font-bold mt-0.5 animate-pulse">
                      ¡{round.minutesWaiting}min!
                    </span>
                  )}
                </div>
              </div>

              {/* Items */}
              <div className="px-3 py-2 space-y-1">
                {round.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-gray-700">{item.quantity}x</span>
                      <span className="text-gray-800 truncate">{item.product_name}</span>
                      {item.size && (
                        <span className="text-gray-400 italic truncate">({item.size})</span>
                      )}
                    </div>
                    <span className="text-gray-500 font-medium flex-shrink-0">
                      ${(item.unit_price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Footer con tiempo y botón */}
              <div className={`px-3 py-2 flex items-center justify-between ${urgent ? 'bg-red-50' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <i className="ri-time-line" />
                  <span>Lista desde {formatTime(round.oldestCreatedAt)}</span>
                  <span className="text-gray-400">· {round.minutesWaiting}min</span>
                </div>
                <span className="text-xs font-bold text-gray-700">
                  ${round.total.toFixed(2)}
                </span>
              </div>

              {/* Botón de acción */}
              <div className="px-3 pb-3 pt-1">
                <button
                  onClick={() => handleMarkDelivered(round)}
                  className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 active:scale-95 text-white rounded-xl py-2.5 text-xs font-black cursor-pointer transition-all whitespace-nowrap"
                >
                  <i className="ri-user-received-2-line text-sm" />
                  Entregado al Cliente
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Ver todo */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-10 pb-10 px-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="bg-orange-500 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 flex items-center justify-center bg-white/20 rounded-lg">
                  <i className="ri-user-received-2-line text-white text-lg" />
                </div>
                <div>
                  <h2 className="text-white font-black text-lg leading-tight">
                    Por Entregar
                  </h2>
                  <p className="text-orange-100 text-xs">
                    {readyRounds.length} ronda{readyRounds.length !== 1 ? 's' : ''} · {totalItemsWaiting} artículo{totalItemsWaiting !== 1 ? 's' : ''} · ${totalMoneyWaiting.toFixed(2)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-9 h-9 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg text-white cursor-pointer transition-colors"
              >
                <i className="ri-close-line text-lg" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {readyRounds.map((round) => {
                  const urgent = round.minutesWaiting >= 10;
                  return (
                    <div
                      key={`modal-${round.accountId}-${round.folioNumber}`}
                      className={`rounded-xl border-2 overflow-hidden ${
                        urgent ? 'border-red-300 bg-red-50' : 'border-orange-200 bg-white'
                      }`}
                    >
                      {/* Card header */}
                      <div className={`px-4 py-3 flex items-center justify-between ${urgent ? 'bg-red-100 border-b border-red-200' : 'bg-orange-50 border-b border-orange-100'}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0 ${urgent ? 'bg-red-500' : 'bg-orange-500'}`}>
                            <span className="text-white font-bold text-sm">
                              {round.accountName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate leading-tight">
                              {round.accountName}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {round.areaLabel} · {round.spot}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0 gap-1">
                          <span className={`text-xs font-black px-2.5 py-1 rounded-full ${urgent ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}`}>
                            #{String(round.folioNumber).padStart(2, '0')}
                          </span>
                          <span className="text-[11px] text-gray-500 font-medium">
                            {formatTime(round.oldestCreatedAt)}
                          </span>
                        </div>
                      </div>

                      {/* Items detallados */}
                      <div className="px-4 py-3 space-y-2">
                        {round.items.map(item => (
                          <div key={`modal-item-${item.id}`} className="flex items-start justify-between text-sm">
                            <div className="flex items-start gap-2 min-w-0">
                              <span className="font-bold text-gray-700 flex-shrink-0">{item.quantity}x</span>
                              <div className="min-w-0">
                                <span className="text-gray-800 block">{item.product_name}</span>
                                {item.size && (
                                  <span className="text-gray-400 italic text-xs">({item.size})</span>
                                )}
                                {item.notes && (
                                  <span className="text-orange-600 text-xs block mt-0.5">
                                    <i className="ri-sticky-note-line mr-1" />
                                    {item.notes}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-gray-500 font-medium flex-shrink-0 ml-2">
                              ${(item.unit_price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Footer */}
                      <div className={`px-4 py-3 flex items-center justify-between ${urgent ? 'bg-red-50' : 'bg-gray-50'}`}>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <i className="ri-time-line" />
                          <span>Esperando desde {formatTime(round.oldestCreatedAt)}</span>
                          <span className={`font-bold ${urgent ? 'text-red-600' : 'text-orange-600'}`}>
                            · {round.minutesWaiting} min
                          </span>
                          {urgent && (
                            <span className="text-red-600 font-black animate-pulse">
                              ¡URGENTE!
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-bold text-gray-800">
                          ${round.total.toFixed(2)}
                        </span>
                      </div>

                      {/* Botón de acción */}
                      <div className="px-4 pb-4 pt-1">
                        <button
                          onClick={() => handleMarkDelivered(round)}
                          className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 active:scale-95 text-white rounded-xl py-3 text-sm font-black cursor-pointer transition-all whitespace-nowrap"
                        >
                          <i className="ri-user-received-2-line text-base" />
                          Entregado al Cliente
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal footer */}
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Las comandas listas permanecen aquí hasta que se marquen como entregadas
              </p>
              <button
                onClick={() => setShowModal(false)}
                className="text-sm font-bold text-gray-600 hover:text-gray-800 bg-white border border-gray-200 hover:border-gray-300 px-4 py-2 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}