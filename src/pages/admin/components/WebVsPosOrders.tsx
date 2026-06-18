import { useAdminData, type DateRange } from '../hooks/useAdminData';
import type { AccountWithItems } from '../hooks/useAdminData';

interface WebVsPosOrdersProps {
  dateRange: DateRange;
}

function OrderCard({ acc }: { acc: AccountWithItems }) {
  const items = acc.pos_account_items ?? [];
  const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const folios = [...new Set(items.map(i => i.folio_number))].sort((a, b) => a - b);
  const isWeb = acc.source === 'web';

  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${isWeb ? 'border-green-200' : 'border-gray-100'}`}>
      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isWeb ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
        <div className="flex items-center gap-2">
          <span className={`w-6 h-6 flex items-center justify-center rounded-lg text-xs ${isWeb ? 'bg-green-500 text-white' : 'bg-gray-700 text-white'}`}>
            <i className={isWeb ? 'ri-global-line' : 'ri-store-2-line'} />
          </span>
          <span className="font-bold text-gray-900 text-sm">{acc.spot}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${isWeb ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {isWeb ? 'Web' : 'POS'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${acc.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
            {acc.status === 'open' ? 'Abierta' : 'Cerrada'}
          </span>
          <span className="font-black text-gray-900 text-sm">${total.toFixed(2)}</span>
        </div>
      </div>

      <div className="px-4 py-3">
        {acc.customer_name && (
          <p className="text-xs text-gray-500 mb-1.5">
            <i className="ri-user-line mr-1" />{acc.customer_name}
            {acc.customer_phone && ` · ${acc.customer_phone}`}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {folios.map(folio => {
            const fItems = items.filter(i => i.folio_number === folio);
            const fTotal = fItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
            return (
              <span key={folio} className="text-xs bg-amber-50 border border-amber-100 text-amber-700 px-2 py-0.5 rounded-lg font-medium">
                Ronda #{folio} · ${fTotal.toFixed(2)}
              </span>
            );
          })}
        </div>
        <p className="text-xs text-gray-400">
          <i className="ri-time-line mr-1" />
          {new Date(acc.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

export default function WebVsPosOrders({ dateRange }: WebVsPosOrdersProps) {
  const { accounts, webOrders, posOrders, loading } = useAdminData(dateRange);

  const rangeLabel = dateRange === 'today' ? 'hoy' : dateRange === 'week' ? 'en 7 días' : 'en 30 días';

  const webRevenue = webOrders.reduce((s, a) =>
    s + (a.pos_account_items ?? []).reduce((ss, i) => ss + i.unit_price * i.quantity, 0), 0
  );
  const posRevenue = posOrders.reduce((s, a) =>
    s + (a.pos_account_items ?? []).reduce((ss, i) => ss + i.unit_price * i.quantity, 0), 0
  );
  const totalRevenue = webRevenue + posRevenue;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-black text-gray-900">Pedidos Web vs POS</h2>
        <p className="text-sm text-gray-500">{accounts.length} pedidos en total {rangeLabel}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Comparativa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Web */}
            <div className="bg-white border-2 border-green-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 flex items-center justify-center bg-green-100 rounded-xl">
                  <i className="ri-global-line text-green-600 text-lg" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">Pedidos desde la Web</p>
                  <p className="text-xs text-gray-500">Clientes escanearon QR</p>
                </div>
              </div>
              <p className="text-3xl font-black text-gray-900">{webOrders.length}</p>
              <p className="text-sm text-green-600 font-semibold mt-1">${webRevenue.toFixed(2)}</p>
              {totalRevenue > 0 && (
                <div className="mt-3">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${(webRevenue / totalRevenue) * 100}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{((webRevenue / totalRevenue) * 100).toFixed(1)}% del total</p>
                </div>
              )}
            </div>

            {/* POS */}
            <div className="bg-white border-2 border-amber-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 flex items-center justify-center bg-amber-100 rounded-xl">
                  <i className="ri-store-2-line text-amber-600 text-lg" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">Pedidos desde el POS</p>
                  <p className="text-xs text-gray-500">Creados por el mesero</p>
                </div>
              </div>
              <p className="text-3xl font-black text-gray-900">{posOrders.length}</p>
              <p className="text-sm text-amber-600 font-semibold mt-1">${posRevenue.toFixed(2)}</p>
              {totalRevenue > 0 && (
                <div className="mt-3">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(posRevenue / totalRevenue) * 100}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{((posRevenue / totalRevenue) * 100).toFixed(1)}% del total</p>
                </div>
              )}
            </div>
          </div>

          {/* Lista unificada */}
          {accounts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <i className="ri-inbox-line text-4xl text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">Sin pedidos registrados {rangeLabel}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map(acc => (
                <OrderCard key={acc.id} acc={acc} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}