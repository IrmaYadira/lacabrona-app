import { useState, useRef, useEffect, type ReactNode } from "react";

interface LazyIframeProps {
  src: string;
  title: string;
  className?: string;
  rootMargin?: string;
  placeholder?: ReactNode;
  allow?: string;
  allowFullScreen?: boolean;
}

export default function LazyIframe({
  src,
  title,
  className = "",
  rootMargin = "400px",
  placeholder,
  allow,
  allowFullScreen,
}: LazyIframeProps) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={containerRef} className={className}>
      {shouldLoad ? (
        <iframe
          src={src}
          title={title}
          className="w-full h-full border-0"
          loading="lazy"
          allow={allow}
          allowFullScreen={allowFullScreen}
        />
      ) : (
        placeholder || (
          <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <i className="ri-loader-4-line text-2xl text-gray-400 animate-spin" />
            </div>
            <span className="text-gray-400 text-sm font-medium">Cargando...</span>
          </div>
        )
      )}
    </div>
  );
}