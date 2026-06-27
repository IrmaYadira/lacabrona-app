import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { supabasePos } from '../supabasePos';
import { AREA_LABELS, type Area } from '../types';
import type { PosAccount, PosAccountItem } from '../types';
import CustomerAccountCard from './CustomerAccountCard';
import OpenAccountModal from './OpenAccountModal';
import { useWebOrderNotifications } from '../hooks/useWebOrderNotifications';
import { groupCalls, timeAgo } from '../hooks/useWaiterCalls';
import type { CallGroup } from '../hooks/useWaiterCalls';
import { BluetoothPrinterProvider } from '../context/BluetoothPrinterContext';
import { usePosPanelData } from '../hooks/usePosPanelData';

// ── Lazy-loaded views: rompen dependencias circulares ocultas ──────────
const AccountView = lazy(() => import('./AccountView'));
const TakeawayView = lazy(() => import('./TakeawayView'));
const CorteCajaView = lazy(() => import('./CorteCajaView'));
const PausarProductosView = lazy(() => import('./PausarProductosView'));
const KitchenView = lazy(() => import('./KitchenView'));
const CustomerDirectoryView = lazy(() => import('./CustomerDirectoryView'));
const WhatsAppTicketsView = lazy(() => import('./WhatsAppTicketsView'));
const WaiterCallNotifier = lazy(() => import('./WaiterCallNotifier'));
const WebOrderNotificationPanel = lazy(() => import('./WebOrderNotificationPanel'));
const ReadyToDeliverPanel = lazy(() => import('./ReadyToDeliverPanel'));
const PrintTicketModal = lazy(() => import('./PrintTicketModal'));

// Lazy-load CapitanBot para romper dependencia circular con CartContext
const CapitanBot = lazy(() => import('./CapitanBot'));

// ── Helper: leer/escribir el banner de fútbol ──────────────────────────
function getFutbolBannerEnabled(): boolean {
  try { return !!localStorage.getItem('lc_futbol_game'); } catch { return false; }
}
function clearFutbolBanner() {
  try { localStorage.removeItem('lc_futbol_game'); } catch { /* noop */ }
}

function getMinutesSinceLastRound(account: PosAccount): number {
  const items = account.pos_account_items ?? [];
  const lastRoundAt = items.length > 0
    ? items.reduce((latest, item) => {
        const itemTime = new Date(item.created_at).getTime();
        return itemTime > latest ? itemTime : latest;
      }, 0)
    : new Date(account.created_at).getTime();
  return Math.floor((Date.now() - lastRoundAt) / 60000);
}

function isAccountAbandoned(account: PosAccount): boolean {
  const items = account.pos_account_items ?? [];
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const deliveredQty = items.filter(i => i.delivered).reduce((s, i) => s + i.quantity, 0);
  const pendingQty = totalQty - deliveredQty;
  if (pendingQty > 0) return false;
  return getMinutesSinceLastRound(account) >= 120;
}

function isAccountWarning(account: PosAccount): boolean {
  const items = account.pos_account_items ?? [];
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const deliveredQty = items.filter(i => i.delivered).reduce((s, i) => s + i.quantity, 0);
  const pendingQty = totalQty - deliveredQty;
  if (pendingQty > 0) return false;
  const mins = getMinutesSinceLastRound(account);
  return mins >= 90 && mins < 120;
}

interface PosPanelProps {
  onLogout: () => void;
}

type View = 'panel' | 'account' | 'takeaway' | 'corte' | 'pausar' | 'kitchen' | 'clientes' | 'tickets';
type AreaFilter = 'all' | Area;

const AREA_FILTER_OPTIONS: { value: AreaFilter; label: string }[] = [
  { value: 'all', label: 'Todas las áreas' },
  { value: 'principal', label: 'Principal' },
  { value: 'af1', label: 'AF1' },
  { value: 'af2', label: 'AF2' },
];

type OpenAccountData = {
  area: Area;
  spot: string;
  name?: string;
  phone?: string;
  zona?: string;
  customerId?: number;
};


export default function PosPanel({ onLogout }: PosPanelProps) {
  const [view, setView] = useState<View>('panel');
  const [openingAccount, setOpeningAccount] = useState(false);
  const [activeAccountId, setActiveAccountId] = useState<number | null>(null);
  const [activeSpotLabel, setActiveSpotLabel] = useState('');
  const [activeAreaLabel, setActiveAreaLabel] = useState('');
  const [areaFilter, setAreaFilter] = useState<AreaFilter>('all');
  const [now, setNow] = useState(new Date());
  const [musicSignal, setMusicSignal] = useState(0);
  const [waiterName, setWaiterName] = useState<string>('');
  const [showOnlyMyAccounts, setShowOnlyMyAccounts] = useState(false);
  const [sortByAlerts, setSortByAlerts] = useState(false);
  // Impresión desde el chat del bot
  const [botPrintData, setBotPrintData] = useState<{
    account: PosAccount;
    items: PosAccountItem[];
    folio: number;
  } | null>(null);

  const handleBotPrintComanda = useCallback((account: PosAccount, items: PosAccountItem[], folioNumber: number) => {
    setBotPrintData({ account, items, folio: folioNumber });
  }, []);
  const [futbolBannerOn, setFutbolBannerOn] = useState(() => getFutbolBannerEnabled());
  const [sortByPending, setSortByPending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [vipBannerDismissed, setVipBannerDismissed] = useState(false);
  const [autoCloseAccountId, setAutoCloseAccountId] = useState<number | null>(null);
  const [customerResults, setCustomerResults] = useState<{
    id: number; name: string; phone?: string;
    visit_count: number; total_spent: number;
    openAccount?: PosAccount;
  }[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  const { activeNotifications, unreadCount, dismiss, dismissAll, markDelivered, realtimeStatus: webRealtimeStatus } = useWebOrderNotifications();

  const {
    accounts,
    waiterCalls,
    setWaiterCalls,
    realtimeStatus,
    setRealtimeStatus,
    lastFetchTime,
    setLastFetchTime,
    isRefreshing,
    fetchAccounts,
    fetchWaiterCalls,
    handleReconnect,
    trackChannelStatus,
    isWithinAge,
  } = usePosPanelData();

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(iv);
  }, []);

  // ── Auto-refresh al recuperar visibilidad de la pestaña ──
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Recargar datos inmediatamente al volver a la pestaña
        fetchAccounts();
        fetchWaiterCalls();
        setLastFetchTime(new Date());
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchAccounts, fetchWaiterCalls]);

  useEffect(() => {
    const name = sessionStorage.getItem('pos_waiter_name');
    if (name) setWaiterName(name);
  }, []);

  useEffect(() => {
    fetchAccounts();
    let channel: ReturnType<typeof supabasePos.channel> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;
    const MAX_RETRIES = 10; // Más intentos — no rendirse

    const setupChannel = () => {
      if (channel) {
        try { supabasePos.removeChannel(channel); } catch { /* ignore */ }
        channel = null;
      }
      setRealtimeStatus('reconnecting');
      const ch = supabasePos
        .channel('pos-panel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_accounts' }, fetchAccounts)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pos_account_items' }, fetchAccounts)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pos_account_items' }, fetchAccounts)
        .subscribe((status) => {
          trackChannelStatus('pos-panel', status);
          if (status === 'SUBSCRIBED') {
            retries = 0;
          } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            channel = null;
            if (retries < MAX_RETRIES) {
              retries += 1;
              const delay = Math.min(2000 * retries, 15000);
              retryTimer = setTimeout(setupChannel, delay);
            }
          }
        });
      channel = ch;
    };

    setupChannel();
    // Polling fallback cada 8s — más frecuente para compensar pérdidas de realtime
    const pollInterval = setInterval(fetchAccounts, 8_000);
    return () => {
      if (channel) { try { supabasePos.removeChannel(channel); } catch { /* ignore */ } }
      if (retryTimer) clearTimeout(retryTimer);
      clearInterval(pollInterval);
    };
  }, [fetchAccounts, trackChannelStatus]);

  useEffect(() => {
    fetchWaiterCalls();
    let waiterChannel: ReturnType<typeof supabasePos.channel> | null = null;
    let waiterRetryTimer: ReturnType<typeof setTimeout> | null = null;
    let waiterRetries = 0;

    const setupWaiterChannel = () => {
      if (waiterChannel) {
        try { supabasePos.removeChannel(waiterChannel); } catch { /* ignore */ }
        waiterChannel = null;
      }
      const ch = supabasePos
        .channel('pos-panel-waiter')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'waiter_requests' },
          (payload) => {
            const rec = payload.new as import('../hooks/useWaiterCalls').WaiterCall;
            if (!rec?.id || rec.status !== 'pending') return;
            if (!isWithinAge(rec.created_at)) return;
            setWaiterCalls(prev => [rec, ...prev]);
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'waiter_requests' },
          (payload) => {
            const rec = payload.new as import('../hooks/useWaiterCalls').WaiterCall;
            if (!rec?.id) return;
            if (rec.status !== 'pending') {
              setWaiterCalls(prev => prev.filter(c => c.id !== rec.id));
            }
          }
        )
        .subscribe((status) => {
          trackChannelStatus('pos-panel-waiter', status);
          if (status === 'SUBSCRIBED') {
            waiterRetries = 0;
          } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            waiterChannel = null;
            if (waiterRetries < 10) {
              waiterRetries += 1;
              const delay = Math.min(2000 * waiterRetries, 15000);
              waiterRetryTimer = setTimeout(setupWaiterChannel, delay);
            }
          }
        });
      waiterChannel = ch;
    };

    setupWaiterChannel();
    // Polling fallback para waiter calls cada 10s
    const waiterPollInterval = setInterval(fetchWaiterCalls, 10_000);
    return () => {
      if (waiterChannel) { try { supabasePos.removeChannel(waiterChannel); } catch { /* ignore */ } }
      if (waiterRetryTimer) clearTimeout(waiterRetryTimer);
      clearInterval(waiterPollInterval);
    };
  }, [fetchWaiterCalls, trackChannelStatus]);

  const waiterGroups = useMemo(() => groupCalls(waiterCalls), [waiterCalls]);

  // Separar por tipo
  const checkGroups = useMemo(() => waiterGroups.filter(g => g.request_type === 'check' || g.request_type === 'request_bill'), [waiterGroups]);
  const callGroups = useMemo(() => waiterGroups.filter(g => g.request_type !== 'check' && g.request_type !== 'request_bill'), [waiterGroups]);

  // Helper: ¿un grupo matchea con alguna cuenta abierta?
  const groupMatchesAccount = useCallback((group: CallGroup) => {
    return accounts.some(a =>
      (group.account_id != null && group.account_id === a.id) ||
      group.spot.trim().toLowerCase() === (a.spot ?? '').trim().toLowerCase() ||
      group.spot.trim().toLowerCase() === (a.customer_name ?? '').trim().toLowerCase()
    );
  }, [accounts]);

  // Contadores por tipo y match
  const matchedCheckCount = useMemo(() => checkGroups.filter(g => groupMatchesAccount(g)).length, [checkGroups, groupMatchesAccount]);
  const matchedCallCount = useMemo(() => callGroups.filter(g => groupMatchesAccount(g)).length, [callGroups, groupMatchesAccount]);
  const unmatchedCheckGroups = useMemo(() => checkGroups.filter(g => !groupMatchesAccount(g)), [checkGroups, groupMatchesAccount]);
  const unmatchedCallGroups = useMemo(() => callGroups.filter(g => !groupMatchesAccount(g)), [callGroups, groupMatchesAccount]);
  const unmatchedGroups = useMemo(() => waiterGroups.filter(g => !groupMatchesAccount(g)), [waiterGroups, groupMatchesAccount]);

  // Rondas listas en cocina pero aun no entregadas al cliente
  const readyToDeliverRounds = useMemo(() => {
    return accounts.reduce((count, acc) => {
      const items = acc.pos_account_items ?? [];
      const folios = [...new Set(items.map(i => i.folio_number))];
      return count + folios.filter(folio => {
        const folioItems = items.filter(i => i.folio_number === folio);
        const allDelivered = folioItems.length > 0 && folioItems.every(i => i.delivered);
        const anyNotCustomerDelivered = folioItems.some(i => !i.customer_delivered);
        return allDelivered && anyNotCustomerDelivered;
      }).length;
    }, 0);
  }, [accounts]);

  const findPendingCallForAccount = useCallback((account: PosAccount): CallGroup | undefined => {
    return waiterGroups.find(g =>
      (g.account_id != null && g.account_id === account.id) ||
      g.spot.trim().toLowerCase() === (account.spot ?? '').trim().toLowerCase() ||
      g.spot.trim().toLowerCase() === (account.customer_name ?? '').trim().toLowerCase()
    );
  }, [waiterGroups]);

  const handleAttendWaiterCall = useCallback(async (group: CallGroup) => {
    if (group.ids.length === 0) return;
    const isCheckCall = group.request_type === 'check' || group.request_type === 'request_bill';

    // Marcar como resuelto en BD
    await supabasePos
      .from('waiter_requests')
      .update({ status: 'resolved', updated_at: new Date().toISOString() })
      .in('id', group.ids);
    setWaiterCalls(prev => prev.filter(c => !group.ids.includes(c.id)));

    // Si es cobro, navegar directamente a la cuenta con el modal de cierre abierto
    if (isCheckCall) {
      // Buscar la cuenta asociada al grupo
      const matchedAccount = accounts.find(a =>
        (group.account_id != null && group.account_id === a.id) ||
        group.spot.trim().toLowerCase() === (a.spot ?? '').trim().toLowerCase() ||
        group.spot.trim().toLowerCase() === (a.customer_name ?? '').trim().toLowerCase()
      );
      if (matchedAccount) {
        setAutoCloseAccountId(matchedAccount.id);
        setActiveAccountId(matchedAccount.id);
        setActiveSpotLabel(matchedAccount.customer_name || matchedAccount.spot || 'Cliente');
        setActiveAreaLabel(
          matchedAccount.zona
            ? `${AREA_LABELS[matchedAccount.area as Area] ?? matchedAccount.area} · ${matchedAccount.zona}`
            : AREA_LABELS[matchedAccount.area as Area] ?? matchedAccount.area
        );
        setView('account');
      }
    }
  }, [accounts]);

  const handleAttendAllWaiterCalls = useCallback(async () => {
    const ids = waiterCalls.map(c => c.id);
    if (ids.length === 0) return;
    await supabasePos
      .from('waiter_requests')
      .update({ status: 'resolved', updated_at: new Date().toISOString() })
      .in('id', ids);
    setWaiterCalls([]);
  }, [waiterCalls]);

  // Buscar clientes en directorio + cruzar con cuentas abiertas
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setCustomerResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabasePos
        .from('pos_customers')
        .select('id, name, phone, visit_count, total_spent')
        .or(`name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`)
        .limit(6);
      const customers = (data ?? []) as { id: number; name: string; phone?: string; visit_count: number; total_spent: number }[];
      const enriched = customers.map(cust => {
        const openAcc = accounts.find(
          a => a.customer_id === cust.id && a.status === 'open'
        );
        return { ...cust, openAccount: openAcc };
      });
      setCustomerResults(enriched);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, accounts]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGoToAccountById = useCallback(async (accountId: number) => {
    const { data: freshAcc } = await supabasePos
      .from('pos_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('status', 'open')
      .maybeSingle();
    if (freshAcc) {
      if (freshAcc.area === 'llevar') {
        setView('takeaway');
        return;
      }
      await fetchAccounts();
      setActiveAccountId(accountId);
      setActiveSpotLabel(freshAcc.customer_name || freshAcc.spot || 'Cliente');
      setActiveAreaLabel(
        freshAcc.zona
          ? `${AREA_LABELS[freshAcc.area as Area] ?? freshAcc.area} · ${freshAcc.zona}`
          : AREA_LABELS[freshAcc.area as Area] ?? freshAcc.area
      );
      setView('account');
    }
  }, [fetchAccounts]);

  const handleAccountCardClick = (account: PosAccount) => {
    setActiveAccountId(account.id);
    setActiveSpotLabel(account.customer_name || account.spot || 'Cliente');
    setActiveAreaLabel(
      account.zona
        ? `${AREA_LABELS[account.area as Area] ?? account.area} · ${account.zona}`
        : AREA_LABELS[account.area as Area] ?? account.area
    );
    setView('account');
  };

  const handleOpenAccount = async (data: OpenAccountData) => {
    const { area, spot, name, phone, zona, customerId } = data;
    let resolvedCustomerId = customerId ?? null;
    const currentWaiter = sessionStorage.getItem('pos_waiter_name') || 'Staff';

    if (name && !resolvedCustomerId) {
      const { data: custData } = await supabasePos
        .from('pos_customers')
        .insert({ name, phone: phone || null, visit_count: 1, total_spent: 0, last_visit: new Date().toISOString() })
        .select('id')
        .maybeSingle();
      resolvedCustomerId = custData?.id ?? null;
    } else if (resolvedCustomerId) {
      await supabasePos
        .from('pos_customers')
        .update({ last_visit: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', resolvedCustomerId);
      const { data: custCurrent } = await supabasePos
        .from('pos_customers')
        .select('visit_count')
        .eq('id', resolvedCustomerId)
        .maybeSingle();
      if (custCurrent) {
        await supabasePos
          .from('pos_customers')
          .update({ visit_count: (custCurrent.visit_count ?? 0) + 1 })
          .eq('id', resolvedCustomerId);
      }
    }

    const insertPayload: Record<string, unknown> = {
      area,
      spot,
      customer_name: name || null,
      customer_phone: phone || null,
      customer_id: resolvedCustomerId,
      status: 'open',
      opened_by: currentWaiter,
    };
    if (zona) insertPayload.zona = zona;

    // ── Validación: evitar cuentas duplicadas para el mismo cliente ──
    if (resolvedCustomerId || phone) {
      let dupQuery = supabasePos.from('pos_accounts').select('*').eq('status', 'open');
      if (resolvedCustomerId) {
        dupQuery = dupQuery.eq('customer_id', resolvedCustomerId);
      } else if (phone) {
        dupQuery = dupQuery.eq('customer_phone', phone.trim().replace(/\s/g, ''));
      }
      const { data: yaAbierta } = await dupQuery.maybeSingle();

      if (yaAbierta) {
        // Ya existe — navegar a esa cuenta en vez de duplicar
        setOpeningAccount(false);
        setActiveAccountId(yaAbierta.id);
        setActiveSpotLabel(yaAbierta.customer_name || yaAbierta.spot || 'Cliente');
        setActiveAreaLabel(
          yaAbierta.zona
            ? `${AREA_LABELS[yaAbierta.area as Area] ?? yaAbierta.area} · ${yaAbierta.zona}`
            : AREA_LABELS[yaAbierta.area as Area] ?? yaAbierta.area
        );
        setView('account');
        fetchAccounts();
        return;
      }
    }

    const { data: accData, error: insertError } = await supabasePos
      .from('pos_accounts')
      .insert(insertPayload)
      .select()
      .maybeSingle();

    if (insertError) {
      console.error('Error al abrir cuenta:', insertError);
      alert('No se pudo abrir la cuenta. Intenta de nuevo.\n\nError: ' + (insertError.message || 'Desconocido'));
      setOpeningAccount(false);
      return;
    }

    setOpeningAccount(false);
    if (accData) {
      if (resolvedCustomerId) {
        await supabasePos.from('pos_account_events').insert({
          account_id: accData.id,
          customer_id: resolvedCustomerId,
          event_type: 'account_opened',
          description: `Cuenta abierta — ${name}${zona ? ` (${zona})` : ''}`,
          metadata: { spot, area, zona: zona || null },
        });
      } else {
        await supabasePos.from('pos_account_events').insert({
          account_id: accData.id,
          event_type: 'account_opened',
          description: `Cuenta abierta sin cliente — ${spot}${zona ? ` (${zona})` : ''}`,
          metadata: { spot, area, zona: zona || null },
        });
      }
      setActiveAccountId(accData.id);
      setActiveSpotLabel(name || spot || 'Cliente');
      setActiveAreaLabel(
        zona
          ? `${AREA_LABELS[area] ?? area} · ${zona}`
          : AREA_LABELS[area] ?? area
      );
      setView('account');
      fetchAccounts();
    }
  };

  const openTakeawayCount = accounts.filter(a => a.area === 'llevar').length;

  const webNotifPanel = (
    <Suspense fallback={null}>
      <WebOrderNotificationPanel
        activeNotifications={activeNotifications}
        unreadCount={unreadCount}
        onDismiss={dismiss}
        onDismissAll={dismissAll}
        onGoToAccount={handleGoToAccountById}
        onMarkDelivered={markDelivered}
        realtimeStatus={webRealtimeStatus}
      />
    </Suspense>
  );

  // Notificaciones flotantes (usadas en vistas que no son el panel principal)
  const notifPanel = (
    <>
      {webNotifPanel}
      <Suspense fallback={null}>
        <WaiterCallNotifier />
      </Suspense>
    </>
  );

  // El Gerente siempre visible en todas las vistas del POS
  const capitanBot = (
    <>
      <Suspense fallback={null}>
        <CapitanBot
          accounts={accounts}
          onGoToAccount={handleGoToAccountById}
          onCloseAccount={fetchAccounts}
          onPrintComanda={handleBotPrintComanda}
          openMusicTabSignal={musicSignal}
        />
      </Suspense>
      {/* Modal de impresión iniciado desde el chat del bot */}
      {botPrintData && (
        <BluetoothPrinterProvider>
          <Suspense fallback={null}>
            <PrintTicketModal
              account={botPrintData.account}
              items={botPrintData.items}
              mode="comanda"
              folioNumber={botPrintData.folio}
              onClose={() => setBotPrintData(null)}
            />
          </Suspense>
        </BluetoothPrinterProvider>
      )}
    </>
  );

  if (view === 'account' && activeAccountId) {
    return (
      <BluetoothPrinterProvider>
      <div className="h-screen flex flex-col bg-gray-50">
        {notifPanel}
        {capitanBot}
        <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}>
        <AccountView
          accountId={activeAccountId}
          spotLabel={activeSpotLabel}
          areaLabel={activeAreaLabel}
          autoOpenClose={autoCloseAccountId === activeAccountId}
          waiterName={waiterName}
          onBack={() => { setAutoCloseAccountId(null); setView('panel'); fetchAccounts(); }}
          onAccountClosed={() => { setAutoCloseAccountId(null); setView('panel'); fetchAccounts(); }}
          onGoToAccount={async (id) => {
            const { data: freshAcc } = await supabasePos
              .from('pos_accounts')
              .select('*')
              .eq('id', id)
              .eq('status', 'open')
              .maybeSingle();
            if (freshAcc) {
              await fetchAccounts();
              setActiveAccountId(id);
              setActiveSpotLabel(freshAcc.customer_name || freshAcc.spot || 'Cliente');
              setActiveAreaLabel(AREA_LABELS[freshAcc.area as Area] ?? freshAcc.area);
              setView('account');
              return;
            }
            await fetchAccounts();
            setView('panel');
          }}
        />
        </Suspense>
      </div>
      </BluetoothPrinterProvider>
    );
  }

  if (view === 'takeaway') {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        {notifPanel}
        {capitanBot}
        <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}>
        <TakeawayView onBack={() => { setView('panel'); fetchAccounts(); }} />
        </Suspense>
      </div>
    );
  }

  if (view === 'corte') {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        {notifPanel}
        {capitanBot}
        <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}>
        <CorteCajaView onBack={() => setView('panel')} />
        </Suspense>
      </div>
    );
  }

  if (view === 'pausar') {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        {notifPanel}
        {capitanBot}
        <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}>
        <PausarProductosView onBack={() => setView('panel')} />
        </Suspense>
      </div>
    );
  }

  if (view === 'kitchen') {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        {notifPanel}
        {capitanBot}
        <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}>
        <KitchenView onBack={() => setView('panel')} />
        </Suspense>
      </div>
    );
  }

  if (view === 'clientes') {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        {notifPanel}
        {capitanBot}
        <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}>
        <CustomerDirectoryView
          onBack={() => setView('panel')}
          onGoToAccount={handleGoToAccountById}
        />
        </Suspense>
      </div>
    );
  }

  if (view === 'tickets') {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        {notifPanel}
        {capitanBot}
        <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}>
        <WhatsAppTicketsView onBack={() => setView('panel')} />
        </Suspense>
      </div>
    );
  }

  // ── Filtrado y ordenamiento de cuentas ──
  const filteredAccounts = areaFilter === 'all'
    ? accounts
    : accounts.filter(a => a.area === areaFilter);

  // Si hay búsqueda activa, filtrar también cuentas por nombre/tel
  const trimmedSearch = searchQuery.trim().toLowerCase();
  const baseFiltered = trimmedSearch
    ? accounts.filter(
        a =>
          (a.customer_name ?? '').toLowerCase().includes(trimmedSearch) ||
          (a.customer_phone ?? '').toLowerCase().includes(trimmedSearch) ||
          a.spot.toLowerCase().includes(trimmedSearch)
      )
    : filteredAccounts;

  // Filtrar por mesero si está activo
  const myFilteredAccounts = showOnlyMyAccounts && waiterName
    ? baseFiltered.filter(a => a.opened_by === waiterName)
    : baseFiltered;

  // Ordenar por pendientes si el botón está activo
  const getPendingQty = (acc: PosAccount) => {
    const items = acc.pos_account_items ?? [];
    const total = items.reduce((s, i) => s + i.quantity, 0);
    const delivered = items.filter(i => i.delivered).reduce((s, i) => s + i.quantity, 0);
    return total - delivered;
  };

  const getAlertScore = (acc: PosAccount): number => {
    if (isAccountAbandoned(acc)) return 3;
    if (isAccountWarning(acc)) return 2;
    const mins = getMinutesSinceLastRound(acc);
    if (mins >= 60) return 1;
    return 0;
  };

  const searchFilteredAccounts = sortByAlerts
    ? [...myFilteredAccounts].sort((a, b) => getAlertScore(b) - getAlertScore(a))
    : sortByPending
    ? [...myFilteredAccounts].sort((a, b) => getPendingQty(b) - getPendingQty(a))
    : myFilteredAccounts;

  const totalPendingAccounts = accounts.filter(a => getPendingQty(a) > 0).length;

  // VIP: cuentas con 4+ rondas
  const vipAccounts = searchFilteredAccounts.filter(a => (a.folio_counter ?? 0) >= 4);

  // Totals
  const totalAcumulado = accounts.reduce((sum, acc) =>
    sum + (acc.pos_account_items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0), 0
  );
  const cuentasAbiertas = accounts.length;
  const allItems = accounts.flatMap(a => a.pos_account_items ?? []);
  const totalItems = allItems.reduce((s, i) => s + i.quantity, 0);
  const deliveredItems = allItems.filter(i => i.delivered).reduce((s, i) => s + i.quantity, 0);
  const pendingItems = totalItems - deliveredItems;
  const abandonedCount = accounts.filter(isAccountAbandoned).length;
  const warningCount = accounts.filter(isAccountWarning).length;
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
            <i className="ri-store-3-line text-white text-sm" />
          </div>
          <div>
            <h1 className="font-bold text-sm">La Cabrona Alitas &amp; Beer</h1>
            <p className="text-gray-400 text-xs">
              {cuentasAbiertas} cuenta{cuentasAbiertas !== 1 ? 's' : ''} activa{cuentasAbiertas !== 1 ? 's' : ''}
              {checkGroups.length > 0 && (
                <span className="ml-2 text-green-400 font-bold">
                  · {checkGroups.length} cobro{checkGroups.length !== 1 ? 's' : ''}
                </span>
              )}
              {callGroups.length > 0 && (
                <span className="ml-2 text-orange-400 font-bold">
                  · {callGroups.length} llamada{callGroups.length !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={() => setView('takeaway')}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-shopping-bag-3-line" />
            Para Llevar
            {openTakeawayCount > 0 && (
              <span className="bg-white text-amber-600 rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold">
                {openTakeawayCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setView('clientes')}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-contacts-book-line" />
            Clientes
          </button>
          {/* Toggle ver solo mis mesas */}
          {waiterName && (
            <button
              onClick={() => setShowOnlyMyAccounts(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap border-2 ${
                showOnlyMyAccounts
                  ? 'bg-amber-500 border-amber-500 text-white'
                  : 'bg-white border-gray-700 text-gray-400 hover:border-amber-400 hover:text-amber-400'
              }`}
            >
              <i className={`ri-user-line ${showOnlyMyAccounts ? 'text-white' : 'text-gray-400'}`} />
              {showOnlyMyAccounts ? 'Solo mis mesas' : 'Todas las mesas'}
            </button>
          )}
          <button
            onClick={() => setView('tickets')}
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-whatsapp-line" />
            Tickets WA
          </button>
          <button
            onClick={() => setMusicSignal(s => s + 1)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap bg-violet-600 hover:bg-violet-700 text-white"
          >
            <i className="ri-music-2-line" />
            Música
          </button>
          {/* Toggle banner fútbol/TV — solo apaga si está activo, NO abre bot */}
          {futbolBannerOn && (
            <button
              onClick={() => {
                clearFutbolBanner();
                setFutbolBannerOn(false);
              }}
              title="Apagar banner de fútbol/TV del menú web"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap bg-green-600 hover:bg-red-600 text-white"
            >
              <i className="ri-football-fill" />
              <span className="hidden sm:inline">TV: ON — Apagar</span>
              <span className="sm:hidden">TV</span>
            </button>
          )}
          <button
            onClick={() => setView('kitchen')}
            className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-fire-line" />
            Cocina
          </button>
          <button
            onClick={() => setView('pausar')}
            className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-pause-circle-line" />
            Productos
          </button>
          <button
            onClick={() => setView('corte')}
            className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-bar-chart-line" />
            Corte
          </button>
          {unreadCount > 0 && (
            <div className="flex items-center gap-1.5 bg-green-500 px-3 py-1.5 rounded-lg animate-pulse">
              <i className="ri-smartphone-line text-white text-sm" />
              <span className="text-white text-xs font-black">{unreadCount} web</span>
            </div>
          )}
          {checkGroups.length > 0 && (
            <div className="flex items-center gap-1.5 bg-green-600 px-3 py-1.5 rounded-lg animate-pulse">
              <i className="ri-money-dollar-circle-line text-white text-sm" />
              <span className="text-white text-xs font-black">{checkGroups.length} cobro{checkGroups.length !== 1 ? 's' : ''}</span>
            </div>
          )}
          {callGroups.length > 0 && (
            <div className="flex items-center gap-1.5 bg-orange-500 px-3 py-1.5 rounded-lg animate-pulse">
              <i className="ri-service-line text-white text-sm" />
              <span className="text-white text-xs font-black">{callGroups.length} llamada{callGroups.length !== 1 ? 's' : ''}</span>
            </div>
          )}
          {/* ── Indicador de conexión prominente ── */}
          <button
            onClick={handleReconnect}
            disabled={isRefreshing}
            title={
              realtimeStatus === 'connected'
                ? `Conexión en vivo · Última actualización: ${lastFetchTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                : realtimeStatus === 'reconnecting'
                  ? 'Reconectando...'
                  : '¡SIN CONEXIÓN EN VIVO! Click para reconectar'
            }
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all whitespace-nowrap border-2 ${
              realtimeStatus === 'connected'
                ? 'bg-green-900/60 border-green-600 text-green-400 hover:bg-green-900'
                : realtimeStatus === 'reconnecting'
                  ? 'bg-amber-900/60 border-amber-600 text-amber-400'
                  : 'bg-red-900/60 border-red-500 text-red-400 animate-pulse hover:bg-red-900'
            }`}
          >
            {isRefreshing ? (
              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className={`w-2 h-2 rounded-full ${
                realtimeStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'
              }`} />
            )}
            {realtimeStatus === 'connected' ? 'En vivo' : realtimeStatus === 'reconnecting' ? 'Reconectando...' : 'Reconectar'}
          </button>
          <button
            onClick={onLogout}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-700 cursor-pointer transition-colors"
          >
            <i className="ri-logout-box-line text-gray-400" />
          </button>
        </div>
      </div>

      {webNotifPanel}
      <Suspense fallback={null}>
        <WaiterCallNotifier />
      </Suspense>

      {/* Live summary bar */}
      <div className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 text-gray-300">
          <i className="ri-time-line text-sm" />
          <span className="text-sm font-bold tabular-nums">{timeStr}</span>
        </div>
        <div className="flex items-center gap-4 flex-1 justify-center flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Total acumulado (MXN)</span>
            <span className="text-sm font-black text-amber-400 tabular-nums">MXN$${totalAcumulado.toFixed(2)}</span>
            <span className="text-xs text-gray-500">({cuentasAbiertas} cuenta{cuentasAbiertas !== 1 ? 's' : ''})</span>
          </div>
          {totalItems > 0 && (
            <>
              <span className="text-gray-600 hidden sm:inline">·</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                  <span className="text-xs text-gray-400">Pendientes</span>
                  <span className={`text-sm font-black tabular-nums ${pendingItems > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
                    {pendingItems}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                  <span className="text-xs text-gray-400">Entregados</span>
                  <span className={`text-sm font-black tabular-nums ${deliveredItems > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                    {deliveredItems}
                  </span>
                </div>
                {totalItems > 0 && (
                  <div className="hidden sm:flex items-center gap-1.5">
                    <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.round((deliveredItems / totalItems) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 tabular-nums">
                      {Math.round((deliveredItems / totalItems) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
          {readyToDeliverRounds > 0 && (
            <>
              <span className="text-gray-600 hidden sm:inline">·</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0 animate-pulse" />
                <span className="text-xs text-gray-400">Por entregar</span>
                <span className="text-sm font-black text-orange-400 tabular-nums">{readyToDeliverRounds} ronda{readyToDeliverRounds !== 1 ? 's' : ''}</span>
              </div>
            </>
          )}
          {abandonedCount > 0 && (
            <>
              <span className="text-gray-600 hidden sm:inline">·</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />
                <span className="text-xs text-gray-400">Abandonadas</span>
                <span className="text-sm font-black text-red-400 tabular-nums">{abandonedCount}</span>
              </div>
            </>
          )}
          {warningCount > 0 && (
            <>
              <span className="text-gray-600 hidden sm:inline">·</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0 animate-pulse" />
                <span className="text-xs text-gray-400">Alertas</span>
                <span className="text-sm font-black text-orange-400 tabular-nums">{warningCount}</span>
              </div>
            </>
          )}
          {matchedCheckCount > 0 && (
            <>
              <span className="text-gray-600 hidden sm:inline">·</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />
                <span className="text-xs text-gray-400">Por cobrar</span>
                <span className="text-sm font-black text-green-400 tabular-nums">{matchedCheckCount}</span>
              </div>
            </>
          )}
          {matchedCallCount > 0 && (
            <>
              <span className="text-gray-600 hidden sm:inline">·</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 animate-pulse" />
                <span className="text-xs text-gray-400">Llamadas</span>
                <span className="text-sm font-black text-orange-400 tabular-nums">{matchedCallCount}</span>
              </div>
            </>
          )}
          {(unmatchedCheckGroups.length + unmatchedCallGroups.length) > 0 && (
            <>
              <span className="text-gray-600 hidden sm:inline">·</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-500 flex-shrink-0" />
                <span className="text-xs text-gray-400">Sin cuenta</span>
                <span className="text-sm font-black text-gray-400 tabular-nums">{unmatchedCheckGroups.length + unmatchedCallGroups.length}</span>
                {unmatchedCheckGroups.length > 0 && unmatchedCallGroups.length > 0 && (
                  <span className="text-[10px] text-gray-500">({unmatchedCheckGroups.length}c · {unmatchedCallGroups.length}ll)</span>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${
            realtimeStatus === 'connected' ? 'bg-green-400 animate-pulse' :
            realtimeStatus === 'reconnecting' ? 'bg-amber-400 animate-pulse' :
            'bg-red-500'
          }`} />
          <span className={`text-xs ${
            realtimeStatus === 'connected' ? 'text-gray-400' :
            realtimeStatus === 'reconnecting' ? 'text-amber-400' :
            'text-red-400'
          }`}>
            {realtimeStatus === 'connected' ? 'En vivo' :
             realtimeStatus === 'reconnecting' ? 'Reconectando...' :
             'Sin conexión'}
          </span>
          <span className="text-[10px] text-gray-600">
            {lastFetchTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Search + Nueva Cuenta bar */}
      <div ref={searchRef} className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center gap-3 relative z-30">
        {/* Buscador */}
        <div className="relative flex-1">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSearchFocused(true); }}
            onFocus={() => setSearchFocused(true)}
            placeholder="Buscar cliente por nombre o celular..."
            className="w-full pl-8 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-400 focus:bg-white transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setCustomerResults([]); setSearchFocused(false); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-300 hover:bg-gray-400 cursor-pointer transition-colors"
            >
              <i className="ri-close-line text-white text-xs" />
            </button>
          )}
        </div>

        {/* Filtro de área */}
        <select
          value={areaFilter}
          onChange={e => setAreaFilter(e.target.value as AreaFilter)}
          className="px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:border-amber-400 cursor-pointer whitespace-nowrap hidden sm:block"
        >
          {AREA_FILTER_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Botón Nueva Cuenta */}
        <button
          onClick={() => setOpeningAccount(true)}
          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors whitespace-nowrap flex-shrink-0"
        >
          <i className="ri-user-add-line" />
          <span className="hidden sm:inline">Nueva Cuenta</span>
          <span className="sm:hidden">Nueva</span>
        </button>

        {/* Dropdown de búsqueda */}
        {searchFocused && searchQuery.trim() && (
          <div className="absolute left-4 right-4 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {customerResults.length === 0 ? (
              <div className="px-4 py-4 text-center">
                <i className="ri-user-search-line text-2xl text-gray-300 block mb-1" />
                <p className="text-xs text-gray-400">Sin resultados para &quot;{searchQuery.trim()}&quot;</p>
                <button
                  onClick={() => { setView('clientes'); setSearchQuery(''); setSearchFocused(false); }}
                  className="mt-2 text-xs text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer"
                >
                  <i className="ri-contacts-book-line mr-1" />
                  Abrir directorio para registrarlo
                </button>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {customerResults.map(cust => {
                  const hasOpen = !!cust.openAccount;
                  const openAcc = cust.openAccount;
                  const openTotal = openAcc
                    ? (openAcc.pos_account_items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0)
                    : 0;
                  return (
                    <div key={`cust-${cust.id}`} className="px-3 py-2.5 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${hasOpen ? 'bg-green-500' : 'bg-gray-200'}`}>
                          <span className={`font-bold text-sm ${hasOpen ? 'text-white' : 'text-gray-500'}`}>
                            {cust.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-gray-900">{cust.name}</p>
                            {hasOpen && (
                              <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                En el bar
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {cust.phone && (
                              <span className="text-xs text-gray-400 flex items-center gap-0.5">
                                <i className="ri-phone-line" />{cust.phone}
                              </span>
                            )}
                            {hasOpen && openAcc && (
                              <span className="text-xs text-amber-600 font-medium">
                                ${openTotal.toFixed(2)}
                              </span>
                            )}
                            {!hasOpen && (
                              <span className="text-xs text-gray-400">
                                {cust.visit_count} visita{cust.visit_count !== 1 ? 's' : ''} · ${cust.total_spent.toFixed(2)} total
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {hasOpen && openAcc && (
                            <button
                              onClick={() => {
                                setActiveAccountId(openAcc.id);
                                setActiveSpotLabel(openAcc.customer_name || openAcc.spot || 'Cliente');
                                setActiveAreaLabel(AREA_LABELS[openAcc.area as Area] ?? openAcc.area);
                                setView('account');
                                setSearchQuery('');
                                setSearchFocused(false);
                              }}
                              className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
                            >
                              <i className="ri-arrow-right-line" />
                              Ir a cuenta
                            </button>
                          )}
                          <button
                            onClick={() => { setView('clientes'); setSearchQuery(''); setSearchFocused(false); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-emerald-100 hover:text-emerald-700 text-gray-400 cursor-pointer transition-colors"
                          >
                            <i className="ri-user-line text-xs" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main content — layout de 2 columnas en desktop si hay llamadas sin cuenta */}
      <div className={`flex-1 p-4 ${unmatchedGroups.length > 0 ? 'flex flex-col lg:flex-row gap-4' : ''}`}>
        {/* Sidebar izquierdo: llamadas sin cuenta abierta */}
        {unmatchedGroups.length > 0 && (
          <div className="w-full lg:w-80 flex-shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                <i className="ri-service-line text-orange-500" />
                Llamadas sin cuenta
              </h3>
              <button
                onClick={handleAttendAllWaiterCalls}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer whitespace-nowrap"
              >
                Atender todas
              </button>
            </div>
            <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {unmatchedGroups.map(group => {
                const isCheck = group.request_type === 'check' || group.request_type === 'request_bill';
                const borderColor = isCheck ? 'border-green-500' : 'border-orange-500';
                const iconBg = isCheck ? 'bg-green-600' : 'bg-orange-500';
                const iconName = isCheck ? 'ri-money-dollar-circle-fill' : 'ri-service-fill';
                const titleLabel = isCheck ? '¡Quieren pagar!' : '¡Llamada de mesero!';
                const spotColor = isCheck ? 'text-green-600' : 'text-orange-600';
                const btnBg = isCheck ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-500 hover:bg-orange-600';
                const fotoUrl = group.selfie_url || group.photo_url;
                const displayName = group.customer_name && group.customer_name.trim() !== group.spot.trim()
                  ? group.customer_name
                  : null;

                return (
                  <div
                    key={group.key}
                    className={`bg-white border-2 ${borderColor} rounded-xl overflow-hidden shadow-sm`}
                  >
                    <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
                      <div className={`w-9 h-9 flex items-center justify-center ${iconBg} rounded-lg flex-shrink-0`}>
                        <i className={`${iconName} text-white text-lg`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 text-xs font-black leading-tight">{titleLabel}</p>
                        <p className={`${spotColor} text-sm font-black truncate`}>{group.spot}</p>
                      </div>
                      {group.count > 1 && (
                        <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                          ×{group.count}
                        </span>
                      )}
                    </div>

                    {(fotoUrl || displayName) && (
                      <div className="px-3 pb-2">
                        <div className={`flex items-center gap-2 rounded-lg p-2 ${isCheck ? 'bg-green-50 border border-green-100' : 'bg-orange-50 border border-orange-100'}`}>
                          {fotoUrl ? (
                            <img src={fotoUrl} alt="Foto del cliente" title="Foto del cliente" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isCheck ? 'bg-green-100' : 'bg-orange-100'}`}>
                              <i className="ri-user-3-line text-gray-400" />
                            </div>
                          )}
                          {displayName && <p className="text-xs font-bold text-gray-800 truncate">{displayName}</p>}
                        </div>
                      </div>
                    )}

                    <div className="px-3 pb-1">
                      <p className="text-gray-400 text-[11px] flex items-center gap-1">
                        <i className="ri-time-line" />
                        {timeAgo(group.latestAt)}
                      </p>
                    </div>

                    <div className="px-2.5 pb-2.5 pt-1">
                      <button
                        onClick={() => handleAttendWaiterCall(group)}
                        className={`w-full flex items-center justify-center gap-1.5 ${btnBg} text-white rounded-lg py-2 text-xs font-black transition-colors cursor-pointer whitespace-nowrap`}
                      >
                        <i className="ri-checkbox-circle-line" />
                        {isCheck ? 'Cobrar mesa' : 'Marcar atendido'}
                        {group.count > 1 && ` (${group.count})`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Contenido principal (cuentas) */}
        <div className="flex-1 min-w-0">
          {searchFilteredAccounts.length === 0 && !trimmedSearch ? (
            /* Estado vacío — sin cuentas abiertas */
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-user-3-line text-4xl text-gray-300" />
              </div>
              <h2 className="text-xl font-bold text-gray-700 mb-1">Sin cuentas abiertas</h2>
              <p className="text-gray-400 text-sm mb-6 max-w-xs">
                El bar está listo. Abre una cuenta para el primer cliente del turno.
              </p>
              <button
                onClick={() => setOpeningAccount(true)}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-bold text-base cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className="ri-user-add-line text-lg" />
                Abrir Primera Cuenta
              </button>
            </div>
          ) : searchFilteredAccounts.length === 0 && trimmedSearch ? (
            /* Sin resultados para búsqueda */
            <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
              <i className="ri-user-search-line text-4xl text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">Sin resultados para &quot;{searchQuery}&quot;</p>
              <p className="text-gray-400 text-sm mt-1">Intenta con otro nombre o celular</p>
            </div>
          ) : (
            <>
              {/* Área filter pills en mobile */}
              <div className="flex items-center gap-2 mb-3 sm:hidden overflow-x-auto pb-1">
                {AREA_FILTER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setAreaFilter(opt.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap transition-all ${
                      areaFilter === opt.value
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Contador + controles en header de grid */}
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-500">
                  {searchFilteredAccounts.length} cuenta{searchFilteredAccounts.length !== 1 ? 's' : ''} activa{searchFilteredAccounts.length !== 1 ? 's' : ''}
                  {trimmedSearch && <span className="ml-1 text-amber-600">· &quot;{searchQuery}&quot;</span>}
                </p>
                <div className="flex items-center gap-2">
                {/* Botón ordenar por alertas */}
                  <button
                    onClick={() => setSortByAlerts(v => !v)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap border ${
                      sortByAlerts
                        ? 'bg-red-500 border-red-500 text-white'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-red-400 hover:text-red-600'
                    }`}
                  >
                    <i className="ri-alarm-warning-line" />
                    Alertas primero
                    {(abandonedCount + warningCount) > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${
                        sortByAlerts ? 'bg-white/25 text-white' : 'bg-red-100 text-red-700'
                      }`}>
                        {abandonedCount + warningCount}
                      </span>
                    )}
                  </button>
                  {/* Botón ordenar por pendientes */}
                  <button
                    onClick={() => setSortByPending(v => !v)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap border ${
                      sortByPending
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-amber-400 hover:text-amber-600'
                    }`}
                  >
                    <i className="ri-sort-desc" />
                    Pendientes primero
                    {totalPendingAccounts > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${
                        sortByPending ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {totalPendingAccounts}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setOpeningAccount(true)}
                    className="hidden sm:flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-semibold cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <i className="ri-add-circle-line" />
                    Nueva cuenta
                  </button>
                </div>
              </div>

              {/* Banner VIP del turno */}
              {vipAccounts.length > 0 && !vipBannerDismissed && (
                <div className="mb-3 flex items-center gap-3 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-xl px-4 py-3">
                  <div className="w-8 h-8 flex items-center justify-center bg-white/25 rounded-lg flex-shrink-0">
                    <i className="ri-vip-crown-2-fill text-white text-base" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-black tracking-wide uppercase leading-tight">
                      {vipAccounts.length === 1
                        ? `¡Mesa VIP activa!`
                        : `¡${vipAccounts.length} mesas VIP activas!`}
                    </p>
                    <p className="text-white/80 text-[11px] font-medium leading-tight mt-0.5">
                      {vipAccounts.length === 1
                        ? `${vipAccounts[0].customer_name || 'Cliente'} lleva ${vipAccounts[0].folio_counter} rondas — atención especial`
                        : vipAccounts.map(a => `${a.customer_name || 'Cliente'} (${a.folio_counter}r)`).join(' · ')
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => setVipBannerDismissed(true)}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white cursor-pointer transition-colors flex-shrink-0"
                  >
                    <i className="ri-close-line text-xs" />
                  </button>
                </div>
              )}

              {/* ===== PANEL POR ENTREGAR ===== */}
              <Suspense fallback={null}>
                <ReadyToDeliverPanel accounts={accounts} onRefresh={fetchAccounts} />
              </Suspense>

              {/* Grid de tarjetas de clientes */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {searchFilteredAccounts.map((account) => {
                  const pendingCall = findPendingCallForAccount(account);
                  return (
                    <CustomerAccountCard
                      key={account.id}
                      account={account}
                      pendingCall={pendingCall}
                      onAttendCall={handleAttendWaiterCall}
                      onClick={() => handleAccountCardClick(account)}
                    />
                  );
                })}

                {/* Tarjeta de "Nueva Cuenta" siempre al final */}
                {!trimmedSearch && (
                  <button
                    onClick={() => setOpeningAccount(true)}
                    className="relative w-full rounded-xl text-left transition-all cursor-pointer border-2 border-dashed border-gray-300 hover:border-amber-400 bg-white hover:bg-amber-50 group flex flex-col items-center justify-center min-h-[120px] gap-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                      <i className="ri-user-add-line text-gray-400 text-lg group-hover:text-amber-500 transition-colors" />
                    </div>
                    <span className="text-xs font-semibold text-gray-400 group-hover:text-amber-600 transition-colors text-center px-2">
                      Nueva Cuenta
                    </span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {capitanBot}

      {/* Modal abrir cuenta */}
      {openingAccount && (
        <OpenAccountModal
          onConfirm={handleOpenAccount}
          onClose={() => setOpeningAccount(false)}
        />
      )}
    </div>
  );
}