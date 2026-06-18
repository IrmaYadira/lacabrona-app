import { CartProvider } from "./pages/home/context/CartContext";
// Deploy v2: forced fresh chunks — CDN cache bust
import CartDrawer from "./pages/home/components/CartDrawer";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import PwaInstallBanner from "./components/feature/PwaInstallBanner";
import FloatingAccountButton from "./components/feature/FloatingAccountButton";
import ErrorBoundary from "./components/ErrorBoundary";
import DebugPanel from "./components/DebugPanel";
import GlobalErrorToast from "./components/GlobalErrorToast";
import { addDebugLog } from "./hooks/useDebugLogs";
import { useEffect } from "react";

// Interceptar fetch para loggear errores de API
function setupApiInterceptor() {
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = args[0]?.toString() || "";
    try {
      const response = await originalFetch.apply(this, args);
      if (!response.ok && !url.includes("supabase") && !url.includes("localhost")) {
        addDebugLog(
          "api",
          `HTTP ${response.status} en ${response.url || url}`,
          `Status: ${response.statusText}`,
          undefined,
          response.url || url
        );
      }
      return response;
    } catch (error) {
      addDebugLog(
        "api",
        `Fetch falló: ${url}`,
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error.stack : undefined,
        url
      );
      throw error;
    }
  };
}

function App() {
  useEffect(() => {
    setupApiInterceptor();
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter basename={__BASE_PATH__}>
        <CartProvider>
          <AppRoutes />
          <CartDrawer />
          <PwaInstallBanner />
          <FloatingAccountButton />
          <GlobalErrorToast />
          <DebugPanel />
        </CartProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;