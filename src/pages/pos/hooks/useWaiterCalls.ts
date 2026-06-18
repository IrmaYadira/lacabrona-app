import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabasePos } from '../supabasePos';

export interface WaiterCall {
  id: number;
  spot: string | null;
  area: string | null;
  account_id: number | null;
  request_type: string | null;
  status: string;
  notes: string | null;
  photo_url: string | null;
  selfie_url: string | null;
  customer_name: string | null;
  created_at: string;
}

export interface CallGroup {
  key: string;
  spot: string;
  area: string | null;
  request_type: string;
  count: number;
  ids: number[];
  latestAt: string;
  customer_name: string | null;
  selfie_url: string | null;
  photo_url: string | null;
  notes: string | null;
  account_id: number | null;
}

const MAX_AGE_MS = 8 * 60 * 60 * 1000;

function isWithinAge(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() <= MAX_AGE_MS;
}

function playBell(type: 'call' | 'check' = 'call') {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const tones = type === 'check' ? [523, 659, 784] : [880, 1100];
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.22;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  } catch (_) {
    // browser blocked
  }
}

function vibrateDevice(type: 'call' | 'check' = 'call') {
  if (!navigator.vibrate) return;
  if (type === 'check') {
    navigator.vibrate([120, 80, 120, 80, 300]);
  } else {
    navigator.vibrate([200, 100, 200, 100, 400, 150, 200]);
  }
}

export function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'Hace un momento';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  return `Hace ${Math.floor(diff / 3600)}h`;
}

export function groupCalls(calls: WaiterCall[]): CallGroup[] {
  const map = new Map<string, CallGroup>();
  for (const call of calls) {
    const spot = call.spot?.trim() || 'Mesa desconocida';
    const rt = call.request_type || 'call';
    const key = `${spot}::${rt}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.ids.push(call.id);
      if (new Date(call.created_at) > new Date(existing.latestAt)) {
        existing.latestAt = call.created_at;
        if (call.selfie_url) existing.selfie_url = call.selfie_url;
        if (call.photo_url) existing.photo_url = call.photo_url;
        if (call.customer_name) existing.customer_name = call.customer_name;
        if (call.account_id) existing.account_id = call.account_id;
      }
    } else {
      map.set(key, {
        key,
        spot,
        area: call.area,
        request_type: rt,
        count: 1,
        ids: [call.id],
        latestAt: call.created_at,
        customer_name: call.customer_name,
        selfie_url: call.selfie_url,
        photo_url: call.photo_url,
        account_id: call.account_id,
      });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
  );
}

export function useWaiterCalls() {
  const [calls, setCalls] = useState<WaiterCall[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrateEnabled, setVibrateEnabled] = useState(true);
  const knownIds = useRef<Set<number>>(new Set());
  const initialized = useRef(false);

  const groups = useMemo(() => groupCalls(calls), [calls]);

  const initPending = useCallback(async () => {
    const { data } = await supabasePos
      .from('waiter_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!data) return;
    const all = data as WaiterCall[];

    const staleIds = all.filter(c => !isWithinAge(c.created_at)).map(c => c.id);
    if (staleIds.length > 0) {
      await supabasePos
        .from('waiter_requests')
        .update({ status: 'resolved', updated_at: new Date().toISOString() })
        .in('id', staleIds);
    }

    const fresh = all.filter(c => isWithinAge(c.created_at));
    fresh.forEach(r => knownIds.current.add(r.id));
    setCalls(fresh);
    initialized.current = true;
  }, []);

  const attendGroup = useCallback(async (group: CallGroup) => {
    if (group.ids.length === 0) return;
    await supabasePos
      .from('waiter_requests')
      .update({ status: 'resolved', updated_at: new Date().toISOString() })
      .in('id', group.ids);
    const idSet = new Set(group.ids);
    setCalls(prev => prev.filter(c => !idSet.has(c.id)));
  }, []);

  const attendAll = useCallback(async () => {
    const ids = calls.map(c => c.id);
    if (ids.length === 0) return;
    await supabasePos
      .from('waiter_requests')
      .update({ status: 'resolved', updated_at: new Date().toISOString() })
      .in('id', ids);
    setCalls([]);
  }, [calls]);

  useEffect(() => {
    initPending();

    let retries = 0;
    const MAX_RETRIES = 10;

    const setupChannel = () => {
      const channel = supabasePos
        .channel('waiter-calls-pos')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'waiter_requests' },
          (payload) => {
            if (!initialized.current) return;
            const rec = payload.new as WaiterCall;
            if (!rec?.id || knownIds.current.has(rec.id)) return;
            if (!isWithinAge(rec.created_at)) return;

            knownIds.current.add(rec.id);
            if (rec.status !== 'pending') return;

            const callType = (rec.request_type === 'check' || rec.request_type === 'request_bill') ? 'check' : 'call';
            if (soundEnabled) playBell(callType);
            if (vibrateEnabled) vibrateDevice(callType);
            setCalls(prev => [rec, ...prev]);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            retries = 0;
          } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            if (retries < MAX_RETRIES) {
              retries += 1;
              const delay = Math.min(2000 * retries, 15000);
              setTimeout(setupChannel, delay);
            }
          }
        });

      return channel;
    };

    const channel = setupChannel();

    return () => { supabasePos.removeChannel(channel); };
  }, [initPending, soundEnabled, vibrateEnabled]);

  // ── Auto-refresh al recuperar visibilidad ──
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        initPending();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [initPending]);

  return {
    calls,
    groups,
    soundEnabled,
    setSoundEnabled,
    vibrateEnabled,
    setVibrateEnabled,
    attendGroup,
    attendAll,
  };
}