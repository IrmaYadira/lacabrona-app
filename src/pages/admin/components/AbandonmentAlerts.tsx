import { useState, useEffect, useRef, useCallback } from 'react';
import { supabasePos } from '@/pages/pos/supabasePos';
import { useAbandonedChecks, isAccountReviewed } from '@/pages/admin/hooks/useAbandonedChecks';

interface AlertItem {
  id: number;
  spot: string;
  area: string;
  customer_name?: string;
  minutesSinceLastOrder: number;
  totalMinutesOpen: number;
  lastOrderAt?: string;
  severity: 'critical' | 'warning' | 'caution';
  itemCount: number;
  folioCount: number;
  triggeredAt: number;
  lastItemAt?: string;
}

const ALERT_THRESHOLDS = {
  critical: 120,
  warning: 90,
  caution: 60,
};

function getMinutesSinceLastOrder(account: {
  created_at: string;
  pos_account_items: { created_at: string }[];
}): { minutes: number; lastItemAt?: string } {
  const items = account.pos_account_items ?? [];
  if (items.length === 0) {
    return {
      minutes: Math.floor((Date.now() - new Date(account.created_at).getTime()) / 60000),
      lastItemAt: undefined,
    };
  }
  const lastOrder = items.reduce((latest, item) => {
    const t = new Date(item.created_at).getTime();
    return t > latest ? t : latest;
  }, 0);
  return {
    minutes: Math.floor((Date.now() - lastOrder) / 60000),
    lastItemAt: new Date(lastOrder).toISOString(),
  };
}

function getSeverity(mins: number): AlertItem['severity'] {
  if (mins >= ALERT_THRESHOLDS.critical) return 'critical';
  if (mins >= ALERT_THRESHOLDS.warning) return 'warning';
  if (mins >= ALERT_THRESHOLDS.caution) return 'caution';
  return 'caution';
}

function formatMins(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const notes = [392.0, 392.0, 392.0];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.3);
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.3);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + i * 0.3 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.3 + 0.4);
      osc.start(ctx.currentTime + i * 0.3);
      osc.stop(ctx.currentTime + i * 0.3 + 0.4);
    });
  } catch (e) {
    console.warn('[AbandonmentAlerts] playAlertSound failed:', e);
  }
}

interface AbandonmentAlertsProps {
  onGoToMesas?: () => void;
}

export default function AbandonmentAlerts({ onGoToMesas }: AbandonmentAlertsProps) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [toasts, setToasts] = useState<AlertItem[]>([]);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewerName, setReviewerName] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const notifiedRef = useRef<Set<number>>(new Set());
  const isFirstMount = useRef(true);
  const { checks, markAsReviewed, refetch } = useAbandonedChecks();

  const fetchAlerts = useCallback(async () => {
    const { data } = await supabasePos
      .from('pos_accounts')
      .select('id, spot, area, customer_name, created_at, folio_counter, pos_account_items(created_at)')
      .eq('status', 'open');

    if (!data) return;

    const newAlerts: AlertItem[] = [];
    (data as {
      id: number; spot: string; area: string; customer_name?: string; created_at: string; folio_counter: number; pos_account_items: { created_at: string }[];
    }[]).forEach(acc => {
      const { minutes: mins, lastItemAt } = getMinutesSinceLastOrder(acc);
      if (mins >= ALERT_THRESHOLDS.caution) {
        // Skip if already reviewed after the last item
        if (isAccountReviewed(acc.id, checks, lastItemAt)) return;

        const itemCount = (acc.pos_account_items ?? []).length;
        const severity = getSeverity(mins);
        newAlerts.push({
          id: acc.id,
          spot: acc.spot,
          area: acc.area,
          customer_name: acc.customer_name,
          minutesSinceLastOrder: mins,
          totalMinutesOpen: Math.floor((Date.now() - new Date(acc.created_at).getTime()) / 60000),
          lastOrderAt: lastItemAt,
          severity,
          itemCount,
          folioCount: acc.folio_counter,
          triggeredAt: Date.now(),
          lastItemAt,
        });
      }
    });

    newAlerts.sort((a, b) => {
      const sevOrder = { critical: 0, warning: 1, caution: 2 };
      if (sevOrder[a.severity] !== sevOrder[b.severity]) {
        return sevOrder[a.severity] - sevOrder[b.severity];
      }
      return b.minutesSinceLastOrder - a.minutesSinceLastOrder;
    });

    setAlerts(newAlerts);

    if (isFirstMount.current) {
      isFirstMount.current = false;
      newAlerts.forEach(a => {
        if (a.severity === 'critical') {
          notifiedRef.current.add(a.id);
        }
      });
      return;
    }

    newAlerts.forEach(a => {
      if (a.severity === 'critical' && !notifiedRef.current.has(a.id)) {
        notifiedRef.current.add(a.id);
        playAlertSound();
        setToasts(prev => [...prev, a]);
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== a.id));
        }, 8000);
      } else if (a.severity !== 'critical') {
        notifiedRef.current.delete(a.id);
      }
    });

    const alertIds = new Set(newAlerts.map(a => a.id));
    notifiedRef.current.forEach(id => {
      if (!alertIds.has(id)) {
        notifiedRef.current.delete(id);
      }
    });
  }, [checks]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);

    const channel = supabasePos
      .channel('abandonment-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_accounts' }, fetchAlerts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_account_items' }, fetchAlerts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_abandoned_checks' }, fetchAlerts)
      .subscribe();

    return () => {
      clearInterval(interval);
      supabasePos.removeChannel(channel);
    };
  }, [fetchAlerts]);

  const handleMarkReviewed = useCallback(async (accountId: number) => {
    await markAsReviewed(accountId, reviewerName.trim() || undefined, reviewNote.trim() || undefined);
    setReviewingId(null);
    setReviewerName('');
    setReviewNote('');
    refetch();
  }, [markAsReviewed, reviewerName, reviewNote, refetch]);

  const visibleAlerts = alerts.filter(a => !dismissed.has(a.id));

  const criticalCount = visibleAlerts.filter(a => a.severity === 'critical').length;
  const warningCount = visibleAlerts.filter(a => a.severity === 'warning').length;
  const cautionCount = visibleAlerts.filter(a => a.severity === 'caution').length;

  const severityConfig = {
    critical: {
      bg: 'bg-red-50 border-red-200',
      headerBg: 'bg-red-500',
      text: 'text-red-600',
      label: 'ABANDONADA',
      icon: 'ri-alarm-warning-fill',
      badge: 'bg-red-500',
    },
    warning: {
      bg: 'bg-orange-50 border-orange-200',
      headerBg: 'bg-orange-500',
      text: 'text-orange-600',
      label: 'ALERTA',
      icon: 'ri-alarm-warning-line',
      badge: 'bg-orange-500',
    },
    caution: {
      bg: 'bg-yellow-50 border-yellow-200',
      headerBg: 'bg-yellow-500',
      text: 'text-yellow-700',
      label: 'CUIDADO',
      icon: 'ri-time-line',
      badge: 'bg-yellow-500',
    },
  };

  if (alerts.length === 0) {
    return null;
  }

  return (
    <>
      {/* Review modal */}
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

      {/* Persistent alert banner */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className={`w-full flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
            criticalCount > 0
              ? 'bg-red-500 hover:bg-red-600'
              : warningCount > 0
                ? 'bg-orange-500 hover:bg-orange-600'
                : 'bg-yellow-500 hover:bg-yellow-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="ri-alarm-warning-fill text-white text-base" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-white text-sm">
                {criticalCount > 0
                  ? `${criticalCount} mesa${criticalCount !== 1 ? 's' : ''} abandonada${criticalCount !== 1 ? 's' : ''}`
                  : warningCount > 0
                    ? `${warningCount} mesa${warningCount !== 1 ? 's' : ''} en alerta`
                    : `${cautionCount} mesa${cautionCount !== 1 ? 's' : ''} con cuidado`}
              </h3>
              <p className="text-xs text-white/80">
                {criticalCount > 0 && `${criticalCount} crítica${criticalCount !== 1 ? 's' : ''} · `}
                {warningCount > 0 && `${warningCount} alerta${warningCount !== 1 ? 's' : ''} · `}
                {cautionCount > 0 && `${cautionCount} cuidado${cautionCount !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onGoToMesas && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onGoToMesas();
                }}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1"
              >
                <i className="ri-table-line" />
                Ver mesas
              </button>
            )}
            <i className={`${collapsed ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line'} text-white text-xl transition-transform`} />
          </div>
        </button>

        {/* Alert list */}
        {!collapsed && (
          <div className="divide-y divide-gray-100">
            {visibleAlerts.map(alert => {
              const config = severityConfig[alert.severity];
              return (
                <div key={alert.id} className={`flex items-center gap-3 px-4 py-3 ${config.bg}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${config.badge} ${alert.severity === 'critical' ? 'animate-pulse' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 text-sm">{alert.spot}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${config.bg} ${config.text}`}>
                        {config.label}
                      </span>
                      {alert.customer_name && (
                        <span className="text-xs text-gray-500">{alert.customer_name}</span>
                      )}
                      <span className="text-xs text-gray-400 capitalize">· {alert.area}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className={`text-xs font-bold ${config.text}`}>
                        <i className="ri-time-line mr-1" />
                        {formatMins(alert.minutesSinceLastOrder)} sin pedir
                      </span>
                      <span className="text-xs text-gray-500">
                        Abierta {formatMins(alert.totalMinutesOpen)} total
                      </span>
                      <span className="text-xs text-gray-500">
                        {alert.itemCount} items · {alert.folioCount} ronda{alert.folioCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setReviewingId(alert.id)}
                      className="px-3 py-1.5 bg-white border border-green-200 hover:border-green-400 text-green-700 hover:text-green-700 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1"
                    >
                      <i className="ri-check-double-line" />
                      Revisada
                    </button>
                    {onGoToMesas && (
                      <button
                        onClick={() => onGoToMesas()}
                        className="px-3 py-1.5 bg-white border border-gray-200 hover:border-amber-400 text-gray-700 hover:text-amber-600 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap"
                      >
                        Ir a mesa
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setDismissed(prev => new Set([...prev, alert.id]));
                        notifiedRef.current.delete(alert.id);
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200/50 cursor-pointer text-gray-400 transition-colors"
                      title="Descartar alerta"
                    >
                      <i className="ri-close-line" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toasts for new critical alerts */}
      {toasts.length > 0 && (
        <div className="fixed top-20 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map(toast => (
            <div
              key={`toast-${toast.id}-${toast.triggeredAt}`}
              className="pointer-events-auto bg-red-600 text-white px-4 py-3 rounded-xl shadow-lg shadow-red-900/30 flex items-center gap-3 animate-bounce"
              style={{ animationDuration: '0.5s', animationIterationCount: '2' }}
            >
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
                <i className="ri-alarm-warning-fill text-xl" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">
                  {toast.spot} — {formatMins(toast.minutesSinceLastOrder)} sin pedir
                </p>
                <p className="text-xs text-red-100">
                  {toast.customer_name || 'Sin nombre'} · {toast.itemCount} items · {toast.folioCount} ronda{toast.folioCount !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => {
                  if (onGoToMesas) onGoToMesas();
                  setToasts(prev => prev.filter(t => t.id !== toast.id));
                }}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
              >
                Ver
              </button>
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 cursor-pointer transition-colors flex-shrink-0"
              >
                <i className="ri-close-line" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}