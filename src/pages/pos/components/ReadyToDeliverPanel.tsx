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
      {/* Header de sección — ahora más prominente con gradiente */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl px-4 py-3 mb-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center bg-white/25 rounded-xl flex-shrink-0">
            <i className="ri-user-received-2-line text-white text-lg" />
          </div>
          <div>
            <h3 className="text-white font-black text-base leading-tight">
              ⚠️ Por Entregar al Cliente
            </h3>
            <p className="text-white/80 text-xs mt-0.5">
              {readyRounds.length} comanda{readyRounds.length !== 1 ? 's' : ''} lista{readyRounds.length !== 1 ? 's' : ''} en cocina · {totalItemsWaiting} artículo{totalItemsWaiting !== 1 ? 's' : ''} por llevar a la mesa
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-white font-black text-xl">
            MXN${totalMoneyWaiting.toFixed(2)}
          </span>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-all whitespace-nowrap border border-white/30"
          >
            <i className="ri-fullscreen-line" />
            Ampliar
          </button>
        </div>
      </div>

      {/* Tarjetas horizontales scrolleables — más grandes y visibles */}
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
        {readyRounds.map((round) => {
          const urgent = round.minutesWaiting >= 10;
          return (
            <div
              key={`${round.accountId}-${round.folioNumber}`}
              className={`snap-start flex-shrink-0 w-80 rounded-xl border-2 overflow-hidden ${
                urgent ? 'border-red-400 bg-red-50 shadow-lg shadow-red-100' : 'border-orange-300 bg-white shadow-md'
              }`}
            >
              {/* Card header — nombre más grande */}
              <div className={`px-4 py-3 flex items-center justify-between ${urgent ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 flex items-center justify-center rounded-full bg-white/25 flex-shrink-0">
                    <span className="text-white font-black text-base">
                      {round.accountName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-black truncate leading-tight">
                      {round.accountName}
                    </p>
                    <p className="text-white/80 text-xs truncate mt-0.5">
                      {round.areaLabel} · {round.spot}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end flex-shrink-0 ml-2">
                  <span className="text-sm font-black px-2.5 py-1 rounded-full bg-white/25">
                    Ronda #{String(round.folioNumber).padStart(2, '0')}
                  </span>
                  {urgent && (
                    <span className="text-xs font-black mt-1 animate-pulse bg-white/30 px-2 py-0.5 rounded-full">
                      ¡{round.minutesWaiting} min!
                    </span>
                  )}
                </div>
              </div>

              {/* Items — más grandes */}
              <div className={`px-4 py-3 space-y-1.5 ${urgent ? 'bg-red-50' : 'bg-white'}`}>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Lo que pidió:
                </p>
                {round.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between text-sm py-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-black text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded-md text-xs">{item.quantity}x</span>
                      <span className="text-gray-800 font-medium truncate">{item.product_name}</span>
                      {item.size && (
                        <span className="text-gray-400 italic text-xs truncate">({item.size})</span>
                      )}
                    </div>
                    <span className="text-gray-600 font-semibold flex-shrink-0 ml-2 text-xs">
                      MXN${(item.unit_price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Footer con tiempo y total */}
              <div className={`px-4 py-3 flex items-center justify-between border-t ${urgent ? 'bg-red-100 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
                <div className="flex items-center gap-2 text-xs">
                  <i className={`${urgent ? 'ri-alarm-warning-fill text-red-500' : 'ri-time-line text-orange-500'}`} />
                  <span className="text-gray-600 font-medium">Lista desde {formatTime(round.oldestCreatedAt)}</span>
                  <span className={`font-black ${urgent ? 'text-red-600' : 'text-orange-600'}`}>
                    · {round.minutesWaiting} min
                  </span>
                </div>
              </div>

              {/* Total y botón de acción */}
              <div className="px-4 py-3 flex items-center justify-between bg-white">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total comanda</p>
                  <p className={`text-lg font-black ${urgent ? 'text-red-600' : 'text-orange-600'}`}>
                    MXN${round.total.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => handleMarkDelivered(round)}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-600 active:scale-95 text-white px-5 py-3 rounded-xl text-sm font-black cursor-pointer transition-all whitespace-nowrap shadow-sm"
                >
                  <i className="ri-user-received-2-line text-base" />
                  Entregado al Cliente
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Ver todo — también actualizado */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-10 pb-10 px-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center bg-white/20 rounded-xl">
                  <i className="ri-user-received-2-line text-white text-2xl" />
                </div>
                <div>
                  <h2 className="text-white font-black text-xl leading-tight">
                    ⚠️ Por Entregar al Cliente
                  </h2>
                  <p className="text-orange-100 text-sm mt-0.5">
                    {readyRounds.length} comanda{readyRounds.length !== 1 ? 's' : ''} lista{readyRounds.length !== 1 ? 's' : ''} en cocina · {totalItemsWaiting} artículo{totalItemsWaiting !== 1 ? 's' : ''} · MXN${totalMoneyWaiting.toFixed(2)} por llevar
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-10 h-10 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-xl text-white cursor-pointer transition-colors"
              >
                <i className="ri-close-line text-xl" />
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
                        urgent ? 'border-red-400 bg-red-50 shadow-md' : 'border-orange-200 bg-white'
                      }`}
                    >
                      {/* Card header */}
                      <div className={`px-5 py-4 flex items-center justify-between ${urgent ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 flex items-center justify-center rounded-full bg-white/25 flex-shrink-0">
                            <span className="text-white font-black text-lg">
                              {round.accountName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-lg font-black truncate leading-tight">
                              {round.accountName}
                            </p>
                            <p className="text-white/80 text-sm truncate">
                              {round.areaLabel} · {round.spot}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0 gap-1 ml-2">
                          <span className="text-sm font-black px-3 py-1 rounded-full bg-white/25">
                            Ronda #{String(round.folioNumber).padStart(2, '0')}
                          </span>
                          <span className="text-white/90 text-xs font-medium">
                            {formatTime(round.oldestCreatedAt)}
                          </span>
                        </div>
                      </div>

                      {/* Items detallados */}
                      <div className="px-5 py-4 space-y-2.5">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                          Lo que pidió:
                        </p>
                        {round.items.map(item => (
                          <div key={`modal-item-${item.id}`} className="flex items-start justify-between">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span className="font-black text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md text-sm flex-shrink-0">{item.quantity}x</span>
                              <div className="min-w-0">
                                <span className="text-gray-800 font-medium block">{item.product_name}</span>
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
                            <span className="text-gray-600 font-semibold flex-shrink-0 ml-3">
                              MXN${(item.unit_price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Footer */}
                      <div className={`px-5 py-3 flex items-center justify-between ${urgent ? 'bg-red-100' : 'bg-orange-50'}`}>
                        <div className="flex items-center gap-2 text-sm">
                          <i className={`${urgent ? 'ri-alarm-warning-fill text-red-500' : 'ri-time-line text-orange-500'}`} />
                          <span className="text-gray-600 font-medium">Esperando desde {formatTime(round.oldestCreatedAt)}</span>
                          <span className={`font-black ${urgent ? 'text-red-600 animate-pulse' : 'text-orange-600'}`}>
                            · {round.minutesWaiting} min
                          </span>
                        </div>
                        <span className="text-lg font-black text-gray-800">
                          MXN${round.total.toFixed(2)}
                        </span>
                      </div>

                      {/* Acción */}
                      <div className="px-5 py-4 bg-white flex items-center justify-between">
                        <p className="text-xs text-gray-400">
                          {round.items.reduce((s, i) => s + i.quantity, 0)} artículos listos
                        </p>
                        <button
                          onClick={() => handleMarkDelivered(round)}
                          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 active:scale-95 text-white px-6 py-3 rounded-xl font-black cursor-pointer transition-all whitespace-nowrap shadow-sm"
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
              <p className="text-sm text-gray-500 font-medium">
                Las comandas listas permanecen aquí hasta que se marquen como entregadas al cliente
              </p>
              <button
                onClick={() => setShowModal(false)}
                className="text-sm font-bold text-gray-600 hover:text-gray-800 bg-white border border-gray-300 hover:border-gray-400 px-5 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
              >
                Cerrar Vista
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}