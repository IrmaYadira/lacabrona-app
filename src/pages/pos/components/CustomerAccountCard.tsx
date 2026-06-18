import { useState, useEffect } from 'react';
import type { PosAccount } from '../types';
import { REWARD_TIERS } from '@/hooks/useLoyaltyRewards';
import type { CallGroup } from '../hooks/useWaiterCalls';
import { useLastRoundInfo } from '../hooks/useLastRoundInfo';

interface CustomerAccountCardProps {
  account: PosAccount;
  onClick: () => void;
  pendingCall?: CallGroup;
  onAttendCall?: (group: CallGroup) => void;
}

function useElapsedTime(createdAt?: string) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!createdAt) return;
    const update = () => {
      const diff = Date.now() - new Date(createdAt).getTime();
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      setElapsed(hrs > 0 ? `${hrs}h ${remMins}m` : `${mins}m`);
    };
    update();
    const iv = setInterval(update, 60000);
    return () => clearInterval(iv);
  }, [createdAt]);
  return elapsed;
}

function getTimeStyle(createdAt?: string): { badge: string; dot: string; urgent: boolean } {
  if (!createdAt) return { badge: 'bg-gray-100 text-gray-500', dot: 'bg-green-400', urgent: false };
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (mins >= 120) return { badge: 'bg-red-100 text-red-600 font-bold', dot: 'bg-red-500', urgent: true };
  if (mins >= 60) return { badge: 'bg-orange-100 text-orange-600 font-semibold', dot: 'bg-orange-400', urgent: false };
  return { badge: 'bg-gray-100 text-gray-500', dot: 'bg-green-400', urgent: false };
}

export default function CustomerAccountCard({ account, onClick, pendingCall, onAttendCall }: CustomerAccountCardProps) {
  const total = (account.pos_account_items ?? []).reduce(
    (sum, item) => sum + item.unit_price * item.quantity, 0
  );
  const folioCount = account.folio_counter ?? 0;
  const elapsed = useElapsedTime(account.created_at);
  const timeStyle = getTimeStyle(account.created_at);
  const lastRound = useLastRoundInfo(account);

  const allItems = account.pos_account_items ?? [];
  const totalQty = allItems.reduce((s, i) => s + i.quantity, 0);
  const deliveredQty = allItems.filter(i => i.delivered).reduce((s, i) => s + i.quantity, 0);
  const pendingQty = totalQty - deliveredQty;
  const progressPct = totalQty > 0 ? Math.round((deliveredQty / totalQty) * 100) : 0;
  const allDelivered = totalQty > 0 && pendingQty === 0;

  // VIP: 4+ rondas enviadas
  const isVip = folioCount >= 4;

  const displayName = account.customer_name || account.spot || 'Sin cliente';
  const isSpotName = !account.customer_name && !!account.spot;
  const showInitials = account.customer_name || displayName;

  const initials = (displayName ?? 'C')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  const avatarColors = [
    'bg-amber-500', 'bg-emerald-500', 'bg-rose-500',
    'bg-violet-500', 'bg-cyan-500', 'bg-orange-500',
  ];
  const colorIndex = (account.id ?? 0) % avatarColors.length;
  const avatarColor = avatarColors[colorIndex];

  const selfieUrl = account.customer_selfie_url ?? null;
  const loyaltyPts = account.customer_loyalty_points ?? 0;
  const canRedeemTier = REWARD_TIERS.find(t => loyaltyPts >= t.points);

  const [imgError, setImgError] = useState(false);

  // Determinar nivel de urgencia para el indicador visual
  const hasManyPending = pendingQty >= 3;

  const isCheckCall = pendingCall && (pendingCall.request_type === 'check' || pendingCall.request_type === 'request_bill');
  const isWaiterCall = pendingCall && !isCheckCall;

  const isAbandoned = lastRound.status === 'abandoned' && pendingQty === 0 && !pendingCall;
  const isWarning = lastRound.status === 'warning' && pendingQty === 0 && !pendingCall;
  const isCaution = lastRound.status === 'caution' && pendingQty === 0 && !pendingCall;

  return (
    <button
      onClick={onClick}
      className={`relative w-full rounded-xl text-left transition-all cursor-pointer overflow-hidden bg-white group ${
        pendingCall
          ? isCheckCall
            ? 'border-2 border-green-500 hover:border-green-600 shadow-[0_0_0_3px_rgba(34,197,94,0.15)]'
            : 'border-2 border-orange-500 hover:border-orange-600 shadow-[0_0_0_3px_rgba(249,115,22,0.15)]'
          : isAbandoned
          ? 'border-2 border-red-400 hover:border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
          : isWarning
          ? 'border-2 border-orange-400 hover:border-orange-500 shadow-[0_0_0_3px_rgba(249,115,22,0.15)]'
          : isVip
          ? 'border-2 border-yellow-400 hover:border-yellow-500 shadow-[0_0_0_3px_rgba(234,179,8,0.15)]'
          : pendingQty > 0
          ? `border-2 ${ hasManyPending ? 'border-red-400 hover:border-red-500' : 'border-amber-400 hover:border-amber-500' }`
          : allDelivered && totalQty > 0
          ? 'border-2 border-green-300 hover:border-green-400'
          : 'border-2 border-amber-300 hover:border-amber-400'
      }`}
    >
      {/* Banner de llamada / cobro pendiente — PRIORIDAD MÁXIMA */}
      {pendingCall && (
        <div className={`flex items-center justify-between gap-1.5 px-3 py-1.5 ${
          isCheckCall ? 'bg-green-500' : 'bg-orange-500'
        }`}>
          <div className="flex items-center gap-1.5">
            <i className={`${isCheckCall ? 'ri-money-dollar-circle-fill' : 'ri-service-fill'} text-white text-xs`} />
            <span className="text-white text-[11px] font-black tracking-wide uppercase">
              {isCheckCall ? '¡PIDE LA CUENTA!' : '¡LLAMÓ AL MESERO!'}
            </span>
            {pendingCall.count > 1 && (
              <span className="bg-white/25 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                ×{pendingCall.count}
              </span>
            )}
          </div>
          {onAttendCall && (
            <button
              onClick={(e) => { e.stopPropagation(); onAttendCall(pendingCall); }}
              className="text-white/90 hover:text-white text-[10px] font-bold underline cursor-pointer"
            >
              {isCheckCall ? 'Cobrar' : 'Atender'}
            </button>
          )}
        </div>
      )}

      {/* Banner de cuenta abandonada — PRIORIDAD ALTA */}
      {!pendingCall && isAbandoned && (
        <div className="flex items-center justify-between gap-1.5 px-3 py-1.5 bg-red-500">
          <div className="flex items-center gap-1.5">
            <i className="ri-alarm-warning-fill text-white text-xs" />
            <span className="text-white text-[11px] font-black tracking-wide uppercase">
              ¡Cuenta abandonada!
            </span>
          </div>
          <span className="text-white/80 text-[10px] font-bold">
            {lastRound.label} sin pedir
          </span>
        </div>
      )}

      {/* Banner de alerta (warning) */}
      {!pendingCall && isWarning && (
        <div className="flex items-center justify-between gap-1.5 px-3 py-1.5 bg-orange-500">
          <div className="flex items-center gap-1.5">
            <i className="ri-alarm-warning-line text-white text-xs" />
            <span className="text-white text-[11px] font-black tracking-wide uppercase">
              Alerta de cuenta
            </span>
          </div>
          <span className="text-white/80 text-[10px] font-bold">
            {lastRound.label} sin pedir
          </span>
        </div>
      )}

      {/* Banner de caution (60-90 min) */}
      {!pendingCall && isCaution && (
        <div className="flex items-center justify-between gap-1.5 px-3 py-1.5 bg-yellow-500">
          <div className="flex items-center gap-1.5">
            <i className="ri-time-line text-white text-xs" />
            <span className="text-white text-[11px] font-black tracking-wide uppercase">
              Cuidado
            </span>
          </div>
          <span className="text-white/80 text-[10px] font-bold">
            {lastRound.label} sin pedir
          </span>
        </div>
      )}

      {/* Pulse dot */}
      <span className={`absolute top-2.5 right-2.5 w-2 h-2 rounded-full animate-pulse z-10 ${
        pendingCall
          ? isCheckCall ? 'bg-green-400' : 'bg-orange-400'
          : isAbandoned
          ? 'bg-red-500'
          : isWarning
          ? 'bg-orange-400'
          : isVip
          ? 'bg-yellow-400'
          : pendingQty > 0
          ? hasManyPending ? 'bg-red-500' : 'bg-amber-400'
          : timeStyle.dot
      }`} />

      {/* Banner VIP — 4+ rondas */}
      {isVip && !pendingCall && !isAbandoned && !isWarning && !isCaution && (
        <div className="flex items-center justify-between gap-1.5 px-3 py-1.5 bg-gradient-to-r from-yellow-400 to-amber-500">
          <div className="flex items-center gap-1.5">
            <i className="ri-vip-crown-2-fill text-white text-xs" />
            <span className="text-white text-[11px] font-black tracking-widest uppercase">
              VIP del turno
            </span>
          </div>
          <span className="text-white/80 text-[10px] font-bold">
            {folioCount} rondas
          </span>
        </div>
      )}

      {/* Banner superior de PENDIENTES DE ENTREGA — muy visible */}
      {pendingQty > 0 && !pendingCall && (
        <div className={`flex items-center justify-between gap-1.5 px-3 py-1.5 ${
          hasManyPending
            ? 'bg-red-500'
            : 'bg-amber-500'
        }`}>
          <div className="flex items-center gap-1.5">
            <i className="ri-truck-line text-white text-xs" />
            <span className="text-white text-[11px] font-black tracking-wide">
              {pendingQty} PENDIENTE{pendingQty !== 1 ? 'S' : ''}
            </span>
          </div>
          {deliveredQty > 0 && (
            <span className="text-white/70 text-[10px] font-semibold">
              {deliveredQty}/{totalQty} entg.
            </span>
          )}
        </div>
      )}

      {/* Banner verde de todo entregado */}
      {allDelivered && totalQty > 0 && !pendingCall && !isAbandoned && !isWarning && !isCaution && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500">
          <i className="ri-check-double-line text-white text-xs" />
          <span className="text-white text-[11px] font-black tracking-wide">TODO ENTREGADO</span>
        </div>
      )}

      {/* Badge de lealtad canjeable */}
      {canRedeemTier && (
        <div
          className="absolute top-8 left-2 z-10 flex items-center gap-0.5 bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-sm"
          title={`${loyaltyPts} pts — puede canjear ${canRedeemTier.title}`}
        >
          <i className="ri-vip-crown-2-fill text-[9px]" />
          {loyaltyPts}pts
        </div>
      )}

      {/* Franja lateral de urgencia */}
      {pendingQty > 0 && !pendingCall && (
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
          hasManyPending ? 'bg-red-500' : 'bg-amber-400'
        }`} />
      )}
      {allDelivered && totalQty > 0 && !pendingCall && !isAbandoned && !isWarning && !isCaution && (
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-green-400" />
      )}
      {pendingCall && (
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isCheckCall ? 'bg-green-500' : 'bg-orange-500'}`} />
      )}
      {isAbandoned && (
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500" />
      )}
      {isWarning && (
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-500" />
      )}
      {isCaution && (
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-yellow-500" />
      )}

      <div className="px-3 pt-2.5 pb-2 pl-4">
        {/* Avatar + nombre */}
        <div className="flex items-center gap-2.5 mb-2 pr-4">
          <div className="relative flex-shrink-0">
            {selfieUrl && !imgError ? (
              <img
                src={selfieUrl}
                alt={displayName}
                onError={() => setImgError(true)}
                className="w-10 h-10 rounded-full object-cover object-top border-2 border-white ring-1 ring-gray-200"
              />
            ) : (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${avatarColor} border-2 border-white`}>
                <span className="text-white font-bold text-sm">{initials}</span>
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate leading-tight">
              {displayName}
            </p>
            {isSpotName && (
              <span className="text-[10px] text-gray-400 font-medium flex items-center gap-0.5">
                <i className="ri-map-pin-2-line text-[10px]" />
                Comanda sin cliente
              </span>
            )}
            {account.customer_name && account.customer_phone && (
              <p className="text-xs text-gray-400 truncate flex items-center gap-0.5">
                <i className="ri-phone-line" />
                {account.customer_phone}
              </p>
            )}
          </div>
        </div>

        {/* Time + zona */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {elapsed && (
            <span className={`text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${timeStyle.badge}`}>
              <i className="ri-time-line" />
              {elapsed}
            </span>
          )}
          {account.zona && (
            <span className="text-xs bg-gray-100 text-gray-600 font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <i className="ri-map-pin-2-line text-[10px]" />
              {account.zona}
            </span>
          )}
          {isAbandoned && (
            <span className="text-[10px] text-red-500 font-semibold flex items-center gap-0.5">
              <i className="ri-alarm-warning-line" />
              Ir a cobrar
            </span>
          )}
        </div>

        {/* Rondas enviadas — indicador destacado */}
        {folioCount > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1">
              <i className="ri-send-plane-2-line text-indigo-500 text-[11px]" />
              <span className="text-[11px] font-bold text-indigo-700">
                {folioCount} ronda{folioCount !== 1 ? 's' : ''} enviada{folioCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}

        {/* Barra de progreso — siempre visible cuando hay items */}
        {totalQty > 0 && (
          <div className="mt-2">
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  allDelivered ? 'bg-green-400' : hasManyPending ? 'bg-red-400' : 'bg-amber-400'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {totalQty === 0 && (
          <div className="mt-2">
            <span className="text-xs text-gray-400 italic">Sin productos aún</span>
          </div>
        )}

        {/* Nota interna — visible desde el panel */}
        {account.notes && (
          <div className="mt-2 flex items-start gap-1.5 bg-violet-50 border border-violet-100 rounded-lg px-2 py-1">
            <i className="ri-sticky-note-2-line text-violet-400 text-[10px] mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-violet-700 font-medium leading-tight line-clamp-2">{account.notes}</p>
          </div>
        )}
      </div>

      {/* Total bar */}
      <div className={`px-3 py-2 flex items-center justify-between transition-colors ${
        pendingCall
          ? isCheckCall
            ? 'bg-green-600 group-hover:bg-green-700'
            : 'bg-orange-500 group-hover:bg-orange-600'
          : isAbandoned
          ? 'bg-red-500 group-hover:bg-red-600'
          : isWarning
          ? 'bg-orange-500 group-hover:bg-orange-600'
          : isCaution
          ? 'bg-yellow-500 group-hover:bg-yellow-600'
          : pendingQty > 0
          ? hasManyPending
            ? 'bg-red-500 group-hover:bg-red-600'
            : 'bg-amber-500 group-hover:bg-amber-600'
          : allDelivered && totalQty > 0
          ? 'bg-green-500 group-hover:bg-green-600'
          : 'bg-amber-500 group-hover:bg-amber-600'
      }`}>
        <span className="text-xs text-white/80 font-medium flex items-center gap-1">
          {pendingCall ? (
            isCheckCall ? <><i className="ri-money-dollar-circle-fill" />Cobrar</> : <><i className="ri-service-fill" />Atender</>
          ) : isAbandoned ? (
            <><i className="ri-alarm-warning-line" />Cobrar ahora</>
          ) : isWarning ? (
            <><i className="ri-alarm-warning-line" />Revisar</>
          ) : isCaution ? (
            <><i className="ri-time-line" />Cuidado</>
          ) : allDelivered && totalQty > 0 ? (
            <><i className="ri-check-double-line" />Completo</>
          ) : (
            'Total'
          )}
        </span>
        <span className="text-base font-black text-white">${total.toFixed(2)}</span>
      </div>
    </button>
  );
}