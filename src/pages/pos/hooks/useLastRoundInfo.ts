import { useState, useEffect } from 'react';
import type { PosAccount } from '../types';

export interface LastRoundInfo {
  minutesSince: number;
  lastRoundAt: string | null;
  status: 'normal' | 'caution' | 'warning' | 'abandoned';
  label: string;
  hasItems: boolean;
  pendingQty: number;
}

/**
 * Calcula el tiempo desde la última ronda (último item agregado).
 * Si no hay items, usa la fecha de apertura de la cuenta.
 * Solo marca como 'abandoned' si no hay items pendientes por entregar.
 */
export function useLastRoundInfo(account?: PosAccount): LastRoundInfo {
  const [info, setInfo] = useState<LastRoundInfo>({
    minutesSince: 0,
    lastRoundAt: null,
    status: 'normal',
    label: '',
    hasItems: false,
    pendingQty: 0,
  });

  useEffect(() => {
    if (!account) return;

    const calculate = () => {
      const items = account.pos_account_items ?? [];
      const hasItems = items.length > 0;
      const totalQty = items.reduce((s, i) => s + i.quantity, 0);
      const deliveredQty = items.filter(i => i.delivered).reduce((s, i) => s + i.quantity, 0);
      const pendingQty = totalQty - deliveredQty;

      const lastRoundAt = hasItems
        ? items.reduce((latest, item) => {
            const itemTime = new Date(item.created_at).getTime();
            return itemTime > latest ? itemTime : latest;
          }, 0)
        : new Date(account.created_at).getTime();

      const minutesSince = Math.floor((Date.now() - lastRoundAt) / 60000);

      let status: LastRoundInfo['status'] = 'normal';
      let label = '';

      // Solo alertar si no hay items pendientes por entregar
      if (pendingQty === 0) {
        if (minutesSince >= 120) {
          status = 'abandoned';
          const hrs = Math.floor(minutesSince / 60);
          const rem = minutesSince % 60;
          label = rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
        } else if (minutesSince >= 90) {
          status = 'warning';
          const hrs = Math.floor(minutesSince / 60);
          const rem = minutesSince % 60;
          label = rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
        } else if (minutesSince >= 60) {
          status = 'caution';
          label = `${minutesSince}m`;
        }
      }

      setInfo({
        minutesSince,
        lastRoundAt: new Date(lastRoundAt).toISOString(),
        status,
        label,
        hasItems,
        pendingQty,
      });
    };

    calculate();
    const iv = setInterval(calculate, 60000);
    return () => clearInterval(iv);
  }, [account]);

  return info;
}