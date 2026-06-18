import { useState, useEffect, useCallback, useRef } from 'react';
import { supabasePos } from '@/pages/pos/supabasePos';
import { AREA_LABELS, type Area } from '@/pages/pos/types';
import { useAbandonedChecks, isAccountReviewed } from '@/pages/admin/hooks/useAbandonedChecks';
import AdminCancelItemModal from './AdminCancelItemModal';
import CloseAccountFromAdmin from './CloseAccountFromAdmin';

interface AccountItem {
  id: number;
  product_name: string;
  size?: string;
  quantity: number;
  unit_price: number;
  folio_number: number;
  created_at: string;
  delivered: boolean;
  origin?: string;
  notes?: string;
}

interface Account {
  id: number;
  spot: string;
  area: string;
  customer_name?: string;
  customer_phone?: string;
  folio_counter: number;
  created_at: string;
  pos_account_items: AccountItem[];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function getElapsed(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return hrs > 0 ? `${hrs}h ${rem}m` : `${mins}m`;
}

function getElapsedColor(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins >= 120) return 'text-red-500';
  if (mins >= 60) return 'text-orange-500';
  return 'text-green-600';
}

function getDeliveryStatus(items: AccountItem[]) {
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const deliveredQty = items.filter(i => i.delivered).reduce((s, i) => s + i.quantity, 0);
  if (totalQty === 0) return { label: 'Sin pedidos', color: 'bg-gray-100 text-gray-400', icon: 'ri-shopping-basket-line', allDelivered: true, pendingQty: 0 };
  if (deliveredQty === 0) return { label: `${totalQty} pendiente${totalQty !== 1 ? 's' : ''}`, color: 'bg-red-50 text-red-600 border-red-200', icon: 'ri-time-line', allDelivered: false, pendingQty: totalQty };
  if (deliveredQty === totalQty) return { label: 'Todo entregado', color: 'bg-green-100 text-green-700 border-green-200', icon: 'ri-check-double-line', allDelivered: true, pendingQty: 0 };
  return { label: `${deliveredQty} de ${totalQty} entregado${totalQty !== 1 ? 's' : ''}`, color: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'ri-loader-2-line', allDelivered: false, pendingQty: totalQty - deliveredQty };
}

function getAbandonStatus(account: Account): { minutes: number; status: 'critical' | 'warning' | 'caution' | 'normal' } {
  const items = account.pos_account_items ?? [];
  const now = Date.now();
  const openAt = new Date(account.created_at).getTime();
  if (items.length === 0) {
    const mins = Math.floor((now - openAt) / 60000);
    return { minutes: mins, status: mins >= 120 ? 'critical' : mins >= 60 ? 'warning' : 'normal' };
  }
  const lastOrder = items.reduce((latest, item) => {
    const t = new Date(item.created_at).getTime();
    return t > latest ? t : latest;
  }, 0);
  const mins = Math.floor((now - lastOrder) / 60000);
  if (mins >= 120) return { minutes: mins, status: 'critical' };
  if (mins >= 90) return { minutes: mins, status: 'warning' };
  if (mins >= 60) return { minutes: mins, status: 'caution' };
  return { minutes: mins, status: 'normal' };
}

function formatAbandonMins(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface ClosedTodayAccount {
  id: number;
  spot: string;
  area: string;
  customer_name?: string;
  closed_at: string;
  pos_account_items: AccountItem[];
}

export default function OpenAccountsView() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [closingAccount, setClosingAccount] = useState<Account | null>(null);
  const [cancellingAccount, setCancellingAccount] = useState<Account | null>(null);
  const [sortByPending, setSortByPending] = useState(false);
  const [, setTick] = useState(0);
  const [readyToCloseOnly, setReadyToCloseOnly] = useState(false);

  // Cerradas hoy
  const [closedToday, setClosedToday] = useState<ClosedTodayAccount[]>([]);
  const [showClosed, setShowClosed] = useState(false);
  const [reopeningId, setReopeningId] = useState<number | null>(null);
  const [reopenConfirmId, setReopenConfirmId] = useState<number | null>(null);
  const [reopenDoneId, setReopenDoneId] = useState<number | null>(null);
  const [showAbandonedOnly, setShowAbandonedOnly] = useState(false);
  const [completionToasts, setCompletionToasts] = useState<Array<{ id: string; accountId: number; spot: string; accountName: string }>>([]);
  const notifiedAccountsRef = useRef<Set<number>>(new Set());
  const isFirstMountRef = useRef(true);
  const { checks, markAsReviewed, refetch } = useAbandonedChecks();
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewerName, setReviewerName] = useState('');
  const [reviewNote, setReviewNote] = useState('');

  const playCompletionSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.15 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.5);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.5);
      });
    } catch {
      // Audio not available
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    const { data } = await supabasePos
      .from('pos_accounts')
      .select('id, spot, area, customer_name, customer_phone, folio_counter, created_at, pos_account_items(*)')
      .eq('status', 'open')
      .order('created_at', { ascending: true });
    if (data) setAccounts(data as Account[]);
    setLoading(false);
  }, []);

  const fetchClosedToday = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabasePos
      .from('pos_accounts')
      .select('id, spot, area, customer_name, closed_at, pos_account_items(*)')
      .eq('status', 'closed')
      .gte('closed_at', `${today}T00:00:00`)
      .lte('closed_at', `${today}T23:59:59`)
      .order('closed_at', { ascending: false })
      .limit(20);
    if (data) setClosedToday(data as ClosedTodayAccount[]);
  }, []);

  const handleReopen = async (accountId: number) => {
    setReopeningId(accountId);
    try {
      await supabasePos.from('pos_payments').delete().eq('account_id', accountId);
      await supabasePos.from('pos_accounts').update({ status: 'open', closed_at: null }).eq('id', accountId);
      setReopenDoneId(accountId);
      setReopenConfirmId(null);
      setTimeout(() => {
        setReopenDoneId(null);
        fetchAccounts();
        fetchClosedToday();
      }, 2500);
    } finally {
      setReopeningId(null);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchClosedToday();
    const interval = setInterval(() => {
      setTick(t => t + 1);
      fetchAccounts();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchAccounts, fetchClosedToday]);

  // Detectar cuentas que acaban de quedar 100% entregadas
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      accounts.forEach(account => {
        const items = account.pos_account_items ?? [];
        if (items.length > 0 && items.every(i => i.delivered)) {
          notifiedAccountsRef.current.add(account.id);
        }
      });
      return;
    }

    accounts.forEach(account => {
      const items = account.pos_account_items ?? [];
      const allDelivered = items.length > 0 && items.every(i => i.delivered);

      if (allDelivered && !notifiedAccountsRef.current.has(account.id)) {
        notifiedAccountsRef.current.add(account.id);
        playCompletionSound();
        setCompletionToasts(prev => [...prev, {
          id: `toast-${account.id}-${Date.now()}`,
          accountId: account.id,
          spot: account.spot,
          accountName: account.customer_name || account.spot,
        }]);
        setTimeout(() => {
          setCompletionToasts(prev => prev.filter(t => t.accountId !== account.id));
        }, 6000);
      } else if (!allDelivered && notifiedAccountsRef.current.has(account.id)) {
        notifiedAccountsRef.current.delete(account.id);
      }
    });
  }, [accounts, playCompletionSound]);

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(accounts.map(a => a.id)));
  const collapseAll = () => setExpanded(new Set());

  const filtered = accounts.filter(a => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      a.spot.toLowerCase().includes(q) ||
      (a.customer_name ?? '').toLowerCase().includes(q) ||
      (a.customer_phone ?? '').includes(q)
    );
  });

  const sorted = sortByPending
    ? [...filtered].sort((a, b) => {
        const pa = getDeliveryStatus(a.pos_account_items ?? []).pendingQty;
        const pb = getDeliveryStatus(b.pos_account_items ?? []).pendingQty;
        return pb - pa;
      })
    : showAbandonedOnly
    ? filtered.filter(a => {
        const ab = getAbandonStatus(a);
        const lastItem = (a.pos_account_items ?? []).length > 0
          ? (a.pos_account_items ?? []).reduce((latest, item) => {
              const t = new Date(item.created_at).getTime();
              return t > latest ? t : latest;
            }, 0)
          : undefined;
        const lastItemAt = lastItem ? new Date(lastItem).toISOString() : undefined;
        return ab.status !== 'normal' && !isAccountReviewed(a.id, checks, lastItemAt);
      })
    : readyToCloseOnly
    ? filtered.filter(a => {
        const items = a.pos_account_items ?? [];
        return items.length > 0 && items.every(i => i.delivered);
      })
    : filtered;

  const totalInBar = accounts.reduce((s, a) =>
    s + (a.pos_account_items ?? []).reduce((ss, i) => ss + i.unit_price * i.quantity, 0), 0);

  // Estadísticas globales de entregas
  const allItems = accounts.flatMap(a => a.pos_account_items ?? []);
  const totalQty = allItems.reduce((s, i) => s + i.quantity, 0);
  const deliveredQty = allItems.filter(i => i.delivered).reduce((s, i) => s + i.quantity, 0);
  const pendingQty = totalQty - deliveredQty;
  const pendingAccountsCount = accounts.filter(a => getDeliveryStatus(a.pos_account_items ?? []).pendingQty > 0).length;
  const readyToCloseCount = accounts.filter(a => {
    const items = a.pos_account_items ?? [];
    return items.length > 0 && items.every(i => i.delivered);
  }).length;

  // Estadísticas de abandono (solo no revisadas)
  const abandonStats = accounts.reduce((acc, a) => {
    const ab = getAbandonStatus(a);
    const lastItem = (a.pos_account_items ?? []).length > 0
      ? (a.pos_account_items ?? []).reduce((latest, item) => {
          const t = new Date(item.created_at).getTime();
          return t > latest ? t : latest;
        }, 0)
      : undefined;
    const lastItemAt = lastItem ? new Date(lastItem).toISOString() : undefined;
    if (isAccountReviewed(a.id, checks, lastItemAt)) return acc;
    if (ab.status === 'critical') acc.critical++;
    else if (ab.status === 'warning') acc.warning++;
    else if (ab.status === 'caution') acc.caution++;
    return acc;
  }, { critical: 0, warning: 0, caution: 0 });

  const reviewedCount = accounts.filter(a => {
    const ab = getAbandonStatus(a);
    if (ab.status === 'normal') return false;
    const lastItem = (a.pos_account_items ?? []).length > 0
      ? (a.pos_account_items ?? []).reduce((latest, item) => {
          const t = new Date(item.created_at).getTime();
          return t > latest ? t : latest;
        }, 0)
      : undefined;
    const lastItemAt = lastItem ? new Date(lastItem).toISOString() : undefined;
    return isAccountReviewed(a.id, checks, lastItemAt);
  }).length;

  const handleMarkReviewed = useCallback(async (accountId: number) => {
    await markAsReviewed(accountId, reviewerName.trim() || undefined, reviewNote.trim() || undefined);
    setReviewingId(null);
    setReviewerName('');
    setReviewNote('');
    refetch();
  }, [markAsReviewed, reviewerName, reviewNote, refetch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Mesas abiertas */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-green-400" />
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <p className="text-xs text-gray-400 uppercase tracking-wide">Mesas Abiertas</p>
          </div>
          <p className="text-3xl font-black text-gray-900">{accounts.length}</p>
          {accounts.length > 0 && (
            <p className="text-xs text-green-600 font-semibold mt-0.5">{accounts.length} mesa{accounts.length !== 1 ? 's' : ''} activa{accounts.length !== 1 ? 's' : ''}</p>
          )}
        </div>

        {/* Total en consumo — el más importante */}
        <div className="bg-gray-950 rounded-xl px-4 py-3 relative overflow-hidden col-span-1">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">En Consumo Ahora</p>
          <p className="text-3xl font-black text-amber-400">${totalInBar.toFixed(2)}</p>
          {accounts.length > 0 && (
            <p className="text-xs text-amber-600 font-semibold mt-0.5">
              Promedio ${accounts.length > 0 ? (totalInBar / accounts.length).toFixed(2) : '0.00'}/mesa
            </p>
          )}
        </div>

        {/* Rondas totales */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Rondas</p>
          <p className="text-3xl font-black text-gray-900">
            {accounts.reduce((s, a) => s + a.folio_counter, 0)}
          </p>
          {accounts.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              {(accounts.reduce((s, a) => s + a.folio_counter, 0) / Math.max(accounts.length, 1)).toFixed(1)} por mesa
            </p>
          )}
        </div>

        {/* Total productos */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Productos</p>
          <p className="text-3xl font-black text-gray-900">
            {accounts.reduce((s, a) =>
              s + (a.pos_account_items ?? []).reduce((ss, i) => ss + i.quantity, 0), 0)}
          </p>
          {accounts.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">En todas las mesas</p>
          )}
        </div>

        {/* Entregas — nueva */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 relative overflow-hidden">
          <div className={`absolute top-0 left-0 right-0 h-1 ${pendingQty > 0 ? 'bg-amber-500' : 'bg-green-500'}`} />
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${pendingQty > 0 ? 'bg-amber-500' : 'bg-green-500'}`} />
            <p className="text-xs text-gray-400 uppercase tracking-wide">Entregas</p>
          </div>
          <p className="text-3xl font-black text-gray-900">{deliveredQty}<span className="text-lg text-gray-400 font-medium">/{totalQty}</span></p>
          {accounts.length > 0 && (
            <p className="text-xs mt-0.5 font-semibold">
              {pendingQty > 0 ? (
                <span className="text-amber-600">{pendingQty} pendiente{pendingQty !== 1 ? 's' : ''} · {pendingAccountsCount} cuenta{pendingAccountsCount !== 1 ? 's' : ''}</span>
              ) : (
                <span className="text-green-600">Todo entregado</span>
              )}
            </p>
          )}
        </div>

        {/* Listas para cerrar — NUEVA */}
        <button
          onClick={() => { setReadyToCloseOnly(v => !v); setSortByPending(false); setShowAbandonedOnly(false); }}
          className={`text-left rounded-xl border px-4 py-3 relative overflow-hidden transition-all cursor-pointer ${
            readyToCloseOnly
              ? 'bg-green-600 border-green-600'
              : 'bg-white border-gray-200 hover:border-green-400'
          }`}
        >
          <div className={`absolute top-0 left-0 right-0 h-1 ${readyToCloseOnly ? 'bg-white/40' : 'bg-green-500'}`} />
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`w-1.5 h-1.5 rounded-full ${readyToCloseOnly ? 'bg-white animate-pulse' : 'bg-green-500'}`} />
            <p className={`text-xs uppercase tracking-wide ${readyToCloseOnly ? 'text-green-100' : 'text-gray-400'}`}>Listas para Cerrar</p>
          </div>
          <p className={`text-3xl font-black ${readyToCloseOnly ? 'text-white' : 'text-gray-900'}`}>{readyToCloseCount}</p>
          {accounts.length > 0 && (
            <p className={`text-xs mt-0.5 font-semibold ${readyToCloseOnly ? 'text-green-200' : 'text-green-600'}`}>
              {readyToCloseCount > 0 ? 'Clic para ver' : 'Ninguna mesa lista'}
            </p>
          )}
        </button>
      </div>

      {/* Alertas de abandono — barra rápida */}
      {(abandonStats.critical > 0 || abandonStats.warning > 0 || abandonStats.caution > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold flex items-center gap-2">
              <i className="ri-alarm-warning-line text-amber-500" />
              Mesas sin actividad reciente
            </p>
            <button
              onClick={() => { setShowAbandonedOnly(v => !v); setReadyToCloseOnly(false); setSortByPending(false); }}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap ${
                showAbandonedOnly
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600'
              }`}
            >
              {showAbandonedOnly ? 'Ver todas' : 'Ver abandonadas'}
            </button>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {abandonStats.critical > 0 && (
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-bold text-red-600">{abandonStats.critical} abandonada{abandonStats.critical !== 1 ? 's' : ''}</span>
              </div>
            )}
            {abandonStats.warning > 0 && (
              <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-xs font-bold text-orange-600">{abandonStats.warning} alerta{abandonStats.warning !== 1 ? 's' : ''}</span>
              </div>
            )}
            {abandonStats.caution > 0 && (
              <div className="flex items-center gap-1.5 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-xs font-bold text-yellow-700">{abandonStats.caution} cuidado{abandonStats.caution !== 1 ? 's' : ''}</span>
              </div>
            )}
            {reviewedCount > 0 && (
              <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs font-bold text-green-600">{reviewedCount} revisada{reviewedCount !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Banner especial cuando se filtra "Abandonadas" */}
      {showAbandonedOnly && sorted.length > 0 && (
        <div className="bg-red-600 text-white rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <i className="ri-alarm-warning-fill text-2xl text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base">Mesas con abandono</h3>
            <p className="text-sm text-red-100">
              {sorted.length} mesa{sorted.length !== 1 ? 's' : ''} sin pedir en 60+ minutos. Considera revisarlas.
            </p>
          </div>
          <button
            onClick={() => setShowAbandonedOnly(false)}
            className="flex-shrink-0 bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-close-line mr-1" />Salir
          </button>
        </div>
      )}

      {/* Barra de totales por mesa — visual rápido */}
      {accounts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3 flex items-center gap-2">
            <i className="ri-bar-chart-horizontal-line text-amber-500" />
            Consumo por mesa
          </p>
          <div className="space-y-2">
            {[...accounts]
              .sort((a, b) => {
                const ta = (a.pos_account_items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
                const tb = (b.pos_account_items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
                return tb - ta;
              })
              .map(acc => {
                const accTotal = (acc.pos_account_items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
                const pct = totalInBar > 0 ? (accTotal / totalInBar) * 100 : 0;
                return (
                  <div key={acc.id} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-700 w-20 truncate flex-shrink-0">{acc.spot}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-black text-amber-600 w-16 text-right flex-shrink-0">${accTotal.toFixed(2)}</span>
                    <span className="text-xs text-gray-400 w-8 text-right flex-shrink-0">{Math.round(pct)}%</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 px-3 py-2 flex-1 min-w-48">
          <i className="ri-search-line text-gray-400 text-sm" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar mesa, cliente..."
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 cursor-pointer">
              <i className="ri-close-line text-sm" />
            </button>
          )}
        </div>
        <button
          onClick={() => { setReadyToCloseOnly(v => !v); setSortByPending(false); setShowAbandonedOnly(false); }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap border ${
            readyToCloseOnly
              ? 'bg-green-600 border-green-600 text-white'
              : 'bg-white border-gray-200 text-gray-500 hover:border-green-400 hover:text-green-600'
          }`}
        >
          <i className="ri-check-double-line" />
          Listas para cerrar
          {readyToCloseCount > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${readyToCloseOnly ? 'bg-white/25 text-white' : 'bg-green-100 text-green-700'}`}>
              {readyToCloseCount}
            </span>
          )}
        </button>
        <button
          onClick={() => { setShowAbandonedOnly(v => !v); setReadyToCloseOnly(false); setSortByPending(false); }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap border ${
            showAbandonedOnly
              ? 'bg-red-500 border-red-500 text-white'
              : 'bg-white border-gray-200 text-gray-500 hover:border-red-400 hover:text-red-600'
          }`}
        >
          <i className="ri-alarm-warning-line" />
          Abandonadas
          {(abandonStats.critical + abandonStats.warning + abandonStats.caution) > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${showAbandonedOnly ? 'bg-white/25 text-white' : 'bg-red-100 text-red-700'}`}>
              {abandonStats.critical + abandonStats.warning + abandonStats.caution}
            </span>
          )}
        </button>
        <button
          onClick={() => { setSortByPending(v => !v); setReadyToCloseOnly(false); setShowAbandonedOnly(false); }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap border ${
            sortByPending
              ? 'bg-amber-500 border-amber-500 text-white'
              : 'bg-white border-gray-200 text-gray-500 hover:border-amber-400 hover:text-amber-600'
          }`}
        >
          <i className="ri-sort-desc" />
          Pendientes primero
          {pendingAccountsCount > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${sortByPending ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-700'}`}>
              {pendingAccountsCount}
            </span>
          )}
        </button>
        <button
          onClick={fetchAccounts}
          className="bg-white border border-gray-200 hover:border-amber-400 text-gray-600 hover:text-amber-600 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap flex items-center gap-1.5"
        >
          <i className="ri-refresh-line" />
          Actualizar
        </button>
        <button
          onClick={expandAll}
          className="bg-white border border-gray-200 hover:border-amber-400 text-gray-600 hover:text-amber-600 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
        >
          Expandir todo
        </button>
        <button
          onClick={collapseAll}
          className="bg-white border border-gray-200 text-gray-500 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
        >
          Colapsar todo
        </button>
        <button
          onClick={() => { setShowClosed(v => !v); fetchClosedToday(); }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap border ${
            showClosed
              ? 'bg-orange-500 border-orange-500 text-white'
              : 'bg-white border-orange-300 text-orange-600 hover:bg-orange-50'
          }`}
        >
          <i className="ri-refresh-line" />
          Cerradas hoy ({closedToday.length})
        </button>
      </div>

      {/* Sección de cuentas cerradas hoy — para reabrir si fue por accidente */}
      {showClosed && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-orange-200 bg-orange-100">
            <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="ri-refresh-line text-white text-base" />
            </div>
            <div>
              <h3 className="font-bold text-orange-900 text-sm">Cuentas Cerradas Hoy</h3>
              <p className="text-xs text-orange-700">Si alguna se cerró por accidente, puedes reabrirla</p>
            </div>
          </div>
          {closedToday.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-orange-600 text-sm">No hay cuentas cerradas hoy todavía</p>
            </div>
          ) : (
            <div className="divide-y divide-orange-100">
              {closedToday.map(acc => {
                const total = (acc.pos_account_items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
                const closedTime = acc.closed_at
                  ? new Date(acc.closed_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                  : '';
                return (
                  <div key={acc.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm">{acc.spot}</span>
                        {acc.customer_name && (
                          <span className="text-xs text-gray-500">{acc.customer_name}</span>
                        )}
                        <span className="text-xs text-gray-400">{closedTime}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {(acc.pos_account_items ?? []).reduce((s, i) => s + i.quantity, 0)} productos
                      </p>
                    </div>
                    <p className="font-bold text-amber-600 text-sm flex-shrink-0">${total.toFixed(2)}</p>
                    {reopenDoneId === acc.id ? (
                      <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap">
                        <i className="ri-checkbox-circle-fill" />Reabierta
                      </span>
                    ) : reopenConfirmId === acc.id ? (
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => setReopenConfirmId(null)}
                          className="text-xs px-2 py-1 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer whitespace-nowrap"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleReopen(acc.id)}
                          disabled={reopeningId === acc.id}
                          className="text-xs px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold cursor-pointer transition-colors whitespace-nowrap disabled:opacity-60"
                        >
                          {reopeningId === acc.id ? 'Reabriendo...' : 'Confirmar'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setReopenConfirmId(acc.id)}
                        className="text-xs px-3 py-1.5 border border-orange-400 text-orange-700 bg-white hover:bg-orange-50 rounded-lg font-semibold cursor-pointer transition-colors whitespace-nowrap flex-shrink-0 flex items-center gap-1"
                      >
                        <i className="ri-refresh-line" />Reabrir
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Estado vacío */}
      {sorted.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
            <i className="ri-door-open-line text-2xl text-gray-300" />
          </div>
          <p className="text-gray-500 font-medium">
            {search ? 'Sin resultados para esa búsqueda' : showAbandonedOnly ? 'Ninguna mesa abandonada actualmente' : readyToCloseOnly ? 'Ninguna mesa tiene todo entregado todavía' : 'No hay mesas abiertas ahora mismo'}
          </p>
        </div>
      )}

      {/* Banner especial cuando se filtra "Listas para cerrar" */}
      {readyToCloseOnly && sorted.length > 0 && (
        <div className="bg-green-600 text-white rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <i className="ri-check-double-line text-2xl text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base">Mesas listas para cerrar</h3>
            <p className="text-sm text-green-100">
              {sorted.length} mesa{sorted.length !== 1 ? 's' : ''} con todo entregado. Clic en "Cerrar" para facturar.
            </p>
          </div>
          <button
            onClick={() => setReadyToCloseOnly(false)}
            className="flex-shrink-0 bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-close-line mr-1" />Salir
          </button>
        </div>
      )}

      {/* Banner especial cuando se filtra "Abandonadas" */}
      {showAbandonedOnly && sorted.length > 0 && (
        <div className="bg-red-600 text-white rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <i className="ri-alarm-warning-fill text-2xl text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base">Mesas con abandono</h3>
            <p className="text-sm text-red-100">
              {sorted.length} mesa{sorted.length !== 1 ? 's' : ''} sin pedir en 60+ minutos. Considera revisarlas.
            </p>
          </div>
          <button
            onClick={() => setShowAbandonedOnly(false)}
            className="flex-shrink-0 bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-close-line mr-1" />Salir
          </button>
        </div>
      )}

      {/* Lista de cuentas */}
      <div className="space-y-3">
        {sorted.map(account => {
          const items = account.pos_account_items ?? [];
          const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
          const isExpanded = expanded.has(account.id);
          const folios = [...new Set(items.map(i => i.folio_number))].sort((a, b) => a - b);
          const elapsed = getElapsed(account.created_at);
          const elapsedColor = getElapsedColor(account.created_at);
          const areaLabel = AREA_LABELS[account.area as Area] ?? account.area;
          const delivery = getDeliveryStatus(items);
          const abandon = getAbandonStatus(account);

          return (
            <div key={account.id} className={`bg-white rounded-2xl border overflow-hidden transition-all ${!delivery.allDelivered && items.length > 0 ? 'border-gray-200' : 'border-gray-200'}`}>
              {/* Account header */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                {/* Expand toggle */}
                <button
                  onClick={() => toggleExpand(account.id)}
                  className="w-10 h-10 flex items-center justify-center bg-amber-100 hover:bg-amber-200 rounded-xl flex-shrink-0 cursor-pointer transition-colors"
                >
                  {isExpanded
                    ? <i className="ri-arrow-up-s-line text-amber-600 text-base" />
                    : <i className="ri-table-line text-amber-600 text-base" />
                  }
                </button>

                {/* Info — clickable to expand */}
                <button
                  onClick={() => toggleExpand(account.id)}
                  className="flex-1 min-w-0 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 text-sm">{account.spot}</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{areaLabel}</span>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                      {account.folio_counter} ronda{account.folio_counter !== 1 ? 's' : ''}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${delivery.color}`}>
                      <i className={delivery.icon} />
                      {delivery.label}
                    </span>
                    {abandon.status !== 'normal' && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        abandon.status === 'critical'
                          ? 'bg-red-500 text-white'
                          : abandon.status === 'warning'
                            ? 'bg-orange-500 text-white'
                            : 'bg-yellow-500 text-white'
                      }`}>
                        <i className="ri-time-line" />
                        {formatAbandonMins(abandon.minutes)} sin pedir
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {account.customer_name && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <i className="ri-user-line text-gray-400" />
                        {account.customer_name}
                      </span>
                    )}
                    <span className={`text-xs flex items-center gap-1 ${elapsedColor}`}>
                      <i className="ri-time-line" />
                      Abrió {formatTime(account.created_at)} · {elapsed}
                    </span>
                    {abandon.status !== 'normal' && (
                      <span className={`text-xs font-bold flex items-center gap-1 ${
                        abandon.status === 'critical'
                          ? 'text-red-600'
                          : abandon.status === 'warning'
                            ? 'text-orange-600'
                            : 'text-yellow-700'
                      }`}>
                        <i className="ri-alarm-warning-line" />
                        {abandon.status === 'critical' ? '¡Mesa abandonada!' : abandon.status === 'warning' ? 'En alerta' : 'Cuidado'}
                      </span>
                    )}
                  </div>
                </button>

                {/* Total */}
                <div className="text-right flex-shrink-0 mr-2">
                  <p className="text-base font-black text-amber-600">${total.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{items.reduce((s, i) => s + i.quantity, 0)} items</p>
                </div>

                {/* Mark as reviewed button for abandoned accounts */}
                {abandon.status !== 'normal' && (
                  <button
                    onClick={e => { e.stopPropagation(); setReviewingId(account.id); }}
                    className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors whitespace-nowrap flex-shrink-0"
                    title="Marcar como revisada"
                  >
                    <i className="ri-check-double-line" />
                    <span className="hidden sm:inline">Revisada</span>
                  </button>
                )}

                {/* Cancel items button */}
                <button
                  onClick={e => { e.stopPropagation(); setCancellingAccount(account); }}
                  className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors whitespace-nowrap flex-shrink-0"
                  title="Gestionar ítems de esta cuenta"
                >
                  <i className="ri-edit-box-line" />
                  <span className="hidden sm:inline">Gestionar</span>
                </button>

                {/* Close account button */}
                <button
                  onClick={e => { e.stopPropagation(); setClosingAccount(account); }}
                  className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors whitespace-nowrap flex-shrink-0"
                >
                  <i className="ri-close-circle-line" />
                  <span className="hidden sm:inline">Cerrar</span>
                </button>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                  {folios.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">Sin productos aún</p>
                  ) : (
                    <div className="space-y-3">
                      {folios.map(folio => {
                        const folioItems = items.filter(i => i.folio_number === folio);
                        const folioTotal = folioItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
                        const isLast = folio === folios[folios.length - 1];
                        const folioDeliveredCount = folioItems.filter(i => i.delivered).length;
                        const allDelivered = folioItems.length > 0 && folioItems.every(i => i.delivered);
                        const someDelivered = folioItems.some(i => i.delivered) && !allDelivered;
                        return (
                          <div key={folio} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div className={`flex items-center justify-between px-3 py-2 border-b ${isLast ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'}`}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${allDelivered ? 'bg-green-500' : isLast ? 'bg-amber-500' : 'bg-gray-400'}`}>
                                  Ronda #{String(folio).padStart(2, '0')}
                                </span>
                                {allDelivered && (
                                  <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                                    <i className="ri-checkbox-circle-fill" />Entregada
                                  </span>
                                )}
                                {someDelivered && (
                                  <span className="text-xs text-orange-500 font-semibold flex items-center gap-1">
                                    <i className="ri-loader-2-line" />Parcial — {folioDeliveredCount}/{folioItems.length}
                                  </span>
                                )}
                                {!someDelivered && !allDelivered && (
                                  <span className="text-xs text-gray-400 font-medium">Pendiente</span>
                                )}
                                {isLast && !allDelivered && <span className="text-xs text-amber-600 font-semibold">Última</span>}
                              </div>
                              <span className={`text-sm font-bold ${allDelivered ? 'text-green-600' : isLast ? 'text-amber-600' : 'text-gray-600'}`}>
                                ${folioTotal.toFixed(2)}
                              </span>
                            </div>
                            <div className="divide-y divide-gray-50">
                              {folioItems.map(item => (
                                <div key={item.id} className={`flex items-center justify-between px-3 py-2 ${item.delivered ? 'bg-green-50/50' : ''}`}>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-gray-900 leading-tight flex items-center gap-1.5">
                                      <span className="text-amber-600 font-bold">{item.quantity}x</span> {item.product_name}
                                      {item.origin === 'web' && (
                                        <span className="text-[10px] bg-green-100 text-green-700 px-1 py-0.5 rounded font-bold">WEB</span>
                                      )}
                                    </p>
                                    {item.size && <p className="text-xs text-amber-500 ml-4">{item.size}</p>}
                                    {item.notes && (
                                      <p className="text-xs text-amber-700 mt-0.5 ml-4 flex items-start gap-1">
                                        <i className="ri-sticky-note-line flex-shrink-0 mt-0.5 text-amber-400" />
                                        {item.notes}
                                      </p>
                                    )}
                                    {item.delivered && (
                                      <p className="text-xs text-green-600 mt-0.5 ml-4 flex items-center gap-1">
                                        <i className="ri-check-line" />
                                        Entregado
                                      </p>
                                    )}
                                  </div>
                                  <p className="text-xs font-bold text-gray-800 ml-2 flex-shrink-0">
                                    ${(item.unit_price * item.quantity).toFixed(2)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      {/* Total footer */}
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 rounded-xl">
                        <div>
                          <p className="text-xs text-gray-400">
                            {folios.length} ronda{folios.length !== 1 ? 's' : ''} · {items.reduce((s, i) => s + i.quantity, 0)} productos
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400 uppercase">Total cuenta</p>
                          <p className="text-lg font-black text-amber-400">${total.toFixed(2)}</p>
                        </div>
                      </div>

                      {/* Action buttons inside expanded */}
                      <div className="flex gap-3">
                        {abandon.status !== 'normal' && (
                          <button
                            onClick={() => setReviewingId(account.id)}
                            className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
                          >
                            <i className="ri-check-double-line text-base" />
                            Marcar Revisada
                          </button>
                        )}
                        <button
                          onClick={() => setCancellingAccount(account)}
                          className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
                        >
                          <i className="ri-edit-box-line text-base" />
                          Gestionar Cuenta
                        </button>
                        <button
                          onClick={() => setClosingAccount(account)}
                          className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
                        >
                          <i className="ri-close-circle-line text-base" />
                          Cerrar Cuenta · ${total.toFixed(2)}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal de cerrar cuenta */}
      {closingAccount && (
        <CloseAccountFromAdmin
          accountId={closingAccount.id}
          spot={closingAccount.spot}
          area={closingAccount.area}
          customerName={closingAccount.customer_name}
          items={closingAccount.pos_account_items ?? []}
          onClose={() => setClosingAccount(null)}
          onClosed={() => {
            setClosingAccount(null);
            fetchAccounts();
          }}
        />
      )}

      {/* Modal de cancelar items */}
      {cancellingAccount && (
        <AdminCancelItemModal
          accountId={cancellingAccount.id}
          spot={cancellingAccount.spot}
          items={cancellingAccount.pos_account_items ?? []}
          onClose={() => setCancellingAccount(null)}
          onCancelled={() => {
            setCancellingAccount(null);
            fetchAccounts();
          }}
        />
      )}

      {/* Modal de marcar como revisada */}
      {reviewingId !== null && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
                <i className="ri-check-double-line text-green-600 text-lg" />
              </div>
              <h3 className="font-bold text-gray-900 text-sm">Marcar como revisada</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Esta mesa dejará de aparecer en alertas hasta que haya un nuevo pedido.
            </p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Revisado por (opcional)</label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={e => setReviewerName(e.target.value)}
                  placeholder="Nombre del mesero..."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Nota (opcional)</label>
                <textarea
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  placeholder="Ej: Cliente no quiere nada más..."
                  rows={2}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setReviewingId(null); setReviewerName(''); setReviewNote(''); }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleMarkReviewed(reviewingId)}
                className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts de cuenta completamente entregada */}
      {completionToasts.length > 0 && (
        <div className="fixed bottom-6 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
          {completionToasts.map(toast => (
            <div
              key={toast.id}
              className="pointer-events-auto bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg shadow-green-900/30 flex items-center gap-3 animate-bounce"
              style={{ animationDuration: '0.5s', animationIterationCount: '2' }}
            >
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <i className="ri-check-double-line text-xl" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">¡{toast.accountName} completamente servida!</p>
                <p className="text-xs text-green-100">Todos los pedidos han sido entregados</p>
              </div>
              <button
                onClick={() => setCompletionToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 cursor-pointer transition-colors flex-shrink-0"
              >
                <i className="ri-close-line" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}