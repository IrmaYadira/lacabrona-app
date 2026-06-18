import type { RouteObject } from "react-router-dom";
import { Suspense, lazy } from "react";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";

// Lazy-load rutas no críticas para reducir el bundle inicial
const MenuPage = lazy(() => import("../pages/menu/page"));
const PosPage = lazy(() => import("../pages/pos/page"));
const QrPage = lazy(() => import("../pages/qr/page"));
const AdminPage = lazy(() => import("../pages/admin/page"));
const CuentaPage = lazy(() => import("../pages/cuenta/page"));
const BillarPage = lazy(() => import("../pages/billar/page"));
const RentaPage = lazy(() => import("../pages/billar/RentaPage"));
const MisCuentasPage = lazy(() => import("../pages/mis-cuentas/page"));
const BienvenidaPage = lazy(() => import("../pages/bienvenida/page"));
const BuscarCuentaPage = lazy(() => import("../pages/buscar-cuenta/page"));
const MiTarjetaPage = lazy(() => import("../pages/mi-tarjeta/page"));
const LandingPage = lazy(() => import("../pages/landing/page"));
const GraciasPage = lazy(() => import("../pages/gracias/page"));
const ReservasPage = lazy(() => import("../pages/reservas/page"));

const pageFallback = (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <div className="w-10 h-10 border-4 border-gray-200 border-t-amber-500 rounded-full animate-spin" />
  </div>
);

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
      <Suspense fallback={pageFallback}>
        <CuentaPage />
      </Suspense>
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
      <Suspense fallback={pageFallback}>
        <MisCuentasPage />
      </Suspense>
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
    path: "*",
    element: <NotFound />,
  },
];

export default routes;