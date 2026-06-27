import { useState, useEffect, useRef } from 'react';
import { useAdminData, type DateRange, PAYMENT_LABELS } from '../hooks/useAdminData';
import { supabasePos } from '@/pages/pos/supabasePos';

interface DayStatsProps {
  dateRange: DateRange;
}

function KpiCard({ label, value, icon, color, sub, pulse }: {
  label: string; value: string; icon: string; color: string; sub?: string; pulse?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
          {pulse && <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}
        </div>
        <div className={`w-9 h-9 flex items-center justify-center rounded-xl ${color}`}>
          <i className={`${icon} text-white text-base`} />
        </div>
      </div>
      <p className="text-2xl md:text-3xl font-black text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

interface LiveSale {
  id: number;
  spot: string;
  area: string;
  customer_name?: string;
  closed_at: string;
  total: number;
  payment_method: string;
  folio_counter: number;
  isNew?: boolean;
}

export default function DayStats({ dateRange }: DayStatsProps) {
  const { stats, loading, openAccounts, closedAccounts, accounts, refetch } = useAdminData(dateRange);
  const [liveSales, setLiveSales] = useState<LiveSale[]>([]);
  const [newSaleFlash, setNewSaleFlash] = useState(false);
  const prevClosedIds = useRef<Set<number>>(new Set());
  const rangeLabel = dateRange === 'today' ? 'hoy' : dateRange === 'week' ? 'en 7 días' : 'en 30 días';

  // Build live sales from closedAccounts
  useEffect(() => {
    const sales: LiveSale[] = closedAccounts.slice(0, 50).map(acc => {
      const pay = acc.pos_payments?.[0];
      const total = pay?.total ?? (acc.pos_account_items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
      const isNew = !prevClosedIds.current.has(acc.id) && prevClosedIds.current.size > 0;
      return {
        id: acc.id,
        spot: acc.spot,
        area: acc.area,
        customer_name: acc.customer_name,
        closed_at: acc.closed_at ?? acc.created_at,
        total,
        payment_method: pay?.payment_method ?? '',
        folio_counter: acc.folio_counter,
        isNew,
      };
    });
    setLiveSales(sales);

    // Check if there are new sales to flash
    const newIds = new Set(closedAccounts.map(a => a.id));
    const hasNew = closedAccounts.some(a => !prevClosedIds.current.has(a.id)) && prevClosedIds.current.size > 0;
    if (hasNew) {
      setNewSaleFlash(true);
      setTimeout(() => setNewSaleFlash(false), 3000);
    }
    prevClosedIds.current = newIds;
  }, [closedAccounts]);

  // Real-time subscription to pos_payments (new closed accounts)
  useEffect(() => {
    const channel = supabasePos
      .channel('admin-live-sales')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'pos_payments',
      }, () => {
        refetch();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'pos_accounts',
        filter: 'status=eq.closed',
      }, () => {
        refetch();
      })
      .subscribe();

    return () => { supabasePos.removeChannel(channel); };
  }, [refetch]);

  const paymentColor: Record<string, string> = {
    cash: 'bg-green-100 text-green-700',
    transfer: 'bg-amber-100 text-amber-700',
    credit_card: 'bg-rose-100 text-rose-700',
    debit_card: 'bg-orange-100 text-orange-700',
  };

  const totalRondas = accounts.reduce((s, a) => s + (a.folio_counter ?? 0), 0);

  // Totales por método de pago (suma TODOS los pagos, incluyendo mixtos)
  const paymentTotals = closedAccounts.reduce((acc, a) => {
    (a.pos_payments ?? []).forEach(p => {
      acc[p.payment_method] = (acc[p.payment_method] ?? 0) + Number(p.total ?? 0);
    });
    return acc;
  }, {} as Record<string, number>);

  // Total general (suma de todos los métodos)
  const grandTotalFromPayments = Object.values(paymentTotals).reduce((s, v) => s + v, 0);

  // Subtotal consumos (sin cargos de terminal)
  const subtotalConsumos = closedAccounts.reduce((s, a) =>
    s + (a.pos_account_items ?? []).reduce((ps, i) => ps + i.unit_price * i.quantity, 0), 0);

  const totalCardFees = closedAccounts.reduce((s, a) =>
    s + (a.pos_payments ?? []).reduce((ps, p) => ps + Number(p.card_fee ?? 0), 0), 0);

  const PAYMENT_DETAIL = [
    { key: 'cash', label: 'Efectivo', icon: 'ri-money-dollar-circle-line', color: 'text-green-600 bg-green-50 border-green-200' },
    { key: 'transfer', label: 'Transferencia', icon: 'ri-bank-line', color: 'text-amber-600 bg-amber-50 border-amber-200' },
    { key: 'credit_card', label: 'T. Crédito', icon: 'ri-bank-card-line', color: 'text-rose-600 bg-rose-50 border-rose-200' },
    { key: 'debit_card', label: 'T. Débito', icon: 'ri-bank-card-2-line', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Ventas Totales"
          value={`MXN$${stats.totalRevenue.toFixed(2)}`}
          icon="ri-money-dollar-circle-line"
          color="bg-amber-500"
          sub={`${stats.closedCount} cuentas cerradas ${rangeLabel}`}
          pulse
        />
        <KpiCard
          label="Ticket Promedio"
          value={`MXN$${stats.avgTicket.toFixed(2)}`}
          icon="ri-receipt-line"
          color="bg-green-500"
          sub="Por cuenta cerrada"
        />
        <KpiCard
          label="Mesas Activas"
          value={String(stats.openCount)}
          icon="ri-table-line"
          color="bg-orange-500"
          sub="Cuentas abiertas ahorita"
          pulse={stats.openCount > 0}
        />
        <KpiCard
          label="Productos Vendidos"
          value={String(stats.totalItems)}
          icon="ri-restaurant-line"
          color="bg-red-500"
          sub={`En ${totalRondas} ronda${totalRondas !== 1 ? 's' : ''}`}
        />
      </div>

      {/* ====== CUADRE DE VENTAS ====== */}
      {closedAccounts.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Cuadre de Ventas</h2>
              <p className="text-xs text-gray-400 mt-0.5">Los totales por forma de pago deben cuadrar con la venta total</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Venta Total</p>
              <p className="text-2xl font-black text-amber-600">MXN${grandTotalFromPayments.toFixed(2)}</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {/* Desglose por método de pago con barras de porcentaje */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {PAYMENT_DETAIL.map(({ key, label, icon, color }) => {
                const amount = paymentTotals[key] ?? 0;
                const pct = grandTotalFromPayments > 0 ? (amount / grandTotalFromPayments) * 100 : 0;
                return (
                  <div key={key} className={`rounded-xl border p-4 ${color}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <i className={`${icon} text-lg`} />
                      <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
                    </div>
                    <p className="text-xl font-black">MXN${amount.toFixed(2)}</p>
                    <div className="mt-2">
                      <div className="h-1.5 bg-black/10 rounded-full overflow-hidden">
                        <div className="h-full bg-current opacity-50 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs opacity-70 mt-1">{pct.toFixed(1)}% del total</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Línea de cuadre */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Verificación de Cuadre</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal consumos (antes de comisiones)</span>
                  <span className="font-semibold text-gray-900">MXN${subtotalConsumos.toFixed(2)}</span>
                </div>
                {totalCardFees > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Comisiones terminal bancaria (3%)</span>
                    <span className="font-semibold text-amber-600">+ MXN${totalCardFees.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-2 border-t border-gray-200">
                  <span className="text-gray-800">Total cobrado a clientes</span>
                  <span className="text-gray-900">MXN${grandTotalFromPayments.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-gray-800">Suma métodos de pago</span>
                  <span className="text-gray-900">MXN${grandTotalFromPayments.toFixed(2)}</span>
                </div>
                <div className={`flex justify-between font-bold pt-2 border-t border-gray-200 rounded-lg px-3 py-2 ${
                  Math.abs(grandTotalFromPayments - subtotalConsumos - totalCardFees) < 0.01
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}>
                  <span className="flex items-center gap-2">
                    <i className={Math.abs(grandTotalFromPayments - subtotalConsumos - totalCardFees) < 0.01 ? 'ri-check-double-line' : 'ri-alert-line'} />
                    {Math.abs(grandTotalFromPayments - subtotalConsumos - totalCardFees) < 0.01 ? 'Todo cuadra correctamente' : 'Diferencia detectada'}
                  </span>
                  <span>{
                    Math.abs(grandTotalFromPayments - subtotalConsumos - totalCardFees) < 0.01
                      ? '✓ $0.00'
                      : `MXN$${(grandTotalFromPayments - subtotalConsumos - totalCardFees).toFixed(2)}`
                  }</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cuentas abiertas ahora */}
      {openAccounts.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Cuentas Abiertas Ahora ({openAccounts.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {openAccounts.map(acc => {
              const accTotal = (acc.pos_account_items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
              const mins = Math.floor((Date.now() - new Date(acc.created_at).getTime()) / 60000);
              const hrs = Math.floor(mins / 60);
              const elapsed = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
              const overTime = mins >= 120;
              return (
                <div key={acc.id} className={`bg-white rounded-xl border px-4 py-3 ${overTime ? 'border-red-200 bg-red-50/30' : 'border-gray-100'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm">{acc.spot}</p>
                      {acc.customer_name && <p className="text-xs text-gray-500 truncate">{acc.customer_name}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ml-2 ${overTime ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                      {overTime ? 'Mucho tiempo' : 'Activa'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-xs flex items-center gap-1 ${overTime ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                        <i className="ri-time-line" />{elapsed}
                      </span>
                      <span className="text-xs text-amber-600 font-semibold">
                        {acc.folio_counter} ronda{acc.folio_counter !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="text-base font-black text-gray-900">MXN${accTotal.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Historial en tiempo real */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            {newSaleFlash
              ? <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
              : <span className="w-2 h-2 bg-gray-300 rounded-full" />
            }
            Ventas Cerradas {rangeLabel === 'hoy' ? 'Hoy' : rangeLabel === 'en 7 días' ? '— 7 días' : '— 30 días'}
            {liveSales.length > 0 && (
              <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {liveSales.length}
              </span>
            )}
          </h2>
          <button
            onClick={refetch}
            className="text-xs text-gray-400 hover:text-amber-600 cursor-pointer flex items-center gap-1 transition-colors whitespace-nowrap"
          >
            <i className="ri-refresh-line" />
            Actualizar
          </button>
        </div>

        {newSaleFlash && (
          <div className="bg-amber-50 border border-amber-300 text-amber-800 px-4 py-2.5 rounded-xl text-sm font-semibold mb-3 flex items-center gap-2 animate-pulse">
            <i className="ri-notification-3-line text-amber-500" />
            Nueva venta registrada!
          </div>
        )}

        {liveSales.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <i className="ri-inbox-line text-3xl text-gray-300 mb-2" />
            <p className="text-gray-400 text-sm">No hay ventas registradas {rangeLabel}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {/* Mini summary strip */}
            <div className="grid grid-cols-3 border-b border-gray-100 bg-gray-50">
              <div className="px-4 py-3 border-r border-gray-100">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Total vendido</p>
                <p className="text-lg font-black text-amber-600">MXN${stats.totalRevenue.toFixed(2)}</p>
              </div>
              <div className="px-4 py-3 border-r border-gray-100">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Cuentas</p>
                <p className="text-lg font-black text-gray-900">{liveSales.length}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Prom. ticket</p>
                <p className="text-lg font-black text-green-600">MXN${stats.avgTicket.toFixed(2)}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Mesa</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Cliente</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Rondas</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Pago</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {liveSales.map(sale => (
                    <tr
                      key={sale.id}
                      className={`transition-colors ${sale.isNew ? 'bg-amber-50 hover:bg-amber-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {sale.isNew && (
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse flex-shrink-0" />
                          )}
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{sale.spot}</p>
                            <p className="text-xs text-gray-400">{sale.area}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <p className="text-gray-700 text-sm">{sale.customer_name || <span className="text-gray-300">—</span>}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                          {sale.folio_counter}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {sale.payment_method ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${paymentColor[sale.payment_method] ?? 'bg-gray-100 text-gray-600'}`}>
                            {PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-black text-gray-900">MXN${sale.total.toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        <span className="text-xs text-gray-400">
                          {new Date(sale.closed_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}