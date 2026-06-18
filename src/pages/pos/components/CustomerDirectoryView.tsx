import { useState, useEffect, useCallback } from 'react';
import { supabasePos } from '../supabasePos';
import CustomerProfileModal from './CustomerProfileModal';

interface PosCustomer {
  id: number;
  name: string;
  phone?: string;
  notes?: string;
  visit_count: number;
  total_spent: number;
  last_visit?: string;
  created_at: string;
  // Extra: cuentas abiertas hoy
  openAccountsToday?: number;
  spentToday?: number;
}

interface CustomerDirectoryViewProps {
  onBack: () => void;
  onGoToAccount?: (accountId: number) => void;
}

export default function CustomerDirectoryView({ onBack, onGoToAccount }: CustomerDirectoryViewProps) {
  const [customers, setCustomers] = useState<PosCustomer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'todos' | 'hoy'>('hoy');

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabasePos
      .from('pos_customers')
      .select('*')
      .order('last_visit', { ascending: false, nullsFirst: false });

    if (data) {
      // Fetch today's accounts for all customers to get "open today" info
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: todayAccs } = await supabasePos
        .from('pos_accounts')
        .select('id, customer_id, status, pos_account_items(unit_price, quantity)')
        .gte('created_at', todayStart.toISOString());

      const enriched = (data as PosCustomer[]).map(cust => {
        const custAccs = (todayAccs ?? []).filter((a: Record<string, unknown>) => a.customer_id === cust.id);
        const openToday = custAccs.filter((a: Record<string, unknown>) => a.status === 'open').length;
        const spentToday = custAccs.reduce((sum: number, acc: Record<string, unknown>) => {
          const items = (acc.pos_account_items as { unit_price: number; quantity: number }[]) ?? [];
          return sum + items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
        }, 0);
        return { ...cust, openAccountsToday: openToday, spentToday };
      });
      setCustomers(enriched);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleCreateCustomer = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const { data } = await supabasePos
      .from('pos_customers')
      .insert({ name: newName.trim(), phone: newPhone.trim() || null, visit_count: 0, total_spent: 0 })
      .select()
      .maybeSingle();
    setSaving(false);
    if (data) {
      setNewName('');
      setNewPhone('');
      setShowNewForm(false);
      await fetchCustomers();
      setSelectedId((data as PosCustomer).id);
    }
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const filtered = customers
    .filter(c => {
      const matchSearch = !search.trim() ||
        c.name.toLowerCase().includes(search.trim().toLowerCase()) ||
        (c.phone ?? '').includes(search.trim());
      const matchFilter = filter === 'todos' ||
        (filter === 'hoy' && c.last_visit && new Date(c.last_visit) >= todayStart);
      return matchSearch && matchFilter;
    });

  const activeToday = customers.filter(
    c => c.last_visit && new Date(c.last_visit) >= todayStart
  ).length;

  const totalTodaySpent = customers
    .filter(c => c.last_visit && new Date(c.last_visit) >= todayStart)
    .reduce((s, c) => s + (c.spentToday ?? 0), 0);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-700 cursor-pointer transition-colors"
        >
          <i className="ri-arrow-left-line text-gray-300" />
        </button>
        <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
          <i className="ri-contacts-book-line text-white text-sm" />
        </div>
        <div className="flex-1">
          <h1 className="font-bold text-sm">Directorio de Clientes</h1>
          <p className="text-gray-400 text-xs">{customers.length} clientes registrados · {activeToday} activos hoy</p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
        >
          <i className="ri-user-add-line" />
          Nuevo Cliente
        </button>
      </div>

      {/* Stats banner */}
      {activeToday > 0 && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-gray-500">Hoy en el bar:</span>
            <span className="text-sm font-bold text-gray-900">{activeToday} clientes</span>
          </div>
          <span className="text-gray-300">·</span>
          <div className="flex items-center gap-1.5">
            <i className="ri-money-dollar-circle-line text-amber-500 text-sm" />
            <span className="text-sm font-bold text-amber-600">${totalTodaySpent.toFixed(2)}</span>
            <span className="text-xs text-gray-400">consumido en total</span>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2">
        <div className="relative flex-1">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o celular..."
            className="w-full pl-8 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-400 focus:bg-white transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-300 hover:bg-gray-400 cursor-pointer transition-colors"
            >
              <i className="ri-close-line text-white text-xs" />
            </button>
          )}
        </div>
        {/* Filter toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setFilter('hoy')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
              filter === 'hoy' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Hoy
          </button>
          <button
            onClick={() => setFilter('todos')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
              filter === 'todos' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Todos
          </button>
        </div>
      </div>

      {/* Customer list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
              <i className="ri-user-search-line text-2xl text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm font-medium">
              {search ? 'No se encontró ningún cliente' : filter === 'hoy' ? 'Ningún cliente hoy todavía' : 'Sin clientes registrados'}
            </p>
            {!search && (
              <button
                onClick={() => setShowNewForm(true)}
                className="mt-4 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className="ri-user-add-line mr-1" />
                Registrar Cliente
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(cust => {
              const isActiveToday = cust.last_visit && new Date(cust.last_visit) >= todayStart;
              const hasOpenAccounts = (cust.openAccountsToday ?? 0) > 0;
              return (
                <button
                  key={cust.id}
                  onClick={() => setSelectedId(cust.id)}
                  className="w-full bg-white rounded-xl border border-gray-200 hover:border-amber-300 hover:bg-amber-50 px-4 py-3 flex items-center gap-3 cursor-pointer transition-all text-left"
                >
                  {/* Avatar */}
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                    hasOpenAccounts ? 'bg-green-500' : isActiveToday ? 'bg-amber-500' : 'bg-gray-200'
                  }`}>
                    <span className={`font-bold text-base ${hasOpenAccounts || isActiveToday ? 'text-white' : 'text-gray-500'}`}>
                      {cust.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{cust.name}</p>
                      {hasOpenAccounts && (
                        <span className="flex items-center gap-1 bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          {cust.openAccountsToday} cuenta{(cust.openAccountsToday ?? 0) > 1 ? 's' : ''} abierta{(cust.openAccountsToday ?? 0) > 1 ? 's' : ''}
                        </span>
                      )}
                      {isActiveToday && !hasOpenAccounts && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Estuvo hoy</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {cust.phone && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <i className="ri-phone-line" />
                          {cust.phone}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {cust.visit_count} visita{cust.visit_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Right: amounts */}
                  <div className="text-right flex-shrink-0">
                    {isActiveToday && (cust.spentToday ?? 0) > 0 && (
                      <p className="text-sm font-bold text-amber-600">${(cust.spentToday ?? 0).toFixed(2)} hoy</p>
                    )}
                    <p className="text-xs text-gray-400">${cust.total_spent.toFixed(2)} total</p>
                    <i className="ri-arrow-right-s-line text-gray-300 text-base mt-0.5" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* New customer form modal */}
      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowNewForm(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <i className="ri-user-add-line text-amber-600 text-lg" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Nuevo Cliente</h3>
                <p className="text-xs text-gray-400">Registrar en el directorio</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Ej: Edgar Ramírez"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreateCustomer()}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  <i className="ri-whatsapp-line text-green-500 mr-1" />
                  Celular / WhatsApp
                </label>
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 focus-within:border-green-400">
                  <i className="ri-whatsapp-line text-green-500 text-base flex-shrink-0" />
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    placeholder="33 1234 5678"
                    onKeyDown={e => e.key === 'Enter' && handleCreateCustomer()}
                    className="flex-1 bg-transparent text-sm focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowNewForm(false); setNewName(''); setNewPhone(''); }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateCustomer}
                disabled={!newName.trim() || saving}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
              >
                {saving ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer profile modal */}
      {selectedId !== null && (
        <CustomerProfileModal
          customerId={selectedId}
          onClose={() => { setSelectedId(null); fetchCustomers(); }}
          onGoToAccount={onGoToAccount}
        />
      )}
    </div>
  );
}