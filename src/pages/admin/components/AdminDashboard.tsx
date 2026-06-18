import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/supabase";
import DayStats from './DayStats';
import SalesHistory from './SalesHistory';
import TopProducts from './TopProducts';
import CashBreakdown from './CashBreakdown';
import WebVsPosOrders from './WebVsPosOrders';
import AdminQuickSale from './AdminQuickSale';
import OpenAccountsView from './OpenAccountsView';
import WebOrdersView from './WebOrdersView';
import AdminKitchenView from './AdminKitchenView';
import AdminBillarMesas from './AdminBillarMesas';
import LiveOrderNotifier from './LiveOrderNotifier';
import LoyaltyAdminView from './LoyaltyAdminView';
import FlashOffersManager from './FlashOffersManager';
import AbandonedAccountsReport from './AbandonedAccountsReport';
import AbandonmentAlerts from './AbandonmentAlerts';
// Lazy-load CapitanBot para romper dependencia circular con CartContext
const CapitanBot = lazy(() => import('@/pages/pos/components/CapitanBot'));
import type { PosAccount } from '@/pages/pos/types';
import ReservationsAdminView from './ReservationsAdminView';
import EventosAdminView from './EventosAdminView';
import SiteSettingsPanel from './SiteSettingsPanel';
import PushDiagnosticsPanel from './PushDiagnosticsPanel';
import InventoryManager from './InventoryManager';

type Tab = 'overview' | 'history' | 'products' | 'cash' | 'web' | 'sale' | 'mesas' | 'pedidos' | 'cocina' | 'billar' | 'lealtad' | 'ofertas' | 'reservas' | 'eventos' | 'sitio' | 'push' | 'abandoned' | 'inventario';

interface AdminDashboardProps {
  onLogout: () => void;
}

function getFutbolBannerEnabled(): boolean {
  try { return !!localStorage.getItem('lc_futbol_game'); } catch { return false; }
}
function clearFutbolBanner() {
  try { localStorage.removeItem('lc_futbol_game'); } catch { /* noop */ }
}

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('sale');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');
  const [openOrdersCount, setOpenOrdersCount] = useState(0);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [flashNew, setFlashNew] = useState(false);
  const [openAccounts, setOpenAccounts] = useState<PosAccount[]>([]);
  const [reservationsCount, setReservationsCount] = useState(0);
  const [futbolBannerOn, setFutbolBannerOn] = useState(() => getFutbolBannerEnabled());

  const TABS: { id: Tab; label: string; icon: string; highlight?: boolean; badge?: number; badgeColor?: string; groupStart?: boolean }[] = [
    // ── Operaciones (día a día) ──
    { id: 'sale', label: 'Venta Rápida', icon: 'ri-add-circle-fill', highlight: true },
    { id: 'mesas', label: 'Mesas Abiertas', icon: 'ri-table-line' },
    {
      id: 'pedidos',
      label: 'Pedidos',
      icon: 'ri-smartphone-line',
      badge: newOrdersCount > 0 ? newOrdersCount : openOrdersCount > 0 ? openOrdersCount : undefined,
      badgeColor: newOrdersCount > 0 ? 'bg-red-500' : 'bg-amber-500',
    },
    { id: 'cocina', label: 'Cocina', icon: 'ri-fire-line' },
    { id: 'reservas', label: 'Reservas', icon: 'ri-calendar-event-line', badge: reservationsCount > 0 ? reservationsCount : undefined, badgeColor: 'bg-amber-500' },
    // ── Reportes & Finanzas ──
    { id: 'overview', label: 'Resumen', icon: 'ri-dashboard-line', groupStart: true },
    { id: 'history', label: 'Historial', icon: 'ri-history-line' },
    { id: 'abandoned', label: 'Abandonadas', icon: 'ri-alarm-warning-line' },
    { id: 'products', label: 'Productos', icon: 'ri-bar-chart-2-line' },
    { id: 'cash', label: 'Corte', icon: 'ri-money-dollar-circle-line' },
    { id: 'web', label: 'Web vs POS', icon: 'ri-global-line' },
    // ── Marketing & Fidelización ──
    { id: 'lealtad', label: 'Lealtad', icon: 'ri-vip-crown-2-fill', groupStart: true },
    { id: 'ofertas', label: 'Ofertas', icon: 'ri-flashlight-fill' },
    { id: 'eventos', label: 'Eventos', icon: 'ri-calendar-todo-line' },
    { id: 'sitio', label: 'Sitio Web', icon: 'ri-settings-3-line' },
    // ── Otros ──
    { id: 'billar', label: 'Billar', icon: 'ri-billiards-line', groupStart: true },
    { id: 'inventario', label: 'Inventario', icon: 'ri-box-3-line' },
    { id: 'push', label: 'Push Test', icon: 'ri-notification-3-line' },
  ];

  useEffect(() => {
    const fetchAccounts = async () => {
      const { data } = await supabase
        .from('pos_accounts')
        .select('*, pos_account_items(*)')
        .eq('status', 'open');
      if (data) {
        setOpenAccounts(data as PosAccount[]);
        setOpenOrdersCount(data.length);
        const twoMinAgo = Date.now() - 2 * 60 * 1000;
        setNewOrdersCount(data.filter((o: PosAccount) => new Date(o.updated_at).getTime() > twoMinAgo).length);
      }
    };
    const fetchPendingReservations = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .gte('reservation_date', today);
      setReservationsCount(count ?? 0);
    };
    fetchAccounts();
    fetchPendingReservations();
    const channel = supabase
      .channel('dashboard-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_accounts' }, fetchAccounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_account_items' }, fetchAccounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, fetchPendingReservations)
      .subscribe();
    const interval = setInterval(() => { fetchAccounts(); fetchPendingReservations(); }, 15_000);
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, []);

  const handleNewOrder = (spot: string) => {
    setFlashNew(true);
    setTimeout(() => setFlashNew(false), 3000);
    // Incrementar badge temporal si no está en la pestaña de pedidos
    if (activeTab !== 'pedidos' && activeTab !== 'mesas') {
      setNewOrdersCount(c => c + 1);
    }
    void spot; // usado en el toast del notifier
  };

  const handleGoToMesas = () => {
    setActiveTab('mesas');
  };

  return (
    <div className={`min-h-screen bg-gray-50 flex flex-col ${flashNew ? 'ring-2 ring-amber-400 ring-inset' : ''}`}>
      {/* Notificador en tiempo real de pedidos */}
      <LiveOrderNotifier onNewOrder={handleNewOrder} />
      {/* Top bar */}
      <header className="bg-gray-950 text-white px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center bg-amber-500 rounded-lg">
            <i className="ri-store-3-line text-white text-base" />
          </div>
          <div>
            <h1 className="font-black text-sm tracking-tight">La Cabrona</h1>
            <p className="text-gray-500 text-xs">Panel Administrador</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Range */}
          <div className="hidden sm:flex bg-gray-800 rounded-lg p-0.5 gap-0.5">
            {(['today', 'week', 'month'] as const).map(r => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
                  dateRange === r ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {r === 'today' ? 'Hoy' : r === 'week' ? '7 días' : '30 días'}
              </button>
            ))}
          </div>

          {/* Solo mostrar si hay banner activo de fútbol/TV — click lo apaga */}
          {futbolBannerOn && (
            <button
              onClick={() => {
                clearFutbolBanner();
                setFutbolBannerOn(false);
              }}
              title="Banner fútbol/TV activo en el menú web — click para apagar"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap border bg-green-500/20 border-green-500/50 text-green-400 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400"
            >
              <i className="ri-football-fill" />
              <span className="hidden sm:inline">TV ON — Apagar</span>
            </button>
          )}
          <a
            href="/pos"
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-layout-grid-line" />
            <span className="hidden sm:inline">Ir al POS</span>
          </a>

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-gray-400 hover:text-red-400 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-logout-box-line" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* Mobile date range */}
      <div className="sm:hidden px-4 pt-3">
        <div className="flex bg-white rounded-xl border border-gray-200 p-1 gap-1">
          {(['today', 'week', 'month'] as const).map(r => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
                dateRange === r ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {r === 'today' ? 'Hoy' : r === 'week' ? '7 días' : '30 días'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab nav */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 cursor-pointer transition-all whitespace-nowrap ${
                tab.groupStart ? 'border-l border-gray-200 ml-2 pl-4' : ''
              } ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-600'
                  : tab.highlight
                    ? 'border-transparent text-amber-500 hover:text-amber-600 font-bold'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className={tab.icon} />
              {tab.label}
              {tab.badge !== undefined && (
                <span className={`${tab.badgeColor ?? 'bg-amber-500'} text-white text-xs font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none ${newOrdersCount > 0 ? 'animate-pulse' : ''}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Alertas de abandono en tiempo real */}
      <div className="px-4 md:px-6 pt-4">
        <AbandonmentAlerts onGoToMesas={handleGoToMesas} />
      </div>

      {/* Content */}
      <main className={`flex-1 overflow-y-auto px-4 md:px-6 py-5 ${activeTab === 'sale' ? 'flex flex-col' : ''}`}>
        {activeTab === 'sale' && <AdminQuickSale />}
        {activeTab === 'pedidos' && <WebOrdersView />}
        {activeTab === 'mesas' && <OpenAccountsView />}
        {activeTab === 'cocina' && <AdminKitchenView />}
        {activeTab === 'abandoned' && <AbandonedAccountsReport dateRange={dateRange} />}
        {activeTab === 'overview' && <DayStats dateRange={dateRange} />}
        {activeTab === 'history' && <SalesHistory dateRange={dateRange} />}
        {activeTab === 'products' && <TopProducts dateRange={dateRange} />}
        {activeTab === 'cash' && <CashBreakdown dateRange={dateRange} />}
        {activeTab === 'lealtad' && <LoyaltyAdminView />}
        {activeTab === 'ofertas' && <FlashOffersManager />}
        {activeTab === 'billar' && <AdminBillarMesas />}
        {activeTab === 'web' && <WebVsPosOrders dateRange={dateRange} />}
        {activeTab === 'reservas' && <ReservationsAdminView />}
        {activeTab === 'eventos' && <EventosAdminView />}
        {activeTab === 'sitio' && <SiteSettingsPanel />}
        {activeTab === 'push' && <PushDiagnosticsPanel />}
        {activeTab === 'inventario' && <InventoryManager />}
      </main>

      {/* Gerente Bot flotante */}
      <Suspense fallback={<div className="flex items-center gap-2 text-gray-500 text-xs">Cargando...</div>}>
        <CapitanBot
          accounts={openAccounts}
          onGoToAccount={async () => {
            const { data } = await supabase
              .from('pos_accounts')
              .select('*, pos_account_items(*)')
              .eq('status', 'open');
            if (data) setOpenAccounts(data as PosAccount[]);
          }}
          onCloseAccount={async () => {
            const { data } = await supabase
              .from('pos_accounts')
              .select('*, pos_account_items(*)')
              .eq('status', 'open');
            if (data) {
              setOpenAccounts(data as PosAccount[]);
              setOpenOrdersCount(data.length);
            }
          }}
          botName="El Gerente"
        />
      </Suspense>
    </div>
  );
}