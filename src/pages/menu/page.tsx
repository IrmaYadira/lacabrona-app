import { useState, useCallback, useEffect } from "react";
import { useCart, type CartItem } from "@/pages/home/context/CartContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import JsonLd from "@/components/JsonLd";
import MenuTour from "@/components/feature/MenuTour";
import { menuTourSteps } from "./menuTourSteps";
import EnablePushBanner from "./components/EnablePushBanner";
import SessionChip from "./components/SessionChip";
import CompactFAB from "./components/CompactFAB";
import FlashOffersBanner from "./components/FlashOffersBanner";
import LoyaltyPointsBadge from "./components/LoyaltyPointsBadge";
import PointsToastContainer, { notifyPointsEarned } from "./components/PointsToast";
import OfferToastContainer, { notifyOfferApplied } from "./components/OfferToast";
import ConfettiOverlay, { useConfetti } from "./components/ConfettiOverlay";
import FloatingSavings, { showFloatingSavings } from "./components/FloatingSavings";
import BurgerOptionsModal from "@/pages/home/components/BurgerOptionsModal";
import WingSauceModal from "@/pages/home/components/WingSauceModal";
import MicheladaFlavorModal from "@/pages/home/components/MicheladaFlavorModal";
import ProductNoteModal from "./components/ProductNoteModal";
import FirstTimeBanner from "./components/FirstTimeBanner";
import {
  wingsMenu,
  bonelessMenu,
  beerMenu,
  halfBeersMenu,
  pacificoBeersMenu,
  ampolletasMenu,
  nonAlcoholicBeersMenu,
  micheladaMenu,
  micheladaConCamaronMenu,
  sidesMenu,
  hotDogsMenu,
  burgersMenu,
  comboMenu,
  sodasMenu,
  shotShowsMenu,
  preparadosMenu,
  vasosPreparadosMenu,
  azulitosMenu,
  barInfo,
  cannedAlcoholicMenu,
  cigarettesMenu,
  barrilMenu,
} from "@/mocks/menu";

import { playOfferSound } from "./utils/offerSound";
import { supabase } from "@/lib/supabase";

/**
 * Convierte el ID numérico de un item + key de categoría al ID usado en paused_products.
 * Debe coincidir exactamente con PausarProductosView y MenuPickerModal.
 */
function getCategoryPausedKey(itemId: number, catKey: string): string {
  switch (catKey) {
    case 'alitas':
      if (itemId === 1) return 'wing-media';
      if (itemId === 2) return 'wing-completa';
      return String(itemId);
    case 'boneless':
      if (itemId === 101) return 'boneless-media';
      if (itemId === 102) return 'boneless-completa';
      return 'boneless-main';
    case 'hamburguesas':
      return `burg-${itemId - 400}`; // id = 400 + burger.id
    case 'hotdogs':
      return `hdog-${itemId - 300}`; // id = 300 + hotdog.id
    case 'entradas':
      return `side-${itemId - 200}`; // id = 200 + side.id
    case 'combos':
      return `combo-${itemId - 300}`; // id = 300 + combo.id
    case 'cervezas':
      return String(itemId - 5000); // beerMenu ids originales para paused_products
    case 'pacifico':
      return `pac-${itemId - 900}`;
    case 'medio-cervezas':
      if (itemId === 7999) return '7999';
      return `half-${itemId - 8000}`; // halfBeerGroups idx
    case 'ampolletas':
      return `amp-${itemId - 850}`;
    case 'sin-alcohol':
      return `na-${itemId - 950}`;
    case 'rusas':
    case 'vasos':
      return `vaso-${itemId - 500}`;
    case 'caballitos': {
      // IDs expandidos: 60101 → shot original 1; IDs antiguos: 600 + id original
      if (itemId >= 60100) return `shot-${Math.floor((itemId - 60100) / 10)}`;
      return `shot-${itemId - 600}`;
    }
    case 'preparados': {
      // IDs expandidos: 70101 → prep original 1; IDs antiguos: 700 + id original
      if (itemId >= 70100) return `prep-${Math.floor((itemId - 70100) / 10)}-sencillo`;
      return `prep-${itemId - 700}-sencillo`;
    }
    case 'azulitos':
      return `azul-${itemId - 900}`;
    case 'latas-alcohol':
      return `can-${itemId - 420}`;
    case 'barril':
      return `barril-${itemId - 1200}`;
    case 'cigarros':
      return `cig-${itemId - 1100}`;
    case 'refrescos':
      return `soda-${itemId - 400}`;
    case 'micheladas':
      return String(itemId); // 1000, 1001
    default:
      return String(itemId);
  }
}

/** Hook local para leer productos pausados en tiempo real */
function useMenuPaused(): Set<string> {
  const [paused, setPaused] = useState<Set<string>>(new Set());

  const fetchPaused = useCallback(async () => {
    const { data } = await supabase.from("paused_products").select("id");
    if (data) setPaused(new Set(data.map((r: { id: string }) => r.id)));
  }, []);

  useEffect(() => {
    fetchPaused();
    const channel = supabase
      .channel("menu-page-paused")
      .on("postgres_changes", { event: "*", schema: "public", table: "paused_products" }, fetchPaused)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPaused]);

  return paused;
}

const LOGO_URL = "https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285";

const MENU_JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://barlacabrona.com/" },
        { "@type": "ListItem", "position": 2, "name": "Menu", "item": "https://barlacabrona.com/menu" }
      ]
    },
    {
      "@type": "Menu",
      "name": "Menu de La Cabrona Alitas & Beer",
      "description": "Menu completo de alitas, boneless, hamburguesas, cervezas y bebidas en La Cabrona Zapopan, Jalisco.",
      "hasMenuSection": [
        { "@type": "MenuSection", "name": "Alitas y Boneless", "description": "12 sabores disponibles en alitas y boneless. Media orden (5 pzas) y orden completa (10 pzas).", "hasMenuItem": [
          { "@type": "MenuItem", "name": "Orden Completa de Alitas (10 piezas)", "description": "Alitas de pollo crujientes y jugosas, fritas a la perfeccion y banadas en la salsa de tu eleccion. Servidas con aderezo ranch, zanahorias y apio.", "offers": { "@type": "Offer", "price": 190, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Media Orden de Alitas (5 piezas)", "description": "5 alitas crujientes con la salsa de tu eleccion entre 12 sabores. Servidas con aderezo ranch.", "offers": { "@type": "Offer", "price": 95, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Orden Completa de Boneless (10 piezas)", "description": "Trocitos de pechuga de pollo empanizados y fritos, crujientes por fuera y jugosos por dentro. 12 sabores disponibles.", "offers": { "@type": "Offer", "price": 190, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Media Orden de Boneless (5 piezas)", "description": "5 boneless empanizados con la salsa de tu eleccion. Servidos con aderezo ranch.", "offers": { "@type": "Offer", "price": 95, "priceCurrency": "MXN" } }
        ] },
        { "@type": "MenuSection", "name": "Hamburguesas", "description": "Hamburguesas artesanales con carne de res de primera calidad y pan recien horneado.", "hasMenuItem": [
          { "@type": "MenuItem", "name": "Hamburguesa de Sirloin con Tocino", "description": "Jugosa carne de sirloin a la parrilla con tocino crujiente, lechuga, jitomate, cebolla y aderezos. Incluye acompanamiento.", "offers": { "@type": "Offer", "price": 95, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Hamburguesa de Res con Tocino", "description": "Carne de res a la parrilla con tocino crujiente, queso cheddar, lechuga, jitomate y cebolla.", "offers": { "@type": "Offer", "price": 95, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Hamburguesa de Pollo", "description": "Pechuga de pollo empanizada y dorada con lechuga, jitomate, cebolla y aderezos.", "offers": { "@type": "Offer", "price": 95, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Hamburguesa Doble Carne con Tocino", "description": "Doble carne de res a la parrilla con tocino crujiente, doble queso, lechuga, jitomate y cebolla.", "offers": { "@type": "Offer", "price": 115, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Hamburguesa Cielo, Mar y Tierra", "description": "La mas cabrona: res, pollo empanizado y camarones cocidos con queso blanco, lechuga, jitomate y cebolla.", "offers": { "@type": "Offer", "price": 120, "priceCurrency": "MXN" } }
        ] },
        { "@type": "MenuSection", "name": "Hot Dogs", "description": "Hot dogs estilo norteno con ingredientes generosos y salsas caseras.", "hasMenuItem": [
          { "@type": "MenuItem", "name": "Hot Dog Menos Sencillo", "description": "Salchicha cocida con crema, mayonesa, jitomate, cebolla, cebolla guisada, sal y panela en pan de buenas noches de Bimbo.", "offers": { "@type": "Offer", "price": 25, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Hot Dog Menos con Papas Doradas", "description": "Hot dog norteno clasico acompanado de papas doradas crujientes.", "offers": { "@type": "Offer", "price": 40, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Hot Dog Menos con Papas a la Francesa", "description": "Hot dog norteno clasico acompanado de clasicas papas a la francesa doradas.", "offers": { "@type": "Offer", "price": 65, "priceCurrency": "MXN" } }
        ] },
        { "@type": "MenuSection", "name": "Micheladas", "description": "Micheladas de 1 litro con cerveza, limon, salsa inglesa y clamato. 4 sabores disponibles.", "hasMenuItem": [
          { "@type": "MenuItem", "name": "Michelada 1 Litro", "description": "Michelada de 1 litro preparada con cerveza fria, sal, limon, tajin, tabasco, salsas negras, pimienta negra, chamoy y hielo. 4 sabores: Clamato, Tamarindo, Mango y Pina.", "offers": { "@type": "Offer", "price": 90, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Michelada 1 Litro con Camaron", "description": "Michelada de 1 litro con camaron fresco. Preparada con cerveza fria, sal, limon, tajin, tabasco, salsas negras y chamoy.", "offers": { "@type": "Offer", "price": 110, "priceCurrency": "MXN" } }
        ] },
        { "@type": "MenuSection", "name": "Cervezas", "description": "Cervezas nacionales e importadas: Corona, Pacifico, Modelo, Victoria, Heineken y mas.", "hasMenuItem": [
          { "@type": "MenuItem", "name": "Mega Corona Extra (1.2L)", "description": "Corona Extra de 1.2 litros bien fria. Para compartir o para los verdaderos cabrones.", "offers": { "@type": "Offer", "price": 85, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Mega Victoria (1.2L)", "description": "Cerveza tradicional mexicana Victoria de 1.2 litros bien fria.", "offers": { "@type": "Offer", "price": 85, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Mega Pacifico (1.2L)", "description": "Pacifico de 1.2 litros. Clara, suave y cabrona para compartir.", "offers": { "@type": "Offer", "price": 90, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Medio Corona Extra Clara (355ml)", "description": "Media cerveza Corona Extra Clara en botella bien fria, espumosa y refrescante.", "offers": { "@type": "Offer", "price": 40, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Cubeta 10 Coronas Extra (355ml)", "description": "Cubeta con 10 cervezas Corona Extra de medio bien frias con hielo. Para compartir en la mesa.", "offers": { "@type": "Offer", "price": 350, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Ampolleta Corona Extra Clara (210ml)", "description": "Corona Extra en presentacion ampolleta de 210ml. Clara, ligera y bien fria.", "offers": { "@type": "Offer", "price": 20, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Barril Clara XX Lager (1L)", "description": "Cerveza de barril XX Lager directo del barril. Clara, refrescante y bien tirada.", "offers": { "@type": "Offer", "price": 75, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Barril Oscura Indio (1L)", "description": "Cerveza de barril Indio oscura. Cuerpo robusto con notas tostadas y espuma cremosa.", "offers": { "@type": "Offer", "price": 65, "priceCurrency": "MXN" } }
        ] },
        { "@type": "MenuSection", "name": "Bebidas Preparadas", "description": "Vasos preparados, shots, preparados, azulitos, charros y rusas.", "hasMenuItem": [
          { "@type": "MenuItem", "name": "Vaso Chelado", "description": "Sal, limon y hielo. El clasico preparado para refrescar tu cerveza.", "offers": { "@type": "Offer", "price": 19, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Vaso Clamatado", "description": "Clamato, sal, limon, salsas negras y hielo. El clasico vaso clamatado bien preparado.", "offers": { "@type": "Offer", "price": 55, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Litro de Clamatado", "description": "Litro cabron de clamato con limon, sal, salsas negras y hielo. Para compartir o para los que aguantan.", "offers": { "@type": "Offer", "price": 100, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Rusa de Squirt", "description": "Squirt bien frio con agua mineral, hielo, sal y limon. Refrescante y sin alcohol.", "offers": { "@type": "Offer", "price": 40, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Shot Centenario Reposado 30ml", "description": "Shot de tequila Centenario Reposado de 30ml. El destilado puro para pistear como un cabron.", "offers": { "@type": "Offer", "price": 60, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Shot Red Label 30ml", "description": "Shot de whisky Johnnie Walker Red Label de 30ml.", "offers": { "@type": "Offer", "price": 65, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Bacacho (Bacardi + Coca-Cola)", "description": "30ml de Bacardi con Coca-Cola, agua mineral y hielo. El clasico preparado de ron.", "offers": { "@type": "Offer", "price": 60, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Tequilita (Centenario + Squirt)", "description": "30ml de Centenario Reposado con Squirt, agua mineral y hielo. Tequila bien preparado.", "offers": { "@type": "Offer", "price": 70, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Azulito Medio Litro", "description": "Preparado azulito con vodka, licor de naranja, curacao azul, chamoy de moras azules, Sprite y hielo.", "offers": { "@type": "Offer", "price": 70, "priceCurrency": "MXN" } },
          { "@type": "MenuItem", "name": "Charro Guero 1 Litro", "description": "Preparado charro guero con tequila de casa, limon, sal, hielo, agua mineral y Squirt.", "offers": { "@type": "Offer", "price": 80, "priceCurrency": "MXN" } }
        ] }
      ],
      "inLanguage": "es",
      "offers": {
        "@type": "Offer",
        "availability": "https://schema.org/InStock",
        "priceCurrency": "MXN"
      }
    }
  ]
};

interface MenuCategory {
  key: string;
  label: string;
  emoji: string;
  image?: string;
  items: MenuItem[];
  isCombo?: boolean;
  hasVariants?: boolean;
  hasSauces?: boolean;
}

interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  priceLabel?: string;
  tags?: string[];
  variants?: string[];
  sauces?: { name: string; color: string; spiceLevel: number }[];
  flavors?: { name: string; color: string; description: string }[];
  image?: string;
}

function buildCategories(): MenuCategory[] {
  const cats: MenuCategory[] = [];

  // Entradas
  cats.push({
    key: "entradas",
    label: "Entradas & Botana",
    emoji: "🍟",
    image: "https://readdy.ai/api/search-image?query=mexican%20bar%20appetizer%20platter%20with%20crispy%20chicken%20wings%20nachos%20cheese%20sticks%20onion%20rings%20potato%20wedges%20arranged%20on%20dark%20wooden%20board%20warm%20amber%20lighting%20restaurant%20food%20photography%20overhead%20shot%20appetizing%20dark%20moody%20background&width=400&height=250&seq=menu-entradas-banner&orientation=landscape",
    items: sidesMenu.map((s) => ({
      id: 200 + s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      image: s.image,
    })),
  });

  // Alitas
  cats.push({
    key: "alitas",
    label: "Alitas",
    emoji: "🍗",
    image: "https://readdy.ai/api/search-image?query=crispy%20golden%20fried%20chicken%20wings%20pile%20with%20saucy%20glaze%20on%20dark%20rustic%20wooden%20board%20restaurant%20food%20photography%20warm%20lighting%20appetizing%20close%20up%20dark%20background&width=400&height=250&seq=menu-alitas-banner&orientation=landscape",
    items: [
      {
        id: 1,
        name: "Orden Completa de Alitas (10 PIEZAS)",
        description: `${wingsMenu.description} 10 piezas. Elige una de nuestras 12 salsas.`,
        price: wingsMenu.prices["Orden Completa (10 pzas)"],
        image: wingsMenu.image,
        tags: ["10 piezas", "12 salsas"],
        sauces: wingsMenu.sauces,
      },
      {
        id: 2,
        name: "Media Orden de Alitas (5 PIEZAS)",
        description: `${wingsMenu.description} 5 piezas. Elige una de nuestras 12 salsas.`,
        price: wingsMenu.prices["Media Orden (5 pzas)"],
        image: wingsMenu.image,
        tags: ["5 piezas", "12 salsas"],
        sauces: wingsMenu.sauces,
      },
    ],
  });

  // Boneless
  cats.push({
    key: "boneless",
    label: "Boneless",
    emoji: "🍗",
    image: "https://readdy.ai/api/search-image?query=golden%20crispy%20boneless%20chicken%20bites%20pile%20with%20dipping%20sauce%20on%20dark%20rustic%20wooden%20board%20restaurant%20food%20photography%20warm%20lighting%20appetizing%20close%20up%20dark%20background&width=400&height=250&seq=menu-boneless-banner&orientation=landscape",
    items: [
      {
        id: 101,
        name: "Orden Completa de Boneless (10 PIEZAS)",
        description: `${bonelessMenu.description} 10 piezas. Elige una de nuestras 12 salsas.`,
        price: bonelessMenu.prices["Orden Completa (10 pzas)"],
        image: bonelessMenu.image,
        tags: ["10 piezas", "12 salsas"],
        sauces: bonelessMenu.sauces,
      },
      {
        id: 102,
        name: "Media Orden de Boneless (5 PIEZAS)",
        description: `${bonelessMenu.description} 5 piezas. Elige una de nuestras 12 salsas.`,
        price: bonelessMenu.prices["Media Orden (5 pzas)"],
        image: bonelessMenu.image,
        tags: ["5 piezas", "12 salsas"],
        sauces: bonelessMenu.sauces,
      },
    ],
  });

  // Hamburguesas
  cats.push({
    key: "hamburguesas",
    label: "Hamburguesas",
    emoji: "🍔",
    image: "https://readdy.ai/api/search-image?query=juicy%20beef%20burger%20with%20bacon%20lettuce%20tomato%20on%20soft%20plain%20white%20round%20hamburger%20bun%20mexican%20style%20with%20fries%20on%20dark%20wooden%20board%20warm%20lighting%20restaurant%20food%20photography%20appetizing%20close%20up%20dark%20background&width=400&height=250&seq=menu-burgers-banner-v3&orientation=landscape",
    items: burgersMenu.map((s) => ({
      id: 400 + s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      image: s.image,
    })),
  });

  // Hot Dogs
  cats.push({
    key: "hotdogs",
    label: "Hot Dogs Meños",
    emoji: "🌭",
    image: "https://readdy.ai/api/search-image?query=mexican%20style%20hot%20dogs%20with%20toppings%20on%20dark%20wooden%20board%20warm%20lighting%20restaurant%20food%20photography%20appetizing%20close%20up%20dark%20background&width=400&height=250&seq=menu-hotdogs-banner&orientation=landscape",
    items: hotDogsMenu.map((s) => ({
      id: 300 + s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      image: s.image,
    })),
  });

  // Combos
  cats.push({
    key: "combos",
    label: "Combos",
    emoji: "🎉",
    image: "https://readdy.ai/api/search-image?query=combo%20meal%20platter%20with%20chicken%20wings%20french%20fries%20beer%20bottles%20on%20rustic%20wooden%20table%20food%20photography%20warm%20lighting%20appetizing%20dark%20background%20restaurant%20presentation&width=400&height=250&seq=menu-combos-banner&orientation=landscape",
    isCombo: true,
    items: comboMenu.map((s) => ({
      id: 300 + s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      image: s.image,
      tags: s.popular ? ["Más Popular"] : undefined,
    })),
  });

  // Micheladas
  cats.push({
    key: "micheladas",
    label: "Micheladas",
    emoji: "🍺",
    image: "https://readdy.ai/api/search-image?query=michelada%20drink%20in%20large%20frosted%20glass%20with%20beer%20tomato%20juice%20lime%20wedge%20chili%20rim%20on%20dark%20bar%20counter%20photography%20dark%20background%20warm%20lighting%20refreshing%20mexican%20cocktail&width=400&height=250&seq=menu-micheladas-banner&orientation=landscape",
    items: [
      {
        id: 1000,
        name: "Michelada 1 Litro",
        description: `${micheladaMenu.description} Elige uno de nuestros 4 sabores.`,
        price: micheladaMenu.price,
        image: micheladaMenu.image,
        tags: ["1 Litro", "4 sabores"],
        flavors: micheladaMenu.flavors,
      },
      {
        id: 1001,
        name: "Michelada 1 Litro con Camarón",
        description: `${micheladaConCamaronMenu.description}`,
        price: micheladaConCamaronMenu.price,
        image: micheladaConCamaronMenu.image,
        tags: ["1 Litro", "Con Camarón", "4 sabores"],
        flavors: micheladaMenu.flavors,
      },
    ],
  });

  // Cervezas Corona — items individuales como en la home
  cats.push({
    key: "cervezas",
    label: "Cervezas Corona",
    emoji: "🍻",
    image: "https://readdy.ai/api/search-image?query=large%20corona%20extra%20beer%20bottle%20with%20lime%20wedge%20on%20dark%20bar%20counter%20cold%20condensation%20warm%20lighting%20restaurant%20photography%20dark%20background%20refreshing%20mexican%20beer&width=400&height=250&seq=menu-corona-banner&orientation=landscape",
    items: beerMenu.map((s) => ({
      id: 5000 + s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      image: s.image,
      tags: s.tags,
    })),
  });

  // Cerveza Pacífico
  cats.push({
    key: "pacifico",
    label: "Cerveza Pacífico",
    emoji: "🍺",
    image: "https://hebmx.vtexassets.com/arquivos/ids/687905/769765_1278437958.jpg?v=638520927139300000",
    items: pacificoBeersMenu.map((s) => ({
      id: 900 + s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      image: s.image,
      tags: s.tags,
    })),
  });

  // Cervezas de Medio
  const halfBeersByPrice: Record<number, typeof halfBeersMenu> = {};
  halfBeersMenu.forEach((s) => {
    if (!halfBeersByPrice[s.price]) halfBeersByPrice[s.price] = [];
    halfBeersByPrice[s.price].push(s);
  });
  const halfBeerGroups = Object.entries(halfBeersByPrice)
    .map(([price, items]) => ({ price: Number(price), items }))
    .sort((a, b) => a.price - b.price);

  const halfBeerMenuItems: MenuItem[] = [
    {
      id: 7999,
      name: "CUBETA 10 CORONAS EXTRA (355ml)",
      description: "Cubeta con 10 cervezas Corona Extra de medio (355ml) bien frías con hielo. También disponibles: Corona Oscura, Victoria, Corona Light, Pacífico o combinadas al gusto.",
      price: 350,
      image: halfBeersMenu[0]?.image || "",
      tags: ["Promo", "10 cervezas", "Cubeta", "Para compartir"],
    },
    ...halfBeerGroups.map((group, idx) => {
      const names = group.items.map((i) => i.name.replace("Medio ", "")).join(", ");
      return {
        id: 8000 + idx,
        name: `Cerveza de Medio (355ml) — $${group.price.toFixed(0)}`,
        description: `Cervezas de 355ml disponibles: ${names}.`,
        price: group.price,
        image: group.items[0]?.image || "",
        tags: group.items.map((i) => i.name.replace("Medio ", "")),
      };
    }),
  ];

  cats.push({
    key: "medio-cervezas",
    label: "Cervezas de Medio",
    emoji: "🍺",
    image: "https://images-mm.s3.amazonaws.com/Screenshot2017bucketledCopy.png",
    items: halfBeerMenuItems,
  });

  // Ampolletas
  cats.push({
    key: "ampolletas",
    label: "Ampolletas",
    emoji: "🍺",
    image: "https://readdy.ai/api/search-image?query=small%20beer%20bottles%20ampolletas%20mexican%20corona%20light%20on%20dark%20bar%20counter%20cold%20condensation%20warm%20lighting%20restaurant%20photography%20dark%20background&width=400&height=250&seq=menu-ampolletas-banner&orientation=landscape",
    items: ampolletasMenu.map((s) => ({
      id: 850 + s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      image: s.image,
      tags: s.tags,
    })),
  });

  // Sin Alcohol
  cats.push({
    key: "sin-alcohol",
    label: "Sin Alcohol",
    emoji: "🚫🍺",
    image: "https://readdy.ai/api/search-image?query=non%20alcoholic%20beer%20bottle%20corona%20cero%20on%20dark%20bar%20counter%20cold%20condensation%20warm%20lighting%20restaurant%20photography%20dark%20background%20refreshing%20zero%20alcohol&width=400&height=250&seq=menu-sinalcohol-banner&orientation=landscape",
    items: nonAlcoholicBeersMenu.map((s) => ({
      id: 950 + s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      image: s.image,
      tags: s.tags,
    })),
  });

  // Rusas (categoría propia)
  const rusaItems = vasosPreparadosMenu.filter((v) => v.id === 7 || v.id === 8);
  cats.push({
    key: "rusas",
    label: "Rusas (Sin Alcohol)",
    emoji: "🫗",
    image: "https://readdy.ai/api/search-image?query=refreshing%20squirt%20soda%20sparkling%20mineral%20water%20drink%20tall%20glass%20ice%20cubes%20lime%20wedge%20salt%20rim%20dark%20mexican%20cantina%20bar%20counter%20cold%20condensation%20warm%20amber%20lighting%20restaurant%20photography%20appetizing%20non%20alcoholic%20drink%20vibrant%20colors&width=400&height=250&seq=menu-rusas-banner-v2&orientation=landscape",
    items: rusaItems.map((s) => ({
      id: 500 + s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      image: s.image,
      tags: s.tags,
    })),
  });

  // Vasos Preparados (sin las Rusas, ya en su propia categoría)
  const vasosSinRusas = vasosPreparadosMenu.filter((v) => v.id !== 7 && v.id !== 8);
  cats.push({
    key: "vasos",
    label: "Vasos Preparados",
    emoji: "🥃",
    image: "https://readdy.ai/api/search-image?query=prepared%20glass%20with%20salt%20rim%20lime%20clamato%20sauce%20ice%20on%20dark%20bar%20counter%20warm%20lighting%20restaurant%20photography%20dark%20background%20mexican%20drink%20preparation&width=400&height=250&seq=menu-vasos-banner&orientation=landscape",
    items: vasosSinRusas.map((s) => ({
      id: 500 + s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      image: s.image,
      tags: s.tags,
    })),
  });

  // Caballitos
  cats.push({
    key: "caballitos",
    label: "Shots de Tequila, Ron, Whisky, Brandy",
    emoji: "🥃",
    image: "https://readdy.ai/api/search-image?query=tequila%20shots%20with%20salt%20rim%20lime%20wedge%20arranged%20on%20dark%20bar%20counter%20warm%20lighting%20restaurant%20photography%20dark%20background%20mexican%20spirits&width=400&height=250&seq=menu-shots-banner&orientation=landscape",
    items: shotShowsMenu.flatMap((s) => [
      {
        id: 60100 + (s.id * 10) + 1,
        name: `${s.name} · Sencillo`,
        description: s.description,
        price: s.price,
        priceLabel: '30ml',
        image: s.image,
        tags: [...(s.tags || []), 'Sencillo'],
      },
      {
        id: 60100 + (s.id * 10) + 2,
        name: `${s.name} · Doble`,
        description: s.description.replace('30ml', '60ml (doble)'),
        price: s.price * 2,
        priceLabel: '60ml',
        image: s.image,
        tags: [...(s.tags || []), 'Doble'],
      },
    ]),
  });

  // Preparados — Simple / Doble / Litro
  cats.push({
    key: "preparados",
    label: "Preparados",
    emoji: "🍹",
    image: "https://readdy.ai/api/search-image?query=mexican%20prepared%20drink%20with%20tequila%20squirt%20lime%20ice%20in%20tall%20glass%20on%20dark%20bar%20counter%20warm%20lighting%20restaurant%20photography%20dark%20background%20refreshing%20cocktail&width=400&height=250&seq=menu-preparados-banner&orientation=landscape",
    items: preparadosMenu.flatMap((s) => [
      {
        id: 70100 + (s.id * 10) + 1,
        name: `${s.name} · Sencillo`,
        description: s.description,
        price: s.basePrice,
        priceLabel: '30ml',
        image: s.image,
        tags: [...(s.tags || []), 'Sencillo'],
      },
      {
        id: 70100 + (s.id * 10) + 2,
        name: `${s.name} · Doble`,
        description: s.doubleDescription || s.description.replace('30ml', '60ml (doble)'),
        price: s.basePrice * 2,
        priceLabel: '60ml',
        image: s.image,
        tags: [...(s.tags || []), 'Doble'],
      },
      {
        id: 70100 + (s.id * 10) + 3,
        name: `${s.name} · Litro`,
        description: s.description.replace('30ml', '90ml (litro)'),
        price: s.basePrice * 3,
        priceLabel: '90ml',
        image: s.image,
        tags: [...(s.tags || []), 'Litro'],
      },
    ]),
  });

  // Azulitos y Charros
  cats.push({
    key: "azulitos",
    label: "Azulitos y Charros",
    emoji: "🔵",
    image: "https://readdy.ai/api/search-image?query=blue%20cocktail%20drink%20in%20large%20glass%20jar%20with%20lime%20salt%20ice%20on%20dark%20bar%20counter%20warm%20lighting%20restaurant%20photography%20dark%20background%20mexican%20blue%20drink%20refreshing&width=400&height=250&seq=menu-azulitos-banner&orientation=landscape",
    items: azulitosMenu.map((s) => ({
      id: 900 + s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      image: s.image,
      tags: s.tags,
    })),
  });

  // Bebidas Alcohólicas en Lata
  cats.push({
    key: "latas-alcohol",
    label: "Bebidas Alcohólicas en Lata",
    emoji: "🍺",
    image: "https://readdy.ai/api/search-image?query=alcoholic%20canned%20drinks%20bacardi%20new%20mix%20caribe%20cooler%20on%20dark%20bar%20counter%20cold%20condensation%20warm%20lighting%20restaurant%20photography%20dark%20background%20pre%20mixed%20beverages&width=400&height=250&seq=menu-latasalcohol-banner&orientation=landscape",
    items: cannedAlcoholicMenu.map((s) => ({
      id: 420 + s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      image: s.image,
      tags: s.tags,
    })),
  });

  // Cerveza de Barril
  cats.push({
    key: "barril",
    label: "Cerveza de Barril",
    emoji: "🍺",
    image: "https://readdy.ai/api/search-image?query=draft%20beer%20tap%20pouring%20golden%20lager%20into%20frosted%20glass%20mug%20on%20dark%20bar%20counter%20cold%20condensation%20foam%20head%20warm%20amber%20lighting%20restaurant%20photography%20authentic%20mexican%20bar%20style&width=400&height=250&seq=menu-barril-banner&orientation=landscape",
    items: barrilMenu.map((s) => ({
      id: 1200 + s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      image: s.image,
      tags: s.tags,
    })),
  });

  // Cigarros
  cats.push({
    key: "cigarros",
    label: "Cigarros",
    emoji: "🚬",
    image: "https://readdy.ai/api/search-image?query=cigarette%20pack%20marlboro%20benson%20hedges%20pall%20mall%20on%20dark%20bar%20counter%20warm%20amber%20lighting%20close%20up%20photography%20simple%20clean%20background%20product%20shot&width=400&height=250&seq=menu-cigarros-banner&orientation=landscape",
    items: cigarettesMenu.map((s) => ({
      id: 1100 + s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      image: s.image,
      tags: s.tags,
    })),
  });

  // Refrescos
  const sodaItems: MenuItem[] = [];
  sodasMenu.forEach((s) => {
    if (s.variants && s.variants.length > 0) {
      s.variants.forEach((v) => {
        sodaItems.push({
          id: 400 + s.id + sodaItems.length,
          name: `${s.name} — ${v}`,
          description: s.description,
          price: s.price,
          image: s.image,
          tags: s.tags,
        });
      });
    } else {
      sodaItems.push({
        id: 400 + s.id,
        name: s.name,
        description: s.description,
        price: s.price,
        image: s.image,
        tags: s.tags,
      });
    }
  });
  cats.push({
    key: "refrescos",
    label: "Refrescos, Jugos y Té Arizona",
    emoji: "🥤",
    image: "https://readdy.ai/api/search-image?query=assorted%20soda%20cans%20bottles%20refreshments%20arizona%20tea%20juice%20on%20dark%20bar%20counter%20cold%20condensation%20warm%20lighting%20restaurant%20photography%20dark%20background%20colorful%20beverages&width=400&height=250&seq=menu-refrescos-banner&orientation=landscape",
    items: sodaItems,
  });

  return cats;
}

const BURGER_KEYS = new Set(["hamburguesas"]);
const SAUCE_KEYS = new Set(["alitas", "boneless"]);
const MICHELADA_KEYS = new Set(["micheladas"]);
const BEER_KEYS = new Set([]);

interface PriceGroup {
  price: number;
  items: MenuItem[];
}

function detectOfferType(offer: { discount_pct: number; title: string; subtitle: string | null }): '2x1' | 'discount' {
  const text = (offer.title + ' ' + (offer.subtitle || '')).toLowerCase();
  if (offer.discount_pct === 50 || text.includes('2x1') || text.includes('2 por 1') || text.includes('2 x 1')) return '2x1';
  return 'discount';
}

function groupItemsByPrice(items: MenuItem[]): PriceGroup[] {
  const grouped = items.reduce<Record<number, MenuItem[]>>((acc, item) => {
    if (!acc[item.price]) acc[item.price] = [];
    acc[item.price].push(item);
    return acc;
  }, {});
  return Object.entries(grouped)
    .map(([price, items]) => ({ price: Number(price), items }))
    .sort((a, b) => a.price - b.price);
}

export default function MenuPage() {
  const categories = buildCategories();
  const { activeAccount } = useActiveAccount();
  const { addItem, setIsOpen, itemCount, total, flashDiscount, isFavorite, toggleFavorite, setAccountId } = useCart();
  const navigate = useNavigate();
  const [menuParams] = useSearchParams();
  const volverCuentaId = menuParams.get('volver_cuenta');
  const mesaActual = menuParams.get('mesa') || menuParams.get('area') || '';

  // Sincronizar accountId con el CartContext cuando viene desde "volver_cuenta"
  useEffect(() => {
    if (volverCuentaId) {
      setAccountId(Number(volverCuentaId));
    } else {
      setAccountId(null);
    }
    return () => {
      setAccountId(null);
    };
  }, [volverCuentaId, setAccountId]);

  // Productos pausados en tiempo real
  const pausedIds = useMenuPaused();

  const [openCats, setOpenCats] = useState<Set<string>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [burgerModalItem, setBurgerModalItem] = useState<CartItem | null>(null);
  const [wingModalItem, setWingModalItem] = useState<CartItem | null>(null);
  const [micheladaModalItem, setMicheladaModalItem] = useState<CartItem | null>(null);
  const [noteModalItem, setNoteModalItem] = useState<{ item: MenuItem; catKey: string } | null>(null);
  const [offerContext, setOfferContext] = useState<{ catKey: string; title: string; offerType: '2x1' | 'discount'; discountPct: number } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('lc_sound_muted') !== 'true';
    }
    return true;
  });
  const [showFullSeo, setShowFullSeo] = useState(true);
  const [tourVisible, setTourVisible] = useState(false);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('lc_sound_muted', String(!next));
      }
      return next;
    });
  }, []);

  const { active: confettiActive, trigger: triggerConfetti } = useConfetti();

  const toggleCat = useCallback((key: string) => {
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const confirmAddWithNote = useCallback((item: MenuItem, catKey: string, note: string, extraPrice = 0) => {
    addItem({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price + extraPrice,
      image: "",
      category: "Menú",
      notes: note || undefined,
    });
    notifyPointsEarned({ price: item.price, name: item.name });
    // Si venimos desde una oferta flash de esta categoría, celebrar
    if (offerContext && offerContext.catKey === catKey) {
      playOfferSound(offerContext.offerType);
      triggerConfetti();
      notifyOfferApplied(offerContext.title, offerContext.discountPct > 0 ? item.price * (offerContext.discountPct / 100) : 0);
      showFloatingSavings(offerContext.discountPct > 0 ? item.price * (offerContext.discountPct / 100) : 0);
      setOfferContext(null);
    }
    setAddedIds((prev) => new Set(prev).add(item.id));
    setIsOpen(true);
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }, 1500);
  }, [addItem, setIsOpen, offerContext, triggerConfetti]);

  const handleAdd = (item: MenuItem, catKey: string) => {
    if (BURGER_KEYS.has(catKey)) {
      setBurgerModalItem({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        image: "",
        category: "Hamburguesas",
      });
      notifyPointsEarned({ price: item.price, name: item.name });
      if (offerContext && offerContext.catKey === catKey) {
        playOfferSound(offerContext.offerType);
        triggerConfetti();
        notifyOfferApplied(offerContext.title, offerContext.discountPct > 0 ? item.price * (offerContext.discountPct / 100) : 0);
      showFloatingSavings(offerContext.discountPct > 0 ? item.price * (offerContext.discountPct / 100) : 0);
        setOfferContext(null);
      }
      return;
    }
    if (SAUCE_KEYS.has(catKey)) {
      setWingModalItem({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        image: "",
        category: catKey === "alitas" ? "Alitas" : "Boneless",
      });
      notifyPointsEarned({ price: item.price, name: item.name });
      if (offerContext && offerContext.catKey === catKey) {
        playOfferSound(offerContext.offerType);
        triggerConfetti();
        notifyOfferApplied(offerContext.title, offerContext.discountPct > 0 ? item.price * (offerContext.discountPct / 100) : 0);
      showFloatingSavings(offerContext.discountPct > 0 ? item.price * (offerContext.discountPct / 100) : 0);
        setOfferContext(null);
      }
      return;
    }
    if (MICHELADA_KEYS.has(catKey)) {
      setMicheladaModalItem({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        image: "",
        category: "Micheladas",
      });
      notifyPointsEarned({ price: item.price, name: item.name });
      if (offerContext && offerContext.catKey === catKey) {
        playOfferSound(offerContext.offerType);
        triggerConfetti();
        notifyOfferApplied(offerContext.title, offerContext.discountPct > 0 ? item.price * (offerContext.discountPct / 100) : 0);
      showFloatingSavings(offerContext.discountPct > 0 ? item.price * (offerContext.discountPct / 100) : 0);
        setOfferContext(null);
      }
      return;
    }
    // Para todos los demás productos: mostrar modal de nota
    setNoteModalItem({ item, catKey });
  };

  const filteredCategories = searchQuery.trim()
    ? categories
        .map((cat) => ({
          ...cat,
          items: cat.items.filter(
            (i) =>
              i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              i.description.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter((cat) => cat.items.length > 0)
    : categories;

  const scrollToCat = (key: string) => {
    setOpenCats((prev) => new Set(prev).add(key));
    // Esperar un frame para que React abra el acordeón y calcular offset del sticky nav
    requestAnimationFrame(() => {
      const el = document.getElementById(`cat-${key}`);
      if (el) {
        const navOffset = 110; // header + sticky category nav
        const top = el.getBoundingClientRect().top + window.scrollY - navOffset;
        window.scrollTo({ top, behavior: 'smooth' });
        // Highlight temporal para que el usuario vea exactamente dónde aterrizó
        setTimeout(() => {
          el.classList.add('animate-cat-highlight');
          setTimeout(() => {
            el.classList.remove('animate-cat-highlight');
          }, 1600);
        }, 400);
      }
    });
  };

  const getWhatsAppLink = () => {
    const text = encodeURIComponent("Hola La Cabrona! Quiero hacer un pedido 🍗🍺");
    return `https://wa.me/${barInfo.whatsapp}?text=${text}`;
  };

  const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <div className="min-h-screen bg-white pb-80 md:pb-96">
      <JsonLd data={MENU_JSONLD} />
      {/* Header */}
      <header className="bg-gray-900 text-white">
        <div className="w-full px-4 md:px-8 max-w-7xl mx-auto py-4 md:py-6">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 md:gap-3 cursor-pointer min-w-0"
            >
              <img
                src={LOGO_URL}
                alt="La Cabrona"
                title="La Cabrona Alitas & Beer"
                className="h-11 md:h-16 w-auto object-contain flex-shrink-0"
              />
              <div className="text-left hidden sm:block min-w-0">
                <span className="font-[Bebas_Neue] text-xl md:text-2xl tracking-wider">
                  LA CABRONA
                </span>
                <span className="block text-xs text-amber-400 tracking-widest">
                  MENÚ DIGITAL
                </span>
              </div>
            </button>
            <a
              href={getWhatsAppLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-3 md:px-4 py-2 md:py-2.5 rounded-md text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex-shrink-0"
            >
              <i className="ri-whatsapp-line text-base md:text-lg" />
              <span className="hidden xs:inline sm:inline">Pedir por WhatsApp</span>
              <span className="xs:hidden sm:hidden">WhatsApp</span>
            </a>
            <button
              onClick={toggleSound}
              className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full cursor-pointer transition-all flex-shrink-0 ${
                soundEnabled
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'bg-white/5 text-gray-500 hover:bg-white/10'
              }`}
              title={soundEnabled ? 'Silenciar sonidos' : 'Activar sonidos'}
            >
              <i className={`${soundEnabled ? 'ri-volume-up-line' : 'ri-volume-mute-line'} text-base md:text-lg`} />
            </button>
            <a
              href="/guia"
              title="Guía para clientes — Cómo disfrutar La Cabrona"
              className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full cursor-pointer transition-all flex-shrink-0 bg-white/10 text-white hover:bg-green-500 hover:text-white"
            >
              <i className="ri-book-open-line text-base md:text-lg" />
            </a>
          </div>
        </div>
      </header>

      {/* Notificaciones push */}
      <EnablePushBanner accountId={activeAccount?.accountId ?? null} />

      {/* Flash Offers exclusivas */}
      <FlashOffersBanner
        onOfferClick={(offer) => {
          if (!offer.category_key) return;
          const key = offer.category_key.toLowerCase().trim();
          let matched = categories.find((c) => c.key.toLowerCase() === key);
          if (!matched) {
            matched = categories.find(
              (c) =>
                c.key.toLowerCase().includes(key) ||
                c.label.toLowerCase().includes(key) ||
                key.includes(c.key.toLowerCase())
            );
          }
          if (matched) {
            setOfferContext({ catKey: matched.key, title: offer.title, offerType: detectOfferType(offer), discountPct: offer.discount_pct });
            scrollToCat(matched.key);
            // Auto-limpiar después de 45 segundos si no agregó nada
            setTimeout(() => setOfferContext((prev) => (prev?.catKey === matched.key ? null : prev)), 45000);
          }
        }}
      />

      {/* Banner ¿Primera vez? */}
      <FirstTimeBanner />

      {/* Session Chip */}
      <SessionChip />

      {/* Banner volver a cuenta */}
      {volverCuentaId && (
        <a
          href={`/cuenta?id=${volverCuentaId}`}
          className="block w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 transition-colors"
        >
          <div className="w-full px-4 md:px-8 max-w-3xl mx-auto py-2.5 flex items-center gap-3">
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
              <i className="ri-arrow-left-line text-white text-base" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-white text-sm font-black">
                Volver a mi cuenta{mesaActual ? ` · Mesa ${mesaActual}` : ''}
              </span>
              <span className="text-amber-100 text-xs ml-2 hidden sm:inline">
                Cuando termines de agregar, regresa para ver tu total
              </span>
            </div>
            <i className="ri-receipt-line text-white text-lg flex-shrink-0" />
          </div>
        </a>
      )}

      {/* Sticky Category Nav */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100">
        {/* Cart summary bar — aparece solo si hay items */}
        <div
          style={{
            maxHeight: itemCount > 0 ? '48px' : '0px',
            opacity: itemCount > 0 ? 1 : 0,
            overflow: 'hidden',
            transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease',
          }}
        >
          <button
            onClick={() => setIsOpen(true)}
            className="w-full flex items-center justify-between gap-3 px-4 md:px-8 py-2 cursor-pointer"
            style={{ background: '#111827' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <i className="ri-shopping-cart-2-fill text-amber-400 text-sm" />
                </div>
                <span className="text-white text-xs font-bold whitespace-nowrap">
                  {itemCount} {itemCount === 1 ? 'producto' : 'productos'} en tu pedido
                </span>
                {flashDiscount > 0 && (
                  <span className="text-green-400 text-[10px] font-bold whitespace-nowrap hidden sm:inline">
                    Ahorraste ${flashDiscount.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="hidden sm:block">
                <LoyaltyPointsBadge cartTotal={total} />
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-amber-400 font-black text-sm whitespace-nowrap">
                ${Number(total).toFixed(2)}
              </span>
              <span
                className="hidden sm:flex items-center gap-1 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap"
              >
                <i className="ri-send-plane-fill text-xs" />
                Ver pedido
              </span>
              <i className="sm:hidden ri-arrow-right-s-line text-amber-400 text-base" />
            </div>
          </button>
        </div>

        {/* Category pills row */}
        <div className="w-full px-3 md:px-8 max-w-7xl mx-auto" style={{ overscrollBehaviorX: 'contain' }}>
          <div className="flex items-center gap-2 py-2.5 overflow-x-auto scrollbar-hide">
            {/* Search input */}
            <div className="flex items-center gap-1.5 flex-shrink-0 bg-gray-100 rounded-full px-3 py-2">
              <i className="ri-search-line text-gray-400 text-sm" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar..."
                className="w-[110px] sm:w-40 md:w-56 bg-transparent text-sm focus:outline-none placeholder-gray-400"
              />
            </div>
            <div className="w-px h-5 bg-gray-200 flex-shrink-0" />
            {categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => scrollToCat(cat.key)}
                className={`flex-shrink-0 px-2.5 md:px-3 py-1.5 md:py-1.5 rounded-full text-[12px] md:text-xs font-semibold cursor-pointer transition-all whitespace-nowrap border ${
                  openCats.has(cat.key)
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {cat.emoji} <span className="hidden sm:inline">{cat.label}</span>
                <span className="sm:hidden">{cat.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Content */}
      <main className="w-full px-4 md:px-8 max-w-3xl mx-auto py-6 md:py-12 pb-24 md:pb-28">
        <h1 className="font-[Bebas_Neue] text-3xl md:text-4xl text-gray-900 tracking-wide mb-4 md:mb-6">
          Menú Completo — Alitas, Boneless &amp; Cervezas en La Cabrona Zapopan
        </h1>

        {/* Info Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 md:p-4 mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <p className="text-sm md:text-sm text-gray-700 leading-relaxed">
              <i className="ri-restaurant-line text-amber-600 mr-1" />
              <strong>{totalItems}</strong> platillos —{" "}
              <a href={getWhatsAppLink()} target="_blank" rel="noopener noreferrer" className="text-amber-600 font-semibold hover:underline">
                pedir por WhatsApp
              </a>
              {" "}o agrega al carrito
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTourVisible(true)}
                className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer transition-all active:scale-95 whitespace-nowrap"
              >
                <i className="ri-guide-line text-sm" />
                Recorrido virtual
              </button>
              <div className="sm:hidden">
                <LoyaltyPointsBadge cartTotal={total} />
              </div>
            </div>
          </div>
        </div>

        {filteredCategories.map((cat) => {
          // Determina qué items están pausados para esta categoría
          const categoryItems = cat.items.map((item) => {
            // Mapear IDs del menú a IDs de paused_products (mismo esquema que PausarProductosView)
            const pausedKey = getCategoryPausedKey(item.id, cat.key);
            const isPausedItem = pausedIds.has(pausedKey);
            return { ...item, isPausedItem };
          });
          // Filtrar items completamente pausados para no mostrarlos
          const visibleItems = categoryItems.filter(i => !i.isPausedItem);

          if (visibleItems.length === 0 && cat.items.length > 0) {
            // Categoría entera agotada — mostrar cabecera con badge
            return (
              <section key={cat.key} id={`cat-${cat.key}`} className="mb-6 md:mb-8">
                <div className="w-full flex items-center justify-between py-3 md:py-4 border-b-2 border-gray-200">
                  <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <span className="text-xl md:text-2xl flex-shrink-0 opacity-40">{cat.emoji}</span>
                    <h2 className="font-[Bebas_Neue] text-xl md:text-3xl text-gray-400 tracking-wide truncate line-through">
                      {cat.label}
                    </h2>
                    <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full flex-shrink-0">
                      Agotado
                    </span>
                  </div>
                </div>
              </section>
            );
          }

          return (
          <section
            key={cat.key}
            id={`cat-${cat.key}`}
            className="mb-6 md:mb-8"
          >
            {/* Category Header */}
            <button
              onClick={() => toggleCat(cat.key)}
              className="w-full flex items-center justify-between py-3 md:py-4 border-b-2 border-gray-900 cursor-pointer group"
            >
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <span className="text-xl md:text-2xl flex-shrink-0">{cat.emoji}</span>
                <h2 className="font-[Bebas_Neue] text-xl md:text-3xl text-gray-900 tracking-wide truncate">
                  {cat.label}
                </h2>
                <span className="text-xs text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
                  {visibleItems.length}
                </span>
              </div>
              <i
                className={`ri-arrow-down-s-line text-xl text-gray-400 transition-transform flex-shrink-0 ${
                  openCats.has(cat.key) ? "rotate-180" : ""
                }`}
              />
            </button>

            {cat.image && openCats.has(cat.key) && (
              <div className="relative h-32 md:h-52 mt-3 rounded-xl overflow-hidden">
                <img
                  src={cat.image}
                  alt={cat.label}
                  title={cat.label}
                  loading="lazy"
                  decoding="async"
                  fetchpriority="low"
                  width="600"
                  height="350"
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute bottom-2 md:bottom-3 left-3 md:left-4">
                  <span className="bg-amber-500 text-white text-xs font-bold px-2 md:px-3 py-0.5 md:py-1 rounded-full uppercase tracking-wider">
                    {cat.label}
                  </span>
                </div>
              </div>
            )}

            {/* Items */}
            {openCats.has(cat.key) && (
              <div className="divide-y divide-gray-100">
                {BEER_KEYS.has(cat.key)
                  ? groupItemsByPrice(visibleItems).map((group) => (
                      <div key={group.price} className="py-4">
                        <div className="flex items-center gap-3 mb-3 px-1">
                          <span className="text-lg font-bold text-amber-600 whitespace-nowrap">
                            ${group.price.toFixed(2)}
                          </span>
                          <div className="h-px flex-1 bg-gray-200" />
                          <span className="text-xs text-gray-400 uppercase tracking-wider whitespace-nowrap">
                            {group.items.length} {group.items.length === 1 ? "opción" : "opciones"}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {group.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-start gap-3 group"
                            >
                              {/* Product image */}
                              {item.image && (
                                <div className="relative w-[60px] h-[60px] md:w-16 md:h-16 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    title={item.name}
                                    loading="lazy"
                                    decoding="async"
                                    fetchpriority="low"
                                    width="80"
                                    height="80"
                                    className="w-full h-full object-cover object-center"
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <h3 className="text-[15px] md:text-base font-bold text-gray-900 leading-snug">
                                  {item.name}
                                </h3>
                                <p className="text-[13px] md:text-sm text-gray-500 mt-1 leading-relaxed">
                                  {item.description}
                                </p>
                                {item.tags && item.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {item.tags.map((tag) => (
                                      <span
                                        key={tag}
                                        className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                                          tag === "Más Popular" || tag === "Promo"
                                            ? "bg-amber-100 text-amber-700"
                                            : tag === "Muy Picante"
                                              ? "bg-red-100 text-red-600"
                                              : tag === "Picante"
                                                ? "bg-orange-100 text-orange-600"
                                                : "bg-gray-100 text-gray-600"
                                        }`}
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => toggleFavorite(item.id)}
                                  className={`w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full cursor-pointer transition-all active:scale-90 ${
                                    isFavorite(item.id)
                                      ? 'bg-red-50 text-red-500'
                                      : 'bg-gray-100 text-gray-400 hover:text-red-400 hover:bg-red-50'
                                  }`}
                                  title={isFavorite(item.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                                >
                                  <i className={`${isFavorite(item.id) ? 'ri-heart-fill' : 'ri-heart-line'} text-xs md:text-sm`} />
                                </button>
                                <button
                                  onClick={() => handleAdd(item, cat.key)}
                                  className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full cursor-pointer transition-all hover:scale-110 active:scale-95 ${
                                    addedIds.has(item.id)
                                      ? "bg-green-500 text-white"
                                      : "bg-gray-100 text-gray-600 hover:bg-amber-500 hover:text-white"
                                  }`}
                                  title="Agregar al carrito"
                                >
                                  {addedIds.has(item.id) ? (
                                    <i className="ri-check-line text-base md:text-lg" />
                                  ) : (
                                    <i className="ri-add-line text-base md:text-lg" />
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  : visibleItems.map((item) => (
                      <div
                        key={item.id}
                        className="py-3 md:py-4 flex items-start gap-3 group"
                      >
                        {/* Product image */}
                        {item.image && (
                          <div className="relative w-[60px] h-[60px] md:w-16 md:h-16 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                            <img
                              src={item.image}
                              alt={item.name}
                              title={item.name}
                              loading="lazy"
                              decoding="async"
                              fetchpriority="low"
                              width="80"
                              height="80"
                              className="w-full h-full object-cover object-center"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          {/* Name + Price row */}
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-[15px] md:text-base font-bold text-gray-900 leading-snug flex-1 min-w-0 pr-1">
                              {item.name}
                            </h3>
                            <span className="text-base md:text-lg font-bold text-amber-600 flex-shrink-0 whitespace-nowrap">
                              ${item.price.toFixed(2)}
                            </span>
                          </div>
                          <p className="text-[13px] md:text-sm text-gray-500 mt-1 leading-relaxed">
                            {item.description}
                          </p>
                          {item.tags && item.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {item.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                                    tag === "Más Popular" || tag === "Promo"
                                      ? "bg-amber-100 text-amber-700"
                                      : tag === "Muy Picante"
                                        ? "bg-red-100 text-red-600"
                                        : tag === "Picante"
                                          ? "bg-orange-100 text-orange-600"
                                          : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {item.sauces && item.sauces.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {item.sauces.map((s) => (
                                <span
                                  key={s.name}
                                  className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-gray-700"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                                  {s.name}
                                  {s.spiceLevel > 0 && (
                                    <span className="text-red-500">{"🔥".repeat(s.spiceLevel)}</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                          {item.flavors && item.flavors.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {item.flavors.map((f) => (
                                <span
                                  key={f.name}
                                  className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-gray-700"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: f.color }} />
                                  {f.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                          <button
                            onClick={() => toggleFavorite(item.id)}
                            className={`w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full cursor-pointer transition-all active:scale-90 ${
                              isFavorite(item.id)
                                ? 'bg-red-50 text-red-500'
                                : 'bg-gray-100 text-gray-400 hover:text-red-400 hover:bg-red-50'
                            }`}
                            title={isFavorite(item.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                          >
                            <i className={`${isFavorite(item.id) ? 'ri-heart-fill' : 'ri-heart-line'} text-xs md:text-sm`} />
                          </button>
                          <button
                            onClick={() => handleAdd(item, cat.key)}
                            className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full cursor-pointer transition-all hover:scale-110 active:scale-95 ${
                              addedIds.has(item.id)
                                ? "bg-green-500 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-amber-500 hover:text-white"
                            }`}
                            title="Agregar al carrito"
                          >
                            {addedIds.has(item.id) ? (
                              <i className="ri-check-line text-base md:text-lg" />
                            ) : (
                              <i className="ri-add-line text-base md:text-lg" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
              </div>
            )}
          </section>
          );
        })}

        {/* SEO Content Section al final del menú */}
        {showFullSeo && (
          <section id="menu-full-seo" className="mt-12 md:mt-16 pt-8 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-[Bebas_Neue] text-2xl md:text-3xl text-gray-900 tracking-wide">
                Menú Completo — Alitas, Boneless &amp; Cervezas
              </h2>
              <button
                onClick={() => setShowFullSeo(false)}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors cursor-pointer whitespace-nowrap px-2 py-1 rounded-md hover:bg-gray-100"
              >
                <i className="ri-close-line text-sm" />
                Cerrar
              </button>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              Bienvenido al <strong>menú digital de La Cabrona Alitas &amp; Beer</strong>, el bar de alitas más popular de Zapopan, Jalisco. Ubicados en Calle Sinaloa 690, Colonia El Mante, nos especializamos en ofrecer una experiencia gastronómica única que combina alitas de pollo crujientes, cervezas frías bien escarchadas, micheladas preparadas al momento y un ambiente familiar diseñado para que disfrutes con amigos, familia o compañeros de trabajo. Nuestro menú está pensado para satisfacer todos los gustos, desde los clásicos irresistibles hasta las opciones más atrevidas.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              Las <strong>alitas de pollo</strong> son nuestro producto estrella. Las preparamos al momento con pollo fresco, marinado con nuestra receta secreta y frito hasta quedar perfectamente crujientes por fuera y jugosas por dentro. Ofrecemos <strong>12 sabores diferentes</strong> para que siempre encuentres tu favorito: BBQ, BBQ Ahumada, BBQ Diabla, Mango Habanero, Buffalo, Bufalo Ranch, Cajun, Habanero, Chipotle, Tamarindo Hot, Lemon & Pepper y Maracuyá Habanero. Puedes pedir media orden de 5 piezas o una orden completa de 10 piezas.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              Nuestros <strong>boneless</strong> son trozos de pechuga de pollo sin hueso, empanizados y fritos hasta obtener una textura crujiente que contrasta con la suavidad de la carne en su interior. Disponibles en los mismos 12 sabores que las alitas, son la opción ideal para quienes prefieren disfrutar sin hueso y compartir fácilmente en mesa. Los boneless son perfectos para acompañar con cerveza y conversación entre amigos.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              El apartado de <strong>hamburguesas artesanales</strong> es otro de los favoritos de nuestros clientes. Utilizamos carne de res de primera calidad, molida diariamente para garantizar frescura. Nuestros panes son artesanales, recién horneados, y los toppings incluyen ingredientes frescos como lechuga, tomate, cebolla, queso cheddar, tocino crujiente y nuestras salsas caseras. Cada hamburguesa se prepara al momento para que llegue a tu mesa jugosa y caliente.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              Los <strong>hot dogs meños</strong> son un tributo al estilo norteño de México. Usamos salchichas de alta calidad, pan suave y toppings generosos que incluyen cebolla caramelizada, chiles toreados, queso fundido, tocino y una variedad de salsas que transforman un simple hot dog en una experiencia gastronómica memorable. Son la opción perfecta para quienes buscan algo diferente y auténtico.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              Nuestra selección de <strong>cervezas y bebidas</strong> es amplia y variada. Servimos cervezas nacionales de las mejores marcas: Corona, Corona Light, Corona Oscura, Victoria, Pacífico, Pacífico Light, Pacífico Clara, Modelo Especial, Negra Modelo, Ultra, Barrilito, Heineken y más. También contamos con cervezas de medio (355ml), ampolletas, cerveza de barril, cervezas sin alcohol, y una selección de bebidas preparadas como micheladas de 1 litro, clamatos, vasos preparados, shots de tequila, ron y whisky, preparados, azulitos, charros, refrescos y jugos.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              Las <strong>micheladas</strong> de La Cabrona son legendarias en la zona de El Mante y Zapopan. Las preparamos en vaso de 1 litro con cerveza, limón, sal, salsa inglesa, salsa Tabasco y un toque de clamato que las hace perfectas para el calor de Jalisco. Ofrecemos 4 sabores diferentes de michelada: clásica, con camarón, con piña y con mango. También puedes personalizarla con el nivel de picante que prefieras.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              Para acompañar tu comida, contamos con una variedad de <strong>botanas y acompañamientos</strong>. Las papas fritas son crujientes y doradas, perfectas para compartir. Los aros de cebolla son empanizados y fritos hasta obtener un dorado perfecto. Los dedos de queso son cremosos por dentro y crujientes por fuera. También ofrecemos nachos con queso fundido, jalapeños y guacamole. Todas nuestras botanas se preparan al momento para garantizar la mejor calidad.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              Los <strong>combos especiales</strong> son la mejor forma de disfrutar La Cabrona al mejor precio. Nuestros combos incluyen combinaciones de alitas, boneless, acompañamientos y cervezas frías, diseñados para compartir entre 2, 4 o más personas. Los combos cambian según las promociones de la semana, así que siempre hay algo nuevo que probar. Consulta las ofertas del día en nuestra página de inicio o pregunta al mesero.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              Todos nuestros <strong>ingredientes son frescos y de proveedores locales</strong>. Las verduras llegan diariamente, la carne se selecciona cuidadosamente y las salsas se elaboran en el bar con recetas propias que hemos perfeccionado a lo largo de los años. Creemos que la calidad de los ingredientes es la base de una buena comida, y por eso no escatimamos en esfuerzos para ofrecerte lo mejor.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              <strong>Hacer un pedido es fácil.</strong> Puedes ordenar directamente desde tu mesa usando nuestro menú digital, hacer tu pedido por WhatsApp al 33-4856-7795 para llevar o servicio a domicilio, o simplemente acercarte a la barra y pedir con nuestros meseros. Aceptamos efectivo, tarjeta de crédito, tarjeta de débito y transferencias bancarias. El pago es seguro y rápido.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              <strong>La ubicación de La Cabrona</strong> es privilegiada. Estamos en Calle Sinaloa 690, Colonia El Mante, Zapopan, Jalisco, con fácil acceso desde Avenida Patria. El estacionamiento es amplio y seguro, lo que facilita la visita tanto si vienes en auto como si usas transporte público. Somos pet friendly, así que puedes traer a tu mascota siempre que esté bien comportada. El ambiente es familiar y deportivo, con pantallas para ver deportes, billar profesional y música en vivo.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              <strong>Nuestros horarios de atención</strong> son amplios para que puedas visitarnos cuando más te convenga. Abrimos de lunes a jueves de 13:00 a 00:00 horas, los viernes y sábados de 14:00 a 02:00 horas, y los domingos de 14:00 a 23:00 horas. Los fines de semana suelen ser los días más concurridos, por lo que recomendamos hacer reservaciones con anticipación. Puedes reservar directamente desde nuestra página web o enviándonos un mensaje por WhatsApp al 33-4856-7795.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              <strong>Servicio a domicilio en Zapopan.</strong> Puedes hacer tu pedido por WhatsApp al 33-4856-7795 y coordinar la entrega a domicilio en Zapopan y zonas aledañas. También puedes ordenar para llevar directamente en el local. El menú digital te permite agregar productos al carrito y enviar tu orden por WhatsApp de forma rápida y sencilla. Nuestro servicio de entrega es rápido y eficiente, para que disfrutes de las mejores alitas y cervezas frías desde la comodidad de tu hogar en El Mante, Zapopan, o cualquier zona cercana.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              <strong>La experiencia La Cabrona.</strong> No importa si vienes solo, en pareja, con amigos o con toda la familia, La Cabrona tiene algo para todos. Los aficionados al deporte pueden disfrutar de los partidos en nuestras pantallas gigantes mientras comparten una cubeta de cervezas. Los amantes del billar pueden pasar horas en nuestras mesas profesionales. Los foodies pueden deleitarse con nuestro menú variado y las salsas artesanales. Y todos pueden disfrutar del ambiente cálido, la música y el servicio amable que nos caracteriza. Ven a descubrir por qué somos el bar de alitas más popular de Zapopan, Jalisco.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              <strong>Ingredientes frescos y de calidad.</strong> Todos los ingredientes que usamos en La Cabrona son frescos y de proveedores locales de Zapopan y Guadalajara. Las verduras se preparan diariamente, la carne se selecciona cuidadosamente, y las salsas se elaboran en el bar con recetas propias que hemos perfeccionado a lo largo de los años. La calidad de nuestros ingredientes es la base de la excelencia gastronómica que ofrecemos en cada plato. Desde el pollo fresco de las alitas hasta la carne de res de las hamburguesas, cada ingrediente cumple con nuestros estándares de frescura y sabor.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              <strong>Promociones y eventos especiales.</strong> Durante toda la semana ofrecemos promociones especiales en La Cabrona Alitas &amp; Beer. Lunes de descuento en alitas, martes de cerveza de barril, miércoles de micheladas, jueves de futbol, viernes de música en vivo, sábados de eventos especiales y domingos de familia. También organizamos eventos temáticos como fiestas de cumpleaños, conciertos acústicos, torneos de billar y celebraciones especiales. Consulta nuestra página de inicio para ver las promociones activas del día y no te pierdas ningún evento en Zapopan.
            </p>
          </section>
        )}
      </main>

      {/* Footer simple */}
      <footer className="bg-gray-900 text-white py-6 md:py-8">
        <div className="w-full px-4 md:px-8 max-w-7xl mx-auto text-center">
          <p className="font-[Bebas_Neue] text-lg md:text-xl tracking-wider mb-2">
            LA CABRONA — ALITAS &amp; BEER
          </p>
          <p className="text-xs md:text-sm text-gray-400 mb-4">{barInfo.address}</p>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-400 flex-wrap">
            <a href={getWhatsAppLink()} target="_blank" rel="noopener noreferrer" className="hover:text-green-400 transition-colors">
              <i className="ri-whatsapp-line mr-1" />
              WhatsApp
            </a>
            <span className="text-gray-600">|</span>
            <span>
              <i className="ri-phone-line mr-1" />
              {barInfo.phone}
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-4 md:mt-6">
            © 2026 La Cabrona. Todos los derechos reservados.
          </p>
        </div>
      </footer>

      {/* Burger Options Modal */}
      {burgerModalItem && (
        <BurgerOptionsModal
          item={burgerModalItem}
          onClose={() => setBurgerModalItem(null)}
          onAdd={() => setBurgerModalItem(null)}
        />
      )}

      {/* Michelada Flavor Modal */}
      {micheladaModalItem && (
        <MicheladaFlavorModal
          item={micheladaModalItem}
          onClose={() => setMicheladaModalItem(null)}
        />
      )}

      {/* Wing / Boneless Sauce Modal */}
      {wingModalItem && (
        <WingSauceModal
          item={wingModalItem}
          onClose={() => setWingModalItem(null)}
        />
      )}

      {/* Product Note Modal */}


      {/* Product Note Modal */}
      {noteModalItem && (
        <ProductNoteModal
          productName={noteModalItem.item.name}
          productPrice={noteModalItem.item.price}
          catKey={noteModalItem.catKey}
          onConfirm={(note, extraPrice) => {
            confirmAddWithNote(noteModalItem.item, noteModalItem.catKey, note, extraPrice);
            setNoteModalItem(null);
          }}
          onCancel={() => setNoteModalItem(null)}
        />
      )}

      {/* Quick Order FAB */}
      <CompactFAB />

      {/* Floating points toast animation */}
      <PointsToastContainer />

      {/* Offer applied toast */}
      <OfferToastContainer />

      {/* Floating savings animation */}
      <FloatingSavings />

      {/* Confetti celebration overlay */}
      <ConfettiOverlay active={confettiActive} />

      {/* Tour virtual del menú */}
      <MenuTour
        steps={menuTourSteps}
        visible={tourVisible}
        onFinish={() => setTourVisible(false)}
      />


    </div>
  );
}