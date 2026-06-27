import { useState } from 'react';
import { useAdminData, type DateRange } from '../hooks/useAdminData';
import type { AccountWithItems } from '../hooks/useAdminData';
import EditPaymentModal from './EditPaymentModal';

interface SalesHistoryProps {
  dateRange: DateRange;
}

const PAYMENT_LABELS_LOCAL: Record<string, string> = {
  cash: 'Efectivo', transfer: 'Transferencia', credit_card: 'Tarjeta Crédito', debit_card: 'Tarjeta Débito'
};
const PAYMENT_ICONS_LOCAL: Record<string, string> = {
  cash: 'ri-money-dollar-circle-line',
  transfer: 'ri-bank-line',
  credit_card: 'ri-bank-card-line',
  debit_card: 'ri-bank-card-2-line',
};

function formatDateTimeMX(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDateMX(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function escapeCSV(value: string | number | undefined): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportToCSV(accounts: AccountWithItems[], rangeLabel: string) {
  const headers = [
    'ID',
    'Mesa',
    'Area',
    'Cliente',
    'Telefono',
    'Abierto por',
    'Fecha apertura',
    'Fecha cierre',
    'Rondas',
    'Productos',
    'Items totales',
    'Subtotal consumos',
    'Propina',
    'Cargo terminal',
    'Total pagado',
    'Metodo de pago',
    'Cerrado por',
  ];

  const rows: (string | number)[][] = [];

  accounts.forEach(acc => {
    const items = acc.pos_account_items ?? [];
    const payments = acc.pos_payments ?? [];
    const products = items.map(i => `${i.quantity}x ${i.product_name}${i.size ? ` (${i.size})` : ''}`).join(' | ');
    const totalItems = items.reduce((s, i) => s + i.quantity, 0);
    const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);

    if (payments.length > 1) {
      // Pago mixto: una fila por cada método de pago
      payments.forEach((pay, idx) => {
        const payMethod = PAYMENT_LABELS_LOCAL[pay.payment_method] ?? pay.payment_method ?? 'N/A';
        rows.push([
          acc.id,
          acc.spot,
          acc.area,
          acc.customer_name ?? '',
          acc.customer_phone ?? '',
          acc.opened_by ?? '',
          formatDateTimeMX(acc.created_at),
          acc.closed_at ? formatDateTimeMX(acc.closed_at) : '',
          acc.folio_counter,
          products,
          totalItems,
          subtotal.toFixed(2),
          Number(pay.tip ?? 0).toFixed(2),
          Number(pay.card_fee ?? 0).toFixed(2),
          Number(pay.total ?? 0).toFixed(2),
          payMethod,
          pay.closed_by ?? '',
        ]);
      });
    } else if (payments.length === 1) {
      // Pago único: una sola fila
      const pay = payments[0];
      const payMethod = PAYMENT_LABELS_LOCAL[pay.payment_method] ?? pay.payment_method ?? 'N/A';
      rows.push([
        acc.id,
        acc.spot,
        acc.area,
        acc.customer_name ?? '',
        acc.customer_phone ?? '',
        acc.opened_by ?? '',
        formatDateTimeMX(acc.created_at),
        acc.closed_at ? formatDateTimeMX(acc.closed_at) : '',
        acc.folio_counter,
        products,
        totalItems,
        subtotal.toFixed(2),
        Number(pay.tip ?? 0).toFixed(2),
        Number(pay.card_fee ?? 0).toFixed(2),
        Number(pay.total ?? 0).toFixed(2),
        payMethod,
        pay.closed_by ?? '',
      ]);
    } else {
      // Sin pagos registrados
      rows.push([
        acc.id,
        acc.spot,
        acc.area,
        acc.customer_name ?? '',
        acc.customer_phone ?? '',
        acc.opened_by ?? '',
        formatDateTimeMX(acc.created_at),
        acc.closed_at ? formatDateTimeMX(acc.closed_at) : '',
        acc.folio_counter,
        products,
        totalItems,
        subtotal.toFixed(2),
        '0.00',
        '0.00',
        '0.00',
        'N/A',
        '',
      ]);
    }
  });

  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `ventas_${rangeLabel}_${formatDateMX(new Date().toISOString())}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function AccountDetail({ acc, onClose }: { acc: AccountWithItems; onClose: () => void }) {
  const folios = [...new Set((acc.pos_account_items ?? []).map(i => i.folio_number))].sort((a, b) => a - b);
  const allPayments = acc.pos_payments ?? [];
  const isMixed = allPayments.length > 1;
  const subtotal = (acc.pos_account_items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const totalPagado = allPayments.reduce((s, p) => s + Number(p.total ?? 0), 0);
  const totalCardFees = allPayments.reduce((s, p) => s + Number(p.card_fee ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between rounded-t-2xl">
          <div>
            <h3 className="font-bold text-gray-900">{acc.spot}</h3>
            <p className="text-xs text-gray-500">
              {acc.customer_name && `${acc.customer_name} · `}
              {new Date(acc.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer">
            <i className="ri-close-line text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Rondas */}
          {folios.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Sin productos registrados</p>
          ) : (
            folios.map(folio => {
              const folioItems = (acc.pos_account_items ?? []).filter(i => i.folio_number === folio);
              const folioTotal = folioItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
              return (
                <div key={folio} className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-b border-amber-100">
                    <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                      Ronda #{String(folio).padStart(2, '0')}
                    </span>
                    <span className="text-sm font-bold text-amber-700">MXN${folioTotal.toFixed(2)}</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {folioItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{item.product_name}</p>
                          {item.size && <p className="text-xs text-amber-600">{item.size}</p>}
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="text-sm font-bold text-gray-900">
                            {item.quantity}x MXN${item.unit_price.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-400">MXN${(item.unit_price * item.quantity).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}

          {/* Resumen de pago */}
          <div className="bg-gray-900 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm pb-2 border-b border-gray-700">
              <span className="text-gray-400">Subtotal consumos</span>
              <span className="text-white font-semibold">MXN${subtotal.toFixed(2)}</span>
            </div>
            {isMixed ? (
              <>
                <p className="text-gray-400 text-xs uppercase tracking-wide font-semibold">Pagos Mixtos</p>
                {allPayments.map((p, idx) => (
                  <div key={p.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300 flex items-center gap-1.5">
                        <i className={PAYMENT_ICONS_LOCAL[p.payment_method] ?? 'ri-money-dollar-circle-line'} />
                        {PAYMENT_LABELS_LOCAL[p.payment_method] ?? p.payment_method}
                        <span className="text-gray-500 text-xs">#{idx + 1}</span>
                      </span>
                      <span className="text-white">MXN${Number(p.subtotal).toFixed(2)}</span>
                    </div>
                    {Number(p.card_fee) > 0 && (
                      <div className="flex justify-between text-xs pl-4">
                        <span className="text-gray-500">Cargo terminal</span>
                        <span className="text-amber-400">+MXN${Number(p.card_fee).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </>
            ) : allPayments.length === 1 ? (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <i className={PAYMENT_ICONS_LOCAL[allPayments[0].payment_method] ?? 'ri-money-dollar-circle-line'} />
                  {PAYMENT_LABELS_LOCAL[allPayments[0].payment_method] ?? allPayments[0].payment_method}
                </span>
                <span className="text-white">MXN${Number(allPayments[0].subtotal).toFixed(2)}</span>
              </div>
            ) : null}
            {totalCardFees > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total cargos terminal</span>
                <span className="text-amber-400">+MXN${totalCardFees.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black border-t border-gray-700 pt-2">
              <span className="text-gray-300">TOTAL COBRADO</span>
              <span className="text-amber-400">MXN${totalPagado.toFixed(2)}</span>
            </div>
            {!isMixed && allPayments[0]?.split_count > 1 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Por persona ({allPayments[0].split_count})</span>
                <span className="text-green-400 font-semibold">MXN${(totalPagado / allPayments[0].split_count).toFixed(2)} c/u</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SalesHistory({ dateRange }: SalesHistoryProps) {
  const { closedAccounts, loading } = useAdminData(dateRange);
  const [selectedAccount, setSelectedAccount] = useState<AccountWithItems | null>(null);
  const [editingPayment, setEditingPayment] = useState<AccountWithItems | null>(null);
  const [search, setSearch] = useState('');

  const filtered = closedAccounts.filter(acc =>
    !search || acc.spot.toLowerCase().includes(search.toLowerCase()) ||
    (acc.customer_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const rangeLabel = dateRange === 'today' ? 'hoy' : dateRange === 'week' ? 'en 7 días' : 'en 30 días';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-gray-900">Historial de Ventas</h2>
          <p className="text-sm text-gray-500">{closedAccounts.length} cuentas cerradas {rangeLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToCSV(closedAccounts, rangeLabel)}
            className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 cursor-pointer transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <i className="ri-file-download-line" />
            Exportar CSV
          </button>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar mesa o cliente..."
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 w-full sm:w-64"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <i className="ri-inbox-line text-4xl text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">No hay ventas registradas {rangeLabel}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(acc => {
            const allPays = acc.pos_payments ?? [];
            const isMixedCard = allPays.length > 1;
            const total = allPays.length > 0
              ? allPays.reduce((s, p) => s + Number(p.total ?? 0), 0)
              : (acc.pos_account_items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
            const pay = allPays[0];
            const folios = [...new Set((acc.pos_account_items ?? []).map(i => i.folio_number))].sort((a, b) => a - b);

            return (
              <div
                key={acc.id}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
              >
                {/* Header de la cuenta */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-xl">
                      <i className="ri-table-line text-gray-500" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{acc.spot}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-gray-500">{acc.customer_name || 'Sin nombre'}</p>
                        {acc.customer_phone && (
                          <p className="text-xs text-gray-400">{acc.customer_phone}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-lg font-black text-gray-900">MXN${total.toFixed(2)}</p>
                      {isMixedCard ? (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
                          Pago Mixto
                        </span>
                      ) : pay ? (
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                          pay.payment_method === 'cash' ? 'bg-green-100 text-green-700' :
                          pay.payment_method === 'transfer' ? 'bg-amber-100 text-amber-700' :
                          pay.payment_method === 'credit_card' ? 'bg-rose-100 text-rose-700' :
                          pay.payment_method === 'debit_card' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {PAYMENT_LABELS_LOCAL[pay.payment_method] ?? pay.payment_method}
                        </span>
                      ) : null}
                    </div>
                    <button
                      onClick={() => setSelectedAccount(acc)}
                      className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-amber-100 hover:text-amber-700 text-gray-500 rounded-xl cursor-pointer transition-colors"
                    >
                      <i className="ri-eye-line" />
                    </button>
                    {(acc.pos_payments ?? []).length > 0 && (
                      <button
                        onClick={() => setEditingPayment(acc)}
                        className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-blue-100 hover:text-blue-700 text-gray-500 rounded-xl cursor-pointer transition-colors"
                        title="Editar forma de pago"
                      >
                        <i className="ri-pencil-line" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Rondas inline */}
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {acc.folio_counter} ronda{acc.folio_counter !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-gray-400">
                      · {new Date(acc.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {folios.map(folio => {
                      const folioItems = (acc.pos_account_items ?? []).filter(i => i.folio_number === folio);
                      const folioTotal = folioItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
                      return (
                        <div key={folio} className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 text-xs">
                          <span className="font-bold text-amber-700">Ronda #{String(folio).padStart(2, '0')}</span>
                          <span className="text-amber-600 ml-1">MXN${folioTotal.toFixed(2)}</span>
                          <span className="text-amber-500 ml-1">· {folioItems.reduce((s, i) => s + i.quantity, 0)} items</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedAccount && (
        <AccountDetail acc={selectedAccount} onClose={() => setSelectedAccount(null)} />
      )}

      {editingPayment && (() => {
        const payments = (editingPayment.pos_payments ?? []).map(p => ({
          id: p.id,
          payment_method: p.payment_method,
          subtotal: Number(p.subtotal),
          card_fee: Number(p.card_fee),
          total: Number(p.total),
          split_count: p.split_count,
          tip: Number(p.tip ?? 0),
          closed_by: p.closed_by,
        }));
        const subtotalItems = (editingPayment.pos_account_items ?? []).reduce(
          (s, i) => s + i.unit_price * i.quantity, 0
        );
        return (
          <EditPaymentModal
            accountId={editingPayment.id}
            spot={editingPayment.spot}
            customerName={editingPayment.customer_name}
            payments={payments}
            subtotalItems={subtotalItems}
            onClose={() => setEditingPayment(null)}
            onSaved={() => setEditingPayment(null)}
          />
        );
      })()}
    </div>
  );
}