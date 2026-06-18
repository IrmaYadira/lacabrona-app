import { useState, useRef } from 'react';
import { useWaiterCalls, timeAgo } from '../hooks/useWaiterCalls';
import type { CallGroup } from '../hooks/useWaiterCalls';

export default function WaiterCallNotifier() {
  const {
    groups,
    soundEnabled,
    setSoundEnabled,
    vibrateEnabled,
    setVibrateEnabled,
    attendGroup,
    attendAll,
  } = useWaiterCalls();

  const [minimized, setMinimized] = useState(false);
  const hasVibration = typeof navigator !== 'undefined' && !!navigator.vibrate;

  const handleAttendGroup = async (group: CallGroup) => {
    await attendGroup(group);
  };

  const handleAttendAll = async () => {
    await attendAll();
  };

  // Estado vacío: solo controles
  if (groups.length === 0) {
    return (
      <div className="fixed bottom-20 right-5 z-50 flex flex-col gap-1.5 items-end">
        <button
          onClick={() => setSoundEnabled(p => !p)}
          title={soundEnabled ? 'Silenciar' : 'Activar sonido'}
          className={`w-9 h-9 flex items-center justify-center rounded-full border transition-all cursor-pointer ${
            soundEnabled
              ? 'bg-orange-50 border-orange-300 text-orange-500 hover:bg-orange-100'
              : 'bg-gray-100 border-gray-200 text-gray-400 hover:bg-gray-200'
          }`}
        >
          <i className={soundEnabled ? 'ri-volume-up-line text-sm' : 'ri-volume-mute-line text-sm'} />
        </button>
        {hasVibration && (
          <button
            onClick={() => setVibrateEnabled(p => !p)}
            title={vibrateEnabled ? 'Desactivar vibración' : 'Activar vibración'}
            className={`w-9 h-9 flex items-center justify-center rounded-full border transition-all cursor-pointer ${
              vibrateEnabled
                ? 'bg-orange-50 border-orange-300 text-orange-500 hover:bg-orange-100'
                : 'bg-gray-100 border-gray-200 text-gray-400 hover:bg-gray-200'
            }`}
          >
            <i className="ri-shake-hands-line text-sm" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 right-5 z-50 flex flex-col gap-2 items-end max-w-[340px]">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <button
          onClick={() => setSoundEnabled(p => !p)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-all whitespace-nowrap ${
            soundEnabled
              ? 'bg-orange-50 border-orange-300 text-orange-600'
              : 'bg-gray-100 border-gray-200 text-gray-400'
          }`}
        >
          <i className={soundEnabled ? 'ri-volume-up-line' : 'ri-volume-mute-line'} />
          {soundEnabled ? 'Sonido' : 'Mute'}
        </button>
        {hasVibration && (
          <button
            onClick={() => setVibrateEnabled(p => !p)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-all whitespace-nowrap ${
              vibrateEnabled
                ? 'bg-orange-50 border-orange-300 text-orange-600'
                : 'bg-gray-100 border-gray-200 text-gray-400'
            }`}
          >
            <i className="ri-shake-hands-line" />
            {vibrateEnabled ? 'Vibra' : 'Sin vibrar'}
          </button>
        )}
        <button
          onClick={() => setMinimized(p => !p)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-white border-gray-200 text-gray-500 cursor-pointer hover:bg-gray-50 whitespace-nowrap"
        >
          <i className={minimized ? 'ri-arrow-up-s-line' : 'ri-subtract-line'} />
          {minimized ? `${groups.length} llamado${groups.length !== 1 ? 's' : ''}` : 'Minimizar'}
        </button>
        {groups.length > 1 && !minimized && (
          <button
            onClick={handleAttendAll}
            className="px-2.5 py-1 rounded-full text-xs font-semibold border bg-orange-500 border-orange-500 text-white cursor-pointer hover:bg-orange-600 whitespace-nowrap"
          >
            Atender todos
          </button>
        )}
      </div>

      {/* Cards agrupadas */}
      {!minimized && groups.map(group => {
        const isCheck = (group.request_type === 'check' || group.request_type === 'request_bill');
        const borderColor = isCheck ? 'border-green-500' : 'border-orange-500';
        const iconBg = isCheck ? 'bg-green-600' : 'bg-orange-500';
        const iconName = isCheck ? 'ri-money-dollar-circle-fill' : 'ri-service-fill';
        const titleLabel = isCheck ? '¡Quieren pagar!' : '¡Llamada de mesero!';
        const spotColor = isCheck ? 'text-green-400' : 'text-orange-400';
        const btnBg = isCheck ? 'bg-green-600 hover:bg-green-700 active:bg-green-800' : 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700';
        const pingColor = isCheck ? 'bg-green-400' : 'bg-red-500';

        const fotoUrl = group.selfie_url || group.photo_url;
        const displayName = group.customer_name && group.customer_name.trim() !== group.spot.trim()
          ? group.customer_name
          : null;

        return (
          <div
            key={group.key}
            className={`w-full bg-gray-950 border-2 ${borderColor} rounded-2xl overflow-hidden`}
            style={{ animation: 'slideInRight 0.3s ease-out' }}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
              <div className="relative flex-shrink-0">
                <div className={`w-10 h-10 flex items-center justify-center ${iconBg} rounded-xl`}>
                  <i className={`${iconName} text-white text-xl`} />
                </div>
                {group.count > 1 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-black rounded-full border-2 border-gray-950 flex items-center justify-center px-1">
                    {group.count}
                  </span>
                )}
                {group.count === 1 && (
                  <>
                    <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 ${pingColor} rounded-full border-2 border-gray-950 animate-ping`} />
                    <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 ${pingColor} rounded-full border-2 border-gray-950`} />
                  </>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-black leading-tight">{titleLabel}</p>
                <p className={`${spotColor} text-base font-black mt-0.5 truncate`}>
                  {group.spot}
                </p>
              </div>
            </div>

            {/* Foto + nombre del cliente (solo si es diferente del spot) */}
            {(fotoUrl || displayName) && (
              <div className="px-4 pb-2">
                <div className={`flex items-center gap-3 rounded-xl p-2.5 ${isCheck ? 'bg-green-950/40 border border-green-800/40' : 'bg-orange-950/40 border border-orange-800/40'}`}>
                  {fotoUrl ? (
                    <img
                      src={fotoUrl}
                      alt="Foto del cliente"
                      title="Foto del cliente"
                      className={`w-14 h-14 rounded-xl object-cover flex-shrink-0 border-2 ${isCheck ? 'border-green-500/50' : 'border-orange-500/50'}`}
                    />
                  ) : (
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${isCheck ? 'bg-green-900/60' : 'bg-orange-900/60'}`}>
                      <i className="ri-user-3-line text-2xl text-white/50" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {displayName && (
                      <p className="text-white font-black text-sm leading-tight truncate">
                        {displayName}
                      </p>
                    )}
                    {fotoUrl ? (
                      <p className={`text-xs mt-0.5 flex items-center gap-1 ${isCheck ? 'text-green-400/70' : 'text-orange-400/70'}`}>
                        <i className={group.selfie_url ? 'ri-vip-crown-line' : 'ri-camera-line'} />
                        {group.selfie_url ? 'Cliente registrado' : 'Selfie del cliente'}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {/* Nota extra para cobro */}
            {isCheck && group.notes && (
              <div className="px-4 pb-1">
                <p className="text-green-500/80 text-xs bg-green-950/60 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                  <i className="ri-receipt-line" />
                  {group.notes}
                </p>
              </div>
            )}

            {/* Tiempo */}
            <div className="px-4 pb-2">
              <p className="text-gray-400 text-xs flex items-center gap-1">
                <i className="ri-time-line" />
                {timeAgo(group.latestAt)}
                {group.count > 1 && (
                  <span className="text-gray-500 ml-1">· {group.count} solicitudes</span>
                )}
              </p>
            </div>

            {/* Acción */}
            <div className="px-3 pb-3 pt-1 border-t border-gray-800">
              <button
                onClick={() => handleAttendGroup(group)}
                className={`w-full flex items-center justify-center gap-2 ${btnBg} text-white rounded-xl py-2.5 text-sm font-black transition-colors cursor-pointer whitespace-nowrap`}
              >
                <i className="ri-checkbox-circle-line text-base" />
                {isCheck ? 'Cobrar mesa' : 'Marcar como atendido'}
                {group.count > 1 && ` (${group.count})`}
              </button>
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}