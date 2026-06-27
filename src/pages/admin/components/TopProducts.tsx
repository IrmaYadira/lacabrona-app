import { useAdminData, type DateRange } from '../hooks/useAdminData';

interface TopProductsProps {
  dateRange: DateRange;
}

export default function TopProducts({ dateRange }: TopProductsProps) {
  const { topProducts, loading, stats } = useAdminData(dateRange);

  const maxQty = topProducts[0]?.total_qty ?? 1;
  const rangeLabel = dateRange === 'today' ? 'hoy' : dateRange === 'week' ? 'en 7 días' : 'en 30 días';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-gray-900">Productos Más Vendidos</h2>
        <p className="text-sm text-gray-500">{stats.totalItems} productos vendidos {rangeLabel}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : topProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <i className="ri-bar-chart-2-line text-4xl text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">Sin datos de ventas {rangeLabel}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <div className="grid grid-cols-12 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span className="col-span-1">#</span>
              <span className="col-span-5">Producto</span>
              <span className="col-span-3 text-center">Cantidad</span>
              <span className="col-span-3 text-right">Ingresos</span>
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            {topProducts.map((product, idx) => {
              const barWidth = Math.round((product.total_qty / maxQty) * 100);
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;

              return (
                <div key={product.product_name} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="grid grid-cols-12 items-center gap-2">
                    <div className="col-span-1 flex items-center">
                      {medal ? (
                        <span className="text-base">{medal}</span>
                      ) : (
                        <span className="text-xs text-gray-400 font-semibold">{idx + 1}</span>
                      )}
                    </div>
                    <div className="col-span-5">
                      <p className="text-sm font-semibold text-gray-900 leading-tight">{product.product_name}</p>
                      {/* bar */}
                      <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-amber-400' : idx === 2 ? 'bg-amber-300' : 'bg-gray-300'
                          }`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                    <div className="col-span-3 text-center">
                      <span className={`text-sm font-black ${idx < 3 ? 'text-amber-600' : 'text-gray-900'}`}>
                        {product.total_qty}
                      </span>
                      <p className="text-xs text-gray-400">unidades</p>
                    </div>
                    <div className="col-span-3 text-right">
                      <p className="text-sm font-bold text-gray-900">MXN${product.total_revenue.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total footer */}
          <div className="px-5 py-3 bg-gray-900 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
              Total vendido
            </span>
            <span className="text-base font-black text-amber-400">
              {topProducts.reduce((s, p) => s + p.total_qty, 0)} productos · MXN${topProducts.reduce((s, p) => s + p.total_revenue, 0).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}