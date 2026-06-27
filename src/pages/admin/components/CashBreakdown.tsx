import { useAdminData, type DateRange, PAYMENT_LABELS, PAYMENT_COLORS } from '../hooks/useAdminData';

interface CashBreakdownProps {
  dateRange: DateRange;
}

export default function CashBreakdown({ dateRange }: CashBreakdownProps) {
  const { paymentBreakdown, stats, loading, closedAccounts } = useAdminData(dateRange);

  const rangeLabel = dateRange === 'today' ? 'hoy' : dateRange === 'week' ? 'en 7 días' : 'en 30 días';
  const totalCardFee = closedAccounts.reduce((s, a) => s + (a.pos_payments?.[0]?.card_fee ?? 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-gray-900">Corte de Caja</h2>
        <p className="text-sm text-gray-500">Resumen por forma de pago {rangeLabel}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Total general */}
          <div className="bg-gray-900 rounded-2xl p-6">
            <p className="text-gray-400 text-sm mb-1">Total recaudado {rangeLabel}</p>
            <p className="text-4xl font-black text-amber-400">MXN${stats.totalRevenue.toFixed(2)}</p>
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <span className="text-xs text-gray-400">
                <i className="ri-receipt-line mr-1" />{stats.closedCount} cuentas cerradas
              </span>
              <span className="text-xs text-gray-400">
                <i className="ri-user-line mr-1" />Ticket prom. MXN${stats.avgTicket.toFixed(2)}
              </span>
              {totalCardFee > 0 && (
                <span className="text-xs text-amber-500">
                  <i className="ri-bank-card-line mr-1" />Cargos terminal: MXN${totalCardFee.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* Por método de pago */}
          {paymentBreakdown.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <i className="ri-money-dollar-circle-line text-4xl text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">Sin pagos registrados {rangeLabel}</p>
            </div>
          ) : (
            <>
              {/* Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {paymentBreakdown.map(pay => {
                  const pct = stats.totalRevenue > 0 ? (pay.total / stats.totalRevenue) * 100 : 0;
                  const colorClass = PAYMENT_COLORS[pay.payment_method] ?? 'bg-gray-400';
                  return (
                    <div key={pay.payment_method} className="bg-white rounded-2xl border border-gray-100 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${colorClass}`} />
                          <span className="font-bold text-gray-900 text-sm">
                            {PAYMENT_LABELS[pay.payment_method] ?? pay.payment_method}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                          {pay.count} venta{pay.count !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-2xl font-black text-gray-900 mb-2">MXN${pay.total.toFixed(2)}</p>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{pct.toFixed(1)}% del total</p>
                    </div>
                  );
                })}
              </div>

              {/* Tabla detalle */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Detalle por método</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {paymentBreakdown.map(pay => {
                    const pct = stats.totalRevenue > 0 ? (pay.total / stats.totalRevenue) * 100 : 0;
                    const colorClass = PAYMENT_COLORS[pay.payment_method] ?? 'bg-gray-400';
                    return (
                      <div key={pay.payment_method} className="flex items-center justify-between px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full ${colorClass} flex-shrink-0`} />
                          <span className="text-sm font-semibold text-gray-800">
                            {PAYMENT_LABELS[pay.payment_method] ?? pay.payment_method}
                          </span>
                        </div>
                        <div className="flex items-center gap-6">
                          <span className="text-xs text-gray-400">{pay.count} cobros</span>
                          <span className="text-xs text-gray-500">{pct.toFixed(1)}%</span>
                          <span className="text-sm font-black text-gray-900">MXN${pay.total.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between px-5 py-3.5 bg-gray-900 border-t border-gray-200">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">TOTAL</span>
                  <span className="text-base font-black text-amber-400">MXN${stats.totalRevenue.toFixed(2)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}