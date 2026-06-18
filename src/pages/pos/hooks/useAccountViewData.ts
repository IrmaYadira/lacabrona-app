import { useState, useEffect, useCallback, useRef } from 'react';
import { supabasePos } from '../supabasePos';
import type { PosAccount, PosAccountItem } from '../types';

export function useAccountViewData(accountId: number) {
  const [account, setAccount] = useState<PosAccount | null>(null);
  const [items, setItems] = useState<PosAccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentEvents, setRecentEvents] = useState<Array<{ id: number; event_type: string; description: string; created_at: string }>>([]);
  const [customerSelfie, setCustomerSelfie] = useState<string | null>(null);
  const [customerLoyaltyPts, setCustomerLoyaltyPts] = useState<number | null>(null);
  const [selfieImgError, setSelfieImgError] = useState(false);
  const autoCloseTriggered = useRef(false);

  const fetchAccount = useCallback(async () => {
    const [{ data }, { data: evData }] = await Promise.all([
      supabasePos
        .from('pos_accounts')
        .select('*, pos_account_items(*), pos_customers(selfie_url, loyalty_points)')
        .eq('id', accountId)
        .maybeSingle(),
      supabasePos
        .from('pos_account_events')
        .select('id, event_type, description, created_at')
        .eq('account_id', accountId)
        .in('event_type', ['qty_changed', 'note_changed', 'item_deleted', 'item_edited', 'item_added_manual'])
        .order('created_at', { ascending: false })
        .limit(8),
    ]);
    if (data) {
      const custJoin = (data as Record<string, unknown>).pos_customers as { selfie_url?: string | null; loyalty_points?: number | null } | null;
      if (custJoin?.selfie_url) {
        setCustomerSelfie(custJoin.selfie_url);
        setSelfieImgError(false);
      }
      if (custJoin?.loyalty_points != null) {
        setCustomerLoyaltyPts(custJoin.loyalty_points);
      }
      setAccount(data as PosAccount);
      const sorted = [...(data.pos_account_items ?? [])].sort(
        (a: PosAccountItem, b: PosAccountItem) => a.folio_number - b.folio_number || a.id - b.id
      );
      setItems(sorted as PosAccountItem[]);
    }
    setRecentEvents((evData ?? []) as Array<{ id: number; event_type: string; description: string; created_at: string }>);
    setLoading(false);
  }, [accountId]);

  // ── Realtime subscription ──
  useEffect(() => {
    fetchAccount();
    const channel = supabasePos
      .channel(`account-${accountId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_accounts', filter: `id=eq.${accountId}` }, fetchAccount)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_account_items', filter: `account_id=eq.${accountId}` }, fetchAccount)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pos_account_events', filter: `account_id=eq.${accountId}` }, fetchAccount)
      .subscribe();
    const poll = setInterval(fetchAccount, 30_000);
    return () => {
      supabasePos.removeChannel(channel);
      clearInterval(poll);
    };
  }, [accountId, fetchAccount]);

  return {
    account,
    items,
    setItems,
    loading,
    fetchAccount,
    recentEvents,
    customerSelfie,
    customerLoyaltyPts,
    selfieImgError,
    setSelfieImgError,
    autoCloseTriggered,
  };
}