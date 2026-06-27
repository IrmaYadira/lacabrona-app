import { useCallback, useEffect, useRef, useState } from "react";

export interface DebugLog {
  id: string;
  type: "error" | "warn" | "info" | "api" | "supabase";
  message: string;
  detail?: string;
  timestamp: Date;
  url?: string;
  stack?: string;
}

const MAX_LOGS = 100;

let globalLogs: DebugLog[] = [];
let listeners: Set<() => void> = new Set();

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function addDebugLog(
  type: DebugLog["type"],
  message: string,
  detail?: string,
  stack?: string,
  url?: string
) {
  const log: DebugLog = {
    id: generateId(),
    type,
    message,
    detail,
    timestamp: new Date(),
    stack,
    url,
  };
  globalLogs = [log, ...globalLogs].slice(0, MAX_LOGS);
  notifyListeners();

  // También loggear a consola para desarrolladores
  const prefix = `[DEBUG ${type.toUpperCase()}]`;
  if (type === "error") {
    // eslint-disable-next-line no-console
    console.error(prefix, message, detail || "", stack || "");
  } else if (type === "warn") {
    // eslint-disable-next-line no-console
    console.warn(prefix, message, detail || "");
  } else {
    // eslint-disable-next-line no-console
    console.log(prefix, message, detail || "");
  }
}

export function getDebugLogs(): DebugLog[] {
  return [...globalLogs];
}

export function clearDebugLogs() {
  globalLogs = [];
  notifyListeners();
}

export function useDebugLogs() {
  const [logs, setLogs] = useState<DebugLog[]>(getDebugLogs);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const update = () => {
      if (isMounted.current) {
        setLogs(getDebugLogs());
      }
    };
    listeners.add(update);
    return () => {
      isMounted.current = false;
      listeners.delete(update);
    };
  }, []);

  const clear = useCallback(() => {
    clearDebugLogs();
  }, []);

  return { logs, clear };
}

export function useDebugLogCounter() {
  const [errorCount, setErrorCount] = useState(0);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const update = () => {
      if (isMounted.current) {
        setErrorCount(globalLogs.filter((l) => l.type === "error").length);
      }
    };
    listeners.add(update);
    update();
    return () => {
      isMounted.current = false;
      listeners.delete(update);
    };
  }, []);

  return errorCount;
}

// Interceptar errores globales del navegador
if (typeof window !== "undefined") {
  const originalOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    addDebugLog(
      "error",
      String(message),
      `Fuente: ${source || "unknown"}:${lineno || 0}:${colno || 0}`,
      error?.stack
    );
    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error);
    }
    return false;
  };

  const originalOnUnhandledRejection = window.onunhandledrejection;
  window.onunhandledrejection = (event) => {
    const reason = event.reason;
    addDebugLog(
      "error",
      typeof reason === "string" ? reason : reason?.message || "Promesa rechazada sin manejar",
      reason?.detail || "",
      reason?.stack
    );
    if (originalOnUnhandledRejection) {
      return originalOnUnhandledRejection(event);
    }
  };

  // ── NO interceptar console.error ni console.warn ──
  // Estos eran demasiado agresivos y capturaban ruido interno de
  // Supabase, React y otras librerías, mostrando toasts innecesarios.
  // Los errores de JS reales los capturan window.onerror y
  // window.onunhandledrejection arriba.
}