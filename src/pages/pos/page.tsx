import { useState, useEffect, lazy, Suspense } from 'react';
import PosLogin from './components/PosLogin';
import { usePageSEO } from '@/hooks/usePageSEO';

const PosPanel = lazy(() => import('./components/PosPanel'));

export default function PosPage() {
  const [authenticated, setAuthenticated] = useState(false);

  // Panel POS interno del bar, no debe indexarse
  usePageSEO({
    title: 'POS | La Cabrona',
    description: 'Sistema de punto de venta interno de La Cabrona Alitas & Beer.',
    canonicalUrl: 'https://barlacabrona.com/pos',
    noindex: true,
  });

  useEffect(() => {
    if (sessionStorage.getItem('pos_auth') === '1') {
      setAuthenticated(true);
    }
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('pos_auth');
    setAuthenticated(false);
  };

  if (!authenticated) {
    return <PosLogin onLogin={() => setAuthenticated(true)} />;
  }

  const posLoader = (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm font-medium">Cargando sistema POS...</p>
      </div>
    </div>
  );

  return (
    <Suspense fallback={posLoader}>
      <PosPanel onLogout={handleLogout} />
    </Suspense>
  );
}