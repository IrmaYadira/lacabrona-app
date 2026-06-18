import { useEffect, useRef, useState, useCallback } from "react";

// ── Singleton IntersectionObserver compartido ───────────────────────────
// Evita crear 20+ observers cuando hay muchos ScrollReveal en la página.
let sharedObserver: IntersectionObserver | null = null;
const callbackMap = new Map<Element, (isVisible: boolean) => void>();

function getSharedObserver(threshold: number, rootMargin: string) {
  // El observer se crea una sola vez con los parámetros del primer consumidor.
  // Esto es suficiente para la mayoría de casos; si hay conflictos de threshold,
  // se puede extender a un Map por configuración, pero para este uso es óptimo.
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const cb = callbackMap.get(entry.target);
          if (cb) cb(entry.isIntersecting);
        });
      },
      { threshold, rootMargin }
    );
  }
  return sharedObserver;
}

export function useScrollAnimation(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const hasTriggered = useRef(false);

  const callback = useCallback((visible: boolean) => {
    if (visible && !hasTriggered.current) {
      hasTriggered.current = true;
      setIsVisible(true);
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    callbackMap.set(el, callback);
    const observer = getSharedObserver(threshold, "0px 0px -50px 0px");
    observer.observe(el);

    return () => {
      callbackMap.delete(el);
      observer.unobserve(el);
      // Si no quedan elementos, desconectamos el observer para liberar memoria
      if (callbackMap.size === 0 && sharedObserver) {
        sharedObserver.disconnect();
        sharedObserver = null;
      }
    };
  }, [threshold, callback]);

  return { ref, isVisible };
}