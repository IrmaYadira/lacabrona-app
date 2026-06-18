import { addDebugLog } from "@/hooks/useDebugLogs";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Intercepta un cliente de Supabase para loggear automáticamente
 * errores en cada operación .from().select/insert/update/delete.
 */
export function interceptSupabaseErrors(client: SupabaseClient) {
  const originalFrom = client.from.bind(client);

  client.from = function (table: string) {
    const builder = originalFrom(table);
    const methodsToIntercept = ["select", "insert", "update", "delete", "upsert"] as const;

    methodsToIntercept.forEach((method) => {
      const original = (builder as unknown as Record<string, unknown>)[method];
      if (typeof original !== "function") return;

      (builder as unknown as Record<string, unknown>)[method] = function (
        ...args: unknown[]
      ) {
        const result = (original as (...args: unknown[]) => unknown).apply(builder, args);
        // Si el resultado es un builder (tiene .then), interceptar la promesa
        if (result && typeof (result as { then?: unknown }).then === "function") {
          return (result as Promise<{ error?: { message: string; details?: string; hint?: string; code?: string }; data?: unknown }>).then(
            (res) => {
              if (res.error) {
                addDebugLog(
                  "supabase",
                  `Supabase error en ${table}.${method}(): ${res.error.message}`,
                  `Code: ${res.error.code || "N/A"} | ${res.error.details || ""} ${res.error.hint || ""}`,
                  undefined,
                  table
                );
              }
              return res;
            }
          );
        }
        return result;
      };
    });

    return builder;
  };

  return client;
}