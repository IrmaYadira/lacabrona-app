import { useEffect, useRef } from 'react';

interface JsonLdProps {
  data: Record<string, unknown> | Record<string, unknown>[];
}

export default function JsonLd({ data }: JsonLdProps) {
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    const existing = document.getElementById('__jsonld_script');
    if (existing) {
      existing.remove();
    }

    const script = document.createElement('script');
    script.id = '__jsonld_script';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
    scriptRef.current = script;

    return () => {
      if (scriptRef.current) {
        scriptRef.current.remove();
        scriptRef.current = null;
      }
    };
  }, [data]);

  return null;
}