import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import LoyaltyChip from "./LoyaltyChip";

interface NavbarProps {
  logoUrl: string;
  onOrderNow?: () => void;
  onOpenLoyalty?: () => void;
}

// Primera fila — comida
const NAV_ROW1 = [
  { label: "Galería", id: "galeria" },
  { label: "Entradas", id: "entradas" },
  { label: "Alitas", id: "alitas" },
  { label: "Boneless", id: "boneless" },
  { label: "Hamburguesas", id: "hamburguesas" },
  { label: "Hot Dogs Meños", id: "hotdogs" },
  { label: "Combos", id: "combos" },
  { label: "Micheladas", id: "micheladas" },
  { label: "Barril", id: "barril" },
  { label: "Cervezas", id: "cervezas" },
  { label: "Pacífico", id: "pacifico" },
  { label: "Medios", id: "medio-cervezas" },
];

// Segunda fila — bebidas y más
const NAV_ROW2 = [
  { label: "Ampolletas", id: "ampolletas" },
  { label: "Latas", id: "latas" },
  { label: "Sin Alcohol", id: "sin-alcohol" },
  { label: "Vasos", id: "vasos" },
  { label: "Shots", id: "caballitos" },
  { label: "Preparados", id: "preparados" },
  { label: "Azulitos", id: "azulitos" },
  { label: "Latas Alc.", id: "latas-alcohol" },
  { label: "Sin Alcohol", id: "bebidas-sin-alcohol" },
  { label: "Cigarros", id: "cigarros" },
  { label: "Horarios", id: "horarios" },
];

const ALL_ITEMS = [...NAV_ROW1, ...NAV_ROW2];

export default function Navbar({ logoUrl, onOrderNow, onOpenLoyalty }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { itemCount, setIsOpen, favorites, lastFavoriteAction, lastCartAction } = useCart();
  const navigate = useNavigate();
  const hasFavorites = favorites.length > 0;
  const [favPop, setFavPop] = useState(false);
  const [cartPop, setCartPop] = useState(false);

  // Pop animation when favorite is added/removed
  useEffect(() => {
    if (lastFavoriteAction) {
      setFavPop(true);
      const t = setTimeout(() => setFavPop(false), 600);
      return () => clearTimeout(t);
    }
  }, [lastFavoriteAction]);

  // Pop animation when item is added to cart
  useEffect(() => {
    if (lastCartAction) {
      setCartPop(true);
      const t = setTimeout(() => setCartPop(false), 600);
      return () => clearTimeout(t);
    }
  }, [lastCartAction]);

  const handleCartOpen = () => {
    if (itemCount > 0) {
      setIsOpen(true);
    } else if (onOrderNow) {
      onOrderNow();
    } else {
      setIsOpen(true);
    }
  };

  const handleVerMenu = () => {
    setMobileOpen(false);
    if (onOrderNow) {
      onOrderNow();
    } else {
      navigate("/menu");
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const rowBtnClass = (dark: boolean) =>
    `text-[11px] font-bold uppercase tracking-wide cursor-pointer whitespace-nowrap px-2.5 py-1 rounded transition-colors flex-shrink-0 ${
      dark
        ? "text-gray-200 hover:text-amber-400 hover:bg-white/10"
        : "text-gray-700 hover:text-amber-600 hover:bg-amber-50"
    }`;

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled
            ? "bg-white/97 backdrop-blur-sm border-b border-gray-100"
            : "bg-transparent"
        }`}
      >
        <div className="w-full px-3 md:px-6">
          <div className="flex items-center gap-2 h-12">
            <button
              onClick={() => scrollTo("hero")}
              className="flex items-center gap-2 cursor-pointer flex-shrink-0"
            >
              <img
                src={logoUrl}
                alt="La Cabrona Alitas & Beer"
                title="La Cabrona Alitas & Beer"
                className="h-8 w-auto object-contain"
                loading="eager"
                decoding="async"
                width="32"
                height="32"
              />
              <span
                className={`text-base font-bold font-[Bebas_Neue] tracking-wide transition-colors hidden lg:block ${
                  scrolled ? "text-gray-900" : "text-white"
                }`}
              >
                LA CABRONA
              </span>
            </button>

            <div className={`w-px h-6 flex-shrink-0 hidden md:block ${scrolled ? "bg-gray-200" : "bg-white/30"}`} />

            <div className="hidden md:flex flex-1 overflow-x-auto items-center gap-0" style={{ scrollbarWidth: "none" }}>
              {NAV_ROW1.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className={rowBtnClass(!scrolled)}
                >
                  {item.label}
                </button>
              ))}
              <div className={`w-px h-5 flex-shrink-0 mx-1 ${scrolled ? 'bg-gray-200' : 'bg-white/30'}`} />
              <Link
                to="/reservas"
                className={`text-[11px] font-bold uppercase tracking-wide cursor-pointer whitespace-nowrap px-2.5 py-1 rounded transition-colors flex-shrink-0 flex items-center gap-1 ${
                  scrolled ? 'text-amber-700 hover:bg-amber-50' : 'text-amber-300 hover:text-amber-200 hover:bg-white/10'
                }`}
              >
                <i className="ri-calendar-event-line text-[12px]" />
                Reservar
              </Link>
              <div className={`w-px h-5 flex-shrink-0 mx-1 ${scrolled ? 'bg-gray-200' : 'bg-white/30'}`} />
              <Link
                to="/billar"
                className={`text-[11px] font-bold uppercase tracking-wide cursor-pointer whitespace-nowrap px-2.5 py-1 rounded transition-colors flex-shrink-0 flex items-center gap-1 ${
                  scrolled ? 'text-amber-700 hover:bg-amber-50' : 'text-amber-300 hover:text-amber-200 hover:bg-white/10'
                }`}
              >
                🎱 Billar
              </Link>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto md:ml-0">
              <div className="hidden md:block">
                <LoyaltyChip scrolled={scrolled} onOpenModal={onOpenLoyalty ?? (() => {})} compact />
              </div>

              {hasFavorites && (
                <button
                  onClick={() => scrollTo('favoritos')}
                  className={`hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wide cursor-pointer transition-all whitespace-nowrap ${
                    favPop ? 'animate-fav-pop' : ''
                  } ${
                    scrolled
                      ? 'text-red-500 hover:bg-red-50 border border-red-200'
                      : 'text-red-300 hover:bg-white/10 border border-white/30'
                  }`}
                >
                  <i className="ri-heart-fill text-xs" />
                  Favoritos
                  <span className={`text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center ${scrolled ? 'bg-red-500 text-white' : 'bg-white/20 text-white'}`}>
                    {favorites.length}
                  </span>
                </button>
              )}

              <button
                onClick={handleVerMenu}
                className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide cursor-pointer transition-all whitespace-nowrap border-2 ${
                  scrolled
                    ? 'border-amber-500 text-amber-600 hover:bg-amber-50'
                    : 'border-white/70 text-white hover:bg-white/20'
                }`}
              >
                <i className="ri-restaurant-2-line text-sm" />
                Ver Menú
              </button>

              <button
                onClick={handleCartOpen}
                className={`relative bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide cursor-pointer transition-colors whitespace-nowrap hidden md:flex items-center gap-1.5 ${cartPop ? 'animate-fav-pop' : ''}`}
              >
                <i className={itemCount > 0 ? 'ri-bill-line' : 'ri-add-circle-line'} />
                {itemCount > 0 ? 'Mi Cuenta' : 'Ordenar'}
                {itemCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {itemCount}
                  </span>
                )}
              </button>

              {hasFavorites && (
                <button
                  onClick={() => { setMobileOpen(false); scrollTo('favoritos'); }}
                  className={`relative w-9 h-9 flex items-center justify-center cursor-pointer md:hidden ${favPop ? 'animate-fav-pop' : ''}`}
                >
                  <i className={`ri-heart-fill text-lg ${scrolled ? 'text-red-500' : 'text-red-300'}`} />
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {favorites.length}
                  </span>
                </button>
              )}

              <button
                onClick={() => { onOpenLoyalty?.(); }}
                className="relative w-9 h-9 flex items-center justify-center cursor-pointer md:hidden"
              >
                <i className={`ri-vip-crown-2-line text-xl ${scrolled ? 'text-amber-700' : 'text-amber-300'}`} />
              </button>

              <button
                onClick={handleCartOpen}
                className={`relative w-9 h-9 flex items-center justify-center cursor-pointer md:hidden ${cartPop ? 'animate-fav-pop' : ''}`}
              >
                <i className={`ri-shopping-basket-2-line text-xl ${scrolled ? "text-gray-900" : "text-white"}`} />
                {itemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {itemCount}
                  </span>
                )}
              </button>

              <button
                className="w-9 h-9 flex items-center justify-center cursor-pointer md:hidden"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                <i className={`${mobileOpen ? "ri-close-line" : "ri-menu-line"} text-xl ${scrolled ? "text-gray-900" : "text-white"}`} />
              </button>
            </div>
          </div>
        </div>

        <div
          className={`hidden md:block border-t transition-all duration-300 ${
            scrolled
              ? "border-gray-100 bg-white/97"
              : "border-white/20 bg-black/30 backdrop-blur-sm"
          }`}
        >
          <div className="w-full px-3 md:px-6">
            <div className="flex items-center overflow-x-auto gap-0 h-9" style={{ scrollbarWidth: "none" }}>
              {NAV_ROW2.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className={rowBtnClass(!scrolled)}
                >
                  {item.label}
                </button>
              ))}
              <div className={`w-px h-5 flex-shrink-0 mx-1 ${scrolled ? 'bg-gray-200' : 'bg-white/30'}`} />
              <Link
                to="/buscar-cuenta"
                className={`text-[11px] font-bold uppercase tracking-wide cursor-pointer whitespace-nowrap px-2.5 py-1 rounded transition-colors flex-shrink-0 flex items-center gap-1 ${
                  scrolled
                    ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                    : 'text-amber-300 bg-white/10 hover:text-amber-200 hover:bg-white/20'
                }`}
              >
                <i className="ri-receipt-line text-[12px]" />
                Ver mi cuenta
              </Link>
              <div className={`w-px h-5 flex-shrink-0 mx-1 ${scrolled ? 'bg-gray-200' : 'bg-white/30'}`} />
              <button
                onClick={() => { const el = document.getElementById('mis-reservaciones'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}
                className={`text-[11px] font-bold uppercase tracking-wide cursor-pointer whitespace-nowrap px-2.5 py-1 rounded transition-colors flex-shrink-0 flex items-center gap-1 ${
                  scrolled
                    ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                    : 'text-amber-300 bg-white/10 hover:text-amber-200 hover:bg-white/20'
                }`}
              >
                <i className="ri-calendar-check-line text-[12px]" />
                Mis Reservas
              </button>
              <div className={`w-px h-5 flex-shrink-0 mx-1 ${scrolled ? 'bg-gray-200' : 'bg-white/30'}`} />
              <LoyaltyChip scrolled={scrolled} onOpenModal={onOpenLoyalty ?? (() => {})} />
            </div>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 max-h-[75vh] overflow-y-auto">
            <div className="px-4 py-3 grid grid-cols-2 gap-1">
              {hasFavorites && (
                <button
                  onClick={() => scrollTo('favoritos')}
                  className="text-left text-red-600 text-sm font-semibold uppercase tracking-wide py-2.5 px-3 rounded-lg hover:bg-red-50 cursor-pointer transition-colors flex items-center gap-2 col-span-2"
                >
                  <i className="ri-heart-fill text-sm" />
                  Mis Favoritos ({favorites.length})
                </button>
              )}
              {ALL_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className="text-left text-gray-800 text-sm font-semibold uppercase tracking-wide py-2.5 px-3 rounded-lg hover:bg-amber-50 hover:text-amber-700 cursor-pointer transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="px-4 pt-1 pb-2 flex flex-col gap-2">
              <button
                onClick={handleVerMenu}
                className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wide cursor-pointer whitespace-nowrap transition-colors"
              >
                <i className="ri-restaurant-2-line text-amber-400" />
                <span>Ver Menú Completo</span>
                <i className="ri-arrow-right-s-line text-amber-400" />
              </button>
              <Link
                to="/buscar-cuenta"
                onClick={() => setMobileOpen(false)}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide cursor-pointer whitespace-nowrap transition-colors"
              >
                <i className="ri-receipt-line" />
                Ver mi cuenta
              </Link>
              <button
                onClick={() => { setMobileOpen(false); onOpenLoyalty?.(); }}
                className="w-full flex items-center justify-center gap-2 border border-amber-400 text-amber-700 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide cursor-pointer whitespace-nowrap hover:bg-amber-50 transition-colors"
              >
                <i className="ri-vip-crown-2-line" />
                Mis puntos de lealtad
              </button>
              <Link
                to="/billar"
                onClick={() => setMobileOpen(false)}
                className="w-full flex items-center justify-center gap-2 border border-amber-400 text-amber-700 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide cursor-pointer whitespace-nowrap hover:bg-amber-50 transition-colors"
              >
                <span>🎱</span> Reglamento de Billar
              </Link>
              <Link
                to="/billar/renta"
                onClick={() => setMobileOpen(false)}
                className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide cursor-pointer whitespace-nowrap transition-colors"
              >
                <span>🎱</span> Mesas de Billar
              </Link>
              <Link
                to="/reservas"
                onClick={() => setMobileOpen(false)}
                className="w-full flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-800 text-white px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide cursor-pointer whitespace-nowrap transition-colors"
              >
                <i className="ri-calendar-event-line" /> Reservar Mesa
              </Link>
              <button
                onClick={() => { setMobileOpen(false); const el = document.getElementById('mis-reservaciones'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}
                className="w-full flex items-center justify-center gap-2 border border-amber-400 text-amber-700 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide cursor-pointer whitespace-nowrap hover:bg-amber-50 transition-colors"
              >
                <i className="ri-calendar-check-line" /> Mis Reservaciones
              </button>
            </div>
            <div className="px-4 pb-4 pt-1">
              <button
                onClick={() => { setMobileOpen(false); handleCartOpen(); }}
                className="w-full bg-amber-500 text-white px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wide cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                <i className={itemCount > 0 ? 'ri-bill-line' : 'ri-add-circle-line'} />
                {itemCount > 0 ? `Mi Cuenta (${itemCount})` : 'Ordenar Ahora'}
              </button>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}