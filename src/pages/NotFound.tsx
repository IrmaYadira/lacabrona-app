import { Link, useLocation } from "react-router-dom";
import { usePageSEO } from "@/hooks/usePageSEO";
import { SITE_URL } from "@/lib/site-url";

const LOGO_URL = "https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285";

export default function NotFound() {
  const location = useLocation();
  const path = location.pathname.toLowerCase();
  const isAdmin = path.includes("/admin");
  const isPos = path.includes("/pos");
  const isStaff = isAdmin || isPos;

  usePageSEO({
    title: "Página no encontrada | La Cabrona Alitas & Beer",
    description: "La página que buscas no existe o ya no está disponible. Vuelve al inicio y sigue disfrutando de las mejores alitas, cervezas frías y billar en Zapopan, Jalisco.",
    canonicalUrl: `${SITE_URL}/404`,
    keywords: "La Cabrona, alitas Zapopan, bar Zapopan, cervezas Zapopan",
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": `${SITE_URL}/#404`,
        "url": `${SITE_URL}/404`,
        "name": "Página no encontrada — La Cabrona Alitas & Beer",
        "isPartOf": { "@id": `${SITE_URL}/#website` }
      }
    ]
  });

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gray-900 px-6 overflow-hidden">
      {/* Logo circular */}
      <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/20 shadow-lg mb-4">
        <img
          src={LOGO_URL}
          alt="La Cabrona Alitas & Beer"
          className="w-full h-full object-cover"
        />
      </div>

      {/* 404 en ámbar */}
      <h1 className="text-[5rem] font-black text-amber-500 leading-none tracking-wider mb-4">
        404
      </h1>

      {/* Mensaje */}
      <p className="text-white text-lg md:text-xl font-medium text-center max-w-md leading-snug mb-2">
        Esta página no existe o ya no está disponible.
      </p>
      <p className="text-white text-lg md:text-xl font-medium text-center max-w-md leading-snug mb-10">
        {isStaff
          ? "Revisa la URL o regresa al panel de trabajo."
          : "Pero no te preocupes — vuelve al inicio y sigue disfrutando de las mejores alitas, cervezas y billar en Zapopan."}
      </p>

      {/* Botones públicos */}
      {!isStaff && (
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center justify-center whitespace-nowrap bg-amber-500 hover:bg-amber-400 active:scale-95 text-gray-900 font-bold px-6 py-3 rounded-lg cursor-pointer transition-all text-base"
          >
            Ir al inicio
          </Link>
          <Link
            to="/menu"
            className="flex items-center justify-center whitespace-nowrap bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/30 font-bold px-6 py-3 rounded-lg cursor-pointer transition-all text-base"
          >
            Ver el menú
          </Link>
        </div>
      )}

      {/* Botones de staff */}
      {isStaff && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            to="/admin"
            className="flex items-center justify-center gap-2 whitespace-nowrap bg-amber-500 hover:bg-amber-400 active:scale-95 text-gray-900 font-bold px-6 py-3 rounded-lg cursor-pointer transition-all text-base"
          >
            <i className="ri-dashboard-line text-lg" />
            Ir al Admin
          </Link>
          <Link
            to="/pos"
            className="flex items-center justify-center gap-2 whitespace-nowrap bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/30 font-bold px-6 py-3 rounded-lg cursor-pointer transition-all text-base"
          >
            <i className="ri-store-line text-lg" />
            Ir al POS
          </Link>
        </div>
      )}
    </div>
  );
}