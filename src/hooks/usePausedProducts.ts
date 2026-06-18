import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface PausedProduct {
  id: string;
  name: string;
  category: string;
}

type AvailAction = 'paused' | 'resumed' | 'resumed_all';

async function logAvailabilityChange(
  product_id: string,
  product_name: string,
  category: string,
  action: AvailAction,
  note?: string,
) {
  await supabase.from('product_availability_log').insert({
    product_id,
    product_name,
    category,
    action,
    note: note ?? null,
    changed_at: new Date().toISOString(),
  });
}

export function usePausedProducts() {
  const [paused, setPaused] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchPaused = useCallback(async () => {
    const { data } = await supabase
      .from('paused_products')
      .select('id');
    if (data) {
      setPaused(new Set(data.map((r: { id: string }) => r.id)));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPaused();

    // Realtime — cuando el POS pausa/activa, el menú web se actualiza al instante
    const channel = supabase
      .channel('paused-products-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paused_products' }, fetchPaused)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPaused]);

  const pauseProduct = useCallback(async (product: PausedProduct) => {
    await supabase.from('paused_products').upsert({
      id: product.id,
      name: product.name,
      category: product.category,
      paused_at: new Date().toISOString(),
    });
    await logAvailabilityChange(product.id, product.name, product.category, 'paused');
    setPaused(prev => new Set([...prev, product.id]));
  }, []);

  const resumeProduct = useCallback(async (productId: string, name?: string, category?: string) => {
    await supabase.from('paused_products').delete().eq('id', productId);
    await logAvailabilityChange(
      productId,
      name ?? productId,
      category ?? '',
      'resumed',
    );
    setPaused(prev => {
      const next = new Set(prev);
      next.delete(productId);
      return next;
    });
  }, []);

  const resumeAll = useCallback(async (pausedList?: PausedProduct[]) => {
    if (pausedList && pausedList.length > 0) {
      await Promise.all(
        pausedList.map(p =>
          logAvailabilityChange(p.id, p.name, p.category, 'resumed_all'),
        ),
      );
    }
    await supabase.from('paused_products').delete().neq('id', '');
    setPaused(new Set());
  }, []);

  const toggleProduct = useCallback(async (product: PausedProduct) => {
    if (paused.has(product.id)) {
      await resumeProduct(product.id, product.name, product.category);
    } else {
      await pauseProduct(product);
    }
  }, [paused, pauseProduct, resumeProduct]);

  const isPaused = useCallback((id: string) => paused.has(id), [paused]);

  return { paused, loading, isPaused, toggleProduct, resumeAll };
}