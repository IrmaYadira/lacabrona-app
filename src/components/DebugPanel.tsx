import { useState, useEffect, useCallback } from "react";
import { useDebugLogs, clearDebugLogs, type DebugLog } from "@/hooks/useDebugLogs";

export default function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "error" | "warn" | "api" | "supabase">("all");
  const { logs, clear } = useDebugLogs();
  const [activeTab, setActiveTab] = useState<"logs" | "storage" | "info">("logs");

  // Toggle con Ctrl + Shift + D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredLogs = filter === "all" ? logs : logs.filter((l) => l.type === filter);

  const exportLogs = useCallback(() => {
    const text = logs
      .map(
        (l) =>
          `[${l.timestamp.toLocaleTimeString()}] [${l.type.toUpperCase()}] ${l.message}${
            l.detail ? ` | ${l.detail}` : ""
          }${l.url ? ` | URL: ${l.url}` : ""}`
      )
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `debug-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs]);

  const getTypeColor = (type: DebugLog["type"]) => {
    switch (type) {
      case "error":
        return "bg-red-50 border-red-200 text-red-700";
      case "warn":
        return "bg-amber-50 border-amber-200 text-amber-700";
      case "api":
        return "bg-blue-50 border-blue-200 text-blue-700";
      case "supabase":
        return "bg-emerald-50 border-emerald-200 text-emerald-700";
      default:
        return "bg-gray-50 border-gray-200 text-gray-700";
    }
  };

  const getTypeIcon = (type: DebugLog["type"]) => {
    switch (type) {
      case "error":
        return "ri-close-circle-line";
      case "warn":
        return "ri-alert-line";
      case "api":
        return "ri-global-line";
      case "supabase":
        return "ri-database-2-line";
      default:
        return "ri-information-line";
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-[9999] w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center shadow-lg cursor-pointer hover:bg-gray-800 transition-colors"
        title="Debug Panel (Ctrl+Shift+D)"
      >
        <i className="ri-bug-line text-sm" />
        {logs.filter((l) => l.type === "error").length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-bold">
            {logs.filter((l) => l.type === "error").length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50 rounded-t-xl">
          <div className="flex items-center gap-2">
            <i className="ri-bug-line text-gray-700" />
            <h3 className="text-sm font-semibold text-gray-800">Debug Panel</h3>
            <span className="text-xs text-gray-500 ml-1">({logs.length} logs)</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={exportLogs}
              className="p-1.5 rounded-md hover:bg-gray-200 text-gray-600 cursor-pointer"
              title="Exportar logs"
            >
              <i className="ri-download-line text-sm" />
            </button>
            <button
              onClick={clear}
              className="p-1.5 rounded-md hover:bg-gray-200 text-gray-600 cursor-pointer"
              title="Limpiar logs"
            >
              <i className="ri-delete-bin-line text-sm" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-md hover:bg-gray-200 text-gray-600 cursor-pointer"
            >
              <i className="ri-close-line text-sm" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(["logs", "storage", "info"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-medium capitalize cursor-pointer transition-colors ${
                activeTab === tab
                  ? "text-amber-600 border-b-2 border-amber-500"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "logs" ? "Logs" : tab === "storage" ? "Storage" : "Info"}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === "logs" && (
          <>
            {/* Filtros */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100 overflow-x-auto">
              {(["all", "error", "warn", "api", "supabase"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    filter === f
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {f === "all" ? "Todos" : f === "error" ? "Errores" : f === "warn" ? "Warnings" : f === "api" ? "API" : "Supabase"}
                </button>
              ))}
            </div>

            {/* Lista de logs */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px]">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  <i className="ri-inbox-line text-2xl mb-2 block" />
                  No hay logs
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`rounded-lg border p-2.5 text-xs ${getTypeColor(log.type)}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <i className={getTypeIcon(log.type)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold uppercase text-[10px] tracking-wide">
                            {log.type}
                          </span>
                          <span className="text-[10px] opacity-60">
                            {log.timestamp.toLocaleTimeString()}
                          </span>
                          {log.url && (
                            <span className="text-[10px] opacity-60 truncate max-w-[120px]">
                              {log.url}
                            </span>
                          )}
                        </div>
                        <p className="font-medium break-words">{log.message}</p>
                        {log.detail && (
                          <p className="mt-1 opacity-80 break-words">{log.detail}</p>
                        )}
                        {log.stack && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-[10px] opacity-70 hover:opacity-100">
                              Stack trace
                            </summary>
                            <pre className="mt-1 text-[10px] opacity-70 whitespace-pre-wrap break-words max-h-[120px] overflow-y-auto">
                              {log.stack}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {activeTab === "storage" && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-2">localStorage</h4>
              <div className="space-y-1">
                {Object.keys(localStorage).map((key) => (
                  <div key={key} className="flex justify-between text-xs bg-gray-50 rounded p-2">
                    <span className="font-medium text-gray-700">{key}</span>
                    <span className="text-gray-500 truncate max-w-[200px] ml-2">
                      {localStorage.getItem(key)?.slice(0, 50) || "(vacío)"}
                    </span>
                  </div>
                ))}
                {Object.keys(localStorage).length === 0 && (
                  <p className="text-xs text-gray-400">localStorage vacío</p>
                )}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-2">sessionStorage</h4>
              <div className="space-y-1">
                {Object.keys(sessionStorage).map((key) => (
                  <div key={key} className="flex justify-between text-xs bg-gray-50 rounded p-2">
                    <span className="font-medium text-gray-700">{key}</span>
                    <span className="text-gray-500 truncate max-w-[200px] ml-2">
                      {sessionStorage.getItem(key)?.slice(0, 50) || "(vacío)"}
                    </span>
                  </div>
                ))}
                {Object.keys(sessionStorage).length === 0 && (
                  <p className="text-xs text-gray-400">sessionStorage vacío</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "info" && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-gray-700 mb-2">Navegador</h4>
              <div className="space-y-1 text-xs text-gray-600">
                <p><span className="font-medium">User Agent:</span> {navigator.userAgent.slice(0, 80)}...</p>
                <p><span className="font-medium">URL:</span> {window.location.href}</p>
                <p><span className="font-medium">Viewport:</span> {window.innerWidth}x{window.innerHeight}</p>
                <p><span className="font-medium">Online:</span> {navigator.onLine ? "Sí" : "No"}</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-gray-700 mb-2">Atajos</h4>
              <div className="space-y-1 text-xs text-gray-600">
                <p><span className="font-medium">Ctrl + Shift + D</span> — Abrir/cerrar este panel</p>
                <p><span className="font-medium">Exportar</span> — Descarga .txt con todos los logs</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-gray-700 mb-2">Supabase</h4>
              <div className="space-y-1 text-xs text-gray-600">
                <p><span className="font-medium">URL:</span> {import.meta.env.VITE_PUBLIC_SUPABASE_URL ? "Configurado" : "No configurado"}</p>
                <p><span className="font-medium">Anon Key:</span> {import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY ? "Configurado" : "No configurado"}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}