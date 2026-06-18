import { useState, useEffect } from "react";
import { useDebugLogs, type DebugLog } from "@/hooks/useDebugLogs";

export default function GlobalErrorToast() {
  const { logs } = useDebugLogs();
  const [visibleToasts, setVisibleToasts] = useState<DebugLog[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Solo mostrar errores y warnings, no info/api/supabase
  useEffect(() => {
    const errorLogs = logs.filter(
      (l) => (l.type === "error" || l.type === "warn") && !dismissed.has(l.id)
    );
    // Mostrar solo los últimos 3 no vistos
    setVisibleToasts(errorLogs.slice(0, 3));
  }, [logs, dismissed]);

  const dismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  if (visibleToasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-[9998] flex flex-col gap-2 pointer-events-none">
      {visibleToasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-lg border p-3 shadow-lg animate-slide-up max-w-md mx-auto w-full ${
            toast.type === "error"
              ? "bg-red-50 border-red-200"
              : "bg-amber-50 border-amber-200"
          }`}
        >
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i
                className={`${
                  toast.type === "error"
                    ? "ri-close-circle-line text-red-500"
                    : "ri-alert-line text-amber-500"
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-semibold ${
                  toast.type === "error" ? "text-red-700" : "text-amber-700"
                }`}
              >
                {toast.type === "error" ? "Error" : "Advertencia"}
              </p>
              <p className="text-xs text-gray-600 mt-0.5 break-words">{toast.message}</p>
              {toast.detail && (
                <p className="text-xs text-gray-500 mt-0.5 break-words">{toast.detail}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="p-1 rounded hover:bg-black/5 flex-shrink-0 cursor-pointer"
            >
              <i className="ri-close-line text-gray-400 text-sm" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}