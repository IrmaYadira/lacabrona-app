import { Suspense, lazy, useMemo, useCallback, useEffect } from "react";
import Navbar from "./components/Navbar";
import HeroSection from "./components/HeroSection";
import WelcomeModal from "./components/WelcomeModal";
import FavoriteToast from "./components/FavoriteToast";
import CartRemoveToast from "./components/CartRemoveToast";
import LazySection from "@/components/base/LazySection";
import SeoTextSection from "./components/SeoTextSection";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PausedProvider } from "./context/PausedContext";
import { useCart } from "./context/CartContext";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { usePageSEO } from "@/hooks/usePageSEO";
import { SITE_URL } from "@/lib/site-url";

// Lazy-load de secciones below-the-fold para reducir bundle inicial y mejorar LCP
const EventosSection = lazy(() => import("./components/EventosSection"));
const GallerySection = lazy(() => import("./components/GallerySection"));
const ShareExperienceSection = lazy(() => import("./components/ShareExperienceSection"));
const SidesSection = lazy(() => import("./components/SidesSection"));
const MenuSection = lazy(() => import("./components/MenuSection"));
const BonelessSection = lazy(() => import("./components/BonelessSection"));
const BurgersSection = lazy(() => import("./components/BurgersSection"));
const HotDogsSection = lazy(() => import("./components/HotDogsSection"));
const CombosSection = lazy(() => import("./components/CombosSection"));
const MicheladaSection = lazy(() => import("./components/MicheladaSection"));
const BarrilSection = lazy(() => import("./components/BarrilSection"));
const BeerSection = lazy(() => import("./components/BeerSection"));
const PacificoBeersSection = lazy(() => import("./components/PacificoBeersSection"));
const HalfBeersSection = lazy(() => import("./components/HalfBeersSection"));
const AmpolletasSection = lazy(() => import("./components/AmpolletasSection"));
const NonAlcoholicBeersSection = lazy(() => import("./components/NonAlcoholicBeersSection"));
const VasosPreparadosSection = lazy(() => import("./components/VasosPreparadosSection"));
const ShotShowsSection = lazy(() => import("./components/ShotShowsSection"));
const PreparadosSection = lazy(() => import("./components/PreparadosSection"));
const AzulitosSection = lazy(() => import("./components/AzulitosSection"));
const CannedAlcoholicSection = lazy(() => import("./components/CannedAlcoholicSection"));
const BebidasSinAlcoholSection = lazy(() => import("./components/BebidasSinAlcoholSection"));
const CigarrettesSection = lazy(() => import("./components/CigarrettesSection"));
const MisReservacionesSection = lazy(() => import("./components/MisReservacionesSection"));
const HoursSection = lazy(() => import("./components/HoursSection"));
const LocationSection = lazy(() => import("./components/LocationSection"));
const Footer = lazy(() => import("./components/Footer"));

// Lazy-load de componentes no críticos para LCP
const MenuSearchBar = lazy(() => import("./components/MenuSearchBar"));
const FavoritesSection = lazy(() => import("./components/FavoritesSection"));
const LoyaltyModal = lazy(() => import("./components/LoyaltyModal"));
const LoyaltyReminder = lazy(() => import("./components/LoyaltyReminder"));
const WhatsAppFloat = lazy(() => import("./components/WhatsAppFloat"));

const LOGO_URL = "https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285";

const LOYALTY_SESSION_KEY = 'lc_loyalty_shown';

export default function Home() {
  const [welcomeDismissed, setWelcomeDismissed] = useState(() => {
    return sessionStorage.getItem("lc_welcome_dismissed") === "true";
  });
  const [showWelcome, setShowWelcome] = useState(false);
  const [showLoyalty, setShowLoyalty] = useState(() => {
    const shownThisSession = sessionStorage.getItem(LOYALTY_SESSION_KEY) === 'true';
    if (shownThisSession) return false;
    return true;
  });
  const [showWhatsApp, setShowWhatsApp] = useState(false);

  const { settings } = useSiteSettings();

  // Prefetch del bundle de /menu en segundo plano para que cargue instantáneo al hacer clic
  useEffect(() => {
    const timer = setTimeout(() => {
      // Trigger lazy import para que Vite descargue el chunk de /menu en background
      import("../menu/page").catch(() => {
        // Silencio: si falla el prefetch, no afecta la experiencia del usuario
      });
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Diferir WhatsAppFloat hasta después del LCP para no competir con recursos críticos
  useEffect(() => {
    const timer = setTimeout(() => setShowWhatsApp(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  usePageSEO({
    title: "La Cabrona Alitas & Beer | Alitas, Hamburguesas.",
    description: "Disfruta las mejores alitas, boneless, hamburguesas y cervezas frías en La Cabrona. Ambiente familiar con billar, tequilas, preparados, cerveza de barril, en El Mante, Zapopan, Jalisco.",
    canonicalUrl: SITE_URL,
    ogImage: LOGO_URL,
    keywords: "alitas Zapopan, bar El Mante, boneless Zapopan, cervezas frías, La Cabrona bar, micheladas Zapopan, bar Jalisco",
  });

  const handleWelcomeDismiss = () => {
    setWelcomeDismissed(true);
    setShowWelcome(false);
  };

  const handleLoyaltyDismiss = () => {
    sessionStorage.setItem(LOYALTY_SESSION_KEY, 'true');
    setShowLoyalty(false);
  };

  const handleOrderNow = useCallback(() => {
    sessionStorage.removeItem("lc_welcome_dismissed");
    setShowWelcome(true);
  }, []);

  const handleOpenLoyalty = useCallback(() => {
    sessionStorage.removeItem(LOYALTY_SESSION_KEY);
    setShowLoyalty(true);
  }, []);

  const { itemCount, total, setIsOpen, favorites } = useCart();

  const showShareExperience = settings?.share_experience_enabled !== false;
  const hasFavorites = favorites.length > 0;

  // Memoizar botón flotante del carrito para evitar re-creación en cada render
  const cartButton = useMemo(() => {
    if (itemCount === 0) return null;
    return (
      <div className="fixed bottom-24 right-5 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-3 bg-gray-900 hover:bg-gray-800 active:scale-95 text-white px-5 py-3.5 rounded-2xl cursor-pointer transition-all"
        >
          <div className="relative">
            <i className="ri-shopping-basket-2-line text-xl text-amber-400" />
            <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
              {itemCount}
            </span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-xs font-bold leading-tight">{itemCount} {itemCount === 1 ? 'producto' : 'productos'}</span>
            <span className="text-sm font-black text-amber-400 leading-tight">${Number(total).toFixed(2)}</span>
          </div>
          <i className="ri-arrow-right-s-line text-white/60 text-lg" />
        </button>
      </div>
    );
  }, [itemCount, total, setIsOpen]);

  return (
    <PausedProvider>
    <div className="min-h-screen bg-white overflow-x-hidden">
      <Navbar logoUrl={LOGO_URL} onOrderNow={handleOrderNow} onOpenLoyalty={handleOpenLoyalty} />
      <HeroSection logoUrl={LOGO_URL} showLogo={welcomeDismissed} />
      {settings?.events_enabled !== false && (
        <LazySection>
          <Suspense fallback={null}>
            <EventosSection />
          </Suspense>
        </LazySection>
      )}
      <Suspense fallback={null}>
        <MenuSearchBar />
      </Suspense>
      {hasFavorites && (
        <Suspense fallback={null}>
          <FavoritesSection />
        </Suspense>
      )}
      <FavoriteToast />
      <CartRemoveToast />
      {settings?.gallery_enabled !== false && (
        <LazySection>
          <Suspense fallback={null}>
            <GallerySection />
          </Suspense>
        </LazySection>
      )}
      {showShareExperience && (
        <LazySection>
          <Suspense fallback={null}>
            <ShareExperienceSection />
          </Suspense>
        </LazySection>
      )}
      <LazySection>
        <Suspense fallback={null}>
          <SidesSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <MenuSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <BonelessSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <BurgersSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <HotDogsSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <CombosSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <MicheladaSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <BarrilSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <BeerSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <PacificoBeersSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <HalfBeersSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <AmpolletasSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <NonAlcoholicBeersSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <VasosPreparadosSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <ShotShowsSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <PreparadosSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <AzulitosSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <CannedAlcoholicSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <BebidasSinAlcoholSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <CigarrettesSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <MisReservacionesSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <HoursSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <LocationSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      </LazySection>

      {/* Sección SEO de texto descriptivo — SIN LazySection para que renderice inmediatamente y mejore text-to-HTML ratio */}
      <SeoTextSection />

      <WelcomeModal onDismiss={handleWelcomeDismiss} forceShow={showWelcome} />
      {showLoyalty && !showWelcome && (
        <Suspense fallback={null}>
          <LoyaltyModal onDismiss={handleLoyaltyDismiss} />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <LoyaltyReminder onOpenModal={handleOpenLoyalty} />
      </Suspense>
      {showWhatsApp && (
        <Suspense fallback={null}>
          <WhatsAppFloat onOrderNow={handleOrderNow} />
        </Suspense>
      )}

      {cartButton}
    </div>
    </PausedProvider>
  );
}