import { useState, useMemo } from 'react';
import { useAdminData } from '../hooks/useAdminData';
import ReviewedTodayPanel from './ReviewedTodayPanel';
import type { AccountWithItems } from '../hooks/useAdminData';

interface AbandonedAccountsReportProps {
  dateRange: 'today' | 'week' | 'month';
}

function getMinutesSinceLastRoundToClose(account: AccountWithItems): number {
  const items = account.pos_account_items ?? [];
  const closedAt = account.closed_at ? new Date(account.closed_at).getTime() : Date.now();
  if (items.length === 0) {
    return Math.floor((closedAt - new Date(account.created_at).getTime()) / 60000);
  }
  const lastRoundAt = items.reduce((latest, item) => {
    const itemTime = new Date(item.created_at).getTime();
    return itemTime > latest ? itemTime : latest;
  }, 0);
  return Math.floor((closedAt - lastRoundAt) / 60000);
}

function getTotalOpenMinutes(account: AccountWithItems): number {
  const closedAt = account.closed_at ? new Date(account.closed_at).getTime() : Date.now();
  return Math.floor((closedAt - new Date(account.created_at).getTime()) / 60000);
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function formatDateTimeMX(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

function getAccountStatus(account: AccountWithItems): { label: string; color: string; bg: string; score: number } {
  const items = account.pos_account_items ?? [];
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const minsToClose = getMinutesSinceLastRoundToClose(account);
  const totalMins = getTotalOpenMinutes(account);

  if (totalQty === 0) {
    if (totalMins >= 60) {
      return { label: 'Sin pedidos', color: 'text-red-600', bg: 'bg-red-50 border-red-200', score: 4 };
    }
    return { label: 'Sin pedidos', color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200', score: 1 };
  }

  if (minsToClose >= 120) {
    return { label: 'Abandonada', color: 'text-red-600', bg: 'bg-red-50 border-red-200', score: 3 };
  }
  if (minsToClose >= 90) {
    return { label: 'Alerta', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', score: 2 };
  }
  if (minsToClose >= 60) {
    return { label: 'Cuidado', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', score: 1 };
  }
  return { label: 'Normal', color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200', score: 0 };
}

export default function AbandonedAccountsReport({ dateRange }: AbandonedAccountsReportProps) {
  const [subTab, setSubTab] = useState<'cerradas' | 'revisadas'>('cerradas');
  const [minFilter, setMinFilter] = useState<'all' | '60' | '90' | '120'>('all');
  const [sortBy, setSortBy] = useState<'abandon' | 'total' | 'opened'>('abandon');
  const [selectedAccount, setSelectedAccount] = useState<AccountWithItems | null>(null);

  const { closedAccounts, loading } = useAdminData(dateRange);

  const enriched = useMemo(() => {
    return closedAccounts.map(acc => ({
      account: acc,
      minsToClose: getMinutesSinceLastRoundToClose(acc),
      totalMins: getTotalOpenMinutes(acc),
      status: getAccountStatus(acc),
      items: acc.pos_account_items ?? [],
    }));
  }, [closedAccounts]);

  const filtered = useMemo(() => {
    let result = enriched;
    if (minFilter === '120') {
      result = result.filter(e => e.minsToClose >= 120 || e.status.score >= 3);
    } else if (minFilter === '90') {
      result = result.filter(e => e.minsToClose >= 90);
    } else if (minFilter === '60') {
      result = result.filter(e => e.minsToClose >= 60);
    }

    return [...result].sort((a, b) => {
      if (sortBy === 'abandon') return b.minsToClose - a.minsToClose;
      if (sortBy === 'total') return b.totalMins - a.totalMins;
      return new Date(b.account.created_at).getTime() - new Date(a.account.created_at).getTime();
    });
  }, [enriched, minFilter, sortBy]);

  // Stats
  const stats = useMemo(() => {
    const total = enriched.length;
    const abandoned = enriched.filter(e => e.minsToClose >= 120).length;
    const warning = enriched.filter(e => e.minsToClose >= 90 && e.minsToClose < 120).length;
    const caution = enriched.filter(e => e.minsToClose >= 60 && e.minsToClose < 90).length;
    const noItems = enriched.filter(e => e.items.length === 0).length;
    const avgMinsToClose = total > 0
      ? Math.round(enriched.reduce((s, e) => s + e.minsToClose, 0) / total)
      : 0;
    const avgTotalMins = total > 0
      ? Math.round(enriched.reduce((s, e) => s + e.totalMins, 0) / total)
      : 0;
    const avgMinsAbandoned = abandoned > 0
      ? Math.round(enriched.filter(e => e.minsToClose >= 120).reduce((s, e) => s + e.minsToClose, 0) / abandoned)
      : 0;

    // Por área
    const areaMap: Record<string, { total: number; abandoned: number }> = {};
    enriched.forEach(e => {
      const area = e.account.area || 'Otra';
      if (!areaMap[area]) areaMap[area] = { total: 0, abandoned: 0 };
      areaMap[area].total += 1;
      if (e.minsToClose >= 120) areaMap[area].abandoned += 1;
    });

    return { total, abandoned, warning, caution, noItems, avgMinsToClose, avgTotalMins, avgMinsAbandoned, areaMap };
  }, [enriched]);

  const abandonedRevenue = useMemo(() => {
    return enriched
      .filter(e => e.minsToClose >= 120)
      .reduce((s, e) => s + (e.account.pos_payments ?? []).reduce((ps, p) => ps + Number(p.total ?? 0), 0), 0);
  }, [enriched]);

  const totalRevenue = useMemo(() => {
    return enriched.reduce((s, e) => s + (e.account.pos_payments ?? []).reduce((ps, p) => ps + Number(p.total ?? 0), 0), 0);
  }, [enriched]);

  const dateRangeLabel = dateRange === 'today' ? 'hoy' : dateRange === 'week' ? 'en 7 días' : 'en 30 días';

  if (loading && subTab === 'cerradas') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Sub-tab toggle */}
      <div className="flex items-center gap-2">
        <div className="bg-white border border-gray-200 rounded-xl p-1 flex gap-1">
          <button
            onClick={() => setSubTab('cerradas')}
            className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${
              subTab === 'cerradas'
                ? 'bg-amber-500 text-white'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <i className="ri-close-circle-line mr-1" />
            Cuentas cerradas
          </button>
          <button
            onClick={() => setSubTab('revisadas')}
            className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${
              subTab === 'revisadas'
                ? 'bg-green-500 text-white'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <i className="ri-check-double-line mr-1" />
            Revisadas hoy
          </button>
        </div>
      </div>

      {/* Cerradas tab */}
      {subTab === 'cerradas' && (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-gray-900">Cuentas Abandonadas</h2>
              <p className="text-sm text-gray-500">
                {closedAccounts.length} cuentas cerradas {dateRangeLabel}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={minFilter}
                onChange={e => setMinFilter(e.target.value as typeof minFilter)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="all">Todas las cuentas</option>
                <option value="60">60+ min sin pedir</option>
                <option value="90">90+ min sin pedir</option>
                <option value="120">120+ min (abandonadas)</option>
              </select>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="abandon">Más abandonadas primero</option>
                <option value="total">Más tiempo abierta</option>
                <option value="opened">Más reciente</option>
              </select>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Cuentas cerradas</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="bg-white rounded-xl border border-red-200 p-4">
              <p className="text-xs text-red-500 font-semibold uppercase tracking-wide">Abandonadas</p>
              <p className="text-2xl font-black text-red-600 mt-1">{stats.abandoned}</p>
              <p className="text-xs text-red-400 mt-0.5">
                {stats.total > 0 ? Math.round((stats.abandoned / stats.total) * 100) : 0}% del total
              </p>
            </div>
            <div className="bg-white rounded-xl border border-orange-200 p-4">
              <p className="text-xs text-orange-500 font-semibold uppercase tracking-wide">Alertas</p>
              <p className="text-2xl font-black text-orange-600 mt-1">{stats.warning}</p>
              <p className="text-xs text-orange-400 mt-0.5">90-120 min</p>
            </div>
            <div className="bg-white rounded-xl border border-yellow-200 p-4">
              <p className="text-xs text-yellow-600 font-semibold uppercase tracking-wide">Cuidado</p>
              <p className="text-2xl font-black text-yellow-700 mt-1">{stats.caution}</p>
              <p className="text-xs text-yellow-600 mt-0.5">60-90 min</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Sin pedidos</p>
              <p className="text-2xl font-black text-gray-700 mt-1">{stats.noItems}</p>
              <p className="text-xs text-gray-400 mt-0.5">Se abrieron y cerraron</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Pérdida estimada</p>
              <p className="text-2xl font-black text-red-600 mt-1">${abandonedRevenue.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {totalRevenue > 0 ? Math.round((abandonedRevenue / totalRevenue) * 100) : 0}% de ventas
              </p>
            </div>
          </div>

          {/* Averages */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <i className="ri-time-line text-amber-500" />
              Tiempos promedio
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <i className="ri-time-line text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Última ronda → cierre</p>
                  <p className="text-lg font-black text-gray-900">{formatMinutes(stats.avgMinsToClose)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <i className="ri-store-3-line text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Apertura → cierre</p>
                  <p className="text-lg font-black text-gray-900">{formatMinutes(stats.avgTotalMins)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                  <i className="ri-alarm-warning-line text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Abandono → cierre</p>
                  <p className="text-lg font-black text-red-600">{formatMinutes(stats.avgMinsAbandoned)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Por área */}
          {Object.keys(stats.areaMap).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <i className="ri-map-pin-2-line text-amber-500" />
                Abandono por área
              </h3>
              <div className="space-y-3">
                {Object.entries(stats.areaMap).sort((a, b) => b[1].abandoned - a[1].abandoned).map(([area, data]) => {
                  const pct = data.total > 0 ? Math.round((data.abandoned / data.total) * 100) : 0;
                  return (
                    <div key={area}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-gray-700 capitalize">{area}</span>
                        <span className="text-sm text-gray-500">
                          <span className="font-bold text-red-600">{data.abandoned}</span>
                          <span className="text-gray-400"> / {data.total} ({pct}%)</span>
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-400 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lista de cuentas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <i className="ri-list-check-2 text-amber-500" />
                Detalle de cuentas
                {filtered.length > 0 && (
                  <span className="text-xs font-normal text-gray-400">({filtered.length} de {enriched.length})</span>
                )}
              </h3>
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <i className="ri-checkbox-circle-line text-4xl text-green-400 mb-3" />
                <p className="text-gray-500 font-medium">No hay cuentas abandonadas en este filtro</p>
                <p className="text-gray-400 text-sm mt-1">¡Todas las mesas se atendieron a tiempo!</p>
              </div>
            ) : (
              filtered.map(({ account, minsToClose, totalMins, status, items }) => {
                const payments = account.pos_payments ?? [];
                const total = payments.reduce((s, p) => s + Number(p.total ?? 0), 0);
                const lastItem = items.length > 0
                  ? items.reduce((latest, item) => {
                      const itemTime = new Date(item.created_at).getTime();
                      return itemTime > new Date(latest.created_at).getTime() ? item : latest;
                    }, items[0])
                  : null;
                const folios = [...new Set(items.map(i => i.folio_number))].sort((a, b) => a - b);

                return (
                  <div
                    key={account.id}
                    className={`bg-white rounded-xl border overflow-hidden ${status.bg}`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 ${
                          status.score >= 3 ? 'bg-red-500' : status.score >= 2 ? 'bg-orange-500' : status.score >= 1 ? 'bg-yellow-500' : 'bg-gray-200'
                        }`}>
                          <i className={`${status.score >= 3 ? 'ri-alarm-warning-fill' : 'ri-table-line'} text-white text-sm`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-gray-900 text-sm">{account.spot}</p>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <p className="text-xs text-gray-500">{account.customer_name || 'Sin nombre'}</p>
                            {account.area && (
                              <span className="text-xs text-gray-400 capitalize">· {account.area}</span>
                            )}
                            {account.opened_by && (
                              <span className="text-xs text-gray-400">· Abierto por {account.opened_by}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-black text-gray-900">${total.toFixed(2)}</p>
                        <p className="text-xs text-gray-400">
                          {items.length} items · {account.folio_counter} ronda{account.folio_counter !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    {/* Timestamps */}
                    <div className="px-4 pb-3">
                      <div className="flex flex-wrap gap-3 text-xs">
                        <div className="flex items-center gap-1 text-gray-500">
                          <i className="ri-door-open-line" />
                          <span>Abierta: {formatDateTimeMX(account.created_at)}</span>
                        </div>
                        {account.closed_at && (
                          <div className="flex items-center gap-1 text-gray-500">
                            <i className="ri-door-closed-line" />
                            <span>Cerrada: {formatDateTimeMX(account.closed_at)}</span>
                          </div>
                        )}
                        {lastItem && (
                          <div className={`flex items-center gap-1 ${
                            minsToClose >= 120 ? 'text-red-500 font-bold' : minsToClose >= 90 ? 'text-orange-500' : 'text-gray-500'
                          }`}>
                            <i className="ri-time-line" />
                            <span>
                              Último pedido: {formatDateTimeMX(lastItem.created_at)}
                              {' · '}
                              {minsToClose >= 120 ? (
                                <span className="text-red-600 font-bold">{formatMinutes(minsToClose)} sin pedir antes de cerrar</span>
                              ) : (
                                <span>{formatMinutes(minsToClose)} sin pedir antes de cerrar</span>
                              )}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-gray-500">
                          <i className="ri-hourglass-line" />
                          <span>Total abierta: {formatMinutes(totalMins)}</span>
                        </div>
                      </div>

                      {/* Rondas */}
                      {folios.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {folios.map(folio => {
                            const folioItems = items.filter(i => i.folio_number === folio);
                            const folioTotal = folioItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
                            const folioQty = folioItems.reduce((s, i) => s + i.quantity, 0);
                            return (
                              <div key={folio} className="bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 text-xs">
                                <span className="font-bold text-gray-700">Ronda #{String(folio).padStart(2, '0')}</span>
                                <span className="text-gray-500 ml-1">${folioTotal.toFixed(2)} · {folioQty} items</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Botón ver detalle */}
                    <div className="px-4 pb-3">
                      <button
                        onClick={() => setSelectedAccount(account)}
                        className="text-xs text-amber-600 hover:text-amber-700 font-semibold cursor-pointer flex items-center gap-1"
                      >
                        <i className="ri-eye-line" />
                        Ver detalle de rondas
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Modal detalle */}
          {selectedAccount && (
            <AccountDetailModal account={selectedAccount} onClose={() => setSelectedAccount(null)} />
          )}
        </>
      )}

      {/* Revisadas tab */}
      {subTab === 'revisadas' && <ReviewedTodayPanel />}
    </div>
  );
}

function AccountDetailModal({ account, onClose }: { account: AccountWithItems; onClose: () => void }) {
  const items = account.pos_account_items ?? [];
  const folios = [...new Set(items.map(i => i.folio_number))].sort((a, b) => a - b);
  const payments = account.pos_payments ?? [];
  const total = payments.reduce((s, p) => s + Number(p.total ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between rounded-t-2xl">
          <div>
            <h3 className="font-bold text-gray-900">{account.spot}</h3>
            <p className="text-xs text-gray-500">
              {account.customer_name || 'Sin nombre'} · {new Date(account.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer">
            <i className="ri-close-line text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {folios.map(folio => {
            const folioItems = items.filter(i => i.folio_number === folio);
            const folioTotal = folioItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
            return (
              <div key={folio} className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-b border-amber-100">
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                    Ronda #{String(folio).padStart(2, '0')}
                  </span>
                  <span className="text-sm font-bold text-amber-700">${folioTotal.toFixed(2)}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {folioItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{item.product_name}</p>
                        {item.size && <p className="text-xs text-amber-600">{item.size}</p>}
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-sm font-bold text-gray-900">{item.quantity}x ${item.unit_price.toFixed(2)}</p>
                        <p className="text-xs text-gray-400">${(item.unit_price * item.quantity).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="bg-gray-900 rounded-xl p-4">
            <div className="flex justify-between text-base font-black border-t border-gray-700 pt-2">
              <span className="text-gray-300">TOTAL COBRADO</span>
              <span className="text-amber-400">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}