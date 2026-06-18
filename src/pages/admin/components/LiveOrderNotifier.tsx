import { useState, useEffect, useRef, useCallback } from 'react';
import { supabasePos } from '@/pages/pos/supabasePos';

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

    // Compressor para maximizar volumen percibido — se escucha sobre ruido de fondo
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
    const pulse = 0.12;
    const gap = 0.08;

    // Primera ráfaga: BEP-BEP-BEP
    playBuzz(1200, t, pulse, 0.9);
    playBuzz(900, t + pulse + gap, pulse, 0.9);
    playBuzz(1200, t + (pulse + gap) * 2, pulse, 0.9);

    // Pausa + segunda ráfaga
    const offset = (pulse + gap) * 3 + 0.18;
    playBuzz(1200, t + offset, pulse, 0.9);
    playBuzz(900, t + offset + pulse + gap, pulse, 0.9);
    playBuzz(1200, t + offset + (pulse + gap) * 2, pulse, 0.9);

    // Vibración del dispositivo si está disponible
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }

    setTimeout(() => ctx.close(), 3000);
  } catch (_) { /* browser blocked */ }
}

interface Props {
  /** Callback cuando llega nuevo pedido, para actualizar badges del dashboard */
  onNewOrder?: (spot: string) => void;
}

export default function LiveOrderNotifier({ onNewOrder }: Props) {
  const [notifications, setNotifications] = useState<NewOrderEvent[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const knownItems = useRef<Set<number>>(new Set());
  const initialized = useRef(false);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Inicializar conocidos sin disparar notificaciones
  const initKnown = useCallback(async () => {
    const { data } = await supabasePos
      .from('pos_account_items')
      .select('id')
      .order('id', { ascending: false })
      .limit(200);
    if (data) data.forEach((r: { id: number }) => knownItems.current.add(r.id));
    initialized.current = true;
  }, []);

  const handleNewItem = useCallback(async (payload: unknown) => {
    if (!initialized.current) return;
    const record = (payload as { new?: { id?: number; folio_number?: number; product_name?: string; quantity?: number; unit_price?: number; account_id?: number; origin?: string | null } })?.new;
    if (!record?.id || knownItems.current.has(record.id)) return;

    // Solo pedidos web
    if (record.origin !== 'web') return;

    knownItems.current.add(record.id);

    // Obtener datos de la cuenta
    const { data: acc } = await supabasePos
      .from('pos_accounts')
      .select('id, spot, area, pos_account_items(product_name, quantity, unit_price)')
      .eq('id', record.account_id)
      .eq('status', 'open')
      .maybeSingle();

    if (!acc) return;

    const items = (acc.pos_account_items ?? []) as { product_name: string; quantity: number; unit_price: number }[];
    const total = items.reduce((s: number, i: { unit_price: number; quantity: number }) => s + i.unit_price * i.quantity, 0);

    // Solo mostrar items del folio actual (los nuevos)
    const recentItems = items.slice(-3).map((i: { quantity: number; product_name: string }) => `${i.quantity}x ${i.product_name}`);

    const notif: NewOrderEvent = {
      id: `${Date.now()}-${record.id}`,
      spot: acc.spot,
      area: acc.area,
      folioNumber: record.folio_number ?? 1,
      items: recentItems,
      total,
      timestamp: Date.now(),
    };

    if (soundEnabled) playChime();
    setNotifications(prev => [...prev.slice(-4), notif]);
    setMinimized(false);
    onNewOrder?.(acc.spot);

    // Auto-dismiss en 12 segundos
    setTimeout(() => dismiss(notif.id), 12000);
  }, [soundEnabled, dismiss, onNewOrder]);

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

    // Fallback polling: revisar nuevos items cada 5 segundos si realtime falla
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
          onClick={() => setSoundEnabled(p => !p)}
          title={soundEnabled ? 'Silenciar alertas de pedidos web' : 'Activar alertas de pedidos web'}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-full border transition-all cursor-pointer text-xs font-semibold whitespace-nowrap ${
            soundEnabled
              ? 'bg-amber-50 border-amber-300 text-amber-600 hover:bg-amber-100'
              : 'bg-gray-100 border-gray-200 text-gray-400 hover:bg-gray-200'
          }`}
        >
          <i className={soundEnabled ? 'ri-notification-3-line' : 'ri-notification-off-line'} />
          {soundEnabled ? 'Alerta Web ON' : 'Alerta Web OFF'}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end" style={{ maxWidth: 340 }}>
      {/* Controls row */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSoundEnabled(p => !p)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-all whitespace-nowrap ${
            soundEnabled ? 'bg-amber-50 border-amber-300 text-amber-600' : 'bg-gray-100 border-gray-200 text-gray-400'
          }`}
        >
          <i className={soundEnabled ? 'ri-volume-up-line' : 'ri-volume-mute-line'} />
          {soundEnabled ? 'Sonido' : 'Silencio'}
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

      {/* Notification cards */}
      {!minimized && notifications.map(notif => (
        <div
          key={notif.id}
          className="w-full bg-gray-950 border border-amber-500 rounded-2xl overflow-hidden"
          style={{ animation: 'slideInRight 0.3s ease-out' }}
        >
          {/* Header */}
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
                Ronda #{String(notif.folioNumber).padStart(2, '0')} · ${notif.total.toFixed(2)} total
              </p>
            </div>
            <button
              onClick={() => dismiss(notif.id)}
              className="text-gray-500 hover:text-white cursor-pointer transition-colors flex-shrink-0 p-1"
            >
              <i className="ri-close-line text-lg" />
            </button>
          </div>

          {/* Items */}
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

          {/* Footer */}
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