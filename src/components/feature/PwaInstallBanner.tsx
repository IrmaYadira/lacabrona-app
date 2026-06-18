import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PwaInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed before
    const wasDismissed = localStorage.getItem('pwa_banner_dismissed');
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    // Detect iOS
    const ua = window.navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua);
    setIsIos(ios);

    if (ios) {
      // Show iOS instructions after a small delay
      setTimeout(() => setShowBanner(true), 2500);
    }

    // Android / Chrome
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 2500);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setShowBanner(false);
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem('pwa_banner_dismissed', '1');
  };

  if (isInstalled || dismissed || !showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 pb-6 bg-gradient-to-t from-gray-950 to-gray-900 border-t border-amber-700/40 shadow-2xl animate-slide-up">
      <div className="max-w-md mx-auto">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-4 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer"
        >
          <i className="ri-close-line text-xl"></i>
        </button>

        <div className="flex items-start gap-3">
          <div className="w-14 h-14 flex-shrink-0 rounded-xl overflow-hidden border border-amber-700/50">
            <img
              src="https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285"
              alt="La Cabrona Alitas & Beer"
              title="La Cabrona Alitas & Beer"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-tight">
              La Cabrona Alitas & Beer
            </p>
            <p className="text-gray-400 text-xs mt-0.5 leading-snug">
              {isIos
                ? 'Agrega la app a tu pantalla de inicio para acceso rápido'
                : 'Instala la app en tu cel — sin App Store, gratis'}
            </p>

            {isIos ? (
              <div className="mt-2 flex items-center gap-1.5 text-amber-400 text-xs">
                <i className="ri-share-forward-line text-base"></i>
                <span>Toca</span>
                <strong className="font-semibold">Compartir</strong>
                <span>→</span>
                <strong className="font-semibold">Añadir a inicio</strong>
              </div>
            ) : (
              <button
                onClick={handleInstall}
                className="mt-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full cursor-pointer whitespace-nowrap transition-colors"
              >
                Instalar app
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PwaInstallBanner;