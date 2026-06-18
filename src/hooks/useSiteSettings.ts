import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface SiteSettings {
  id: number;
  share_experience_enabled: boolean;
  google_reviews_enabled: boolean;
  gallery_enabled: boolean;
  events_enabled: boolean;
  updated_at: string;
}

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('site_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (err) throw err;
      setSettings(data as SiteSettings | null);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (updates: Partial<Omit<SiteSettings, 'id' | 'updated_at'>>) => {
    try {
      const { data, error: err } = await supabase
        .from('site_settings')
        .update(updates)
        .eq('id', 1)
        .select()
        .single();
      if (err) throw err;
      setSettings(data as SiteSettings);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
    const channel = supabase
      .channel('site-settings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_settings' },
        () => {
          void fetchSettings();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchSettings]);

  // Memoizar retorno para evitar re-renders innecesarios en componentes consumidores
  return useMemo(() => ({
    settings,
    loading,
    error,
    refetch: fetchSettings,
    updateSettings,
  }), [settings, loading, error, fetchSettings, updateSettings]);
}