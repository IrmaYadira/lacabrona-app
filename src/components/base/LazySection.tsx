import { Suspense, lazy, useRef, useState, useEffect, ComponentType } from 'react';

interface LazySectionProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}

// Fallback más sutil: ocupa menos espacio y no muestra spinner pesado
const DEFAULT_FALLBACK = (
  <div className="min-h-[80px]" aria-hidden="true" />
);

/**
 * LazySection — carga su contenido solo cuando el viewport se acerca a la sección.
 * Ideal para secciones "below the fold" que no son críticas en el primer paint.
 */
export default function LazySection({
  children,
  fallback = DEFAULT_FALLBACK,
  threshold = 0,
  rootMargin = '400px 0px',
  once = true,
}: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldRender(true);
            if (once) {
              observer.unobserve(el);
            }
          } else if (!once) {
            setShouldRender(false);
          }
        });
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return (
    <div ref={ref} className="min-h-[1px]">
      {shouldRender ? children : fallback}
    </div>
  );
}

/**
 * lazyLoadComponent — helper para crear un componente lazy-loaded con Suspense.
 * Usa React.lazy() bajo el hood.
 */
export function lazyLoadComponent<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(factory);
}