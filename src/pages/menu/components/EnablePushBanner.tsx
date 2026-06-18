import { useState, useCallback } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface EnablePushBannerProps {
  accountId: number | null;
}

export default function EnablePushBanner({ accountId }: EnablePushBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const { supported, permission, subscribed, loading, subscribe, requestPermission } =
    usePushNotifications(accountId);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem("lc_push_banner_dismissed", Date.now().toString());
    } catch {
      // ignore
    }
  }, []);

  // No mostrar si el usuario ya lo cerró hoy
  if (dismissed) return null;
  try {
    const dismissedAt = localStorage.getItem("lc_push_banner_dismissed");
    if (dismissedAt) {
      const hoursSince = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60);
      if (hoursSince < 24) return null;
    }
  } catch {
    // ignore
  }

  // No mostrar si no hay soporte, ya está suscrito, o fue denegado
  if (!supported) return null;
  if (subscribed) return null;
  if (permission === "denied") return null;

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleActivate = async () => {
    try {
      if (permission === "default") {
        const granted = await requestPermission();
        if (!granted) {
          showToast("error", "Permiso denegado. Activa las notificaciones en la configuración de tu navegador.");
          return;
        }
      }
      const success = await subscribe();
      if (success) {
        showToast("success", "¡Notificaciones activadas! Te avisaremos cuando tu pedido esté listo.");
      } else {
        showToast("error", "No se pudieron activar las notificaciones. Intenta de nuevo más tarde.");
      }
    } catch {
      showToast("error", "Ocurrió un error. Asegúrate de usar Chrome en tu celular.");
    }
  };

  return (
    <>
      <div className="w-full bg-amber-500 relative">
        <div className="w-full px-4 md:px-8 max-w-3xl mx-auto py-2.5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full bg-white/20 flex-shrink-0">
              <i className="ri-notification-3-line text-white text-base md:text-lg" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs md:text-sm font-semibold leading-tight">
                Activa las notificaciones
              </p>
              <p className="text-amber-100 text-[10px] md:text-xs leading-tight truncate">
                Te avisamos cuando tu pedido esté listo o haya promociones
              </p>
            </div>
            <button
              onClick={handleActivate}
              disabled={loading}
              className="flex-shrink-0 bg-white text-amber-600 text-xs font-bold px-3 md:px-4 py-1.5 md:py-2 rounded-full hover:bg-amber-50 active:bg-amber-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <i className="ri-loader-4-line animate-spin text-sm" />
                  Activando...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <i className="ri-notification-fill text-sm" />
                  Activar
                </span>
              )}
            </button>
            <button
              onClick={handleDismiss}
              className="w-7 h-7 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex-shrink-0"
              title="Cerrar"
            >
              <i className="ri-close-line text-base" />
            </button>
          </div>
        </div>

        {/* Toast flotante */}
        {toast && (
          <div
            className={`absolute top-full left-0 right-0 z-50 flex justify-center px-4 pt-2 pb-1 ${
              toast.type === "success" ? "bg-green-600" : "bg-red-600"
            }`}
            style={{ animation: "slideDown 0.3s ease-out" }}
          >
            <div className="flex items-center gap-2 text-white text-xs font-semibold">
              <i
                className={
                  toast.type === "success"
                    ? "ri-checkbox-circle-fill text-sm"
                    : "ri-error-warning-fill text-sm"
                }
              />
              <span>{toast.message}</span>
            </div>
          </div>
        )}
      </div>

      {/* Animación toast */}
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}