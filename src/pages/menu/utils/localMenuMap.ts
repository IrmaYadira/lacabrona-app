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
  cannedAlcoholicMenu,
  barrilMenu,
  cigarettesMenu,
} from "@/mocks/menu";

interface LocalMenuItem {
  id: number;
  name: string;
  price: number;
  image: string;
  category: string;
}

function buildLocalMenuMap(): Map<number, LocalMenuItem> {
  const map = new Map<number, LocalMenuItem>();

  // Helper para agregar
  const add = (id: number, name: string, price: number, image: string, category: string) => {
    map.set(id, { id, name, price, image, category });
  };

  // ── Entradas & Botana ──
  sidesMenu.forEach((s) => {
    add(200 + s.id, s.name, s.price, s.image, "Entradas & Botana");
  });

  // ── Alitas ──
  add(
    1,
    "Orden Completa de Alitas (10 PIEZAS)",
    wingsMenu.prices["Orden Completa (10 pzas)"],
    wingsMenu.image,
    "Alitas"
  );
  add(
    2,
    "Media Orden de Alitas (5 PIEZAS)",
    wingsMenu.prices["Media Orden (5 pzas)"],
    wingsMenu.image,
    "Alitas"
  );

  // ── Boneless ──
  add(
    101,
    "Orden Completa de Boneless (10 PIEZAS)",
    bonelessMenu.prices["Orden Completa (10 pzas)"],
    bonelessMenu.image,
    "Boneless"
  );
  add(
    102,
    "Media Orden de Boneless (5 PIEZAS)",
    bonelessMenu.prices["Media Orden (5 pzas)"],
    bonelessMenu.image,
    "Boneless"
  );

  // ── Hamburguesas ──
  burgersMenu.forEach((s) => {
    add(400 + s.id, s.name, s.price, s.image, "Hamburguesas");
  });

  // ── Hot Dogs ──
  hotDogsMenu.forEach((s) => {
    add(300 + s.id, s.name, s.price, s.image, "Hot Dogs Meños");
  });

  // ── Combos ── (IDs únicos para favoritos, evita colisión con hot dogs)
  comboMenu.forEach((s) => {
    add(3000 + s.id, s.name, s.price, s.image, "Combos");
  });

  // ── Micheladas ──
  add(1000, "Michelada 1 Litro", micheladaMenu.price, micheladaMenu.image, "Micheladas");
  add(1001, "Michelada 1 Litro con Camarón", micheladaConCamaronMenu.price, micheladaConCamaronMenu.image, "Micheladas");

  // ── Cervezas Corona (listado BeerSection) ──
  beerMenu.forEach((s) => {
    add(5000 + s.id, s.name, s.price, s.image, "Cervezas Corona");
  });

  // ── Cerveza Pacífico ──
  pacificoBeersMenu.forEach((s) => {
    add(900 + s.id, s.name, s.price, s.image, "Cerveza Pacífico");
  });

  // ── Cervezas de Medio ──
  add(
    7999,
    "CUBETA 10 CORONAS EXTRA (355ml)",
    350,
    halfBeersMenu[0]?.image || "",
    "Cervezas de Medio"
  );
  const halfBeersByPrice: Record<number, typeof halfBeersMenu> = {};
  halfBeersMenu.forEach((s) => {
    if (!halfBeersByPrice[s.price]) halfBeersByPrice[s.price] = [];
    halfBeersByPrice[s.price].push(s);
  });
  const halfBeerGroups = Object.entries(halfBeersByPrice)
    .map(([price, items]) => ({ price: Number(price), items }))
    .sort((a, b) => a.price - b.price);
  halfBeerGroups.forEach((group, idx) => {
    add(
      8000 + idx,
      `Cerveza de Medio (355ml) — $${group.price.toFixed(0)}`,
      group.price,
      group.items[0]?.image || "",
      "Cervezas de Medio"
    );
  });
  // También IDs únicos para favoritos de cada cerveza de medio individual
  halfBeersMenu.forEach((s) => {
    add(5100 + s.id, s.name, s.price, s.image, "Cervezas de Medio");
  });

  // ── Ampolletas ── (IDs únicos para favoritos)
  ampolletasMenu.forEach((s) => {
    add(5200 + s.id, s.name, s.price, s.image, "Ampolletas");
  });

  // ── Sin Alcohol ──
  nonAlcoholicBeersMenu.forEach((s) => {
    add(950 + s.id, s.name, s.price, s.image, "Sin Alcohol");
  });

  // ── Vasos Preparados ──
  vasosPreparadosMenu.forEach((s) => {
    add(500 + s.id, s.name, s.price, s.image, "Vasos Preparados");
  });

  // ── Shots ──
  shotShowsMenu.forEach((s) => {
    add(600 + s.id, s.name, s.price, s.image, "Shots");
  });

  // ── Preparados ──
  preparadosMenu.forEach((s) => {
    add(700 + s.id, s.name, s.basePrice, s.image, "Preparados");
  });

  // ── Azulitos ── (IDs únicos para favoritos, evita colisión con preparados)
  azulitosMenu.forEach((s) => {
    add(5300 + s.id, s.name, s.price, s.image, "Azulitos y Charros");
  });

  // ── Bebidas Alcohólicas en Lata ──
  cannedAlcoholicMenu.forEach((s) => {
    add(420 + s.id, s.name, s.price, s.image, "Bebidas Alcohólicas en Lata");
  });

  // ── Cerveza de Barril ── (IDs únicos para favoritos)
  barrilMenu.forEach((s) => {
    add(5400 + s.id, s.name, s.price, s.image, "Cerveza de Barril");
  });

  // ── Cigarros ── (sueltos + cajetillas con IDs únicos)
  cigarettesMenu.filter(c => c.id <= 3).forEach((s) => {
    add(5500 + s.id, s.name, s.price, s.image, "Cigarros");
  });
  // Cajetillas genéricas por marca
  add(5600, "Cajetilla Marlboro", 115, cigarettesMenu.find(c => c.name.includes("Marlboro"))?.image || "", "Cigarros");
  add(5601, "Cajetilla Benson & Hedges", 115, cigarettesMenu.find(c => c.name.includes("Benson"))?.image || "", "Cigarros");
  add(5602, "Cajetilla Pall Mall", 115, cigarettesMenu.find(c => c.name.includes("Pall Mall"))?.image || "", "Cigarros");

  // ── Refrescos ── (IDs únicos para favoritos)
  sodasMenu.forEach((s) => {
    add(5700 + s.id, s.name, s.price, s.image, "Refrescos");
  });

  return map;
}

const localMenuMap = buildLocalMenuMap();

export function findLocalMenuItem(id: number): LocalMenuItem | undefined {
  return localMenuMap.get(id);
}

export function getAllLocalMenuItems(): LocalMenuItem[] {
  return Array.from(localMenuMap.values());
}

export type { LocalMenuItem };