import { useState, useCallback, useRef } from 'react';
import { supabasePos } from '../supabasePos';
import type { PosAccount } from '../types';
import type { WaiterCall } from './useWaiterCalls';

const MAX_AGE_MS = 8 * 60 * 60 * 1000;
const isWithinAge = (createdAt: string) => Date.now() - new Date(createdAt).getTime() <= MAX_AGE_MS;

export function usePosPanelData() {
  const [accounts, setAccounts] = useState<PosAccount[]>([]);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('reconnecting');
  const [lastFetchTime, setLastFetchTime] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const channelStatusRef = useRef<Map<string, 'connected' | 'disconnected'>>(new Map());

  // ⬆️ markDataFresh tiene que ir ANTES de fetchAccounts porque fetchAccounts lo usa en su array de dependencias
  const markDataFresh = useCallback(() => {
    setRealtimeStatus(prev => {
      if (prev === 'connected') return prev;
      const allConnected = Array.from(channelStatusRef.current.values()).every(s => s === 'connected');
      if (allConnected) return 'connected';
      return 'connected';
    });
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const { data } = await supabasePos
        .from('pos_accounts')
        .select('*, pos_account_items(*), pos_customers(selfie_url, loyalty_points)')
        .eq('status', 'open')
        .neq('area', 'llevar')
        .order('created_at', { ascending: false });

      const normalized = (data ?? []).map((acc: Record<string, unknown>) => {
        const cust = acc.pos_customers as { selfie_url?: string | null; loyalty_points?: number | null } | null;
        return {
          ...acc,
          pos_customers: undefined,
          customer_selfie_url: cust?.selfie_url ?? null,
          customer_loyalty_points: cust?.loyalty_points ?? null,
        };
      });
      setAccounts(normalized as PosAccount[]);
      setLastFetchTime(new Date());
      markDataFresh();
    } catch (err) {
      console.error('[POS] Error fetching accounts:', err);
    }
  }, [markDataFresh]);

  const handleReconnect = useCallback(async () => {
    setIsRefreshing(true);
    setRealtimeStatus('reconnecting');
    await fetchAccounts();
    setIsRefreshing(false);
    setTimeout(() => {
      const allConnected = Array.from(channelStatusRef.current.values()).every(s => s === 'connected');
      const hasAny = channelStatusRef.current.size > 0;
      setRealtimeStatus(hasAny && allConnected ? 'connected' : 'disconnected');
    }, 4000);
  }, [fetchAccounts]);

  const trackChannelStatus = useCallback((name: string, status: string) => {
    if (status === 'SUBSCRIBED') {
      channelStatusRef.current.set(name, 'connected');
    } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
      channelStatusRef.current.set(name, 'disconnected');
    }
    const allConnected = Array.from(channelStatusRef.current.values()).every(s => s === 'connected');
    const hasAnyEntry = channelStatusRef.current.size > 0;
    if (hasAnyEntry) {
      setRealtimeStatus(allConnected ? 'connected' : 'disconnected');
    }
  }, []);

  const fetchWaiterCalls = useCallback(async () => {
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
    setWaiterCalls(fresh);
  }, []);

  return {
    accounts,
    setAccounts,
    waiterCalls,
    setWaiterCalls,
    realtimeStatus,
    setRealtimeStatus,
    lastFetchTime,
    setLastFetchTime,
    isRefreshing,
    setIsRefreshing,
    fetchAccounts,
    fetchWaiterCalls,
    handleReconnect,
    trackChannelStatus,
    channelStatusRef,
    isWithinAge,
    markDataFresh,
  };
}