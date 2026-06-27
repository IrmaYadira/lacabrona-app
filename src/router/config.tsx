import type { RouteObject } from "react-router-dom";
import { Suspense, lazy, Component, type ReactNode } from "react";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";

// Lazy-load rutas no críticas para reducir el bundle inicial
const MenuPage = lazy(() => import("../pages/menu/page"));
const PosPage = lazy(() => import("../pages/pos/page"));
const QrPage = lazy(() => import("../pages/qr/page"));
const AdminPage = lazy(() => import("../pages/admin/page"));
const BillarPage = lazy(() => import("../pages/billar/page"));
const RentaPage = lazy(() => import("../pages/billar/RentaPage"));
// Estas páginas se importan directo (no lazy) porque crashes en lazy-load hacen que
// React Router se vaya al * (NotFound) sin que ningún ErrorBoundary lo atrape
import CuentaPage from "../pages/cuenta/page";
import MisCuentasPage from "../pages/mis-cuentas/page";
const BienvenidaPage = lazy(() => import("../pages/bienvenida/page"));
const BuscarCuentaPage = lazy(() => import("../pages/buscar-cuenta/page"));
const MiTarjetaPage = lazy(() => import("../pages/mi-tarjeta/page"));
const LandingPage = lazy(() => import("../pages/landing/page"));
const GraciasPage = lazy(() => import("../pages/gracias/page"));
const ReservasPage = lazy(() => import("../pages/reservas/page"));
const GuiaPage = lazy(() => import("../pages/guia/page"));

const pageFallback = (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <div className="w-10 h-10 border-4 border-gray-200 border-t-amber-500 rounded-full animate-spin" />
  </div>
);

// ── Error boundary por ruta: evita que un crash en un lazy component se trague el NotFound ──
interface RouteGuardState { hasError: boolean; errorMessage: string; }
class RouteGuard extends Component<{ children: ReactNode }, RouteGuardState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): RouteGuardState {
    return { hasError: true, errorMessage: error?.message || 'Error desconocido' };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log para diagnóstico — si un error derriba la ruta, queda registro
    try {
      const componentName = errorInfo.componentStack?.split('\n')[1]?.trim() || 'desconocido';
      console.error(`[RouteGuard] Error en ruta: ${error.message} | Componente: ${componentName}`, error.stack);
    } catch {
      // nunca fallar en el logger
    }
  }

  handleRetry = () => {
    // Recarga completa para forzar la descarga de chunks nuevos
    // Resetear solo el state no sirve si el chunk está stale
    window.location.reload();
  };

  handleGoBack = () => {
    window.history.back();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 text-center gap-6">
          {/* Logo */}
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-amber-500/30">
            <img
              src="https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285"
              alt="La Cabrona"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <p className="text-5xl mb-3">🤔</p>
            <h1 className="text-white text-2xl font-bold mb-2">Algo falló al cargar</h1>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              No pudimos cargar esta página. Puede ser un error temporal — intenta de nuevo.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-3">
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-2xl text-sm font-bold cursor-pointer transition-colors active:scale-95 whitespace-nowrap"
              >
                <i className="ri-refresh-line" />
                Reintentar
              </button>
              <button
                onClick={this.handleGoBack}
                className="flex items-center gap-2 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 px-5 py-3 rounded-2xl text-sm font-bold cursor-pointer transition-colors active:scale-95 whitespace-nowrap"
              >
                <i className="ri-arrow-left-line" />
                Regresar
              </button>
            </div>
            <button
              onClick={this.handleGoHome}
              className="text-gray-500 hover:text-gray-300 text-xs cursor-pointer transition-colors flex items-center gap-1"
            >
              <i className="ri-home-line" />
              Ir al inicio
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const routes: RouteObject[] = [
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/menu",
    element: (
      <Suspense fallback={pageFallback}>
        <MenuPage />
      </Suspense>
    ),
  },
  {
    path: "/pos",
    element: (
      <Suspense fallback={pageFallback}>
        <PosPage />
      </Suspense>
    ),
  },
  {
    path: "/qr",
    element: (
      <Suspense fallback={pageFallback}>
        <QrPage />
      </Suspense>
    ),
  },
  {
    path: "/admin",
    element: (
      <Suspense fallback={pageFallback}>
        <AdminPage />
      </Suspense>
    ),
  },
  {
    path: "/cuenta",
    element: (
      <RouteGuard>
        <CuentaPage />
      </RouteGuard>
    ),
  },
  {
    path: "/billar",
    element: (
      <Suspense fallback={pageFallback}>
        <BillarPage />
      </Suspense>
    ),
  },
  {
    path: "/billar/renta",
    element: (
      <Suspense fallback={pageFallback}>
        <RentaPage />
      </Suspense>
    ),
  },
  {
    path: "/mis-cuentas",
    element: (
      <RouteGuard>
        <MisCuentasPage />
      </RouteGuard>
    ),
  },
  {
    path: "/bienvenida",
    element: (
      <Suspense fallback={pageFallback}>
        <BienvenidaPage />
      </Suspense>
    ),
  },
  {
    path: "/buscar-cuenta",
    element: (
      <Suspense fallback={pageFallback}>
        <BuscarCuentaPage />
      </Suspense>
    ),
  },
  {
    path: "/mi-tarjeta",
    element: (
      <Suspense fallback={pageFallback}>
        <MiTarjetaPage />
      </Suspense>
    ),
  },
  {
    path: "/landing",
    element: (
      <Suspense fallback={pageFallback}>
        <LandingPage />
      </Suspense>
    ),
  },
  {
    path: "/gracias",
    element: (
      <Suspense fallback={pageFallback}>
        <GraciasPage />
      </Suspense>
    ),
  },
  {
    path: "/reservas",
    element: (
      <Suspense fallback={pageFallback}>
        <ReservasPage />
      </Suspense>
    ),
  },
  {
    path: "/guia",
    element: (
      <Suspense fallback={pageFallback}>
        <GuiaPage />
      </Suspense>
    ),
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;