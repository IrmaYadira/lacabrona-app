import { useState, useEffect, useRef, useCallback } from 'react';
import { supabasePos } from '@/pages/pos/supabasePos';
import { speakNewOrder, type OrderItemVoice } from '@/lib/orderSpeech';

interface NewOrderEvent {
  id: string;
  spot: string;
  area: string;
  folioNumber: number;
  items: string[];
  total: number;
  timestamp: number;
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-10, ctx.currentTime);
    compressor.knee.setValueAtTime(3, ctx.currentTime);
    compressor.ratio.setValueAtTime(20, ctx.currentTime);
    compressor.attack.setValueAtTime(0, ctx.currentTime);
    compressor.release.setValueAtTime(0.1, ctx.currentTime);
    compressor.connect(ctx.destination);

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
    const pulse = 0.12;
    const gap = 0.08;

    playBuzz(1200, t, pulse, 0.9);
    playBuzz(900, t + pulse + gap, pulse, 0.9);
    playBuzz(1200, t + (pulse + gap) * 2, pulse, 0.9);

    const offset = (pulse + gap) * 3 + 0.18;
    playBuzz(1200, t + offset, pulse, 0.9);
    playBuzz(900, t + offset + pulse + gap, pulse, 0.9);
    playBuzz(1200, t + offset + (pulse + gap) * 2, pulse, 0.9);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }

    setTimeout(() => ctx.close(), 3000);
  } catch (_) { /* browser blocked */ }
}

interface Props {
  onNewOrder?: (spot: string) => void;
}

interface PendingItem {
  itemId: number;
  accountId: number;
  spot: string;
  area: string;
  folioNumber: number;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export default function LiveOrderNotifier({ onNewOrder }: Props) {
  const [notifications, setNotifications] = useState<NewOrderEvent[]>([]);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const knownItems = useRef<Set<number>>(new Set());
  const initialized = useRef(false);
  const pendingBatch = useRef<PendingItem[]>([]);
  const batchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const initKnown = useCallback(async () => {
    const { data } = await supabasePos
      .from('pos_account_items')
      .select('id')
      .order('id', { ascending: false })
      .limit(200);
    if (data) data.forEach((r: { id: number }) => knownItems.current.add(r.id));
    initialized.current = true;
  }, []);

  // Agrupa items del mismo pedido web y solo notifica los NUEVOS (batch actual)
  const flushBatch = useCallback(() => {
    if (pendingBatch.current.length === 0) return;

    const batch = [...pendingBatch.current];
    pendingBatch.current = [];

    // Agrupar por accountId
    const byAccount = new Map<number, PendingItem[]>();
    batch.forEach(item => {
      const list = byAccount.get(item.accountId) ?? [];
      list.push(item);
      byAccount.set(item.accountId, list);
    });

    // Crear notificación por cada cuenta con SOLO los items nuevos del batch
    for (const [accountId, batchItems] of byAccount.entries()) {
      const first = batchItems[0];
      const total = batchItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

      const recentItems = batchItems.map(i => `${i.quantity}x ${i.productName}`);

      // Solo los items NUEVOS del batch para voz
      const voiceItems: OrderItemVoice[] = batchItems.map(i => ({
        name: i.productName,
        qty: i.quantity,
      }));

      const notif: NewOrderEvent = {
        id: `${Date.now()}-${accountId}`,
        spot: first.spot,
        area: first.area,
        folioNumber: first.folioNumber,
        items: recentItems,
        total,
        timestamp: Date.now(),
      };

      // Beep siempre
      playChime();

      // Voz: solo los items NUEVOS
      if (voiceEnabled) {
        setTimeout(() => speakNewOrder(first.spot, voiceItems, total, false), 700);
      }

      setNotifications(prev => [...prev.slice(-4), notif]);
      setMinimized(false);
      onNewOrder?.(first.spot);

      setTimeout(() => dismiss(notif.id), 12000);
    }
  }, [voiceEnabled, dismiss, onNewOrder]);

  const handleNewItem = useCallback(async (payload: unknown) => {
    if (!initialized.current) return;
    const record = (payload as { new?: { id?: number; folio_number?: number; product_name?: string; quantity?: number; unit_price?: number; account_id?: number; origin?: string | null } })?.new;
    if (!record?.id || knownItems.current.has(record.id)) return;

    if (record.origin !== 'web') return;

    knownItems.current.add(record.id);

    // Obtener el spot de la cuenta
    const { data: acc } = await supabasePos
      .from('pos_accounts')
      .select('id, spot, area')
      .eq('id', record.account_id)
      .eq('status', 'open')
      .maybeSingle();

    if (!acc) return;

    // Agregar al batch pendiente (solo el item NUEVO)
    pendingBatch.current.push({
      itemId: record.id,
      accountId: record.account_id ?? 0,
      spot: acc.spot,
      area: acc.area,
      folioNumber: record.folio_number ?? 1,
      productName: record.product_name ?? 'Producto',
      quantity: record.quantity ?? 1,
      unitPrice: record.unit_price ?? 0,
    });

    // Esperar 600ms para agrupar todos los items del mismo pedido
    if (batchTimer.current) clearTimeout(batchTimer.current);
    batchTimer.current = setTimeout(flushBatch, 600);
  }, [voiceEnabled, dismiss, onNewOrder, flushBatch]);

  useEffect(() => {
    initKnown();

    const channel = supabasePos
      .channel('live-order-notifier')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pos_account_items' }, handleNewItem)
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          console.log('[LiveOrderNotifier] Realtime status:', status);
        }
      });

    const pollInterval = setInterval(async () => {
      if (!initialized.current) return;
      const { data } = await supabasePos
        .from('pos_account_items')
        .select('id, folio_number, product_name, quantity, unit_price, account_id, origin')
        .eq('origin', 'web')
        .order('id', { ascending: false })
        .limit(5);
      if (data) {
        data.forEach((record: { id: number; folio_number?: number; product_name?: string; quantity?: number; unit_price?: number; account_id?: number; origin?: string | null }) => {
          if (!knownItems.current.has(record.id)) {
            handleNewItem({ new: record });
          }
        });
      }
    }, 5000);

    return () => {
      supabasePos.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [initKnown, handleNewItem]);

  if (notifications.length === 0) {
    return (
      <div className="fixed bottom-5 right-5 z-50">
        <button
          onClick={() => setVoiceEnabled(p => !p)}
          title={voiceEnabled ? 'Silenciar voz de pedidos' : 'Activar voz de pedidos'}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-full border transition-all cursor-pointer text-xs font-semibold whitespace-nowrap ${
            voiceEnabled
              ? 'bg-amber-50 border-amber-300 text-amber-600 hover:bg-amber-100'
              : 'bg-gray-100 border-gray-200 text-gray-400 hover:bg-gray-200'
          }`}
        >
          <i className={voiceEnabled ? 'ri-volume-up-line' : 'ri-volume-mute-line'} />
          {voiceEnabled ? 'Voz ON' : 'Voz OFF'}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end" style={{ maxWidth: 340 }}>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setVoiceEnabled(p => !p)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-all whitespace-nowrap ${
            voiceEnabled ? 'bg-amber-50 border-amber-300 text-amber-600' : 'bg-gray-100 border-gray-200 text-gray-400'
          }`}
        >
          <i className={voiceEnabled ? 'ri-volume-up-line' : 'ri-volume-mute-line'} />
          {voiceEnabled ? 'Voz' : 'Silencio'}
        </button>
        <button
          onClick={() => setMinimized(p => !p)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-white border-gray-200 text-gray-500 cursor-pointer hover:bg-gray-50 whitespace-nowrap"
        >
          <i className={minimized ? 'ri-arrow-up-s-line' : 'ri-subtract-line'} />
          {minimized ? `${notifications.length} nuevos` : 'Minimizar'}
        </button>
        {notifications.length > 1 && !minimized && (
          <button
            onClick={dismissAll}
            className="px-2.5 py-1 rounded-full text-xs font-semibold border bg-white border-gray-200 text-gray-400 cursor-pointer hover:bg-gray-50 whitespace-nowrap"
          >
            Limpiar todo
          </button>
        )}
      </div>

      {!minimized && notifications.map(notif => (
        <div
          key={notif.id}
          className="w-full bg-gray-950 border border-amber-500 rounded-2xl overflow-hidden"
          style={{ animation: 'slideInRight 0.3s ease-out' }}
        >
          <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 flex items-center justify-center bg-amber-500 rounded-xl">
                <i className="ri-restaurant-fill text-white text-base" />
              </div>
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-gray-950 animate-ping" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-gray-950" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-black leading-tight">
                Nuevo pedido — {notif.spot}
              </p>
              <p className="text-amber-400 text-xs font-semibold">
                Ronda #{String(notif.folioNumber).padStart(2, '0')} · MXN${notif.total.toFixed(2)} total
              </p>
            </div>
            <button
              onClick={() => dismiss(notif.id)}
              className="text-gray-500 hover:text-white cursor-pointer transition-colors flex-shrink-0 p-1"
            >
              <i className="ri-close-line text-lg" />
            </button>
          </div>

          {notif.items.length > 0 && (
            <div className="px-4 pb-2">
              {notif.items.map((item, idx) => (
                <p key={idx} className="text-gray-300 text-xs leading-relaxed flex items-center gap-1.5">
                  <i className="ri-arrow-right-s-line text-amber-500 flex-shrink-0" />
                  {item}
                </p>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between px-4 pb-3.5 pt-1 border-t border-gray-800 mt-1">
            <span className="text-gray-500 text-xs flex items-center gap-1">
              <i className="ri-time-line" />
              Ahora mismo
            </span>
            <a
              href="/admin"
              className="flex items-center gap-1 text-amber-400 hover:text-amber-300 text-xs font-bold transition-colors whitespace-nowrap"
            >
              Ver en admin
              <i className="ri-arrow-right-s-line" />
            </a>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}