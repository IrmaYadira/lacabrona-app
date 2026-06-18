import { useEffect, useRef, useCallback, useState } from 'react';
import { supabasePos } from '../supabasePos';
import { detectExtras } from '../utils/extrasPrice';

export interface WebOrderNotification {
  id: string;
  accountId: number;
  spot: string;
  itemsCount: number;
  total: number;
  timestamp: Date;
  dismissed: boolean;
  hasExtras?: boolean;
}

// Genera un sonido de alarma urgente usando Web Audio API — diseñado para escucharse sobre música
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    // Compressor para maximizar volumen percibido
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-10, ctx.currentTime);
    compressor.knee.setValueAtTime(3, ctx.currentTime);
    compressor.ratio.setValueAtTime(20, ctx.currentTime);
    compressor.attack.setValueAtTime(0, ctx.currentTime);
    compressor.release.setValueAtTime(0.1, ctx.currentTime);
    compressor.connect(ctx.destination);

    // Onda cuadrada: más agresiva y cortante que seno, se escucha sobre ruido de fondo
    const playBuzz = (freq: number, startTime: number, duration: number, gain: number) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(compressor);

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, startTime);

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
      gainNode.gain.setValueAtTime(gain, startTime + duration - 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const t = ctx.currentTime;
    // BEP-BEP-BEP dos veces: frecuencias alternantes para máxima distinción
    const pulse = 0.12;
    const gap = 0.08;

    // Primera ráfaga
    playBuzz(1200, t, pulse, 0.9);
    playBuzz(900, t + pulse + gap, pulse, 0.9);
    playBuzz(1200, t + (pulse + gap) * 2, pulse, 0.9);

    // Pausa + segunda ráfaga (insistente)
    const offset = (pulse + gap) * 3 + 0.18;
    playBuzz(1200, t + offset, pulse, 0.9);
    playBuzz(900, t + offset + pulse + gap, pulse, 0.9);
    playBuzz(1200, t + offset + (pulse + gap) * 2, pulse, 0.9);

    setTimeout(() => ctx.close(), 3000);
  } catch {
    // Silencioso si el navegador no soporta Web Audio
  }
}

// Sonido EXTRA AGRESIVO para órdenes con extras de pago — no se puede ignorar
function playExtraAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-20, ctx.currentTime);
    compressor.knee.setValueAtTime(6, ctx.currentTime);
    compressor.ratio.setValueAtTime(30, ctx.currentTime);
    compressor.attack.setValueAtTime(0, ctx.currentTime);
    compressor.release.setValueAtTime(0.05, ctx.currentTime);
    compressor.connect(ctx.destination);

    // Función para tono cuadrado cortante
    const playTone = (freq: number, start: number, dur: number, vol: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(compressor);
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(vol, start + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.start(start);
      osc.stop(start + dur);
    };

    // Función para chirp ascendente (más llamativo)
    const playChirp = (freqFrom: number, freqTo: number, start: number, dur: number, vol: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(compressor);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freqFrom, start);
      osc.frequency.exponentialRampToValueAtTime(freqTo, start + dur);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(vol, start + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.start(start);
      osc.stop(start + dur);
    };

    const t = ctx.currentTime;

    // ALARMA: ¡ring-ring-ring! 3 ráfagas rápidas + chirp final
    for (let r = 0; r < 3; r++) {
      const rOffset = r * 0.45;
      playTone(1500, t + rOffset, 0.10, 0.95);
      playTone(1100, t + rOffset + 0.13, 0.10, 0.95);
      playTone(1500, t + rOffset + 0.26, 0.10, 0.95);
    }

    // Chirp ascendente final que "corta" para llamar la atención
    playChirp(800, 2200, t + 1.4, 0.5, 0.8);

    // Vibración del dispositivo si está disponible (2 ráfagas)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }

    setTimeout(() => ctx.close(), 3000);
  } catch {
    // Silencioso
  }
}

// Polling fallback: busca items web insertados recientemente
async function pollRecentWebItems(
  knownIds: Set<number>,
  onNewItem: (item: {
    id: number;
    account_id: number;
    unit_price: number;
    quantity: number;
    size?: string;
    spot: string;
  }) => void
) {
  try {
    const since = new Date(Date.now() - 30_000).toISOString(); // últimos 30s
    const { data } = await supabasePos
      .from('pos_account_items')
      .select('id, account_id, unit_price, quantity, size, origin, pos_accounts!inner(spot, origin)')
      .eq('origin', 'web')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!data) return;

    for (const row of data as Record<string, unknown>[]) {
      const id = row.id as number;
      if (knownIds.has(id)) continue;
      knownIds.add(id);

      const accountData = row.pos_accounts as Record<string, unknown> | Record<string, unknown>[] | undefined;
      const account = Array.isArray(accountData) ? accountData[0] : accountData;
      const spot = (account?.spot as string) ?? `Cuenta #${row.account_id}`;

      onNewItem({
        id,
        account_id: row.account_id as number,
        unit_price: row.unit_price as number,
        quantity: row.quantity as number,
        size: (row.size as string) || undefined,
        spot,
      });
    }
  } catch {
    // silencioso
  }
}

export function useWebOrderNotifications() {
  const [notifications, setNotifications] = useState<WebOrderNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const processedItemIds = useRef<Set<number>>(new Set());
  const pendingBatch = useRef<{ itemId: number; accountId: number; spot: string; unitPrice: number; size?: string }[]>([]);
  const batchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabasePos.channel> | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
  const MAX_RETRIES = 10;

  // Agrupa inserciones que llegan casi al mismo tiempo (mismo pedido web)
  const flushBatch = useCallback(async () => {
    if (pendingBatch.current.length === 0) return;

    const batch = [...pendingBatch.current];
    pendingBatch.current = [];

    // Agrupar por accountId
    const byAccount = new Map<number, typeof batch>();
    batch.forEach(item => {
      const list = byAccount.get(item.accountId) ?? [];
      list.push(item);
      byAccount.set(item.accountId, list);
    });

    // Para cada cuenta buscar el spot
    for (const [accountId, batchItems] of byAccount.entries()) {
      // Spot ya viene en el batch
      const spot = batchItems[0].spot;
      const total = batchItems.reduce((s, i) => s + i.unitPrice, 0);

      // Detectar si ALGÚN item del batch tiene extras de pago
      const hasExtras = batchItems.some(item => {
        const extras = detectExtras(item.size ?? '');
        return extras.length > 0;
      });

      const notification: WebOrderNotification = {
        id: `${accountId}-${Date.now()}`,
        accountId,
        spot,
        itemsCount: batchItems.length,
        total,
        timestamp: new Date(),
        dismissed: false,
        hasExtras,
      };

      setNotifications(prev => [notification, ...prev.slice(0, 9)]); // max 10
      setUnreadCount(prev => prev + 1);

      // Sonido diferente si tiene extras de pago
      if (hasExtras) {
        playExtraAlertSound();
      } else {
        playNotificationSound();
      }

      // Auto-dismiss después de 30s
      setTimeout(() => {
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, dismissed: true } : n)
        );
      }, 30000);
    }
  }, []);

  // Procesa un item nuevo (tanto de realtime como de polling)
  const handleNewItem = useCallback(async (newItem: {
    id: number;
    account_id: number;
    unit_price: number;
    quantity: number;
    size?: string;
    spot: string;
  }) => {
    // Evitar duplicados
    if (processedItemIds.current.has(newItem.id)) return;
    processedItemIds.current.add(newItem.id);

    const spot = newItem.spot ?? `Cuenta #${newItem.account_id}`;

    pendingBatch.current.push({
      itemId: newItem.id,
      accountId: newItem.account_id,
      spot,
      unitPrice: newItem.unit_price * newItem.quantity,
      size: newItem.size ?? undefined,
    });

    // Esperar 600ms para agrupar todos los items del mismo pedido
    if (batchTimer.current) clearTimeout(batchTimer.current);
    batchTimer.current = setTimeout(flushBatch, 600);
  }, [flushBatch]);

  // Setup realtime con reintento automático
  const setupRealtime = useCallback(() => {
    // Limpiar channel anterior si existe
    if (channelRef.current) {
      try { supabasePos.removeChannel(channelRef.current); } catch { /* ignore */ }
      channelRef.current = null;
    }

    const channel = supabasePos
      .channel('web-order-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pos_account_items',
        },
        async (payload) => {
          const newItem = payload.new as {
            id: number;
            account_id: number;
            unit_price: number;
            quantity: number;
            origin?: string | null;
            size?: string | null;
          };

          // Filtrar manualmente — más robusto que filter en .on()
          if (newItem.origin !== 'web') return;

          // Buscar el spot de la cuenta
          const { data: account } = await supabasePos
            .from('pos_accounts')
            .select('spot, area')
            .eq('id', newItem.account_id)
            .maybeSingle();

          const spot = account?.spot ?? `Cuenta #${newItem.account_id}`;

          handleNewItem({
            id: newItem.id,
            account_id: newItem.account_id,
            unit_price: newItem.unit_price,
            quantity: newItem.quantity,
            size: newItem.size ?? undefined,
            spot,
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
          retryCount.current = 0;
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeStatus('disconnected');
          channelRef.current = null;
          // Reintento automático con backoff
          if (retryCount.current < MAX_RETRIES) {
            retryCount.current += 1;
            const delay = Math.min(2000 * retryCount.current, 15000);
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            reconnectTimer.current = setTimeout(() => {
              setupRealtime();
            }, delay);
          }
        }
      });

    channelRef.current = channel;
  }, [handleNewItem]);

  useEffect(() => {
    // ── Realtime subscription ──
    setupRealtime();

    // ── Polling fallback cada 8 segundos — SIEMPRE activo para detectar items perdidos ──
    pollingInterval.current = setInterval(() => {
      pollRecentWebItems(processedItemIds.current, handleNewItem);
    }, 8000);

    // Polling inmediato al montar por si hay items recientes
    pollRecentWebItems(processedItemIds.current, handleNewItem);

    return () => {
      if (channelRef.current) {
        try { supabasePos.removeChannel(channelRef.current); } catch { /* ignore */ }
      }
      if (batchTimer.current) clearTimeout(batchTimer.current);
      if (pollingInterval.current) clearInterval(pollingInterval.current);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [handleNewItem, setupRealtime]);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, dismissed: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, dismissed: true })));
    setUnreadCount(0);
  }, []);

  const clearUnread = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // Marca todos los items web de una cuenta como entregados en la BD
  const markDelivered = useCallback(async (accountId: number) => {
    await supabasePos
      .from('pos_account_items')
      .update({ delivered: true })
      .eq('account_id', accountId)
      .eq('origin', 'web');
  }, []);

  const activeNotifications = notifications.filter(n => !n.dismissed);

  return { notifications, activeNotifications, unreadCount, dismiss, dismissAll, clearUnread, markDelivered, realtimeStatus };
}