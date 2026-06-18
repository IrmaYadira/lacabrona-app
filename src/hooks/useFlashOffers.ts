import { useState, useEffect, useCallback } from 'react';
import { supabasePos } from '@/pages/pos/supabasePos';

export interface FlashOffer {
  id: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  discount_pct: number;
  product_ids: number[] | null;
  category_key: string | null;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
}

export function useFlashOffers() {
  const [offers, setOffers] = useState<FlashOffer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOffers = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabasePos
        .from('flash_offers')
        .select('*')
        .eq('is_active', true)
        .lte('start_time', now)
        .gte('end_time', now)
        .order('end_time', { ascending: true })
        .limit(5);

      if (error) {
        console.warn('Flash offers query error:', error.message);
      } else {
        setOffers((data ?? []) as FlashOffer[]);
      }
    } catch (err) {
      // Error de red transitorio — ignorar silenciosamente para no romper la UI
      console.warn('Flash offers fetch skipped (network):', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOffers(false);

    // Refrescar cada minuto para sincronizar temporizadores (sin loading spinner)
    const interval = setInterval(() => fetchOffers(true), 60_000);
    return () => clearInterval(interval);
  }, [fetchOffers]);

  return { offers, loading, refresh: fetchOffers };
}

export function getTimeRemaining(endTime: string): { hours: number; minutes: number; seconds: number; totalMs: number } {
  const totalMs = Math.max(new Date(endTime).getTime() - Date.now(), 0);
  const totalSeconds = Math.floor(totalMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds, totalMs };
}