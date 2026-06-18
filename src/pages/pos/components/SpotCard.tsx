import { useState, useEffect } from 'react';
import type { Spot, PosAccount } from '../types';
import { useLastRoundInfo } from '../hooks/useLastRoundInfo';

interface SpotCardProps {
  spot: Spot;
  account?: PosAccount;
  onClick: () => void;
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

function getTimeStyle(createdAt?: string): { color: string; bg: string } {
  if (!createdAt) return { color: 'text-gray-500', bg: '' };
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (mins >= 120) return { color: 'text-red-600 font-bold', bg: 'bg-red-50' };
  if (mins >= 60) return { color: 'text-orange-500 font-semibold', bg: 'bg-orange-50' };
  return { color: 'text-gray-500', bg: '' };
}

export default function SpotCard({ spot, account, onClick }: SpotCardProps) {
  const isOpen = !!account;
  const total = account?.pos_account_items?.reduce(
    (sum, item) => sum + item.unit_price * item.quantity, 0
  ) ?? 0;
  const folioCount = account?.folio_counter ?? 0;
  const elapsed = useElapsedTime(account?.created_at);
  const timeStyle = getTimeStyle(account?.created_at);

  const lastRound = useLastRoundInfo(account);

  // Contadores de productos pendientes y entregados
  const allItems = account?.pos_account_items ?? [];
  const totalQty = allItems.reduce((s, i) => s + i.quantity, 0);
  const deliveredQty = allItems.filter(i => i.delivered).reduce((s, i) => s + i.quantity, 0);
  const pendingQty = totalQty - deliveredQty;

  return (
    <button
      onClick={onClick}
      className={`relative w-full rounded-xl text-left transition-all cursor-pointer border-2 overflow-hidden ${
        isOpen
          ? 'bg-white border-amber-400 hover:border-amber-500 hover:shadow-sm'
          : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      {/* Pulse indicator */}
      {isOpen && (
        <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      )}

      {isOpen ? (
        <>
          {/* Top section */}
          <div className="px-3 pt-3 pb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-1">
              {spot.label}
            </p>
            <p className="text-sm font-bold text-gray-900 truncate leading-tight pr-4">
              {account?.customer_name || 'Sin nombre'}
            </p>

            {/* Time + rondas row */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {elapsed && (
                <span className={`text-xs flex items-center gap-0.5 ${timeStyle.color}`}>
                  <i className="ri-time-line" />
                  {elapsed}
                </span>
              )}
              {lastRound.status !== 'normal' && pendingQty === 0 && (
                <span className={`text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-bold ${
                  lastRound.status === 'abandoned'
                    ? 'bg-red-100 text-red-600'
                    : lastRound.status === 'warning'
                    ? 'bg-orange-100 text-orange-600'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  <i className="ri-alarm-warning-line" />
                  {lastRound.status === 'abandoned' ? 'Abandonada' : lastRound.status === 'warning' ? 'Alerta' : 'Cuidado'}
                  {' · '}{lastRound.label}
                </span>
              )}
              {folioCount > 0 && (
                <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded-full">
                  {folioCount} ronda{folioCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Pendientes vs entregados */}
            {totalQty > 0 && (
              <div className="flex items-center gap-2 mt-2">
                {pendingQty > 0 && (
                  <span className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 font-semibold px-1.5 py-0.5 rounded-full border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                    {pendingQty} pend.
                  </span>
                )}
                {deliveredQty > 0 && (
                  <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 font-semibold px-1.5 py-0.5 rounded-full border border-green-200">
                    <i className="ri-check-line text-green-600" />
                    {deliveredQty} entg.
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Total bar — destacado */}
          <div className={`px-3 py-2 flex items-center justify-between ${
            lastRound.status === 'abandoned' && pendingQty === 0
              ? 'bg-red-500'
              : lastRound.status === 'warning' && pendingQty === 0
              ? 'bg-orange-500'
              : 'bg-amber-500'
          }`}>
            <span className={`text-xs font-medium ${
              lastRound.status === 'abandoned' && pendingQty === 0
                ? 'text-red-100'
                : lastRound.status === 'warning' && pendingQty === 0
                ? 'text-orange-100'
                : 'text-amber-100'
            }`}>
              {lastRound.status === 'abandoned' && pendingQty === 0
                ? 'Sin pedir desde ' + lastRound.label
                : 'Total acumulado'}
            </span>
            <span className="text-base font-black text-white">${total.toFixed(2)}</span>
          </div>
        </>
      ) : (
        <div className="px-3 py-3">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
            {spot.label}
          </p>
          <p className="text-xs text-gray-400">Disponible</p>
        </div>
      )}
    </button>
  );
}