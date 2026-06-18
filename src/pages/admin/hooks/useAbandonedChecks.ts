import { useState, useEffect, useCallback } from 'react';
import { supabasePos } from '@/pages/pos/supabasePos';

interface AbandonedCheck {
  id: number;
  account_id: number;
  checked_at: string;
  checked_by: string | null;
  notes: string | null;
  created_at: string;
}

export function useAbandonedChecks() {
  const [checks, setChecks] = useState<AbandonedCheck[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChecks = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabasePos
      .from('pos_abandoned_checks')
      .select('*')
      .gte('checked_at', `${today}T00:00:00`)
      .order('checked_at', { ascending: false });
    if (data) setChecks(data as AbandonedCheck[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchChecks();
    const channel = supabasePos
      .channel('abandoned-checks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_abandoned_checks' }, fetchChecks)
      .subscribe();
    return () => {
      supabasePos.removeChannel(channel);
    };
  }, [fetchChecks]);

  const markAsReviewed = useCallback(async (accountId: number, checkedBy?: string, notes?: string) => {
    await supabasePos.from('pos_abandoned_checks').insert({
      account_id: accountId,
      checked_by: checkedBy || null,
      notes: notes || null,
    });
  }, []);

  const unmarkAsReviewed = useCallback(async (checkId: number) => {
    await supabasePos.from('pos_abandoned_checks').delete().eq('id', checkId);
  }, []);

  return { checks, loading, markAsReviewed, unmarkAsReviewed, refetch: fetchChecks };
}

/**
 * Determina si una cuenta ya fue revisada DESPUÉS del último pedido.
 * Si no hay items, usa la fecha de apertura de la cuenta.
 */
export function isAccountReviewed(
  accountId: number,
  checks: AbandonedCheck[],
  lastItemAt?: string
): boolean {
  const check = checks.find(c => c.account_id === accountId);
  if (!check) return false;
  const checkTime = new Date(check.checked_at).getTime();
  const referenceTime = lastItemAt ? new Date(lastItemAt).getTime() : 0;
  return checkTime > referenceTime;
}