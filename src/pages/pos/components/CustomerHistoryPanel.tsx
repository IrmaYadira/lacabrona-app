import { useState, useEffect, useCallback } from 'react';
import { supabasePos } from '../supabasePos';

interface CustomerHistoryPanelProps {
  customerId: number | null | undefined;
  customerName?: string;
  currentAccountTotal?: number;
}

interface CustomerData {
  id: number;
  name: string;
  phone?: string;
  visit_count: number;
  total_spent: number;
  last_visit?: string;
  birthday?: string;
  loyalty_points: number;
  notes?: string;
}

interface PastAccount {
  id: number;
  created_at: string;
  closed_at?: string;
  total: number;
  spot: string;
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatDateShort(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff < 7) return `Hace ${diff} días`;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

function getLoyaltyLevel(points: number): { label: string; color: string; icon: string; next: number } {
  if (points >= 50) return { label: 'Cabrón VIP', color: 'text-amber-600', icon: 'ri-vip-crown-fill', next: 0 };
  if (points >= 30) return { label: 'Habitual', color: 'text-violet-600', icon: 'ri-star-fill', next: 50 };
  if (points >= 10) return { label: 'Regular', color: 'text-emerald-600', icon: 'ri-medal-fill', next: 30 };
  return { label: 'Nuevo', color: 'text-gray-500', icon: 'ri-user-3-line', next: 10 };
}

export default function CustomerHistoryPanel({
  customerId,
  customerName,
  currentAccountTotal = 0,
}: CustomerHistoryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [pastAccounts, setPastAccounts] = useState<PastAccount[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);

    // Fetch customer profile
    const { data: custData } = await supabasePos
      .from('pos_customers')
      .select('id, name, phone, visit_count, total_spent, last_visit, birthday, loyalty_points, notes')
      .eq('id', customerId)
      .maybeSingle();

    if (custData) setCustomer(custData as CustomerData);

    // Fetch last 5 closed accounts with their payment totals
    const { data: accData } = await supabasePos
      .from('pos_accounts')
      .select('id, created_at, closed_at, spot, pos_account_items(unit_price, quantity)')
      .eq('customer_id', customerId)
      .eq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(5);

    if (accData) {
      const parsed: PastAccount[] = (accData as {
        id: number;
        created_at: string;
        closed_at?: string;
        spot: string;
        pos_account_items: { unit_price: number; quantity: number }[];
      }[]).map(acc => ({
        id: acc.id,
        created_at: acc.created_at,
        closed_at: acc.closed_at,
        spot: acc.spot,
        total: (acc.pos_account_items ?? []).reduce(
          (s, i) => s + i.unit_price * i.quantity, 0
        ),
      }));
      setPastAccounts(parsed);
    }

    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    if (isOpen && customerId) {
      fetchData();
    }
  }, [isOpen, customerId, fetchData]);

  // Si no tiene customer_id vinculado, no mostrar nada
  if (!customerId) return null;

  const level = customer ? getLoyaltyLevel(customer.loyalty_points ?? 0) : null;

  // Check birthday
  const isBirthday = (() => {
    if (!customer?.birthday) return false;
    const bday = new Date(customer.birthday);
    const today = new Date();
    return bday.getMonth() === today.getMonth() && bday.getDate() === today.getDate();
  })();

  return (
    <div className="border-b border-gray-100">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <i className="ri-history-line text-amber-600 text-sm" />
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">
            Historial del cliente
          </span>
          {isBirthday && (
            <span className="text-xs bg-rose-500 text-white px-1.5 py-0.5 rounded-full font-bold animate-pulse">
              🎂 Cumpleaños
            </span>
          )}
          {customer && (
            <span className={`text-xs font-semibold ${level?.color}`}>
              <i className={`${level?.icon} mr-0.5`} />
              {level?.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {customer && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="font-bold text-amber-600">{customer.loyalty_points ?? 0} pts</span>
              <span>·</span>
              <span>{customer.visit_count ?? 0} visitas</span>
            </div>
          )}
          {isOpen ? <i className="ri-arrow-up-s-line text-amber-500 text-sm" /> : <i className="ri-arrow-down-s-line text-amber-500 text-sm" />}
        </div>
      </button>

      {/* Panel expandible */}
      {isOpen && (
        <div className="bg-amber-50/50 border-t border-amber-100">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : customer ? (
            <div className="px-4 py-3 space-y-3">

              {/* Fila principal: stats */}
              <div className="grid grid-cols-3 gap-2">
                {/* Puntos lealtad */}
                <div className="bg-white rounded-xl p-3 text-center border border-amber-100">
                  <div className={`text-2xl font-black ${level?.color}`}>
                    {customer.loyalty_points ?? 0}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">puntos</div>
                  {level && level.next > 0 && (
                    <div className="text-[10px] text-gray-400 mt-1">
                      {level.next - (customer.loyalty_points ?? 0)} para {level.next === 30 ? 'Habitual' : level.next === 50 ? 'VIP' : 'subir'}
                    </div>
                  )}
                </div>

                {/* Total gastado */}
                <div className="bg-white rounded-xl p-3 text-center border border-amber-100">
                  <div className="text-2xl font-black text-gray-800">
                    ${(customer.total_spent ?? 0).toFixed(0)}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">total gastado</div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    {customer.visit_count ?? 0} visita{(customer.visit_count ?? 0) !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Última visita */}
                <div className="bg-white rounded-xl p-3 text-center border border-amber-100">
                  <div className="text-sm font-black text-gray-800 leading-tight">
                    {formatDateShort(customer.last_visit)}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">última visita</div>
                  {customer.birthday && (
                    <div className="text-[10px] text-gray-400 mt-1">
                      🎂 {new Date(customer.birthday).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                    </div>
                  )}
                </div>
              </div>

              {/* Barra de nivel */}
              {level && level.next > 0 && (
                <div className="bg-white rounded-xl p-3 border border-amber-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-bold ${level.color}`}>
                      <i className={`${level.icon} mr-1`} />
                      {level.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {customer.loyalty_points ?? 0} / {level.next} pts para siguiente nivel
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(((customer.loyalty_points ?? 0) / level.next) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Notas del cliente */}
              {customer.notes && (
                <div className="bg-amber-100 rounded-xl px-3 py-2 flex items-start gap-2">
                  <i className="ri-sticky-note-line text-amber-600 text-sm flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-relaxed">{customer.notes}</p>
                </div>
              )}

              {/* Últimas visitas */}
              {pastAccounts.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                    Últimas visitas
                  </p>
                  <div className="space-y-1.5">
                    {pastAccounts.map((acc, idx) => (
                      <div
                        key={acc.id}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                          idx === 0 ? 'bg-amber-100 border border-amber-200' : 'bg-white border border-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                            idx === 0 ? 'bg-amber-500' : 'bg-gray-200'
                          }`}>
                            <span className={`text-[10px] font-bold ${idx === 0 ? 'text-white' : 'text-gray-500'}`}>
                              {idx + 1}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-700 truncate">
                              {formatDateShort(acc.closed_at ?? acc.created_at)}
                            </p>
                            <p className="text-[10px] text-gray-400">{formatDate(acc.closed_at ?? acc.created_at)}</p>
                          </div>
                        </div>
                        <span className={`text-sm font-bold flex-shrink-0 ${idx === 0 ? 'text-amber-700' : 'text-gray-600'}`}>
                          ${acc.total.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pastAccounts.length === 0 && (
                <div className="text-center py-2">
                  <p className="text-xs text-gray-400">
                    <i className="ri-store-2-line mr-1" />
                    Primera visita al bar
                  </p>
                </div>
              )}

              {/* Consumo esta visita vs promedio */}
              {currentAccountTotal > 0 && customer.visit_count > 1 && (
                <div className="bg-white rounded-xl p-3 border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400">Esta visita</p>
                    <p className="text-base font-black text-gray-900">${currentAccountTotal.toFixed(2)}</p>
                  </div>
                  <i className="ri-arrow-right-line text-gray-300" />
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Promedio por visita</p>
                    <p className={`text-base font-black ${
                      currentAccountTotal >= (customer.total_spent / customer.visit_count)
                        ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      ${(customer.total_spent / customer.visit_count).toFixed(2)}
                    </p>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="px-4 py-4 text-center">
              <p className="text-xs text-gray-400">No se encontró el perfil del cliente</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}