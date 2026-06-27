import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";

const LOGO_URL = "https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285";

// Rutas conocidas de la app — si el usuario estaba intentando ir a una de estas,
// probablemente fue un crash de carga y no un 404 real
const KNOWN_ROUTES = [
  '/mis-cuentas',
  '/cuenta',
  '/menu',
  '/mi-tarjeta',
  '/buscar-cuenta',
  '/billar',
  '/reservas',
  '/bienvenida',
  '/gracias',
  '/landing',
];

export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = (location?.pathname ?? '').toLowerCase();
  const isAdmin = path.includes("/admin");
  const isPos = path.includes("/pos");
  const isStaff = isAdmin || isPos;

  // ¿Es una ruta conocida que falló al cargar?
  const isKnownRoute = KNOWN_ROUTES.some(r => {
    if (path === r || path.startsWith(r + '?')) return true;
    // React Router v7 con basename puede entregar el path completo en el catch-all
    // Ej: /preview/xxx/cuenta → detectar "cuenta" al final
    const normalized = path.endsWith('/') ? path.slice(0, -1) : path;
    return normalized.endsWith(r) ||
           (r.includes('/') && normalized.endsWith(r + '/')) ||
           normalized.endsWith(r + '/');
  });

  // Extraer la ruta conocida que matchea (para navegación directa)
  const matchedKnownRoute = KNOWN_ROUTES.find(r => {
    if (path === r || path.startsWith(r + '?')) return true;
    const normalized = path.endsWith('/') ? path.slice(0, -1) : path;
    return normalized.endsWith(r) ||
           (r.includes('/') && normalized.endsWith(r + '/')) ||
           normalized.endsWith(r + '/');
  }) ?? null;

  // Debug: loguear en consola para rastrear cuándo se muestra el 404
  useEffect(() => {
    // Pequeño delay para asegurar que el log se capture completo
    const timer = setTimeout(() => {
      console.error('[NotFound] Se mostró la página 404 para:', path, 'known:', isKnownRoute, 'matched:', matchedKnownRoute);
    }, 0);
    return () => clearTimeout(timer);
  }, [path, isKnownRoute, matchedKnownRoute]);

  // Recuperación inteligente: si es ruta conocida, intentar navegar directo
  const handleRetryNavigate = () => {
    if (matchedKnownRoute) {
      // Navegar usando React Router — si el basename está bien, esto funciona
      navigate(matchedKnownRoute, { replace: true });
    } else {
      window.location.reload();
    }
  };

  const handleHardReload = () => {
    window.location.reload();
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gray-900 px-6 overflow-hidden">
      {/* Logo circular */}
      <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/20 mb-4">
        <img
          src={LOGO_URL}
          alt="La Cabrona Alitas & Beer"
          className="w-full h-full object-cover"
        />
      </div>

      {isKnownRoute && !isStaff ? (
        <>
          {/* Mensaje de error de carga */}
          <p className="text-5xl mb-3">🤔</p>
          <h1 className="text-white text-xl md:text-2xl font-bold text-center max-w-sm leading-snug mb-2">
            No se pudo cargar esta página
          </h1>
          <p className="text-gray-400 text-sm text-center max-w-xs leading-relaxed mb-8">
            Parece que hubo un error al intentar abrir esta sección. No te preocupes, suele ser algo temporal.
          </p>

          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={handleRetryNavigate}
                className="flex items-center justify-center gap-2 whitespace-nowrap bg-amber-500 hover:bg-amber-400 active:scale-95 text-gray-900 font-bold px-6 py-3 rounded-lg cursor-pointer transition-all text-base"
              >
                <i className="ri-refresh-line" />
                Reintentar
              </button>
              <Link
                to="/"
                className="flex items-center justify-center whitespace-nowrap bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/30 font-bold px-6 py-3 rounded-lg cursor-pointer transition-all text-base"
              >
                Ir al inicio
              </Link>
            </div>
            {/* Fallback: si navigate no funciona, reload duro */}
            <button
              onClick={handleHardReload}
              className="text-gray-500 hover:text-gray-300 text-xs cursor-pointer transition-colors flex items-center gap-1"
            >
              <i className="ri-restart-line" />
              ¿Sigue sin funcionar? Recargar la página completa
            </button>
          </div>
        </>
      ) : (
        <>
          {/* 404 normal */}
          <h1 className="text-[5rem] font-black text-amber-500 leading-none tracking-wider mb-4">
            404
          </h1>

          <p className="text-white text-lg md:text-xl font-medium text-center max-w-md leading-snug mb-2">
            Esta página no existe o ya no está disponible.
          </p>
          <p className="text-white text-lg md:text-xl font-medium text-center max-w-md leading-snug mb-10">
            {isStaff
              ? "Revisa la URL o regresa al panel de trabajo."
              : "Pero no te preocupes — vuelve al inicio y sigue disfrutando de las mejores alitas, cervezas y billar en Zapopan."}
          </p>

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
        </>
      )}
    </div>
  );
}