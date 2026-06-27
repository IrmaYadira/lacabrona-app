import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabasePos } from '@/pages/pos/supabasePos';
import {
  getAccountHistory,
  clearAccountHistory,
  removeAccountFromHistory,
  updateAccountInHistory,
  type AccountHistoryEntry,
} from '@/hooks/useAccountHistory';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285';

interface LiveAccount {
  id: number;
  status: 'open' | 'closed';
  total: number;
  itemCount: number;
  pendingItems: number;
}

type RealtimeStatus = 'connecting' | 'connected' | 'disconnected';

const faqs = [
  {
    q: "¿Qué son las cuentas guardadas en La Cabrona?",
    a: "Las cuentas guardadas son un historial de tus pedidos que se almacenan automáticamente en el navegador de tu celular cada vez que haces un pedido en La Cabrona. Este sistema te permite revisar el estado de tus cuentas, ver el total acumulado, los productos que ordenaste y cuántos están pendientes de entrega, todo sin necesidad de buscar nuevamente.",
  },
  {
    q: "¿Cuántas cuentas se pueden guardar?",
    a: "El sistema guarda un máximo de 10 cuentas por dispositivo. Cuando llegas al límite, las cuentas más antiguas se eliminan automáticamente para dar espacio a las nuevas. Puedes borrar el historial completo en cualquier momento usando el botón de eliminar en la parte superior de la página.",
  },
  {
    q: "¿Se actualizan las cuentas en tiempo real?",
    a: "Sí, las cuentas abiertas se actualizan automáticamente en tiempo real. Cuando el mesero agrega nuevos productos a tu cuenta o marca algunos como entregados, verás los cambios instantáneamente en tu celular sin necesidad de recargar la página.",
  },
  {
    q: "¿Puedo ver mi cuenta desde otro celular?",
    a: "No, el historial de cuentas está vinculado únicamente al navegador de tu celular. Si cambias de dispositivo, no verás tus cuentas guardadas. Sin embargo, puedes buscar tu cuenta activa en el nuevo dispositivo usando tu nombre o número de mesa en la página de Buscar Mi Cuenta.",
  },
  {
    q: "¿Qué pasa si borro el historial?",
    a: "Al borrar el historial, se eliminan todas las cuentas guardadas en ese dispositivo. Esto no afecta las cuentas abiertas en el sistema del bar, solo borra el registro local de tu celular. Puedes buscar nuevamente tus cuentas activas en cualquier momento.",
  },
  {
    q: "¿Cómo sé si mi cuenta sigue abierta?",
    a: "Las cuentas abiertas se muestran con una barra verde y un indicador parpadeante. También verás el número de productos en camino. Las cuentas cerradas aparecen en gris y ya no se actualizan. Si una cuenta abierta se cierra, se mueve automáticamente a la sección de cuentas anteriores.",
  },
];

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `hace ${days} día${days > 1 ? 's' : ''}`;
  if (hrs > 0) return `hace ${hrs}h ${mins % 60}m`;
  if (mins > 0) return `hace ${mins} min`;
  return 'justo ahora';
}

// ── Push notification toggle por cuenta ──
function PushToggle({ accountId, accountSpot }: { accountId: number; accountSpot: string }) {
  const [localError, setLocalError] = useState(false);

  // Si ya falló localmente, mostrar un mini estado de error y no llamar al hook
  if (localError) {
    return (
      <span className="inline-flex items-center gap-1 text-gray-600 text-[10px] bg-gray-800 px-2 py-1 rounded-full">
        <i className="ri-error-warning-line text-xs" />
        No disponible
      </span>
    );
  }

  try {
    return <PushToggleInner accountId={accountId} accountSpot={accountSpot} onError={() => setLocalError(true)} />;
  } catch {
    return null;
  }
}

function PushToggleInner({ accountId, accountSpot, onError }: { accountId: number; accountSpot: string; onError: () => void }) {
  const push = usePushNotifications(accountId);

  // Si el hook detecta que no es compatible, devolver null inmediatamente
  if (!push.supported) return null;
  if (push.isPreviewEnv) return null;

  if (push.subscribed) {
    return (
      <span className="inline-flex items-center gap-1 text-green-400 text-[10px] font-bold bg-green-500/10 px-2 py-1 rounded-full animate-in fade-in">
        <i className="ri-notification-3-fill text-xs" />
        Notificaciones ON
      </span>
    );
  }

  if (push.loading) {
    return (
      <span className="inline-flex items-center gap-1 text-gray-500 text-[10px] bg-gray-800 px-2 py-1 rounded-full">
        <i className="ri-loader-2-line animate-spin text-xs" />
        Activando...
      </span>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); push.subscribe().catch(() => onError()); }}
      className="inline-flex items-center gap-1 text-amber-400 text-[10px] font-bold bg-amber-500/10 px-2 py-1 rounded-full hover:bg-amber-500/20 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
    >
      <i className="ri-notification-line text-xs" />
      Notificarme cambios
    </button>
  );
}

// ── Realtime status indicator ──
function RealtimeDot({ status }: { status: RealtimeStatus }) {
  const label = status === 'connected' ? 'En vivo' : status === 'connecting' ? 'Conectando...' : 'Sin conexión en vivo';
  const color = status === 'connected' ? 'bg-green-400' : status === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-red-400';

  return (
    <div className="flex items-center gap-1.5" title={label}>
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className={`text-[10px] font-bold uppercase tracking-wider ${
        status === 'connected' ? 'text-green-400' : status === 'connecting' ? 'text-amber-400' : 'text-red-400'
      }`}>
        {label}
      </span>
    </div>
  );
}

// ── AccountCard ──
const AccountCard = memo(({
  entry,
  liveData,
  showPushToggle,
  onRemove,
}: {
  entry: AccountHistoryEntry;
  liveData?: Record<number, LiveAccount>;
  showPushToggle?: boolean;
  onRemove?: (id: number) => void;
}) => {
  const navigate = useNavigate();
  const live = liveData?.[entry.id];
  const status = live?.status ?? entry.lastStatus;
  const total = live?.total ?? entry.lastTotal;
  const isOpen = status === 'open';
  const pending = live?.pendingItems ?? 0;

  return (
    <button
      onClick={() => navigate(entry.url)}
      className="w-full text-left bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden active:scale-[0.98] transition-transform cursor-pointer relative group/card"
    >
      {/* Botón eliminar — solo visible en hover */}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onRemove(entry.id);
          }}
          className="absolute top-2 right-2 w-7 h-7 bg-gray-800 hover:bg-red-500/40 rounded-full flex items-center justify-center cursor-pointer opacity-0 group-hover/card:opacity-100 transition-all z-10"
          title="Quitar del historial"
          aria-label="Quitar del historial"
        >
          <i className="ri-close-line text-gray-500 hover:text-red-400 text-sm" />
        </button>
      )}
      {/* Status bar */}
      <div className={`h-1 w-full ${isOpen ? 'bg-green-500' : 'bg-gray-600'}`} />

      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          {/* Info izquierda */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOpen ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
              <span className={`text-xs font-bold uppercase tracking-wide ${isOpen ? 'text-green-400' : 'text-gray-500'}`}>
                {isOpen ? 'Abierta' : 'Cerrada'}
              </span>
              {isOpen && pending > 0 && (
                <span className="flex items-center gap-1 text-amber-400 text-xs font-bold bg-amber-500/15 px-2 py-0.5 rounded-full">
                  <i className="ri-loader-2-line animate-spin text-xs" />
                  {pending} en camino
                </span>
              )}
            </div>

            <p className="text-white text-2xl font-black leading-tight truncate">
              {entry.spot}
            </p>
            {entry.area && entry.area !== entry.spot && (
              <p className="text-gray-500 text-xs mt-0.5">{entry.area}</p>
            )}
            {entry.customer_name && (
              <p className="text-amber-400 text-sm mt-1 flex items-center gap-1">
                <i className="ri-user-line text-xs" />
                {entry.customer_name}
              </p>
            )}

            {/* Push toggle — solo en cuentas abiertas */}
            {isOpen && showPushToggle && (
              <div className="mt-2">
                <PushToggle accountId={entry.id} accountSpot={entry.spot} />
              </div>
            )}
          </div>

          {/* Total derecha */}
          <div className="text-right flex-shrink-0">
            <p className="text-gray-500 text-xs mb-0.5">Total</p>
            <p className={`text-2xl font-black ${isOpen ? 'text-amber-400' : 'text-gray-400'}`}>
              ${total.toFixed(2)}
            </p>
            {live && (
              <p className="text-gray-600 text-xs mt-0.5">
                {live.itemCount} producto{live.itemCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        {/* Footer de la card */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
          <span className="text-gray-600 text-xs flex items-center gap-1">
            <i className="ri-time-line" />
            {formatRelativeTime(entry.lastSeen)}
          </span>
          <span className={`flex items-center gap-1 text-xs font-semibold ${isOpen ? 'text-amber-500' : 'text-gray-500'}`}>
            {isOpen ? 'Ver cuenta' : 'Ver resumen'}
            <i className="ri-arrow-right-s-line" />
          </span>
        </div>
      </div>
    </button>
  );
});

AccountCard.displayName = 'AccountCard';

// ── PAGE ──
export default function MisCuentasPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<AccountHistoryEntry[]>([]);
  const [liveData, setLiveData] = useState<Record<number, LiveAccount>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('disconnected');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showFaq, setShowFaq] = useState(false);
  const historyRef = useRef<AccountHistoryEntry[]>([]);

  // Mantener ref sincronizada para que el callback del canal siempre tenga datos frescos
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const loadHistory = useCallback(() => {
    const h = getAccountHistory();
    setHistory(h);
    historyRef.current = h;
    return h;
  }, []);

  const fetchLiveData = useCallback(async (entries: AccountHistoryEntry[]) => {
    if (entries.length === 0) { setLoading(false); setError(null); return; }

    const ids = entries.map(e => e.id).filter(id => id != null && !Number.isNaN(id));
    if (ids.length === 0) { setLoading(false); setError(null); return; }

    try {
      const { data, error: queryError } = await supabasePos
        .from('pos_accounts')
        .select('id, status, pos_account_items(unit_price, quantity, delivered)')
        .in('id', ids);

      if (queryError) {
        console.error('Error fetching live accounts:', queryError);
        setError('No pudimos actualizar tus cuentas en este momento. Intenta de nuevo.');
        setLoading(false);
        return;
      }

      if (data && Array.isArray(data)) {
        const map: Record<number, LiveAccount> = {};
        data.forEach((acc: {
          id: number;
          status: 'open' | 'closed';
          pos_account_items: { unit_price: number; quantity: number; delivered: boolean }[];
        }) => {
          const items = acc.pos_account_items ?? [];
          const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
          const pending = items.filter(i => !i.delivered).length;
          map[acc.id] = {
            id: acc.id,
            status: acc.status,
            total,
            itemCount: items.length,
            pendingItems: pending,
          };
          updateAccountInHistory(acc.id, {
            lastTotal: total,
            lastStatus: acc.status,
            lastSeen: new Date().toISOString(),
          });
        });
        setLiveData(map);
        setError(null);
      }
    } catch (err) {
      console.error('fetchLiveData crashed:', err);
      setError('Ocurrió un error al cargar tus cuentas. Intenta recargar la página.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const h = loadHistory();
    fetchLiveData(h);
  }, [loadHistory, fetchLiveData]);

  // ── Suscripción en tiempo real robusta ──
  useEffect(() => {
    const openIds = history.filter(e => e.lastStatus === 'open').map(e => e.id);
    if (openIds.length === 0) {
      setRealtimeStatus('disconnected');
      return;
    }

    setRealtimeStatus('connecting');

    const channel = supabasePos
      .channel('mis-cuentas-live', {
        config: { broadcast: { self: true } },
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pos_account_items' },
        () => {
          // Usar ref para acceder a history fresco
          const current = historyRef.current;
          fetchLiveData(current.length > 0 ? current : history);
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pos_accounts' },
        () => {
          const current = historyRef.current;
          fetchLiveData(current.length > 0 ? current : history);
        },
      )
      .subscribe((status) => {
        switch (status) {
          case 'SUBSCRIBED':
            setRealtimeStatus('connected');
            break;
          case 'CHANNEL_ERROR':
          case 'TIMED_OUT':
          case 'CLOSED':
            setRealtimeStatus('disconnected');
            break;
          default:
            break;
        }
      });

    return () => {
      supabasePos.removeChannel(channel).catch(() => {});
    };
  }, [history.length, fetchLiveData]);
  // Nota: dependemos de history.length en vez de history entero para evitar
  // recrear el canal en cada cambio menor. Pero si cambian los IDs de cuentas
  // abiertas, se recrea porque history.filter(...) cambia.

  const handleClear = useCallback(() => {
    clearAccountHistory();
    setHistory([]);
    setLiveData({});
    setError(null);
    setShowClearConfirm(false);
    setTimeout(() => loadHistory(), 100);
  }, [loadHistory]);

  const handleRemoveEntry = useCallback((id: number) => {
    removeAccountFromHistory(id);
    setHistory(prev => prev.filter(e => e.id !== id));
    setLiveData(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const openAccounts = history.filter(e => (liveData[e.id]?.status ?? e.lastStatus) === 'open');
  const closedAccounts = history.filter(e => (liveData[e.id]?.status ?? e.lastStatus) === 'closed');

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-5 pt-10 pb-5">
        <div className="flex items-center gap-4 mb-1">
          <img
            src={LOGO_URL}
            alt="La Cabrona"
            title="La Cabrona Alitas & Beer"
            className="w-11 h-11 rounded-full object-cover border-2 border-amber-500 flex-shrink-0"
            loading="lazy"
            decoding="async"
          />
          <div className="flex-1 min-w-0">
            <h1
              className="text-white font-bold text-lg leading-tight"
              style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.08em' }}
            >
              MIS CUENTAS
            </h1>
            <p className="text-amber-500 text-xs font-bold tracking-widest">La Cabrona · Alitas &amp; Beer</p>
          </div>
          {history.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-gray-600 hover:text-red-400 cursor-pointer transition-colors p-2 rounded-xl active:bg-gray-800"
            >
              <i className="ri-delete-bin-line text-lg" />
            </button>
          )}
        </div>

        {/* Realtime status indicator */}
        <div className="mt-2 flex items-center gap-3">
          <RealtimeDot status={realtimeStatus} />
          <span className="text-[10px] text-gray-600">
            {openAccounts.length > 0
              ? `${openAccounts.length} cuenta${openAccounts.length > 1 ? 's' : ''} con seguimiento en vivo`
              : 'Sin cuentas abiertas para seguir'}
          </span>
        </div>
      </div>

      {/* Contenido */}
      <div className="px-4 pt-5 space-y-6">

        {/* Error state */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-16 h-16 bg-red-500/15 rounded-2xl flex items-center justify-center mb-4">
              <i className="ri-error-warning-line text-red-400 text-3xl" />
            </div>
            <p className="text-white text-base font-bold mb-2">Error al cargar</p>
            <p className="text-gray-400 text-sm leading-relaxed mb-4 max-w-xs">{error}</p>
            <button
              onClick={() => { setError(null); setLoading(true); const h = loadHistory(); fetchLiveData(h); }}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-2xl text-sm font-bold cursor-pointer transition-colors active:scale-95 whitespace-nowrap"
            >
              <i className="ri-refresh-line" />
              Reintentar
            </button>
          </div>
        )}

        {/* Loading state */}
        {!error && loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Cargando tus cuentas...</p>
          </div>
        )}

        {/* Empty state */}
        {!error && !loading && history.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center px-4">
            <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mb-5">
              <i className="ri-receipt-line text-4xl text-gray-600" />
            </div>
            <p className="text-white text-xl font-bold mb-2">Sin cuentas guardadas</p>
            <p className="text-gray-500 text-sm leading-relaxed mb-3">
              Cuando hagas un pedido en La Cabrona y veas tu cuenta en este celular, aparecerá aquí automáticamente.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              ¿Ya tienes una cuenta y no la ves? Búscala por tu nombre o número de teléfono. También funciona para cuentas que ya fueron cerradas.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
              <Link
                to="/buscar-cuenta"
                className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3.5 rounded-2xl text-sm font-bold transition-colors cursor-pointer whitespace-nowrap active:scale-95"
              >
                <i className="ri-search-line" />
                Buscar por nombre o teléfono
              </Link>
              <Link
                to="/menu"
                className="flex items-center justify-center gap-2 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 px-6 py-3.5 rounded-2xl text-sm font-bold transition-colors cursor-pointer whitespace-nowrap active:scale-95"
              >
                <i className="ri-restaurant-line" />
                Ver el menú
              </Link>
            </div>
          </div>
        )}

        {/* Cuentas abiertas */}
        {!error && !loading && openAccounts.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <h2 className="text-green-400 text-xs font-black uppercase tracking-widest">
                Cuentas abiertas ahora
              </h2>
              <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-0.5 rounded-full">
                {openAccounts.length}
              </span>
            </div>

            {/* Banner explicativo de notificaciones push */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="ri-notification-3-line text-amber-400 text-base" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-bold mb-0.5">Recibe notificaciones push</p>
                  <p className="text-gray-500 text-[11px] leading-relaxed">
                    Activa las notificaciones en cada cuenta abierta para recibir alertas cuando el mesero agregue productos, marque entregas o cierre la cuenta. Funcionan incluso con la pantalla apagada.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {openAccounts.map(entry => (
                <AccountCard key={entry.id} entry={entry} liveData={liveData} showPushToggle onRemove={handleRemoveEntry} />
              ))}
            </div>
          </section>
        )}

        {/* Banner: ¿Falta una cuenta? */}
        {!error && !loading && history.length > 0 && (
          <Link
            to="/buscar-cuenta"
            className="flex items-center gap-3 bg-gray-900 border border-gray-800 hover:border-amber-500/40 rounded-2xl px-4 py-3.5 cursor-pointer transition-all active:scale-[0.98]"
          >
            <div className="w-9 h-9 bg-amber-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="ri-search-line text-amber-400 text-lg" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-bold">¿Falta una cuenta?</p>
              <p className="text-gray-500 text-xs mt-0.5">Busca por tu nombre o número de teléfono para encontrar cuentas que no aparecen aquí, incluso las que ya fueron cerradas.</p>
            </div>
            <i className="ri-arrow-right-s-line text-gray-500 text-lg flex-shrink-0" />
          </Link>
        )}

        {/* Cuentas anteriores */}
        {!error && !loading && closedAccounts.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-gray-500 text-xs font-black uppercase tracking-widest">
                Cuentas anteriores
              </h2>
              <span className="bg-gray-800 text-gray-500 text-xs font-bold px-2 py-0.5 rounded-full">
                {closedAccounts.length}
              </span>
            </div>
            <div className="space-y-3">
              {closedAccounts.map(entry => (
                <AccountCard key={entry.id} entry={entry} liveData={liveData} onRemove={handleRemoveEntry} />
              ))}
            </div>
          </section>
        )}

        {!error && !loading && history.length > 0 && (
          <p className="text-center text-gray-700 text-xs pt-2">
            Solo se guarda en este celular · máx. 10 cuentas
          </p>
        )}

        {/* FAQs */}
        <div className="pt-4 pb-2">
          <button
            onClick={() => setShowFaq(!showFaq)}
            className="w-full flex items-center justify-between bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <i className="ri-question-line text-amber-400 text-xl" />
              <span className="text-white text-sm font-bold">Preguntas sobre mis cuentas</span>
            </div>
            <i className={`ri-arrow-down-s-line text-gray-400 text-lg transition-transform ${showFaq ? 'rotate-180' : ''}`} />
          </button>
          {showFaq && (
            <div className="mt-3 space-y-3">
              {faqs.map((faq, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4">
                  <p className="text-white text-sm font-bold mb-1.5">{faq.q}</p>
                  <p className="text-gray-500 text-sm leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal confirmar borrar */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end px-4 pb-8">
          <div className="w-full bg-gray-900 border border-gray-700 rounded-3xl p-5 space-y-4">
            <div className="text-center">
              <i className="ri-delete-bin-line text-red-400 text-3xl" />
              <p className="text-white font-bold text-base mt-2">¿Borrar historial?</p>
              <p className="text-gray-500 text-sm mt-1">Se eliminarán todas las cuentas guardadas en este celular</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-3.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-2xl text-sm font-bold cursor-pointer transition-colors active:bg-gray-700 whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                onClick={handleClear}
                className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-2xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
              >
                Sí, borrar todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}