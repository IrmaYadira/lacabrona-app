import { useState, useCallback } from 'react';
import { supabasePos } from '@/pages/pos/supabasePos';

export interface LoyaltyCustomer {
  id: number;
  name: string;
  phone: string;
  birthday?: string;
  visit_count: number;
  total_spent: number;
  loyalty_points: number;
  last_visit?: string;
  selfie_url?: string | null;
}

const STORAGE_KEY = 'lc_loyalty_customer';

export function getLoyaltyCustomerFromStorage(): LoyaltyCustomer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LoyaltyCustomer;
  } catch {
    return null;
  }
}

export function saveLoyaltyCustomerToStorage(customer: LoyaltyCustomer) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customer));
}

export function useLoyaltyCustomer() {
  const [customer, setCustomer] = useState<LoyaltyCustomer | null>(() => getLoyaltyCustomerFromStorage());
  const [loading, setLoading] = useState(false);

  // Registrar nuevo cliente o hacer check-in si ya existe por teléfono.
  // accountId: ID de la cuenta abierta en el POS (opcional). Si se pasa,
  // se vincula automáticamente el customer_id para que los puntos se sumen al cerrar.
  const registerOrCheckin = useCallback(async (
    name: string,
    phone: string,
    birthday?: string,
    accountId?: number | null,
  ): Promise<LoyaltyCustomer | null> => {
    setLoading(true);
    try {
      // Limpiar espacios del teléfono para búsqueda y guardado
      const cleanPhone = phone.trim().replace(/\s/g, '');

      // Buscar por teléfono (exacto)
      const { data: existing } = await supabasePos
        .from('pos_customers')
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle();

      let result: LoyaltyCustomer;

      if (existing) {
        // Check-in: actualizar visita y last_visit
        const newVisitCount = (existing.visit_count ?? 0) + 1;
        const { data: updated } = await supabasePos
          .from('pos_customers')
          .update({
            name: name.trim(),
            birthday: birthday || existing.birthday || null,
            visit_count: newVisitCount,
            last_visit: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .maybeSingle();
        result = (updated ?? existing) as LoyaltyCustomer;
      } else {
        // Registrar nuevo
        const { data: created } = await supabasePos
          .from('pos_customers')
          .insert({
            name: name.trim(),
            phone: cleanPhone,
            birthday: birthday || null,
            visit_count: 1,
            total_spent: 0,
            loyalty_points: 0,
            last_visit: new Date().toISOString(),
          })
          .select()
          .maybeSingle();
        result = created as LoyaltyCustomer;
      }

      if (result) {
        saveLoyaltyCustomerToStorage(result);
        setCustomer(result);

        // ── Vincular el customer_id a la cuenta abierta en el POS ──
        // Esto garantiza que los puntos se sumen correctamente al cerrar la cuenta.
        // Solo se vincula si la cuenta está abierta y aún no tiene customer_id asignado.
        if (accountId && result.id) {
          try {
            const { data: accData } = await supabasePos
              .from('pos_accounts')
              .select('id, customer_id, status')
              .eq('id', accountId)
              .eq('status', 'open')
              .maybeSingle();

            if (accData && !accData.customer_id) {
              await supabasePos
                .from('pos_accounts')
                .update({
                  customer_id: result.id,
                  customer_name: result.name,
                  customer_phone: cleanPhone,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', accountId);

              // Registrar el evento de vinculación para trazabilidad
              await supabasePos.from('pos_account_events').insert({
                account_id: accountId,
                customer_id: result.id,
                event_type: 'customer_linked',
                description: `Cliente vinculado desde menú web: ${result.name} (${cleanPhone}) — ${existing ? 'Check-in' : 'Registro nuevo'}`,
                metadata: {
                  customer_name: result.name,
                  customer_phone: cleanPhone,
                  loyalty_points: result.loyalty_points,
                  is_new_customer: !existing,
                },
              });
            }
            // Si la cuenta ya tiene otro customer_id: no sobreescribir (seguridad)
          } catch (linkErr) {
            console.warn('[Loyalty] Error al vincular cuenta:', linkErr);
          }
        }
      }
      return result ?? null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Refrescar desde la BD (para ver puntos actualizados, foto, etc.)
  // Si no encuentra por ID, busca por teléfono como fallback para evitar
  // duplicados donde el POS creó otro registro con el mismo teléfono.
  const refresh = useCallback(async () => {
    const stored = getLoyaltyCustomerFromStorage();
    if (!stored?.phone) return;

    try {
      // Normalizar teléfono igual que en registerOrCheckin para evitar falsos negativos
      const cleanPhone = stored.phone.trim().replace(/\s/g, '');

      // 1) Intentar por ID primero
      if (stored.id) {
        const { data } = await supabasePos
          .from('pos_customers')
          .select('*')
          .eq('id', stored.id)
          .maybeSingle();
        if (data) {
          const fromDb = data as LoyaltyCustomer;
          if (fromDb.loyalty_points !== stored.loyalty_points) {
            // eslint-disable-next-line no-console
            console.log('[Loyalty] Puntos sincronizados:', stored.loyalty_points, '→', fromDb.loyalty_points);
          }
          const merged: LoyaltyCustomer = {
            ...fromDb,
            selfie_url: fromDb.selfie_url ?? stored.selfie_url ?? null,
          };
          saveLoyaltyCustomerToStorage(merged);
          setCustomer(merged);
          return;
        }
      }

      // 2) Fallback: buscar por teléfono normalizado (corrige IDs duplicados/desfasados y formatos inconsistentes)
      const { data: byPhone } = await supabasePos
        .from('pos_customers')
        .select('*')
        .eq('phone', cleanPhone)
        .order('loyalty_points', { ascending: false }) // el que tenga más puntos es el "bueno"
        .limit(1)
        .maybeSingle();

      if (byPhone) {
        const fromDb = byPhone as LoyaltyCustomer;
        // eslint-disable-next-line no-console
        console.log('[Loyalty] Registro encontrado por teléfono fallback:', fromDb.id, 'puntos:', fromDb.loyalty_points);
        const merged: LoyaltyCustomer = {
          ...fromDb,
          selfie_url: fromDb.selfie_url ?? stored.selfie_url ?? null,
        };
        saveLoyaltyCustomerToStorage(merged);
        setCustomer(merged);
        return;
      }

      // Si no se encontró ni por ID ni por teléfono, limpiar datos locales
      // Este caso ocurre cuando el cliente fue eliminado de la BD o el teléfono cambió en otro sistema
      console.warn('[Loyalty] No se encontró cliente por ID ni por teléfono — limpiando datos locales');
      localStorage.removeItem(STORAGE_KEY);
      setCustomer(null);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Loyalty] Error en refresh:', err);
    }
  }, []);

  // Actualizar foto localmente (para reflejo inmediato sin esperar BD)
  const updatePhotoUrl = useCallback((url: string) => {
    setCustomer(prev => {
      if (!prev) return prev;
      const updated = { ...prev, selfie_url: url };
      saveLoyaltyCustomerToStorage(updated);
      return updated;
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setCustomer(null);
  }, []);

  return { customer, loading, registerOrCheckin, refresh, logout, updatePhotoUrl };
}