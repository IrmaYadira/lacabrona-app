import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface PushState {
  supported: boolean;
  permission: 'granted' | 'denied' | 'default';
  subscribed: boolean;
  loading: boolean;
  error: string | null;
  isPreviewEnv: boolean;
}

export function usePushNotifications(accountId: number | null) {
  const [state, setState] = useState<PushState>({
    supported: false,
    permission: "default",
    subscribed: false,
    loading: false,
    error: null,
    isPreviewEnv: false,
  });
  const swRef = useRef<ServiceWorkerRegistration | null>(null);

  // Detectar soporte al montar
  useEffect(() => {
    const supported =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setState((prev) => ({
      ...prev,
      supported,
      permission: supported ? (Notification.permission as 'granted' | 'denied' | 'default') : "default",
    }));
  }, []);

  const requestPermission = useCallback(async () => {
    if (!state.supported) return false;
    try {
      const permission = await Notification.requestPermission();
      setState((prev) => ({ ...prev, permission }));
      return permission === "granted";
    } catch {
      return false;
    }
  }, [state.supported]);

  const subscribe = useCallback(async () => {
    if (!state.supported || !accountId) return false;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // 1. Construir ruta del SW usando la URL actual como base
      const swUrl = new URL("sw.js", window.location.href).href;

      let registration: ServiceWorkerRegistration;
      try {
        registration =
          swRef.current ?? (await navigator.serviceWorker.register(swUrl));
        swRef.current = registration;
      } catch (swErr) {
        const swMsg = swErr instanceof Error ? swErr.message : String(swErr);
        // Si el servidor devuelve HTML (preview sin archivo estático), detectarlo
        if (swMsg.includes("unsupported MIME type") || swMsg.includes("text/html")) {
          console.warn("[Push] ServiceWorker no disponible en este entorno (preview). Las notificaciones push requieren el dominio propio.");
          setState((prev) => ({
            ...prev,
            loading: false,
            error: "Las notificaciones push solo funcionan en el sitio publicado.",
            isPreviewEnv: true,
          }));
          return false;
        }
        throw swErr;
      }

      // Esperar a que el SW esté activo
      await navigator.serviceWorker.ready;

      // 2. Obtener VAPID public key
      const { data: vapidData, error: vapidErr } = await supabase.functions.invoke(
        "get-vapid-public-key",
        { method: "GET" }
      );
      if (vapidErr || !vapidData?.publicKey) {
        throw new Error(vapidErr?.message || "No se pudo obtener la clave VAPID");
      }

      // 3. Suscribirse a push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
      });

      const subJson = subscription.toJSON();
      const endpoint = subJson.endpoint ?? "";
      const keys = subJson.keys as { p256dh?: string; auth?: string } | undefined;
      const p256dh = keys?.p256dh ?? "";
      const auth = keys?.auth ?? "";

      if (!endpoint || !p256dh || !auth) {
        throw new Error("Datos de suscripción incompletos");
      }

      // 4. Guardar en Supabase
      const { error: insertErr } = await supabase.from("push_subscriptions").insert({
        account_id: accountId,
        endpoint,
        p256dh,
        auth,
      });

      if (insertErr) {
        // Si ya existe (conflicto de endpoint), ignorar
        console.warn("[Push] Insert error:", insertErr.message);
      }

      setState((prev) => ({ ...prev, subscribed: true, loading: false, isPreviewEnv: false }));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Push] Subscribe error:", msg);
      setState((prev) => ({ ...prev, error: msg, loading: false }));
      return false;
    }
  }, [state.supported, accountId]);

  const unsubscribe = useCallback(async () => {
    if (!swRef.current) return false;
    try {
      const sub = await swRef.current.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
      }
      setState((prev) => ({ ...prev, subscribed: false }));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState((prev) => ({ ...prev, error: msg }));
      return false;
    }
  }, []);

  // Auto-suscribir si ya hay permiso
  const autoSubscribeRef = useRef(false);
  useEffect(() => {
    if (
      !autoSubscribeRef.current &&
      state.supported &&
      state.permission === "granted" &&
      accountId &&
      !state.subscribed &&
      !state.loading
    ) {
      autoSubscribeRef.current = true;
      subscribe();
    }
  }, [state.supported, state.permission, state.subscribed, state.loading, accountId, subscribe]);

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe,
  };
}

// Helper para enviar push desde el frontend (POS)
export async function sendPushNotification(
  accountId: number,
  title: string,
  body: string,
  options?: { tag?: string; data?: Record<string, unknown>; actions?: Array<{ action: string; title: string }> }
) {
  try {
    const { data, error } = await supabase.functions.invoke("send-push-notification", {
      body: {
        account_id: accountId,
        title,
        body,
        tag: options?.tag ?? `la-cabrona-${Date.now()}`,
        data: options?.data ?? {},
        actions: options?.actions ?? [],
      },
    });
    if (error) {
      // Loguear más detalles para debug
      const errObj = error as unknown as { status?: number; response?: { _body?: { error?: string; detail?: string } } };
      console.error("[Push] Send error:", {
        message: error.message,
        status: errObj.status,
        body: errObj.response?._body,
      });
      return { success: false, error: error.message };
    }
    console.log("[Push] Send success:", data);
    return { success: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Push] Send exception:", msg);
    return { success: false, error: msg };
  }
}