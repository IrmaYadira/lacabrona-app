import { useEffect } from 'react';

interface PageSEOProps {
  title: string;
  description: string;
  /** Canonical URL for this page (absolute). */
  canonicalUrl?: string;
  /** Open Graph image URL (absolute). Falls back to site logo if omitted. */
  ogImage?: string;
  /** Additional keywords for meta[name="keywords"]. */
  keywords?: string;
  /** One or more Schema.org JSON-LD objects to inject in <head>. */
  structuredData?: Record<string, unknown> | Record<string, unknown>[];
  /** If true, adds noindex, nofollow robots meta. Default false (index, follow). */
  noindex?: boolean;
}

export function usePageSEO({ title, description, canonicalUrl, ogImage, keywords, structuredData, noindex }: PageSEOProps) {
  useEffect(() => {
    const originalTitle = document.title;
    const originalDescription =
      document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
    const originalKeywords =
      document.querySelector('meta[name="keywords"]')?.getAttribute('content') ?? '';
    const originalCanonical =
      document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '';
    const originalOgUrl =
      document.querySelector('meta[property="og:url"]')?.getAttribute('content') ?? '';
    const originalOgImage =
      document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '';
    const originalTwitterImage =
      document.querySelector('meta[name="twitter:image"]')?.getAttribute('content') ?? '';
    const originalLastModified =
      document.querySelector('meta[name="last-modified"]')?.getAttribute('content') ?? '';
    const originalRobots =
      document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '';

    document.title = title;

    let metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = description;

    // Keywords
    if (keywords) {
      let metaKw = document.querySelector('meta[name="keywords"]') as HTMLMetaElement | null;
      if (!metaKw) {
        metaKw = document.createElement('meta');
        metaKw.name = 'keywords';
        document.head.appendChild(metaKw);
      }
      metaKw.content = keywords;
    }

    // Robots
    let metaRobots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!metaRobots) {
      metaRobots = document.createElement('meta');
      metaRobots.name = 'robots';
      document.head.appendChild(metaRobots);
    }
    metaRobots.content = noindex ? 'noindex, nofollow' : 'index, follow';

    // Canonical
    if (canonicalUrl) {
      let linkCan = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!linkCan) {
        linkCan = document.createElement('link');
        linkCan.rel = 'canonical';
        document.head.appendChild(linkCan);
      }
      linkCan.href = canonicalUrl;

      // og:url sync with canonical
      let ogUrl = document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null;
      if (!ogUrl) {
        ogUrl = document.createElement('meta');
        ogUrl.setAttribute('property', 'og:url');
        document.head.appendChild(ogUrl);
      }
      ogUrl.content = canonicalUrl;
    }

    // og:image
    if (ogImage) {
      let ogImg = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null;
      if (!ogImg) {
        ogImg = document.createElement('meta');
        ogImg.setAttribute('property', 'og:image');
        document.head.appendChild(ogImg);
      }
      ogImg.content = ogImage;

      // twitter:image sync
      let twImg = document.querySelector('meta[name="twitter:image"]') as HTMLMetaElement | null;
      if (!twImg) {
        twImg = document.createElement('meta');
        twImg.name = 'twitter:image';
        document.head.appendChild(twImg);
      }
      twImg.content = ogImage;
    }

    // last-modified
    const today = new Date().toISOString().split('T')[0];
    let lastMod = document.querySelector('meta[name="last-modified"]') as HTMLMetaElement | null;
    if (!lastMod) {
      lastMod = document.createElement('meta');
      lastMod.name = 'last-modified';
      document.head.appendChild(lastMod);
    }
    lastMod.content = today;

    // Remove any previously injected structured-data tags
    document.querySelectorAll('script[data-seo-structured]').forEach((el) => el.remove());

    const createdScripts: HTMLScriptElement[] = [];

    if (structuredData) {
      const items = Array.isArray(structuredData) ? structuredData : [structuredData];
      items.forEach((data, idx) => {
        const scriptTag = document.createElement('script');
        scriptTag.type = 'application/ld+json';
        scriptTag.setAttribute('data-seo-structured', String(idx));
        scriptTag.textContent = JSON.stringify(data);
        document.head.appendChild(scriptTag);
        createdScripts.push(scriptTag);
      });
    }

    return () => {
      document.title = originalTitle;
      if (metaDesc) {
        metaDesc.content = originalDescription;
      }
      if (keywords) {
        const metaKw = document.querySelector('meta[name="keywords"]') as HTMLMetaElement | null;
        if (metaKw) metaKw.content = originalKeywords;
      }
      if (canonicalUrl) {
        const linkCan = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
        if (linkCan) linkCan.href = originalCanonical;
        const ogUrl = document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null;
        if (ogUrl) ogUrl.content = originalOgUrl;
      }
      if (ogImage) {
        const ogImg = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null;
        if (ogImg) ogImg.content = originalOgImage;
        const twImg = document.querySelector('meta[name="twitter:image"]') as HTMLMetaElement | null;
        if (twImg) twImg.content = originalTwitterImage;
      }
      const lastMod = document.querySelector('meta[name="last-modified"]') as HTMLMetaElement | null;
      if (lastMod) lastMod.content = originalLastModified;

      const metaRobotsCleanup = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
      if (metaRobotsCleanup) metaRobotsCleanup.content = originalRobots;

      createdScripts.forEach((s) => s.remove());
    };
  }, [title, description, canonicalUrl, ogImage, keywords, structuredData, noindex]);
}