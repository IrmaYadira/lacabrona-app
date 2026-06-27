import { useState } from 'react';
import type { WebOrderNotification } from '../hooks/useWebOrderNotifications';

interface Props {
  activeNotifications: WebOrderNotification[];
  unreadCount: number;
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onGoToAccount?: (accountId: number) => void;
  onMarkDelivered?: (accountId: number, notifId: string) => void;
  realtimeStatus?: 'connecting' | 'connected' | 'disconnected';
}

export default function WebOrderNotificationPanel({
  activeNotifications,
  unreadCount,
  onDismiss,
  onDismissAll,
  onGoToAccount,
  onMarkDelivered,
  realtimeStatus,
}: Props) {
  const [open, setOpen] = useState(false);
  const [deliveredIds, setDeliveredIds] = useState<Set<string>>(new Set());
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const hasNew = unreadCount > 0;

  const handleMarkDelivered = async (notif: WebOrderNotification) => {
    if (loadingId === notif.id) return;
    setLoadingId(notif.id);
    if (onMarkDelivered) {
      await onMarkDelivered(notif.accountId, notif.id);
    }
    setDeliveredIds(prev => new Set(prev).add(notif.id));
    setLoadingId(null);
    // Auto-dismiss después de 1.5s de marcar entregado
    setTimeout(() => onDismiss(notif.id), 1500);
  };

  if (activeNotifications.length === 0 && !open) {
    return null;
  }

  // Banner compacto cuando está cerrado pero hay notificaciones activas
  if (!open) {
    const hasExtrasBanner = activeNotifications.some(n => n.hasExtras);
    return (
      <>
        <style>{`
          @keyframes flash-extras {
            0%, 100% { background-color: #facc15; color: #713f12; box-shadow: 0 0 0 rgba(239,68,68,0); transform: scale(1); }
            50% { background-color: #ef4444; color: #fff; box-shadow: 0 0 12px rgba(239,68,68,0.6); transform: scale(1.08); }
          }
          .animate-flash-extras {
            animation: flash-extras 0.7s ease-in-out infinite;
          }
          @keyframes shake-banner {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
            20%, 40%, 60%, 80% { transform: translateX(2px); }
          }
          .animate-shake-banner {
            animation: shake-banner 0.5s ease-in-out infinite;
          }
        `}</style>
        <button
          onClick={() => setOpen(true)}
          className={`fixed top-16 right-4 z-[80] flex items-center gap-2 hover:bg-green-600 text-white pl-3 pr-4 py-2.5 rounded-full cursor-pointer transition-all shadow-lg whitespace-nowrap ${
            hasExtrasBanner ? 'bg-red-500 border-2 border-yellow-400 animate-shake-banner' : 'bg-green-500 animate-bounce'
          }`}
          style={!hasExtrasBanner ? { animationDuration: '1s', animationIterationCount: '3' } : undefined}
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <i className="ri-smartphone-line text-base" />
          </div>
          <span className="text-sm font-bold">
            {activeNotifications.length === 1
              ? '1 pedido web nuevo'
              : `${activeNotifications.length} pedidos web nuevos`}
          </span>
          {activeNotifications.some(n => n.hasExtras) && (
            <span className="animate-flash-extras flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
              <i className="ri-alarm-warning-line text-[10px]" />
              EXTRAS
            </span>
          )}
          {hasNew && (
            <span className="bg-red-500 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center">
              {unreadCount}
            </span>
          )}
          {realtimeStatus === 'disconnected' && (
            <span className="bg-gray-600 text-gray-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none" title="Conexión en tiempo real desconectada — usando actualización cada 8s">
              <i className="ri-wifi-off-line text-[10px]" />
            </span>
          )}
        </button>
      </>
    );
  }

  return (
    <>
      {/* Overlay semitransparente */}
      <div
        className="fixed inset-0 z-[79]"
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div className="fixed top-14 right-4 z-[80] w-84 bg-white rounded-2xl border-2 border-green-400 overflow-hidden shadow-xl" style={{ width: '340px' }}>
        {/* Header */}
        <div className="bg-green-500 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center">
              <i className="ri-smartphone-line text-white text-lg" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Pedidos desde la Web</p>
              <p className="text-green-100 text-xs">
                {activeNotifications.length} pendiente{activeNotifications.length !== 1 ? 's' : ''}
                {realtimeStatus === 'disconnected' && ' · Modo offline'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {activeNotifications.length > 1 && (
              <button
                onClick={onDismissAll}
                className="text-green-100 hover:text-white text-xs font-medium cursor-pointer px-2 py-1 rounded hover:bg-green-600 transition-colors whitespace-nowrap"
              >
                Limpiar todo
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-green-600 cursor-pointer transition-colors"
            >
              <i className="ri-close-line text-white text-base" />
            </button>
          </div>
        </div>

        {/* Notificaciones */}
        <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
          {activeNotifications.length === 0 && (
            <div className="px-4 py-8 text-center">
              <div className="w-12 h-12 mx-auto mb-2 bg-gray-100 rounded-xl flex items-center justify-center">
                <i className="ri-inbox-line text-2xl text-gray-300" />
              </div>
              <p className="text-gray-500 text-sm font-medium">Sin pedidos web nuevos</p>
              <p className="text-gray-400 text-xs mt-1">
                {realtimeStatus === 'disconnected'
                  ? 'Modo offline activo — se actualiza cada 8 segundos'
                  : 'Los pedidos aparecerán aquí al instante'}
              </p>
            </div>
          )}
          {activeNotifications.map((notif) => {
            const mins = Math.floor((Date.now() - notif.timestamp.getTime()) / 60000);
            const timeLabel = mins === 0 ? 'Ahora mismo' : `Hace ${mins}m`;
            const isDelivered = deliveredIds.has(notif.id);
            const isLoading = loadingId === notif.id;

            return (
              <div
                key={notif.id}
                className={`px-4 py-3 transition-colors ${isDelivered ? 'bg-green-50' : 'hover:bg-gray-50'} ${notif.hasExtras ? 'border-l-4 border-l-yellow-400' : ''}`}
              >
                <div className="flex items-start gap-3">
                  {/* Icono */}
                  <div className={`w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0 mt-0.5 ${isDelivered ? 'bg-green-200' : notif.hasExtras ? 'bg-yellow-100' : 'bg-green-100'}`}>
                    <i className={`text-base ${isDelivered ? 'ri-check-double-line text-green-700' : notif.hasExtras ? 'ri-vip-crown-line text-yellow-600' : 'ri-store-2-line text-green-600'}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-sm font-bold text-gray-900 truncate">{notif.spot}</p>
                      <span className="text-xs text-gray-400 flex-shrink-0">{timeLabel}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {notif.itemsCount} producto{notif.itemsCount !== 1 ? 's' : ''} ·{' '}
                      <span className="font-semibold text-green-700">${notif.total.toFixed(2)}</span>
                    </p>

                    {/* Badge de extras de pago — parpadeo intenso */}
                    {notif.hasExtras && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="animate-flash-extras flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-full leading-none">
                          <i className="ri-alarm-warning-line text-[10px]" />
                          EXTRAS DE PAGO
                        </span>
                        <span className="text-[10px] text-yellow-600 font-semibold animate-pulse">
                          Revisar notas ahora
                        </span>
                      </div>
                    )}

                    {isDelivered ? (
                      <p className="mt-1.5 text-xs text-green-600 font-bold flex items-center gap-1">
                        <i className="ri-checkbox-circle-fill" />
                        Marcado como entregado
                      </p>
                    ) : (
                      <div className="mt-2 flex items-center gap-2">
                        {/* Botón Entregado */}
                        <button
                          onClick={() => handleMarkDelivered(notif)}
                          disabled={isLoading}
                          className="flex items-center gap-1 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                        >
                          {isLoading ? (
                            <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block" />
                          ) : (
                            <i className="ri-check-double-line" />
                          )}
                          Entregado
                        </button>
                        {/* Botón Ir a la cuenta */}
                        {onGoToAccount && (
                          <button
                            onClick={() => {
                              onGoToAccount(notif.accountId);
                              onDismiss(notif.id);
                              setOpen(false);
                            }}
                            className="flex items-center gap-1 text-xs text-green-600 font-bold hover:text-green-700 cursor-pointer transition-colors whitespace-nowrap border border-green-200 px-2.5 py-1.5 rounded-lg hover:bg-green-50"
                          >
                            <i className="ri-arrow-right-circle-line" />
                            Ver cuenta
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Dismiss */}
                  <button
                    onClick={() => onDismiss(notif.id)}
                    className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-gray-500 cursor-pointer flex-shrink-0 transition-colors"
                  >
                    <i className="ri-close-line text-sm" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-4 py-2.5 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            <i className={`mr-1 ${realtimeStatus === 'connected' ? 'ri-wifi-line text-green-500' : realtimeStatus === 'disconnected' ? 'ri-wifi-off-line text-gray-500' : 'ri-loader-4-line animate-spin text-amber-500'}`} />
            {realtimeStatus === 'connected'
              ? 'Voz y alerta activas · En tiempo real'
              : realtimeStatus === 'disconnected'
              ? 'Modo offline · Actualizando cada 8 segundos'
              : 'Conectando...'}
            {activeNotifications.some(n => n.hasExtras) ? ' · Voz especial para extras' : ''}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes flash-extras {
          0%, 100% { background-color: #facc15; color: #713f12; box-shadow: 0 0 0 rgba(239,68,68,0); transform: scale(1); }
          50% { background-color: #ef4444; color: #fff; box-shadow: 0 0 12px rgba(239,68,68,0.6); transform: scale(1.08); }
        }
        .animate-flash-extras {
          animation: flash-extras 0.7s ease-in-out infinite;
        }
        @keyframes shake-banner {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
          20%, 40%, 60%, 80% { transform: translateX(2px); }
        }
        .animate-shake-banner {
          animation: shake-banner 0.5s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}