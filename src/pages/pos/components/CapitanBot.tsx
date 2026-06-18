import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
// useCart removed - unused import caused circular dep in POS bundle
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useCartSound } from "@/hooks/useCartSound";
import { useLoyaltyCustomer } from "@/hooks/useLoyaltyCustomer";
import { supabasePos } from "@/pages/pos/supabasePos";
import { addDebugLog } from "@/hooks/useDebugLogs";
import type { PosAccount, PosAccountItem } from '../types';
import {
  wingsMenu, bonelessMenu, beerMenu, halfBeersMenu, pacificoBeersMenu,
  ampolletasMenu, nonAlcoholicBeersMenu, micheladaMenu, micheladaConCamaronMenu,
  sidesMenu, hotDogsMenu, burgersMenu, comboMenu, sodasMenu, cannedAlcoholicMenu,
  shotShowsMenu, vasosPreparadosMenu, azulitosMenu, preparadosMenu, barrilMenu, cigarettesMenu,
} from '@/mocks/menu';

// ── Descontar stock al vender desde el bot ─────────────────────────────
async function deductStockFromBot(
  productName: string,
  quantity: number,
  context: { accountId?: number; spot?: string; folio?: number } = {}
): Promise<void> {
  const { data: product } = await supabase
    .from('product_items')
    .select('id, name, stock')
    .ilike('name', productName.trim())
    .maybeSingle();

  if (!product || (product.stock ?? 0) <= 0) return;

  const stockBefore = product.stock ?? 0;
  const qty = Math.min(quantity, stockBefore);
  const stockAfter = stockBefore - qty;

  await supabase
    .from('product_items')
    .update({ stock: stockAfter, updated_at: new Date().toISOString() })
    .eq('id', product.id);

  await supabase.from('inventory_adjustments').insert({
    product_id: product.id,
    product_name: product.name,
    adjustment_type: 'sale',
    quantity: -qty,
    stock_before: stockBefore,
    stock_after: stockAfter,
    note: `Venta vía bot${context.spot ? ` — ${context.spot}` : ''}${context.folio ? ` · Ronda #${String(context.folio).padStart(2, '00')}` : ''}`,
    created_by: 'capitan_bot',
  });
}

// ── Tipos de billar ─────────────────────────────────────────────────────
type EstadoBillar = 'disponible' | 'ocupada' | 'reservada';
interface BillarMesa {
  id: number;
  numero: number;
  estado: EstadoBillar;
  etiqueta: string | null;
  updated_at: string;
}

// Tarifas billar: $70/hr → ~$1.17/min
const BILLAR_TARIFA_HR = 70;

function calcBillarTotal(mesa: BillarMesa): number {
  if (mesa.estado !== 'ocupada') return 0;
  const mins = Math.floor((Date.now() - new Date(mesa.updated_at).getTime()) / 60000);
  return Math.ceil((mins / 60) * BILLAR_TARIFA_HR);
}

// ── Catálogo plano de productos del menú ─────────────────────────────────
interface MenuProduct { id: string; name: string; category: string; price: number; }

function buildMenuCatalog(): MenuProduct[] {
  const list: MenuProduct[] = [];
  // Helper: extrae precio principal de cualquier forma de item
  const getPrice = (i: Record<string, unknown>): number => {
    if (typeof i.price === 'number') return i.price;
    if (typeof i.basePrice === 'number') return i.basePrice;
    if (i.prices && typeof i.prices === 'object') {
      const vals = Object.values(i.prices as Record<string, number>);
      if (vals.length > 0) return vals[0];
    }
    return 0;
  };
  const add = (items: Record<string, unknown>[], cat: string) =>
    items.forEach(i => list.push({
      id: String(i.id ?? i.name),
      name: String(i.name),
      category: cat,
      price: getPrice(i),
    }));

  add([wingsMenu as unknown as Record<string, unknown>], 'Alitas');
  add([bonelessMenu as unknown as Record<string, unknown>], 'Boneless');
  add(beerMenu as unknown as Record<string, unknown>[], 'Cervezas Mega');
  add(halfBeersMenu as unknown as Record<string, unknown>[], 'Medios');
  add(pacificoBeersMenu as unknown as Record<string, unknown>[], 'Pacífico');
  add(ampolletasMenu as unknown as Record<string, unknown>[], 'Ampolletas');
  add(nonAlcoholicBeersMenu as unknown as Record<string, unknown>[], 'Sin Alcohol');
  add([micheladaMenu, micheladaConCamaronMenu] as unknown as Record<string, unknown>[], 'Micheladas');
  add(sidesMenu as unknown as Record<string, unknown>[], 'Botanas');
  add(hotDogsMenu as unknown as Record<string, unknown>[], 'Hot Dogs');
  add(burgersMenu as unknown as Record<string, unknown>[], 'Hamburguesas');
  add(comboMenu as unknown as Record<string, unknown>[], 'Combos');
  add(sodasMenu as unknown as Record<string, unknown>[], 'Refrescos');
  add(cannedAlcoholicMenu as unknown as Record<string, unknown>[], 'Latas Alcohólicas');
  add(shotShowsMenu as unknown as Record<string, unknown>[], 'Shots');
  add(vasosPreparadosMenu as unknown as Record<string, unknown>[], 'Vasos Preparados');
  add(azulitosMenu as unknown as Record<string, unknown>[], 'Azulitos');
  add(preparadosMenu as unknown as Record<string, unknown>[], 'Preparados');
  add(barrilMenu as unknown as Record<string, unknown>[], 'Barril');
  add(cigarettesMenu as unknown as Record<string, unknown>[], 'Cigarros');
  return list;
}

const MENU_CATALOG = buildMenuCatalog();

// Normaliza tildes/acentos para búsqueda robusta
function normalize(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ── Diccionario de apodos → términos de búsqueda reales ────────────────
// Cada alias se expande a uno o más términos que SÍ aparecen en los nombres del catálogo.
const PRODUCT_ALIASES: Record<string, string[]> = {
  // Cervezas por apodo corto
  'ultra':          ['michelob'],
  'michelob':       ['michelob'],
  'negra':          ['modelo especial negra', 'negra'],
  'modelo negra':   ['modelo especial negra'],
  'clara':          ['modelo especial clara'],
  'modelo clara':   ['modelo especial clara'],
  'modelo':         ['modelo'],
  'vic':            ['victoria'],
  'vikinga':        ['victoria'],
  'victori':        ['victoria'],
  'corona':         ['corona'],
  'coronita':       ['corona'],
  'light':          ['light'],
  'pacifico':       ['pacifico'],
  'pac':            ['pacifico'],
  'ampolleta':      ['ampolleta'],
  'ampolletas':     ['ampolleta'],
  'ampo':           ['ampolleta'],
  'barril':         ['barril'],
  'indio':          ['indio'],
  'xx':             ['lager'],
  'lager':          ['lager'],
  // Botanas / comida
  'alitas':         ['alitas'],
  'boneless':       ['boneless'],
  'papas':          ['papas'],
  'aros':           ['aros'],
  'nachos':         ['nachos'],
  'dedos':          ['dedos'],
  'jalapenos':      ['jalapenos'],
  'hotdog':         ['hot dog'],
  'hotdogs':        ['hot dog'],
  'hamburguesa':    ['hamburguesa'],
  'burger':         ['hamburguesa'],
  'duritos':        ['duritos'],
  // Shots / preparados
  'cuervo':         ['cuervo'],
  'cabrito':        ['cabrito'],
  'centenario':     ['centenario'],
  'bacardi':        ['bacardi'],
  'smirnoff':       ['smirnoff'],
  'torres':         ['torres'],
  'sky':            ['sky'],
  'donramon':       ['don ramon'],
  'leguas':         ['leguas'],
  'tepa':           ['tepa'],
  'azulon':         ['azul centenario'],
  // Otros
  'michelada':      ['michelada'],
  'chelada':        ['michelada'],
  'cheladas':       ['michelada'],
  'azulito':        ['azulito'],
  'clamatado':      ['clamatado'],
  'marlboro':       ['marlboro'],
  'benson':         ['benson'],
  'pallmall':       ['pall mall'],
  'redbull':        ['red bull'],
  'electrolit':     ['electrolit'],
};

/** Expande un texto con apodos a términos reales de búsqueda */
function expandAliases(text: string): string {
  const norm = normalize(text);
  // Busca coincidencias exactas de alias (de más largo a más corto para evitar conflictos)
  const keys = Object.keys(PRODUCT_ALIASES).sort((a, b) => b.length - a.length);
  let expanded = norm;
  for (const alias of keys) {
    // Solo reemplaza si aparece como palabra completa (no parte de otra)
    const re = new RegExp(`\\b${alias}\\b`, 'g');
    if (re.test(expanded)) {
      const replacements = PRODUCT_ALIASES[alias].join(' ');
      expanded = expanded.replace(new RegExp(`\\b${alias}\\b`, 'g'), replacements);
    }
  }
  return expanded;
}

// Busca productos del menú que coincidan con el texto dado
function findMenuMatches(text: string): MenuProduct[] {
  // Primero expandir apodos, luego normalizar
  const q = expandAliases(normalize(text));
  // Palabras clave a ignorar en la búsqueda
  const stopWords = ['no', 'hay', 'se', 'acabo', 'el', 'la', 'los', 'las',
    'un', 'una', 'pausa', 'pausar', 'agoto', 'que', 'ya', 'tenemos', 'tengo',
    'producto', 'item', 'esto', 'este', 'eso', 'ponla', 'ponlo', 'mi', 'me', 'le', 'les'];
  const words = q.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));
  if (words.length === 0) return [];

  return MENU_CATALOG.filter(p => {
    const name = normalize(p.name);
    const cat  = normalize(p.category);
    return words.some(w => name.includes(w) || cat.includes(w));
  }).slice(0, 8);
}

// Detecta si el mensaje es una intención de pausar un producto
function detectPauseIntent(text: string): boolean {
  const q = text.toLowerCase();
  const pauseKeywords = [
    'no hay', 'se acabó', 'se acabo', 'agotado', 'agotó', 'pausa', 'pausar',
    'sin stock', 'no tenemos', 'ya no hay', 'no hay más', 'no hay mas',
    'se terminó', 'se termino', 'no queda', 'no quedan',
  ];
  return pauseKeywords.some(k => q.includes(k));
}

// Detecta si el mensaje es una intención de COBRAR una cuenta
function detectChargeIntent(text: string): boolean {
  const q = text.toLowerCase();
  const chargeKeywords = [
    'cobrar', 'cobrar la cuenta', 'cerrar cuenta', 'cerrar la cuenta',
    'pagar', 'que pague', 'hay que cobrar', 'lista la cuenta',
    'la cuenta de', 'cuenta de', 'cobrale', 'cóbrale', 'cóbrala',
    'necesita pagar', 'va a pagar', 'liquidar', 'sacar la cuenta',
  ];
  return chargeKeywords.some(k => q.includes(k));
}

// Busca cuentas abiertas que coincidan con el texto
function findAccountMatches(text: string, accounts: PosAccount[]): PosAccount[] {
  const q = text.toLowerCase();
  // Intentar por número de mesa (ej: "mesa 3", "lugar 3", "spot 3")
  const numMatch = q.match(/(mesa|lugar|spot|tabla|cuenta|silla|banca|n[uú]mero|#)\s*(\d+)/);
  if (numMatch) {
    const num = numMatch[2];
    const bySpot = accounts.filter(a => a.spot?.toLowerCase().includes(num));
    if (bySpot.length > 0) return bySpot;
  }
  // Intentar por nombre del cliente
  const stopWords = ['cobrar', 'cobrale', 'cuenta', 'mesa', 'la', 'el', 'los', 'cerrar', 'pagar', 'de', 'del'];
  const words = q.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));
  if (words.length > 0) {
    const byName = accounts.filter(a => {
      const name = (a.customer_name ?? '').toLowerCase();
      const spot = (a.spot ?? '').toLowerCase();
      return words.some(w => name.includes(w) || spot.includes(w));
    });
    if (byName.length > 0) return byName;
  }
  return [];
}

// Detecta si el mensaje quiere agregar productos a una cuenta
function detectAddIntent(text: string): boolean {
  const q = text.toLowerCase();
  const addKeywords = [
    'agregar', 'añadir', 'poner', 'manda', 'mandar', 'traer',
    'ponle', 'dale', 'llevar', 'agrega',
    'a mesa', 'a la cuenta', 'para mesa', 'para la cuenta',
    'a spot', 'a la mesa',
  ];
  return addKeywords.some(k => q.includes(k));
}

interface ParsedAddItem {
  qty: number;
  productQuery: string;
  accountQuery: string;
}

// Extrae cantidad, producto y cuenta destino del texto
function parseAddIntent(text: string): ParsedAddItem | null {
  const q = text.toLowerCase().trim();
  const cleaned = q
    .replace(/^(agregar?|añ[ao]dir?|poner?|ponle|mandar?|manda|traer?|dale|agrega|lleva[rl]?)\s+/, '')
    .trim();
  // Buscar separador "a / para / en [cuenta]"
  const splitMatch = cleaned.match(/^(.+?)\s+(?:a|para|en)\s+(?:la\s+)?(?:mesa|cuenta|spot|lugar|tabla|silla|banca|n[uú]mero|#)?\s*(.+)$/);
  if (!splitMatch) return null;
  const leftPart  = splitMatch[1].trim();
  const accountQ  = splitMatch[2].trim();
  const qtyMatch  = leftPart.match(/^(\d+)\s+(.+)$/);
  const qty       = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
  const productQ  = (qtyMatch ? qtyMatch[2] : leftPart)
    .replace(/^(de|del|un|una|unos|unas)\s+/, '')
    .trim();
  if (!productQ || !accountQ) return null;
  return { qty, productQuery: productQ, accountQuery: accountQ };
}

// Detecta intención de CORTE DE CAJA
function detectCashCutIntent(text: string): boolean {
  const q = text.toLowerCase();
  const keywords = [
    'corte de caja', 'corte', 'cierre de turno', 'cierre del turno',
    'cuánto hicimos', 'cuanto hicimos', 'cuánto vendimos', 'cuanto vendimos',
    'total del turno', 'resumen del turno', 'ventas del turno',
    'cuánto llevamos', 'cuanto llevamos', 'recap', 'reporte de ventas',
    'balance', 'balance del turno', 'cierre de caja',
  ];
  return keywords.some(k => q.includes(k));
}

// Detecta si el mensaje es una intención de REACTIVAR un producto
function detectResumeIntent(text: string): boolean {
  const q = text.toLowerCase();
  const resumeKeywords = [
    'ya hay', 'activar', 'reactivar', 'ya tenemos', 'llegó', 'llego',
    'ya llegó', 'ya llego', 'volvió', 'volvio', 'ya volvió', 'disponible',
    'ya está', 'ya esta', 'quitar pausa', 'despausa', 'despausar',
    'ya queda', 'ya quedó', 'vuelve a haber',
  ];
  return resumeKeywords.some(k => q.includes(k));
}

// ── Tipos generales ───────────────────────────────────────────────────────
type AlertLevel = 'ok' | 'info' | 'warning' | 'danger';

// ── Corte de Caja ─────────────────────────────────────────────────────────
interface PayBreakdown {
  method: string;
  label: string;
  icon: string;
  count: number;
  total: number;
}

interface CashCutData {
  turnoStart: Date;
  totalCobrado: number;
  cardFeeTotal: number;
  cuentasCerradas: number;
  cuentasAbiertas: number;
  breakdown: PayBreakdown[];
  prevTurnoTotal: number | null;
  prevTurnoCuentas: number | null;
  generatedAt: Date;
}

const PAY_METHOD_META: Record<string, { label: string; icon: string }> = {
  cash:        { label: 'Efectivo',      icon: 'ri-money-dollar-circle-line' },
  transfer:    { label: 'Transferencia', icon: 'ri-bank-line' },
  credit_card: { label: 'Crédito',       icon: 'ri-bank-card-line' },
  debit_card:  { label: 'Débito',        icon: 'ri-bank-card-2-line' },
};

// ── Tipos de alerta ───────────────────────────────────────────────────────

interface AccountAlert {
  accountId: number;
  customerName: string;
  level: AlertLevel;
  message: string;
  detail?: string;
  tags: string[];
}

// Métodos de pago disponibles para cobrar desde chat
type ChatPayMethod = 'cash' | 'transfer' | 'credit_card' | 'debit_card';

const CHAT_PAY_OPTIONS: { value: ChatPayMethod; label: string; icon: string }[] = [
  { value: 'cash',        label: 'Efectivo',       icon: 'ri-money-dollar-circle-line' },
  { value: 'transfer',   label: 'Transferencia',  icon: 'ri-bank-line' },
  { value: 'credit_card', label: 'Crédito',       icon: 'ri-bank-card-line' },
  { value: 'debit_card', label: 'Débito',         icon: 'ri-bank-card-2-line' },
];

// ── Tipos para estado de rondas ──────────────────────────────────────────
interface DeliveryRonda {
  folio: number;
  items: { name: string; qty: number; delivered: boolean }[];
  allDelivered: boolean;
  pendingCount: number;
  minutesWaiting: number; // minutos desde el primer item no entregado
}

interface DeliveryAccount {
  accountId: number;
  label: string;         // "Mesa 3" o nombre cliente
  rondas: DeliveryRonda[];
  totalPending: number;
  urgent: boolean;       // si lleva más de 15 min esperando
}

interface DeliveryData {
  accounts: DeliveryAccount[];
  totalPending: number;
  filterLabel?: string;  // si filtró por una mesa específica
}

/** Detecta si el mensaje pregunta por rondas/entregas de una mesa específica o en general */
// ── Marcar ronda entregada desde el chat ─────────────────────────────
interface MarkDeliveredOption {
  account: PosAccount;
  folio: number;      // 0 = todas las rondas pendientes
  itemCount: number;
  label: string;      // "Ronda #02 — Mesa 3 (4 ítems)"
}

function detectMarkDeliveredIntent(text: string): boolean {
  const t = text.toLowerCase();
  return (
    (t.includes('entregar') || t.includes('marcar') || t.includes('marca') ||
     t.includes('listo') || t.includes('lista') || t.includes('llev') ||
     t.includes('ya salió') || t.includes('ya salio') || t.includes('ya va') ||
     t.includes('sale') || t.includes('ya está') || t.includes('ya esta')) &&
    (
      t.includes('ronda') ||
      t.includes('mesa') ||
      t.includes('cuenta') ||
      t.includes('pedido') ||
      t.match(/\d+/) !== null
    ) &&
    // Que NO sea solo una consulta
    !t.includes('falta') && !t.includes('pendiente') && !t.includes('estado') &&
    !t.includes('cuánto') && !t.includes('cuanto') && !t.includes('qué hay') &&
    !t.includes('cómo va') && !t.includes('como va')
  );
}

function parseMarkDeliveredIntent(
  text: string,
  accounts: PosAccount[]
): { options: MarkDeliveredOption[]; ambiguous: boolean } {
  const t = text.toLowerCase();

  // Extraer número de ronda si existe: "ronda 2", "ronda #2", "la 2"
  const folioMatch = t.match(/ronda[\s#]*(\d+)/) ?? t.match(/folio[\s#]*(\d+)/);
  const targetFolio = folioMatch ? parseInt(folioMatch[1], 10) : 0;

  // Extraer cuenta objetivo
  const numMatch = t.match(/(\d+)/);
  const targetNum = numMatch ? numMatch[1] : null;

  // Buscar cuenta por spot o nombre
  const matchedAccounts = accounts.filter(a => {
    const spot = (a.spot ?? '').toLowerCase();
    const name = (a.customer_name ?? '').toLowerCase();
    if (targetNum && spot.includes(targetNum)) return true;
    if (name && t.includes(name.split(' ')[0])) return true;
    // match parcial de spot
    const spotWords = spot.split(/[\s-]+/);
    return spotWords.some(w => w.length > 2 && t.includes(w));
  });

  const candidates = matchedAccounts.length > 0 ? matchedAccounts : accounts;

  const options: MarkDeliveredOption[] = [];

  candidates.forEach(acc => {
    const items = acc.pos_account_items ?? [];
    if (items.length === 0) return;

    if (targetFolio > 0) {
      // Ronda específica
      const folioItems = items.filter(i => i.folio_number === targetFolio && !i.delivered);
      if (folioItems.length > 0) {
        options.push({
          account: acc,
          folio: targetFolio,
          itemCount: folioItems.length,
          label: `Ronda #${String(targetFolio).padStart(2, '0')} — ${acc.customer_name || acc.spot} (${folioItems.length} ítem${folioItems.length !== 1 ? 's' : ''})`,
        });
      }
    } else {
      // Sin folio específico → todas las rondas pendientes de la cuenta
      const folios = [...new Set(items.filter(i => !i.delivered).map(i => i.folio_number))];
      folios.forEach(folio => {
        const fi = items.filter(i => i.folio_number === folio && !i.delivered);
        options.push({
          account: acc,
          folio,
          itemCount: fi.length,
          label: `Ronda #${String(folio).padStart(2, '0')} — ${acc.customer_name || acc.spot} (${fi.length} ítem${fi.length !== 1 ? 's' : ''})`,
        });
      });
    }
  });

  const ambiguous = options.length > 1 && matchedAccounts.length !== 1;
  return { options, ambiguous };
}

function detectRondasIntent(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('ronda') ||
    (t.includes('falta') && (t.includes('entregar') || t.includes('mesa') || t.includes('cuenta'))) ||
    (t.includes('pendiente') && (t.includes('mesa') || t.includes('cuenta') || t.includes('ronda'))) ||
    t.includes('qué falta') ||
    t.includes('que falta') ||
    t.includes('sin entregar') ||
    t.includes('por entregar') ||
    (t.includes('estado') && (t.includes('mesa') || t.includes('cuenta') || t.includes('ronda')))
  );
}

/** Construye DeliveryData para todas las cuentas o una específica */
function buildDeliveryData(
  accounts: PosAccount[],
  filterText?: string
): DeliveryData {
  const now = Date.now();

  let filtered = accounts;
  let filterLabel: string | undefined;

  if (filterText) {
    const ft = filterText.toLowerCase();
    const match = accounts.find(a => {
      const spotLow  = (a.spot ?? '').toLowerCase();
      const nameLow  = (a.customer_name ?? '').toLowerCase();
      const numMatch = ft.match(/(\d+)/);
      if (numMatch) {
        const num = numMatch[1];
        if (spotLow.includes(num)) return true;
      }
      if (nameLow && ft.includes(nameLow.split(' ')[0])) return true;
      if (spotLow && ft.includes(spotLow.toLowerCase())) return true;
      return false;
    });
    if (match) {
      filtered = [match];
      filterLabel = match.customer_name || match.spot;
    }
  }

  const deliveryAccounts: DeliveryAccount[] = filtered
    .map(a => {
      const items = a.pos_account_items ?? [];
      if (items.length === 0) return null;

      // Agrupar por folio
      const folioMap = new Map<number, typeof items>();
      items.forEach(i => {
        if (!folioMap.has(i.folio_number)) folioMap.set(i.folio_number, []);
        folioMap.get(i.folio_number)!.push(i);
      });

      const rondas: DeliveryRonda[] = [...folioMap.entries()]
        .sort(([a2], [b2]) => a2 - b2)
        .map(([folio, folioItems]) => {
          const pending = folioItems.filter(i => !i.delivered);
          const oldestPending = pending.length > 0
            ? Math.min(...pending.map(i => new Date(i.created_at).getTime()))
            : now;
          const minutesWaiting = pending.length > 0
            ? Math.floor((now - oldestPending) / 60000)
            : 0;
          return {
            folio,
            items: folioItems.map(i => ({
              name: i.product_name + (i.size ? ` (${i.size})` : ''),
              qty: i.quantity,
              delivered: i.delivered,
            })),
            allDelivered: pending.length === 0,
            pendingCount: pending.length,
            minutesWaiting,
          };
        });

      const totalPending = rondas.reduce((s, r) => s + r.pendingCount, 0);
      const maxWait = Math.max(...rondas.map(r => r.minutesWaiting));

      return {
        accountId: a.id,
        label: a.customer_name || a.spot,
        rondas,
        totalPending,
        urgent: maxWait >= 15,
      } as DeliveryAccount;
    })
    .filter((x): x is DeliveryAccount => x !== null && x.rondas.length > 0);

  // Ordenar: urgentes primero, luego por más pendientes
  deliveryAccounts.sort((a2, b2) => {
    if (a2.urgent && !b2.urgent) return -1;
    if (!a2.urgent && b2.urgent) return 1;
    return b2.totalPending - a2.totalPending;
  });

  return {
    accounts: deliveryAccounts,
    totalPending: deliveryAccounts.reduce((s, a2) => s + a2.totalPending, 0),
    filterLabel,
  };
}

interface CobrarOption {
  account: PosAccount;
  total: number;
}

interface ChatMessage {
  id: string;
  from: 'capitan' | 'user';
  text: string;
  timestamp: Date;
  pauseOptions?: MenuProduct[];        // productos sugeridos para pausar
  pausedProduct?: string;              // nombre del producto ya pausado
  resumeOptions?: PausedProductItem[]; // productos pausados sugeridos para reactivar
  resumedProduct?: string;             // nombre del producto ya reactivado
  cobrarOptions?: CobrarOption[];      // cuentas candidatas a cobrar
  cobrarConfirmed?: string;            // texto de confirmación de cobro
  addContext?: { products: MenuProduct[]; accounts: PosAccount[]; qty: number }; // selector agregar item
  addConfirmed?: string;               // texto de confirmación de item agregado
  cashCutData?: CashCutData;           // datos del corte de caja
  deliveryData?: DeliveryData;          // estado de rondas por mesa
  markDeliveredOptions?: MarkDeliveredOption[]; // opciones para marcar como entregada
  deliveryConfirmed?: string;           // confirmación de ronda marcada como entregada
  waiterOptions?: WaiterRequest[];     // llamadas de mesero pendientes para atender
  waiterAttended?: string;             // confirmación de llamada atendida
  musicOptions?: MusicPlaylist[];       // playlists sugeridas
  musicForbidden?: boolean;             // intento de pedir narcocorrido
  clientMusicRequest?: ClientMusicRequest; // preferencia de cliente registrada
  goToMusicTab?: boolean;               // botón de acceso directo al tab Música
  loadYouTubeUrl?: string;              // URL para cargar directo en el reproductor
  loadYouTubeLabel?: string;            // nombre para mostrar en el botón
  printOptions?: PrintRondaOption[];     // opciones de ronda para imprimir comanda
  printConfirmed?: string;              // confirmación de impresión
}

interface PrintRondaOption {
  account: PosAccount;
  folio: number;
  itemCount: number;
  label: string; // "Ronda #02 — Mesa 3 (4 ítems)"
}

interface PausedProductItem {
  id: string;
  name: string;
  category: string;
}

// ── Análisis de cuentas ────────────────────────────────────────────────────
function analyzeAccounts(accounts: PosAccount[]): AccountAlert[] {
  const alerts: AccountAlert[] = [];
  const now = Date.now();

  accounts.forEach(acc => {
    const name = acc.customer_name || acc.spot || 'Cliente';
    const items = acc.pos_account_items ?? [];
    const minutesOpen = Math.floor((now - new Date(acc.created_at).getTime()) / 60000);
    const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const undelivered = items.filter(i => !i.delivered);
    const oldestUndelivered = undelivered.length > 0
      ? Math.floor((now - new Date(undelivered[0].created_at).getTime()) / 60000)
      : 0;
    const tags: string[] = [];

    // Construir tags
    if (undelivered.length > 0) tags.push(`${undelivered.length} pendiente${undelivered.length > 1 ? 's' : ''}`);
    if (total >= 500) tags.push(`$${total.toFixed(0)}`);
    if (minutesOpen >= 60) tags.push(`${Math.floor(minutesOpen / 60)}h ${minutesOpen % 60}m`);
    else tags.push(`${minutesOpen}min`);

    if (items.length === 0 && minutesOpen >= 15) {
      alerts.push({ accountId: acc.id, customerName: name, level: 'warning', tags,
        message: `${name} lleva ${minutesOpen}min sin pedir`,
        detail: 'Puede que necesite atención' });
      return;
    }

    if (oldestUndelivered >= 20) {
      alerts.push({ accountId: acc.id, customerName: name, level: 'danger', tags,
        message: `${name} esperando ${oldestUndelivered}min`,
        detail: `${undelivered.length} producto${undelivered.length !== 1 ? 's' : ''} sin entregar` });
      return;
    }

    if (oldestUndelivered >= 10) {
      alerts.push({ accountId: acc.id, customerName: name, level: 'warning', tags,
        message: `Pedido de ${name} lleva ${oldestUndelivered}min`,
        detail: `${undelivered.length} ítem${undelivered.length !== 1 ? 's' : ''} sin entregar` });
      return;
    }

    if (total >= 800 && minutesOpen >= 60) {
      alerts.push({ accountId: acc.id, customerName: name, level: 'info', tags,
        message: `${name} — cliente VIP esta noche`,
        detail: `$${total.toFixed(0)} · ${Math.floor(minutesOpen / 60)}h${minutesOpen % 60 > 0 ? ' ' + (minutesOpen % 60) + 'min' : ''} en el bar` });
      return;
    }

    alerts.push({ accountId: acc.id, customerName: name, level: 'ok', tags,
      message: `${name} — todo en orden`,
      detail: total > 0 ? `$${total.toFixed(0)} · ${minutesOpen}min` : `${minutesOpen}min` });
  });

  const order: Record<AlertLevel, number> = { danger: 0, warning: 1, info: 2, ok: 3 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}

function getTopAlertLevel(alerts: AccountAlert[]): AlertLevel {
  if (alerts.some(a => a.level === 'danger'))  return 'danger';
  if (alerts.some(a => a.level === 'warning')) return 'warning';
  if (alerts.some(a => a.level === 'info'))    return 'info';
  return 'ok';
}

// ── Generador de respuestas variadas ───────────────────────────────────────
// Selecciona aleatoriamente entre varias opciones para evitar repeticiones
function pickResponse(options: string[]): string {
  if (options.length === 0) return '';
  const idx = Math.floor(Math.random() * options.length);
  return options[idx];
}

// ── Respuestas del Gerente ─────────────────────────────────────────────────
function generateResponse(
  input: string,
  accounts: PosAccount[],
  alerts: AccountAlert[],
  paused: PausedProductItem[],
  billar: BillarMesa[],
): string {
  const q = input.toLowerCase().trim();
  const name = (acc: PosAccount) => acc.customer_name || acc.spot || 'Cliente';
  const totAcum = accounts.reduce((s, a) =>
    s + (a.pos_account_items ?? []).reduce((ss, i) => ss + i.unit_price * i.quantity, 0), 0);
  const pendingCount = accounts.flatMap(a => a.pos_account_items ?? []).filter(i => !i.delivered).length;
  const issues = alerts.filter(a => a.level !== 'ok');
  const issuesCount = issues.length;
  const dangerCount = issues.filter(a => a.level === 'danger').length;
  const warningCount = issues.filter(a => a.level === 'warning').length;
  const now = new Date();

  // ── Saludos y bromas ─────────────────────────────────────────────
  if (q.includes('hola') || q.includes('buenas') || q.includes('hey') || q.includes('ahi') || q.includes('ahí') || q.includes('qué tal') || q.includes('que tal') || q.includes('cómo estás') || q.includes('como estas') || q.includes('saludos')) {
    if (accounts.length === 0) {
      return pickResponse([
        'Listo para el turno. No hay cuentas abiertas todavía. ¿Qué te cuento?',
        'Hey, buenas. Todo tranquilo por ahora — nadie ha abierto cuenta. ¿Necesitas algo?',
        '¡Qué onda! Bar en cero cuentas, esperando que lleguen clientes. ¿Qué ocupas?',
        'Buenas. Sin cuentas abiertas ahorita. ¿Ponemos música o algo?',
        'Recién empezando. Sin cuentas activas. ¿Te preparo algo o necesitas info?',
      ]);
    }
    const greetOptions = [
      `¡Qué onda! Hay ${accounts.length} cuenta${accounts.length !== 1 ? 's' : ''} activa${accounts.length !== 1 ? 's' : ''} ahorita. $${totAcum.toFixed(0)} en el turno. ¿Qué te digo?`,
      `Hey, buenas. Tengo ${accounts.length} cuenta${accounts.length !== 1 ? 's' : ''} en la mira. $${totAcum.toFixed(0)} acumulado. ¿Qué necesitas?`,
      `Todo chill. ${accounts.length} cuenta${accounts.length !== 1 ? 's' : ''} abierta${accounts.length !== 1 ? 's' : ''} · $${totAcum.toFixed(0)}. ${pendingCount > 0 ? `${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''}.` : 'Sin pendientes.'}`,
      `¡Qué rollo! Monitoreando ${accounts.length} cuenta${accounts.length !== 1 ? 's' : ''} ahorita. ${issuesCount > 0 ? `Tengo ${issuesCount} cosa${issuesCount !== 1 ? 's' : ''} que reportarte.` : 'Todo bajo control.'}`,
      `Bar activo. ${accounts.length} cuentas, $${totAcum.toFixed(0)}. ${issuesCount > 0 ? `Ojo: ${issuesCount} alerta${issuesCount !== 1 ? 's' : ''}.` : 'Sin alertas.'}`,
    ];
    return pickResponse(greetOptions);
  }

  // ── Productos agotados / pausados ─────────────────────────────────
  if (q.includes('agotado') || q.includes('pausado') || q.includes('sin stock') || q.includes('producto')) {
    if (paused.length === 0) {
      return pickResponse([
        'No hay nada agotado. Todo el menú está disponible para pedir.',
        'Menú al 100%. Sin productos pausados ni agotados.',
        'Todo disponible. Los clientes pueden pedir lo que sea.',
        'Nada pausado. El menú completo está activo.',
      ]);
    }
    return pickResponse([
      `${paused.length} producto${paused.length !== 1 ? 's' : ''} pausado${paused.length !== 1 ? 's' : ''}: ${paused.map(p => p.name).join(', ')}. Dime "ya hay [nombre]" o "activar [nombre]" para reactivar.`,
      `Agotados: ${paused.map(p => p.name).join(', ')}. ¿Cuál reactivamos?`,
      `Faltan ${paused.length} producto${paused.length !== 1 ? 's' : ''}: ${paused.map(p => p.name).join(', ')}. Dime cuál ya hay.`,
    ]);
  }

  // ── Estado general / cómo va todo ─────────────────────────────────
  if (q.includes('cómo') || q.includes('como') || q.includes('estado') || q.includes('todo') || q.includes('qué pasa') || q.includes('que pasa') || q.includes('qué hay') || q.includes('que hay') || q.includes('qué onda') || q.includes('que onda') || q.includes('dime algo')) {
    if (accounts.length === 0) {
      return pickResponse([
        'Bar vacío. Sin cuentas. Todo en cero.',
        'Nada por ahora. Nadie ha abierto cuenta. ¿Qué ocupas?',
        'Todo en orden, pero sin clientes. ¿Preparamos algo?',
        'Sin movimiento ahorita. ¿Pongo música?',
      ]);
    }
    if (dangerCount === 0 && warningCount === 0 && paused.length === 0 && pendingCount === 0) {
      return pickResponse([
        `Todo tranqui. ${accounts.length} cuenta${accounts.length !== 1 ? 's' : ''} activa${accounts.length !== 1 ? 's' : ''}. $${totAcum.toFixed(0)} acumulado. El turno va bien.`,
        `Bar funcionando. ${accounts.length} cuentas, todo entregado, sin alertas. $${totAcum.toFixed(0)}.`,
        `Todo en orden. ${accounts.length} cuenta${accounts.length !== 1 ? 's' : ''}, $${totAcum.toFixed(0)}. Sin pendientes ni agotados.`,
        `Chill. ${accounts.length} cuentas, $${totAcum.toFixed(0)}. Nada que reportar.`,
      ]);
    }
    let r = '';
    if (dangerCount > 0) {
      r += pickResponse([
        `Urgente: ${issues.filter(a => a.level === 'danger').map(d => d.customerName).join(', ')} esperando. `,
        `ALERTA: ${issues.filter(a => a.level === 'danger').map(d => d.customerName).join(', ')} llevan mucho tiempo. `,
        `¡Ojo! ${issues.filter(a => a.level === 'danger').map(d => d.customerName).join(', ')} — atención urgente. `,
      ]);
    }
    if (warningCount > 0) {
      r += pickResponse([
        `Atención con: ${issues.filter(a => a.level === 'warning').map(w => w.customerName).join(', ')}. `,
        `Revisa a: ${issues.filter(a => a.level === 'warning').map(w => w.customerName).join(', ')}. `,
        `Ojo con: ${issues.filter(a => a.level === 'warning').map(w => w.customerName).join(', ')}. `,
      ]);
    }
    if (paused.length > 0) {
      r += pickResponse([
        `${paused.length} producto${paused.length !== 1 ? 's' : ''} sin stock. `,
        `Faltan: ${paused.map(p => p.name).join(', ')}. `,
        `Hay ${paused.length} agotado${paused.length !== 1 ? 's' : ''}. `,
      ]);
    }
    if (pendingCount > 0) {
      r += pickResponse([
        `${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''} por entregar. `,
        `Faltan ${pendingCount} entrega${pendingCount !== 1 ? 's' : ''}. `,
      ]);
    }
    r += pickResponse([
      `${accounts.length} cuenta${accounts.length !== 1 ? 's' : ''} · $${totAcum.toFixed(0)} acumulado.`,
      `Total: $${totAcum.toFixed(0)} en ${accounts.length} cuenta${accounts.length !== 1 ? 's' : ''}.`,
      `${accounts.length} cuentas · $${totAcum.toFixed(0)}.`,
    ]);
    return r.trim();
  }

  // ── Tiempo / espera / llevan ──────────────────────────────────────
  if (q.includes('tiempo') || q.includes('rato') || q.includes('llevan') || q.includes('espera') || q.includes('desde cuándo') || q.includes('cuánto lleva') || q.includes('cuanto lleva') || q.includes('llevamos') || q.includes('desde cuando')) {
    if (accounts.length === 0) return pickResponse(['No hay cuentas abiertas ahorita.', 'Bar vacío, nadie espera.', 'Sin clientes, no hay tiempos.']);
    const oldest = [...accounts].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
    const mins = Math.floor((Date.now() - new Date(oldest.created_at).getTime()) / 60000);
    const hrs  = Math.floor(mins / 60); const rem = mins % 60;
    const total = (oldest.pos_account_items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
    return pickResponse([
      `${name(oldest)} lleva más tiempo: ${hrs > 0 ? hrs + 'h ' : ''}${rem}min. ${mins >= 120 ? 'Ya va para largo, pregúntale si ocupa algo.' : 'Todo bien aún.'} ${total > 0 ? `Lleva $${total.toFixed(0)}.` : ''}`,
      `La cuenta más vieja es ${name(oldest)} con ${hrs > 0 ? hrs + 'h ' : ''}${rem}min. ${total > 0 ? `$${total.toFixed(0)} consumidos.` : 'Sin pedidos aún.'}`,
      `${name(oldest)} — ${hrs > 0 ? hrs + 'h ' : ''}${rem}min abierta. ${mins >= 120 ? 'Considera preguntarle si todo va bien.' : 'En tiempo normal.'}`,
    ]);
  }

  // ── Gasto / consumo / más lleva ─────────────────────────────────────
  if (q.includes('gastó') || q.includes('gasto') || q.includes('consumo') || q.includes('más lleva') || q.includes('mas lleva') || q.includes('más tiene') || q.includes('mas tiene') || q.includes('mayor cuenta') || q.includes('quién más') || q.includes('quien mas') || q.includes('quién lleva') || q.includes('quien lleva') || q.includes('más consumió') || q.includes('mas consumio')) {
    if (accounts.length === 0) return pickResponse(['No hay cuentas abiertas ahorita.', 'Sin cuentas, no hay consumo.']);
    const top = [...accounts].sort((a, b) => {
      const ta = (a.pos_account_items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
      const tb = (b.pos_account_items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
      return tb - ta;
    })[0];
    const total = (top.pos_account_items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const items = (top.pos_account_items ?? []).reduce((s, i) => s + i.quantity, 0);
    return pickResponse([
      `${name(top)} es quien más lleva con $${total.toFixed(2)}. ${total >= 500 ? ' ¡Buen cliente esta noche!' : ''} ${items > 0 ? `${items} producto${items !== 1 ? 's' : ''} pedidos.` : ''}`,
      `La cuenta más alta es ${name(top)} — $${total.toFixed(2)}. ${total >= 500 ? 'VIP de la noche.' : ''}`,
      `Top cuenta: ${name(top)} con $${total.toFixed(2)}. ${items > 0 ? `${items} pedidos.` : ''}`,
    ]);
  }

  // ── Pedidos pendientes / entregas ───────────────────────────────────
  if (q.includes('pendiente') || q.includes('entregar') || q.includes('falta') || q.includes('sin entregar') || q.includes('por entregar') || q.includes('no entregado') || q.includes('no entregados')) {
    const pending = accounts.filter(a => (a.pos_account_items ?? []).some(i => !i.delivered));
    if (pending.length === 0) return pickResponse(['¡Todo entregado! Sin pedidos pendientes.', 'Nada pendiente. Todo ya fue a la mesa.', 'Sin entregas pendientes. Bar al día.']);
    const details = pending.map(a => {
      const pCount = (a.pos_account_items ?? []).filter(i => !i.delivered).length;
      return `${name(a)} (${pCount})`;
    });
    return pickResponse([
      `${pending.length} cuenta${pending.length !== 1 ? 's' : ''} con pendientes: ${details.join(', ')}.`,
      `Falta entregar en: ${details.join(', ')}.`,
      `${pending.length} mesa${pending.length !== 1 ? 's' : ''} esperando: ${details.join(', ')}.`,
    ]);
  }

  // ── Cuántas cuentas / mesas ─────────────────────────────────────────
  if (q.includes('cuántas') || q.includes('cuantas') || q.includes('cuentas') || q.includes('mesas') || q.includes('cuántas mesas') || q.includes('cuantas mesas') || q.includes('cuántas cuentas') || q.includes('cuantas cuentas') || q.includes('cuántos clientes') || q.includes('cuantos clientes')) {
    if (accounts.length === 0) {
      return pickResponse(['No hay cuentas abiertas ahorita. El bar está tranquilo.', 'Cero cuentas. Bar vacío.', 'Nadie ha abierto cuenta.']);
    }
    const pendientes = accounts.filter(a => (a.pos_account_items ?? []).some(i => !i.delivered)).length;
    const items = accounts.flatMap(a => a.pos_account_items ?? []).length;
    return pickResponse([
      `${accounts.length} cuenta${accounts.length !== 1 ? 's' : ''} activa${accounts.length !== 1 ? 's' : ''} · $${totAcum.toFixed(0)} acumulado${pendientes > 0 ? ` · ${pendientes} con pedidos pendientes` : ' · todo entregado'}.`,
      `Hay ${accounts.length} cuenta${accounts.length !== 1 ? 's' : ''} abierta${accounts.length !== 1 ? 's' : ''}. $${totAcum.toFixed(0)} en el turno. ${items > 0 ? `${items} pedidos totales.` : ''}`,
      `${accounts.length} mesa${accounts.length !== 1 ? 's' : ''} activa${accounts.length !== 1 ? 's' : ''} — $${totAcum.toFixed(0)}. ${pendientes > 0 ? `${pendientes} con pendientes.` : 'Sin pendientes.'}`,
    ]);
  }

  // ── Alertas / urgentes / problemas ───────────────────────────────────
  if (q.includes('alerta') || q.includes('urgente') || q.includes('problema') || q.includes('hay algo') || q.includes('algo mal') || q.includes('hay problema') || q.includes('hay problemas') || q.includes('algo urgente') || q.includes('necesita atención') || q.includes('necesita atencion')) {
    if (issuesCount === 0) {
      return pickResponse(['Sin alertas activas. Todo en orden.', 'Nada urgente. Todo chill.', 'No hay problemas. Bar tranquilo.', 'Todo controlado, sin alertas.']);
    }
    return pickResponse([
      issues.map(a => `${a.level === 'danger' ? 'Urgente' : 'Ojo'}: ${a.message}`).join('. '),
      `Alertas: ${issues.map(a => a.message).join('. ')}.`,
      `Tengo ${issuesCount} alerta${issuesCount !== 1 ? 's' : ''}: ${issues.slice(0, 3).map(a => a.message).join('. ')}${issuesCount > 3 ? ` y ${issuesCount - 3} más.` : '.'}`,
    ]);
  }

  // ── Total / venta / acumulado ───────────────────────────────────────
  if (q.includes('total') || q.includes('venta') || q.includes('acumulado') || q.includes('cuánto dinero') || q.includes('cuanto dinero') || q.includes('cuánto llevamos') || q.includes('cuanto llevamos') || q.includes('llevamos') || q.includes('dinero') || q.includes('recaudación') || q.includes('recaudacion')) {
    return pickResponse([
      `Total acumulado del turno: $${totAcum.toFixed(2)} entre ${accounts.length} cuenta${accounts.length !== 1 ? 's' : ''}.`,
      `Llevamos $${totAcum.toFixed(2)} en ${accounts.length} cuenta${accounts.length !== 1 ? 's' : ''}.`,
      `Recaudación: $${totAcum.toFixed(2)}. ${accounts.length} cuenta${accounts.length !== 1 ? 's' : ''} activa${accounts.length !== 1 ? 's' : ''}.`,
      `En caja: $${totAcum.toFixed(2)}. ${accounts.length} cuentas abiertas.`,
    ]);
  }

  // ── Resumen / briefing / reporte ─────────────────────────────────────
  if (q.includes('resumen') || q.includes('briefing') || q.includes('reporte') || q.includes('dime todo') || q.includes('dime todo') || q.includes('cuéntame todo') || q.includes('cuentame todo') || q.includes('status') || q.includes('resumen') || q.includes('dame el resumen') || q.includes('que hay de nuevo') || q.includes('qué hay de nuevo') || q.includes('resumen') || q.includes('reporte completo')) {
    const pending = accounts.filter(a => (a.pos_account_items ?? []).some(i => !i.delivered)).length;
    const billarOcupadas = billar.filter(m => m.estado === 'ocupada');
    const billarStr = billarOcupadas.length > 0 ? ` · ${billarOcupadas.length} mesa${billarOcupadas.length > 1 ? 's' : ''} de billar ocupada${billarOcupadas.length > 1 ? 's' : ''}` : '';
    return pickResponse([
      `Resumen: ${accounts.length} cuentas · $${totAcum.toFixed(0)} acumulado · ${pending} con pendientes · ${issuesCount} alerta${issuesCount !== 1 ? 's' : ''} · ${paused.length} producto${paused.length !== 1 ? 's' : ''} sin stock${billarStr}.${issuesCount > 0 ? ' Hay cosas que atender.' : ' Todo tranquilo.'}`,
      `Reporte: ${accounts.length} cuentas, $${totAcum.toFixed(0)}, ${pending} pendientes, ${issuesCount} alertas, ${paused.length} agotados${billarStr}.`,
      `Estado: ${accounts.length} mesas, $${totAcum.toFixed(0)}. ${pending} sin entregar, ${issuesCount} problema${issuesCount !== 1 ? 's' : ''}, ${paused.length} sin stock${billarStr}.`,
      `Turno: ${accounts.length} cuentas activas. Recaudación: $${totAcum.toFixed(0)}. ${pendingCount} pendientes. ${issuesCount > 0 ? `${issuesCount} alerta${issuesCount !== 1 ? 's' : ''}.` : 'Sin alertas.'} ${paused.length > 0 ? `${paused.length} agotado${paused.length !== 1 ? 's' : ''}.` : ''}${billarStr}.`,
    ]);
  }

  // ── Billar ────────────────────────────────────────────────────────
  if (q.includes('billar') || q.includes('mesa') || q.includes('billa') || q.includes('pool') || q.includes('mesas de billar')) {
    const ocupadas  = billar.filter(m => m.estado === 'ocupada');
    const reservadas = billar.filter(m => m.estado === 'reservada');
    const disponibles = billar.filter(m => m.estado === 'disponible');
    if (billar.length === 0) return pickResponse(['No tengo info de billar ahorita.', 'Sin mesas de billar configuradas.']);
    if (ocupadas.length === 0 && reservadas.length === 0) {
      return pickResponse([
        `Las ${billar.length} mesas de billar están disponibles. Sin ocupados.`,
        `Billar libre — ${billar.length} mesas disponibles. Nadie jugando.`,
        `Todas las mesas de billar libres. ${billar.length} disponibles.`,
      ]);
    }
    const detalles = ocupadas.map(m => {
      const mins = Math.floor((Date.now() - new Date(m.updated_at).getTime()) / 60000);
      const hrs = Math.floor(mins / 60); const rem = mins % 60;
      const costo = calcBillarTotal(m);
      return `Mesa ${m.numero}: ${hrs > 0 ? hrs + 'h ' : ''}${rem}min (~$${costo})${m.etiqueta ? ' — ' + m.etiqueta : ''}`;
    });
    let r = '';
    if (ocupadas.length > 0) {
      r += pickResponse([
        `${ocupadas.length} mesa${ocupadas.length > 1 ? 's' : ''} ocupada${ocupadas.length > 1 ? 's' : ''}: ${detalles.join('; ')}. `,
        `Jugando: ${detalles.join('; ')}. `,
        `Ocupadas: ${ocupadas.length} mesa${ocupadas.length > 1 ? 's' : ''} — ${detalles.join('; ')}. `,
      ]);
    }
    if (reservadas.length > 0) {
      r += pickResponse([
        `${reservadas.length} reservada${reservadas.length > 1 ? 's' : ''}. `,
        `Reservas: ${reservadas.length}. `,
      ]);
    }
    if (disponibles.length > 0) {
      r += pickResponse([
        `${disponibles.length} disponible${disponibles.length > 1 ? 's' : ''}.`,
        `Libres: ${disponibles.length}.`,
      ]);
    }
    return r.trim();
  }

  // ── Respuesta genérica con contexto ─────────────────────────────────
  if (accounts.length === 0) {
    return pickResponse([
      'No hay cuentas abiertas. Puedo ayudarte con la música, los productos agotados, el billar o el corte de caja. ¿Qué necesitas?',
      'Bar vacío. ¿Qué ocupas? Puedo manejar música, stock, billar, corte...',
      'Sin clientes ahorita. ¿Te digo algo de música o productos?',
      'Nada en el radar. ¿Quieres que configure algo o te doy info?',
    ]);
  }

  if (issuesCount > 0) {
    const urgentes = issues.filter(a => a.level === 'danger');
    if (urgentes.length > 0) {
      return pickResponse([
        `Ojo — ${urgentes.map(a => a.customerName).join(', ')} ${urgentes.length === 1 ? 'lleva' : 'llevan'} tiempo esperando. ¿Quieres que detalle el estado completo o hay algo específico en lo que pueda ayudarte?`,
        `Urgente: ${urgentes.map(a => a.customerName).join(', ')}. ¿Necesitas que te desglose todo?`,
        `Alerta activa: ${urgentes.map(a => a.customerName).join(', ')}. ¿Qué info necesitas?`,
      ]);
    }
    return pickResponse([
      `${issuesCount} alerta${issuesCount !== 1 ? 's' : ''} activa${issuesCount !== 1 ? 's' : ''}. ¿Quieres el resumen completo del turno?`,
      `Tengo ${issuesCount} cosa${issuesCount !== 1 ? 's' : ''} que reportarte. ¿Resumen o algo específico?`,
      `Hay ${issuesCount} alerta${issuesCount !== 1 ? 's' : ''}. ¿Qué quieres saber?`,
    ]);
  }

  return pickResponse([
    `${accounts.length} cuenta${accounts.length !== 1 ? 's' : ''} activa${accounts.length !== 1 ? 's' : ''} · $${totAcum.toFixed(0)} acumulado. Todo tranquilo. Escríbeme lo que necesitas.`,
    `Bar funcionando. ${accounts.length} cuentas, $${totAcum.toFixed(0)}. ¿Qué te digo?`,
    `Monitoreando ${accounts.length} cuenta${accounts.length !== 1 ? 's' : ''}. $${totAcum.toFixed(0)} en el turno. ¿Necesitas algo?`,
    `${accounts.length} cuentas activas, $${totAcum.toFixed(0)}. Sin alertas. ¿Qué ocupas?`,
    `Todo en orden. ${accounts.length} mesas, $${totAcum.toFixed(0)}. ¿Quieres info de algo específico?`,
  ]);
}

// ── Colores ───────────────────────────────────────────────────────────────
const LEVEL_COLORS = {
  ok:      { bg: 'bg-emerald-500', ring: 'ring-emerald-400', text: 'text-emerald-400', dot: 'bg-emerald-400', bar: 'bg-emerald-400', label: 'Todo bien',  card: 'bg-emerald-900/20 border-emerald-700/30' },
  info:    { bg: 'bg-sky-500',     ring: 'ring-sky-400',     text: 'text-sky-400',     dot: 'bg-sky-400',     bar: 'bg-sky-400',     label: 'Atención',   card: 'bg-sky-900/20 border-sky-700/30' },
  warning: { bg: 'bg-amber-500',   ring: 'ring-amber-400',   text: 'text-amber-400',   dot: 'bg-amber-400',   bar: 'bg-amber-400',   label: 'Ojo',        card: 'bg-amber-900/20 border-amber-700/30' },
  danger:  { bg: 'bg-red-500',     ring: 'ring-red-400',     text: 'text-red-400',     dot: 'bg-red-400',     bar: 'bg-red-400',     label: 'Urgente',    card: 'bg-red-900/20 border-red-700/30' },
} as const;

// ── Reconocimiento de voz ─────────────────────────────────────────────────
type SpeechRecognitionType = typeof window & {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
};

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionResult {
  readonly [index: number]: { transcript: string };
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  const w = window as SpeechRecognitionType;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function speak(text: string, onEnd?: () => void) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'es-MX';
  utter.rate = 1.05;
  utter.pitch = 1.0;
  if (onEnd) utter.onend = onEnd;
  // Intentar usar voz en español
  const voices = window.speechSynthesis.getVoices();
  const esVoice = voices.find(v => v.lang.startsWith('es'));
  if (esVoice) utter.voice = esVoice;
  window.speechSynthesis.speak(utter);
}

// ── Componente: Tarjeta de cuenta en el mapa ──────────────────────────────
interface AccountMapCardProps {
  account: PosAccount;
  alert: AccountAlert;
  onClick: () => void;
}

function AccountMapCard({ account, alert, onClick }: AccountMapCardProps) {
  const c = LEVEL_COLORS[alert.level];
  const items = account.pos_account_items ?? [];
  const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const delivered = items.filter(i => i.delivered);
  const undelivered = items.filter(i => !i.delivered);
  const pct = items.length > 0 ? Math.round((delivered.length / items.length) * 100) : 100;
  const minutesOpen = Math.floor((Date.now() - new Date(account.created_at).getTime()) / 60000);

  // Últimos 3 items ordenados por fecha desc
  const recentItems = [...items]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border p-3 text-left cursor-pointer transition-all hover:scale-[1.01] ${c.card}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot} ${alert.level === 'danger' ? 'animate-pulse' : alert.level === 'warning' ? 'animate-pulse' : ''}`} />
          <p className="text-white font-bold text-xs truncate">{alert.customerName}</p>
        </div>
        <span className={`text-xs font-bold ${c.text} flex-shrink-0`}>${total.toFixed(0)}</span>
      </div>

      {/* Zona */}
      <p className="text-gray-500 text-[10px] mb-2 truncate">
        {account.zona ? `${account.area.toUpperCase()} · ${account.zona}` : account.area.toUpperCase()}
        {' · '}{minutesOpen >= 60 ? `${Math.floor(minutesOpen/60)}h${minutesOpen%60>0?` ${minutesOpen%60}m`:''}` : `${minutesOpen}m`}
      </p>

      {/* Progress bar entregas */}
      {items.length > 0 && (
        <div className="mb-2">
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-[10px] text-gray-500">Entregado</span>
            <span className={`text-[10px] font-bold ${pct === 100 ? 'text-emerald-400' : undelivered.length > 0 ? c.text : 'text-gray-400'}`}>{pct}%</span>
          </div>
          <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${c.bar}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Últimos productos */}
      {recentItems.length > 0 && (
        <div className="space-y-0.5">
          {recentItems.map(item => (
            <div key={item.id} className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.delivered ? 'bg-emerald-500' : c.dot}`} />
              <span className={`text-[10px] truncate ${item.delivered ? 'text-gray-600 line-through' : 'text-gray-300'}`}>
                {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.product_name}
              </span>
            </div>
          ))}
          {items.length > 3 && (
            <p className="text-[10px] text-gray-600 pl-3">+{items.length - 3} más</p>
          )}
        </div>
      )}

      {items.length === 0 && (
        <p className="text-[10px] text-gray-600 italic">Sin pedidos aún</p>
      )}

      {/* Tags de alerta */}
      {alert.level !== 'ok' && (
        <div className={`mt-2 pt-2 border-t ${alert.level === 'danger' ? 'border-red-800/40' : 'border-amber-800/40'}`}>
          <p className={`text-[10px] font-bold ${c.text}`}>{alert.detail}</p>
        </div>
      )}
    </button>
  );
}

// ── Panel de productos agotados ───────────────────────────────────────────
interface PausedPanelProps {
  paused: PausedProductItem[];
  onResume: (id: string) => void;
  onDismiss?: () => void; // ocultar panel localmente
}

function PausedPanel({ paused, onResume, onDismiss }: PausedPanelProps) {
  if (paused.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div className="w-10 h-10 rounded-full bg-emerald-900/30 flex items-center justify-center mb-2">
          <i className="ri-checkbox-circle-line text-emerald-400 text-lg" />
        </div>
        <p className="text-emerald-400 text-xs font-bold">Todo disponible</p>
        <p className="text-gray-600 text-[10px] mt-0.5">Sin productos agotados</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {paused.map(p => (
        <div key={p.id} className="flex items-center gap-2 bg-red-900/20 border border-red-700/30 rounded-lg px-2.5 py-2 group">
          <button
            onClick={() => onResume(p.id)}
            title={`Reactivar ${p.name}`}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-800/60 text-red-400 hover:text-white cursor-pointer transition-colors flex-shrink-0"
          >
            <i className="ri-close-circle-line text-sm" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{p.name}</p>
            <p className="text-red-400/70 text-[10px]">{p.category} · Agotado</p>
          </div>
          <button
            onClick={() => onResume(p.id)}
            className="text-[10px] px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md cursor-pointer transition-colors whitespace-nowrap font-semibold"
          >
            Activar
          </button>
        </div>
      ))}
      {/* Reactivar todo */}
      {paused.length > 1 && (
        <button
          onClick={() => paused.forEach(p => onResume(p.id))}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 mt-1 bg-emerald-700/40 hover:bg-emerald-600/60 border border-emerald-600/40 text-emerald-300 hover:text-white rounded-lg cursor-pointer transition-colors text-[10px] font-bold"
        >
          <i className="ri-check-double-line text-xs" />
          Reactivar todo ({paused.length})
        </button>
      )}
    </div>
  );
}

// ── Tipos de ronda vencida (20+ min) ──────────────────────────────────
interface OverdueRonda {
  accountId: number;
  accountLabel: string;
  folio: number;
  pendingCount: number;
  minutesWaiting: number;
  items: string[];
}

/** Construye lista de rondas que llevan 20+ min sin entregarse */
function buildOverdueRondas(accounts: PosAccount[]): OverdueRonda[] {
  const now = Date.now();
  const result: OverdueRonda[] = [];
  accounts.forEach(acc => {
    const items = acc.pos_account_items ?? [];
    if (items.length === 0) return;
    const folioMap = new Map<number, typeof items>();
    items.forEach(i => {
      if (!folioMap.has(i.folio_number)) folioMap.set(i.folio_number, []);
      folioMap.get(i.folio_number)!.push(i);
    });
    folioMap.forEach((folioItems, folio) => {
      const pending = folioItems.filter(i => !i.delivered);
      if (pending.length === 0) return;
      const oldest = Math.min(...pending.map(i => new Date(i.created_at).getTime()));
      const mins = Math.floor((now - oldest) / 60000);
      if (mins >= 20) {
        result.push({
          accountId: acc.id,
          accountLabel: acc.customer_name || acc.spot || 'Cliente',
          folio,
          pendingCount: pending.length,
          minutesWaiting: mins,
          items: pending.slice(0, 3).map(i => i.product_name + (i.quantity > 1 ? ` x${i.quantity}` : '')),
        });
      }
    });
  });
  return result.sort((a, b) => b.minutesWaiting - a.minutesWaiting);
}

// ── Tipos waiter_requests ────────────────────────────────────────────────
interface WaiterRequest {
  id: number;
  spot: string;
  area: string;
  message?: string;
  request_type?: 'call' | 'check' | string; // 'check' = pedir la cuenta, 'call' = llamar mesero
  notes?: string;                            // notas extra, ej: "Total: $250.00"
  status: string;
  created_at: string;
}

// ── Historial de partidos transmitidos ──────────────────────────────────────
interface MatchRecord {
  id: string;          // timestamp de inicio como string único
  name: string;        // "Chivas vs Cruz Azul"
  league?: string;
  date: string;        // "2026-05-16"
  startTime: string;   // "19:00"
  endTime?: string;    // "21:00" (si se completó)
  durationMinutes: number;
  phase: 'live' | 'finished' | 'cancelled'; // cómo terminó
  youtubeUrl?: string;
  playlistAfter?: string; // nombre del playlist que se puso después
}

const HISTORY_STORAGE_KEY = 'lc_match_history';

// ── Historial de URLs custom de YouTube ─────────────────────────────────────
const CUSTOM_URL_HISTORY_KEY = 'lc_custom_youtube_history';

interface CustomYouTubeEntry {
  id: string;       // timestamp como string único
  label: string;    // nombre que le puso el usuario
  url: string;      // URL original de YouTube
  addedAt: string;  // ISO timestamp
}

function loadCustomUrlHistory(): CustomYouTubeEntry[] {
  try {
    const raw = localStorage.getItem(CUSTOM_URL_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomUrlHistory(entries: CustomYouTubeEntry[]): void {
  try {
    const trimmed = entries.slice(-20); // max 20 entradas
    localStorage.setItem(CUSTOM_URL_HISTORY_KEY, JSON.stringify(trimmed));
  } catch { /* ignore */ }
}

function loadMatchHistory(): MatchRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMatchHistory(records: MatchRecord[]): void {
  try {
    // Keep last 50 records max
    const trimmed = records.slice(-50);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* ignore */ }
}

// ── Tipos de modo Fútbol ───────────────────────────────────────────────────
interface FutbolGame {
  name: string;          // Nombre del partido, ej: "América vs Chivas"
  startHour: number;     // Hora de inicio (24h)
  startMinute: number;
  durationMinutes: number; // Duración aprox del partido en minutos
  youtubeUrl?: string;   // URL del canal del partido si se tiene
}

type FutbolPhase = 'idle' | 'live' | 'finished';

// ── Tipos de música ────────────────────────────────────────────────────────
interface MusicPlaylist {
  id: string;
  name: string;
  vibe: string;          // descripción del ambiente
  youtubeUrl: string;    // URL directa de YouTube playlist
  category: MusicCategory;
  emoji: string;
  forbidden?: boolean;   // si es narcocorrido u otro género prohibido
}

type MusicCategory =
  | 'regional'     // norteño, grupero SIN narco
  | 'cumbia'
  | 'pop_latin'
  | 'reggaeton'
  | 'ranchera'
  | 'electronica'
  | 'romantica'
  | 'variado';

interface ClientMusicRequest {
  spot: string;
  genre: string;
  timestamp: Date;
}

// ── Catálogo de playlists permitidas (sin narcocorridos) ──────────────────
const MUSIC_PLAYLISTS: MusicPlaylist[] = [
  {
    id: 'nortenio-sin-narco',
    name: 'Norteño Festivo',
    vibe: 'Ambiente ranchero alegre sin narcocorridos',
    youtubeUrl: 'https://www.youtube.com/watch?v=rNcDSBx5KKg',
    category: 'regional',
    emoji: '🤠',
  },
  {
    id: 'grupero-clasico',
    name: 'Grupero Clásico',
    vibe: 'Lo mejor del grupero de los 90s y 2000s',
    youtubeUrl: 'https://www.youtube.com/watch?v=Zc42e4vFBHo',
    category: 'regional',
    emoji: '🎸',
  },
  {
    id: 'cumbia-sabrosa',
    name: 'Cumbia Sabrosa',
    vibe: 'Cumbia para bailar toda la noche',
    youtubeUrl: 'https://www.youtube.com/watch?v=k0S60IM7ZAE',
    category: 'cumbia',
    emoji: '💃',
  },
  {
    id: 'cumbia-angelitos',
    name: 'Los Ángeles Azules Mix',
    vibe: 'Cumbia chilanga para el bar',
    youtubeUrl: 'https://www.youtube.com/watch?v=lsO5pAaL4CI',
    category: 'cumbia',
    emoji: '🔵',
  },
  {
    id: 'ranchera-clasica',
    name: 'Rancheras Clásicas',
    vibe: 'Vicente, Lola, Pedro — los inmortales',
    youtubeUrl: 'https://www.youtube.com/watch?v=FYH8DsE3uCY',
    category: 'ranchera',
    emoji: '🌵',
  },
  {
    id: 'pop-latin-hits',
    name: 'Pop Latino Hits',
    vibe: 'Éxitos del pop en español',
    youtubeUrl: 'https://www.youtube.com/watch?v=ktvTqknDobU',
    category: 'pop_latin',
    emoji: '⭐',
  },
  {
    id: 'reggaeton-fiesta',
    name: 'Reggaetón de Fiesta',
    vibe: 'Perreo y flow para el antro',
    youtubeUrl: 'https://www.youtube.com/watch?v=10Qi_rNnx7A',
    category: 'reggaeton',
    emoji: '🔥',
  },
  {
    id: 'romantica-80s90s',
    name: 'Romántica 80s/90s',
    vibe: 'Para la noche tranquila y romantic',
    youtubeUrl: 'https://www.youtube.com/watch?v=pMIpqtBsYQs',
    category: 'romantica',
    emoji: '❤️',
  },
  {
    id: 'variado-bar',
    name: 'Mix Bar Variado',
    vibe: 'De todo un poco para contentar a todos',
    youtubeUrl: 'https://www.youtube.com/watch?v=Pb5TiMIFy_M',
    category: 'variado',
    emoji: '🎵',
  },
  {
    id: 'electronica-lounge',
    name: 'Electrónica / Lounge',
    vibe: 'Ambiente moderno para noches tranquilas',
    youtubeUrl: 'https://www.youtube.com/watch?v=5yx6BWlEVcY',
    category: 'electronica',
    emoji: '🎧',
  },
];

// Palabras que detectan narcocorridos (PROHIBIDOS)
const NARCO_KEYWORDS = [
  'narco', 'corrido', 'cartel', 'capo', 'sicario', 'buchón', 'buchon',
  'sinaloa', 'jalisco ng', 'cjng', 'cds', 'chapito', 'mayo zambada',
  'el mayo', 'el chapo', 'corridos tumbados', 'fuerza regida narco',
  'junior h narco', 'peso pluma narco', 'netza', 'natanael narco',
  'eslabon narco', 'bélicos', 'belicos', 'traficantes', 'pistoleros corrido',
];

function isForbiddenMusic(query: string): boolean {
  const q = normalize(query);
  return NARCO_KEYWORDS.some(k => q.includes(normalize(k)));
}

function detectMusicIntent(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('música') || t.includes('musica') ||
    (t.includes('poner') && (t.includes('canción') || t.includes('cancion') || t.includes('playlist') || t.includes('lista'))) ||
    (t.includes('pon') && (t.includes('algo') || t.includes('música') || t.includes('musica') || t.includes('cumbia') || t.includes('norteño') || t.includes('ranchera') || t.includes('reggaeton') || t.includes('pop') || t.includes('mix'))) ||
    t.includes('playlist') || t.includes('play list') ||
    t.includes('qué poner') || t.includes('que poner') ||
    (t.includes('cambia') && (t.includes('canción') || t.includes('cancion') || t.includes('música') || t.includes('musica'))) ||
    (t.includes('ambiente') && (t.includes('música') || t.includes('musica') || t.includes('poner') || t.includes('pon'))) ||
    (t.includes('prefiero') && (t.includes('música') || t.includes('musica'))) ||
    t.includes('les gusta') || (t.includes('prefieren') && t.includes('música')) ||
    t.includes('quieren escuchar') || t.includes('piden música') || t.includes('pidieron') ||
    // Preguntas de nivel de ambiente desde el quick chip
    t.includes('subir ritmo') || t.includes('qué música pongo') || t.includes('que musica pongo') ||
    (t.includes('bar lleno') && (t.includes('ritmo') || t.includes('música') || t.includes('musica'))) ||
    (t.includes('bar activo') && (t.includes('música') || t.includes('musica') || t.includes('pongo')))
  );
}

// ── Nivel de ambiente según ocupación del bar ─────────────────────────────
type VibeLevel = 'tranquilo' | 'activo' | 'lleno';

interface VibeInfo {
  level: VibeLevel;
  label: string;
  description: string;
  icon: string;
  color: string;        // tailwind text color
  bgColor: string;      // tailwind bg color
  borderColor: string;  // tailwind border color
  autoPlaylist: MusicPlaylist[];
}

function getVibeLevel(accountCount: number): VibeLevel {
  if (accountCount >= 7) return 'lleno';
  if (accountCount >= 4) return 'activo';
  return 'tranquilo';
}

function getVibeInfo(accountCount: number): VibeInfo {
  const level = getVibeLevel(accountCount);
  switch (level) {
    case 'lleno':
      return {
        level,
        label: 'Bar lleno — Ritmo alto',
        description: `${accountCount} cuentas activas. Sube el ritmo automáticamente.`,
        icon: 'ri-fire-fill',
        color: 'text-orange-400',
        bgColor: 'bg-orange-900/20',
        borderColor: 'border-orange-600/40',
        autoPlaylist: MUSIC_PLAYLISTS.filter(p =>
          ['reggaeton', 'cumbia', 'variado'].includes(p.category)
        ),
      };
    case 'activo':
      return {
        level,
        label: 'Bar activo — Ritmo medio',
        description: `${accountCount} cuentas activas. Buen ambiente para cumbia y grupero.`,
        icon: 'ri-rhythm-line',
        color: 'text-amber-400',
        bgColor: 'bg-amber-900/20',
        borderColor: 'border-amber-600/40',
        autoPlaylist: MUSIC_PLAYLISTS.filter(p =>
          ['cumbia', 'regional', 'pop_latin'].includes(p.category)
        ),
      };
    default: // tranquilo
      return {
        level,
        label: 'Bar tranquilo — Ambiente suave',
        description: `${accountCount === 0 ? 'Sin cuentas abiertas' : `${accountCount} cuenta${accountCount > 1 ? 's' : ''} activa${accountCount > 1 ? 's' : ''}`}. Ambiente relajado.`,
        icon: 'ri-leaf-line',
        color: 'text-teal-400',
        bgColor: 'bg-teal-900/20',
        borderColor: 'border-teal-600/40',
        autoPlaylist: MUSIC_PLAYLISTS.filter(p =>
          ['romantica', 'ranchera', 'pop_latin', 'electronica'].includes(p.category)
        ),
      };
  }
}

function suggestPlaylistByTime(accountCount?: number): MusicPlaylist[] {
  // Si se pasa el conteo de cuentas, el nivel de ambiente PESA MÁS que la hora
  if (accountCount !== undefined) {
    const vibe = getVibeInfo(accountCount);
    // Si hay resultados por nivel de ocupación, usarlos (mezclando un poco con la hora)
    const byOccupancy = vibe.autoPlaylist;
    if (byOccupancy.length > 0) return byOccupancy;
  }

  const hour = new Date().getHours();
  if (hour >= 18 && hour < 21) {
    return MUSIC_PLAYLISTS.filter(p =>
      ['romantica', 'pop_latin', 'ranchera', 'cumbia'].includes(p.category)
    );
  } else if (hour >= 21 || hour < 2) {
    return MUSIC_PLAYLISTS.filter(p =>
      ['cumbia', 'reggaeton', 'regional', 'variado'].includes(p.category)
    );
  } else if (hour >= 2 && hour < 6) {
    return MUSIC_PLAYLISTS.filter(p =>
      ['romantica', 'variado', 'pop_latin'].includes(p.category)
    );
  }
  return MUSIC_PLAYLISTS.filter(p => p.category === 'variado');
}

function matchPlaylistByQuery(text: string): MusicPlaylist[] {
  const t = normalize(text);
  const matches: MusicPlaylist[] = [];

  const catKeywords: Record<string, MusicCategory[]> = {
    'cumbia':    ['cumbia'],
    'norteño':   ['regional'],
    'norteno':   ['regional'],
    'grupero':   ['regional'],
    'ranchera':  ['ranchera'],
    'corrido':   ['regional'],
    'banda':     ['regional'],
    'reggaeton': ['reggaeton'],
    'reggeton':  ['reggaeton'],
    'perreo':    ['reggaeton'],
    'pop':       ['pop_latin'],
    'romantica': ['romantica'],
    'balada':    ['romantica'],
    'electronica':['electronica'],
    'lounge':    ['electronica'],
    'variado':   ['variado'],
    'mix':       ['variado'],
    'de todo':   ['variado'],
  };

  for (const [kw, cats] of Object.entries(catKeywords)) {
    if (t.includes(kw)) {
      const found = MUSIC_PLAYLISTS.filter(p => cats.includes(p.category));
      matches.push(...found.filter(f => !matches.find(m => m.id === f.id)));
    }
  }

  return matches.length > 0 ? matches : suggestPlaylistByTime();
}

// ── Control de Volumen Sugerido ───────────────────────────────────────────────

interface VolumeSuggestion {
  value: number;      // 0-100
  label: string;      // "– 40%"
  zone: 'bajo' | 'ideal' | 'alto';
  zoneLabel: string;
  reason: string;     // por qué este volumen
  color: string;      // tailwind text-
  bgColor: string;
  borderColor: string;
}

function getVolumeSuggestion(accountCount: number): VolumeSuggestion {
  const hour = new Date().getHours();
  const vibe: VibeLevel =
    accountCount >= 7 ? 'lleno' : accountCount >= 4 ? 'activo' : 'tranquilo';

  // Tabla: hora + ocupación → volumen recomendado
  let value: number;
  let reason: string;

  if (vibe === 'lleno') {
    if (hour >= 22 || hour < 2) { value = 85; reason = 'Bar lleno de noche — sube el ritmo al máximo'; }
    else if (hour >= 20)        { value = 78; reason = 'Bar lleno, noche activa'; }
    else                        { value = 70; reason = 'Bar lleno por la tarde'; }
  } else if (vibe === 'activo') {
    if (hour >= 21 || hour < 2) { value = 68; reason = 'Ambiente activo de noche'; }
    else if (hour >= 18)        { value = 60; reason = 'Buen ritmo para la noche de cuentas'; }
    else                        { value = 55; reason = 'Ambiente activo temprano'; }
  } else { // tranquilo
    if (hour >= 22 || hour < 6) { value = 45; reason = 'Bar tranquilo, hora nocturna'; }
    else if (hour >= 18)        { value = 40; reason = 'Inicio de turno, pocas cuentas'; }
    else if (hour >= 12)        { value = 35; reason = 'Turno de tarde tranquilo'; }
    else                        { value = 30; reason = 'Apertura — ambiente suave'; }
  }

  // Zona de confort
  const zone: VolumeSuggestion['zone'] =
    value < 35 ? 'bajo' : value > 80 ? 'alto' : 'ideal';

  const zoneMap = {
    bajo:  { zoneLabel: 'Ambiente suave',   color: 'text-teal-400',   bgColor: 'bg-teal-900/20',   borderColor: 'border-teal-700/40' },
    ideal: { zoneLabel: 'Volumen ideal',     color: 'text-emerald-400', bgColor: 'bg-emerald-900/20', borderColor: 'border-emerald-700/40' },
    alto:  { zoneLabel: 'Ritmo alto',        color: 'text-orange-400', bgColor: 'bg-orange-900/20', borderColor: 'border-orange-700/40' },
  };

  return { value, label: `${value}%`, zone, reason, ...zoneMap[zone] };
}

interface VolumeAdvisorProps {
  accountCount: number;
  playBeepSound: (freq: number, duration: number, gainVal: number, startOffset?: number) => void;
}

function VolumeAdvisor({ accountCount, playBeepSound }: VolumeAdvisorProps) {
  const suggested = getVolumeSuggestion(accountCount);
  // El slider que el usuario puede mover manualmente
  const [manualVolume, setManualVolume] = useState<number | null>(null);
  const displayVolume = manualVolume ?? suggested.value;
  const isManual = manualVolume !== null;

  // Zona del volumen display
  const displayZone: VolumeSuggestion['zone'] =
    displayVolume < 35 ? 'bajo' : displayVolume > 80 ? 'alto' : 'ideal';
  const zoneLabels: Record<VolumeSuggestion['zone'], { label: string; color: string }> = {
    bajo:  { label: 'Suave',       color: 'text-teal-400' },
    ideal: { label: 'Ideal',       color: 'text-emerald-400' },
    alto:  { label: 'Ritmo alto',  color: 'text-orange-400' },
  };
  const dz = zoneLabels[displayZone];

  // Beep de referencia: volumen proporcional al slider
  const playRef = useCallback(() => {
    const gain = (displayVolume / 100) * 0.7; // max 0.7
    playBeepSound(880, 0.15, gain, 0);
    playBeepSound(660, 0.15, gain * 0.8, 0.2);
    playBeepSound(880, 0.25, gain * 0.9, 0.4);
  }, [displayVolume, playBeepSound]);

  // Gradiente del slider: azul → verde → naranja según valor
  const sliderGradient = (() => {
    if (displayVolume <= 35) return 'from-teal-500 to-teal-400';
    if (displayVolume <= 80) return 'from-emerald-500 to-emerald-400';
    return 'from-amber-500 to-orange-400';
  })();

  // Marcadores de zona en la barra
  const zones = [
    { label: 'Suave',  pct: 0,   width: 35 },
    { label: 'Ideal',  pct: 35,  width: 45 },
    { label: 'Alto',   pct: 80,  width: 20 },
  ];

  return (
    <div className={`mx-3 mt-3 rounded-xl border overflow-hidden ${suggested.bgColor} ${suggested.borderColor}`}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
        <div className={`w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 ${suggested.bgColor}`}>
          <i className={`ri-volume-up-line ${suggested.color} text-base`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={`text-xs font-black ${suggested.color} leading-tight`}>
              Volumen sugerido: {suggested.label}
            </p>
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${suggested.bgColor} ${suggested.color} border ${suggested.borderColor}`}>
              {suggested.zoneLabel}
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{suggested.reason}</p>
        </div>
      </div>

      {/* Barra + número grande */}
      <div className="px-3 pb-3">
        {/* Número grande central */}
        <div className="flex items-end justify-between mb-1.5">
          <div className="flex items-end gap-1">
            <span className={`text-3xl font-black tabular-nums leading-none ${dz.color} transition-all duration-200`}>
              {displayVolume}
            </span>
            <span className="text-sm text-gray-500 font-bold mb-0.5">%</span>
          </div>
          <div className="flex items-center gap-1.5">
            {isManual && (
              <button
                onClick={() => setManualVolume(null)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-500 hover:text-gray-300 text-[10px] font-bold cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className="ri-magic-line text-xs" />
                Auto
              </button>
            )}
            <button
              onClick={playRef}
              title="Escuchar tono de referencia"
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold cursor-pointer transition-all ${suggested.bgColor} ${suggested.borderColor} ${suggested.color} hover:brightness-125`}
            >
              <i className="ri-play-circle-line text-xs" />
              Test
            </button>
          </div>
        </div>

        {/* Slider custom con zonas de color */}
        <div className="relative">
          {/* Track de fondo con zonas */}
          <div className="h-3 rounded-full overflow-hidden flex mb-1">
            <div className="bg-teal-900/60" style={{ width: '35%' }} />
            <div className="bg-emerald-900/60" style={{ width: '45%' }} />
            <div className="bg-orange-900/60" style={{ width: '20%' }} />
          </div>
          {/* Fill del slider */}
          <div
            className={`absolute top-0 left-0 h-3 rounded-full bg-gradient-to-r ${sliderGradient} transition-all duration-150 pointer-events-none`}
            style={{ width: `${displayVolume}%` }}
          />
          {/* Thumb indicador (solo visual, sobre la barra) */}
          <div
            className="absolute top-0 h-3 flex items-center pointer-events-none transition-all duration-150"
            style={{ left: `calc(${displayVolume}% - 6px)` }}
          >
            <div className="w-3 h-3 rounded-full bg-white shadow-md" />
          </div>
          {/* Input range invisible encima */}
          <input
            type="range"
            min={0}
            max={100}
            value={displayVolume}
            onChange={e => setManualVolume(Number(e.target.value))}
            className="absolute inset-0 w-full h-3 opacity-0 cursor-pointer"
          />
        </div>

        {/* Etiquetas de zona */}
        <div className="flex justify-between mt-1 mb-3">
          {zones.map(z => (
            <span
              key={z.label}
              className={`text-[9px] font-bold transition-colors ${
                (z.pct <= displayVolume && displayVolume < z.pct + z.width)
                  ? dz.color
                  : 'text-gray-700'
              }`}
              style={{ width: `${z.width}%`, textAlign: z.pct === 0 ? 'left' : z.pct === 80 ? 'right' : 'center' }}
            >
              {z.label}
            </span>
          ))}
        </div>

        {/* Atajos rápidos */}
        <div className="grid grid-cols-4 gap-1">
          {[
            { label: 'Apertura',  value: 30, icon: 'ri-sun-line' },
            { label: 'Tarde',     value: 50, icon: 'ri-restaurant-line' },
            { label: 'Noche',     value: 70, icon: 'ri-moon-line' },
            { label: 'Fiesta',    value: 88, icon: 'ri-fire-line' },
          ].map(preset => (
            <button
              key={preset.label}
              onClick={() => setManualVolume(preset.value)}
              className={`flex flex-col items-center gap-0.5 px-1 py-2 rounded-xl border cursor-pointer transition-all ${
                Math.abs(displayVolume - preset.value) <= 5
                  ? `${suggested.bgColor} ${suggested.borderColor} ${suggested.color}`
                  : 'bg-gray-900 border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              <i className={`${preset.icon} text-sm`} />
              <span className="text-[9px] font-bold">{preset.value}%</span>
              <span className="text-[8px] text-gray-600 leading-none">{preset.label}</span>
            </button>
          ))}
        </div>

        {/* Aviso de volumen extremo */}
        {displayVolume > 85 && (
          <div className="mt-2 flex items-center gap-1.5 px-2 py-1.5 bg-orange-900/30 border border-orange-700/30 rounded-lg">
            <i className="ri-alert-line text-orange-400 text-xs flex-shrink-0" />
            <p className="text-[10px] text-orange-300/80">Volumen muy alto — cuida el oído de los clientes y el equipo</p>
          </div>
        )}
        {displayVolume < 20 && (
          <div className="mt-2 flex items-center gap-1.5 px-2 py-1.5 bg-teal-900/20 border border-teal-700/20 rounded-lg">
            <i className="ri-volume-mute-line text-teal-400 text-xs flex-shrink-0" />
            <p className="text-[10px] text-teal-300/70">Volumen muy bajo — los clientes quizás ni lo escuchen</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Panel de Prueba de Sonido ────────────────────────────────────────────────

type SoundCheckStatus = 'idle' | 'testing' | 'ok' | 'fail';

// Canción de prueba: "La Bamba" instrumental en YouTube — reconocible, cortita
const SOUND_TEST_URL = 'https://www.youtube.com/watch?v=r7bQA-MuXaw';

// ── Input URL custom de YouTube ───────────────────────────────────────
interface CustomYouTubeInputProps {
  toEmbedUrl: (url: string) => string;
  onLoad: (playlist: MusicPlaylist) => void;
}

function CustomYouTubeInput({ toEmbedUrl, onLoad }: CustomYouTubeInputProps) {
  const [customUrl, setCustomUrl] = useState('');
  const [customError, setCustomError] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [history, setHistory] = useState<CustomYouTubeEntry[]>(() => loadCustomUrlHistory());
  const [historyOpen, setHistoryOpen] = useState(false);

  const handleLoad = (urlOverride?: string, labelOverride?: string) => {
    const trimmed = (urlOverride ?? customUrl).trim();
    const label = (labelOverride ?? customLabel).trim();
    if (!trimmed) return;
    const embedUrl = toEmbedUrl(trimmed);
    if (!embedUrl) {
      if (!urlOverride) {
        setCustomError(true);
        setTimeout(() => setCustomError(false), 3500);
      }
      // Si viene del historial y no tiene embed, abrir en nueva pestaña
      if (urlOverride) window.open(trimmed, '_blank', 'noopener,noreferrer');
      return;
    }
    const finalLabel = label || 'Video custom';
    const playlist: MusicPlaylist = {
      id: 'custom-url',
      name: finalLabel,
      vibe: trimmed.length > 55 ? trimmed.slice(0, 55) + '...' : trimmed,
      youtubeUrl: trimmed,
      category: 'variado',
      emoji: '\uD83D\uDD17',
    };
    onLoad(playlist);

    // Guardar en historial (evitar duplicados por URL)
    const newEntry: CustomYouTubeEntry = {
      id: `cu-${Date.now()}`,
      label: finalLabel,
      url: trimmed,
      addedAt: new Date().toISOString(),
    };
    setHistory(prev => {
      // Eliminar entrada previa con misma URL si existe
      const filtered = prev.filter(e => e.url !== trimmed);
      const updated = [...filtered, newEntry];
      saveCustomUrlHistory(updated);
      return updated;
    });

    if (!urlOverride) {
      setCustomUrl('');
      setCustomLabel('');
      setCustomError(false);
    }
  };

  const removeEntry = (id: string) => {
    setHistory(prev => {
      const updated = prev.filter(e => e.id !== id);
      saveCustomUrlHistory(updated);
      return updated;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    saveCustomUrlHistory([]);
  };

  // Historial ordenado de más reciente a más antiguo
  const sortedHistory = [...history].reverse();

  return (
    <div className="mx-3 mt-3 bg-gray-900 border border-gray-700/60 rounded-xl overflow-hidden">
      {/* Input principal */}
      <div className="px-3 py-3">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
          <i className="ri-link-m text-violet-400" />
          Poner URL de YouTube
        </p>
        <p className="text-[10px] text-gray-600 mb-2.5 leading-tight">
          Pega cualquier video, playlist o canal — se carga directo en el reproductor y en el screensaver.
        </p>
        <div className="space-y-1.5">
          <input
            type="text"
            value={customLabel}
            onChange={e => setCustomLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLoad()}
            placeholder="Nombre (opcional)"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
          />
          <div className="flex gap-1.5">
            <input
              type="url"
              value={customUrl}
              onChange={e => { setCustomUrl(e.target.value); setCustomError(false); }}
              onKeyDown={e => e.key === 'Enter' && handleLoad()}
              placeholder="https://youtube.com/watch?v=..."
              className={`flex-1 bg-gray-800 border rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none transition-colors ${
                customError ? 'border-red-500' : 'border-gray-700 focus:border-violet-500'
              }`}
            />
            <button
              onClick={() => handleLoad()}
              disabled={!customUrl.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-800 disabled:text-gray-600 text-white text-xs font-bold rounded-lg cursor-pointer disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              <i className="ri-play-fill text-xs" />
              Poner
            </button>
          </div>
        </div>
        {customError && (
          <p className="text-[10px] text-red-400 mt-1.5 flex items-center gap-1">
            <i className="ri-error-warning-line" />
            URL no válida — usa un enlace de video, playlist o canal de YouTube.
          </p>
        )}
        <p className="text-[9px] text-gray-700 mt-2 leading-tight">
          Formatos: youtube.com/watch?v=ID · youtu.be/ID · youtube.com/playlist?list=ID
        </p>
      </div>

      {/* Historial de URLs custom */}
      {sortedHistory.length > 0 && (
        <div className="border-t border-gray-800">
          {/* Header colapsable del historial */}
          <button
            onClick={() => setHistoryOpen(h => !h)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 cursor-pointer hover:bg-gray-800/60 transition-colors group"
          >
            <div className="flex items-center gap-1.5">
              <i className="ri-history-line text-violet-400 text-xs" />
              <p className="text-[10px] font-black text-violet-300 uppercase tracking-wider group-hover:text-violet-200 transition-colors">
                Historial reciente
              </p>
              <span className="min-w-[18px] h-4 px-1 flex items-center justify-center rounded-full bg-violet-900/50 text-violet-400 text-[9px] font-black border border-violet-700/40">
                {sortedHistory.length}
              </span>
            </div>
            <i className={`text-gray-600 text-xs transition-transform duration-200 ${
              historyOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'
            }`} />
          </button>

          {historyOpen && (
            <div className="px-3 pb-3">
              <div className="space-y-1.5">
                {sortedHistory.map(entry => {
                  const hasEmbed = !!toEmbedUrl(entry.url);
                  const dateLabel = (() => {
                    try {
                      const d = new Date(entry.addedAt);
                      const today = new Date();
                      const yesterday = new Date(today);
                      yesterday.setDate(today.getDate() - 1);
                      const entryDate = d.toDateString();
                      if (entryDate === today.toDateString()) {
                        return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                      }
                      if (entryDate === yesterday.toDateString()) {
                        return 'Ayer ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                      }
                      return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
                    } catch { return ''; }
                  })();

                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-2 bg-gray-800/60 hover:bg-gray-800 border border-gray-700/40 rounded-xl px-2.5 py-2 group transition-colors"
                    >
                      {/* Icono */}
                      <div className="w-7 h-7 flex items-center justify-center bg-violet-900/40 rounded-lg flex-shrink-0">
                        <i className={`text-xs ${
                          hasEmbed ? 'ri-youtube-line text-red-400' : 'ri-external-link-line text-gray-500'
                        }`} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate leading-tight">{entry.label}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-[9px] text-gray-600 truncate flex-1">{entry.url.replace('https://', '')}</p>
                          <span className="text-[9px] text-gray-600 flex-shrink-0 whitespace-nowrap">{dateLabel}</span>
                        </div>
                      </div>

                      {/* Botones: Poner + Eliminar */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleLoad(entry.url, entry.label)}
                          className="flex items-center gap-1 px-2 py-1 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                          title={hasEmbed ? 'Cargar en reproductor' : 'Abrir en YouTube'}
                        >
                          <i className={`text-xs ${
                            hasEmbed ? 'ri-play-fill' : 'ri-external-link-line'
                          }`} />
                          {hasEmbed ? 'Poner' : 'Abrir'}
                        </button>
                        <button
                          onClick={() => removeEntry(entry.id)}
                          className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-700/60 hover:bg-red-900/50 text-gray-600 hover:text-red-400 cursor-pointer transition-colors flex-shrink-0"
                          title="Eliminar del historial"
                        >
                          <i className="ri-close-line text-xs" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Limpiar todo */}
              {sortedHistory.length > 1 && (
                <button
                  onClick={clearHistory}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 mt-2 text-[10px] text-gray-600 hover:text-red-400 cursor-pointer transition-colors rounded-xl hover:bg-red-900/20 border border-transparent hover:border-red-900/30"
                >
                  <i className="ri-delete-bin-2-line text-xs" />
                  Limpiar historial
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SoundCheckPanelProps {
  playBeepSound: (freq: number, duration: number, gainVal: number, startOffset?: number) => void;
}

function SoundCheckPanel({ playBeepSound }: SoundCheckPanelProps) {
  const [status, setStatus] = useState<SoundCheckStatus>('idle');
  const [step, setStep] = useState(0); // 0=idle, 1=beep, 2=youtube, 3=resultado
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Limpia timers al desmontar
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const startTest = useCallback(() => {
    setStatus('testing');
    setStep(1);

    // Forzar desbloqueo del AudioContext desde el evento de click
    // (los navegadores requieren que el audio se inicie desde interacción directa del usuario)
    try {
      const AnyAudioCtx = window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const tmpCtx = new AnyAudioCtx();
      // Nodo silencioso para desbloquear el contexto
      const buf = tmpCtx.createBuffer(1, 1, 22050);
      const src = tmpCtx.createBufferSource();
      src.buffer = buf;
      src.connect(tmpCtx.destination);
      src.start(0);
      tmpCtx.resume().catch(() => {});
    } catch (_) { /* ignore */ }

    // Paso 1: Beep de prueba (tono de soundcheck clásico 1kHz)
    playBeepSound(1000, 0.6, 0.5, 0.05);
    playBeepSound(1000, 0.4, 0.4, 0.85);
    playBeepSound(800,  0.3, 0.35, 1.45);
    playBeepSound(1200, 0.5, 0.45, 1.95);
    // Fanfarria breve ascendente
    playBeepSound(523, 0.15, 0.4, 2.65);  // C5
    playBeepSound(659, 0.15, 0.4, 2.85);  // E5
    playBeepSound(784, 0.15, 0.4, 3.05);  // G5
    playBeepSound(1047, 0.4, 0.5, 3.25);  // C6

    // Paso 2: despues de 1.5s mostrar que los beeps salieron y ofrecer YouTube
    const t1 = setTimeout(() => {
      setStep(2);
    }, 1500);
    timerRef.current = t1;
  }, [playBeepSound]);

  const openYoutube = useCallback(() => {
    window.open(SOUND_TEST_URL, '_blank', 'noopener,noreferrer');
    setStep(3);
    setStatus('testing');
  }, []);

  const confirmResult = useCallback((ok: boolean) => {
    setStatus(ok ? 'ok' : 'fail');
    setStep(0);
    // Volver a idle después de 5s
    const t = setTimeout(() => {
      setStatus('idle');
      setOpen(false);
    }, 5000);
    timerRef.current = t;
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setStep(0);
  }, []);

  const statusColors = {
    idle:    { bg: 'bg-gray-900', border: 'border-gray-800',       icon: 'ri-speaker-2-line',       iconColor: 'text-gray-400' },
    testing: { bg: 'bg-amber-900/20', border: 'border-amber-700/40', icon: 'ri-sound-module-line',    iconColor: 'text-amber-400 animate-pulse' },
    ok:      { bg: 'bg-emerald-900/25', border: 'border-emerald-600/50', icon: 'ri-checkbox-circle-fill', iconColor: 'text-emerald-400' },
    fail:    { bg: 'bg-red-900/25',    border: 'border-red-600/50',  icon: 'ri-error-warning-fill',   iconColor: 'text-red-400' },
  } as const;

  const sc = statusColors[status];

  return (
    <div className="mx-3 mt-3">
      {/* Botón colapsable */}
      <button
        onClick={() => { setOpen(o => !o); if (status !== 'idle') reset(); }}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
          open ? `${sc.bg} ${sc.border}` : 'bg-gray-900 border-gray-800 hover:border-gray-600'
        }`}
      >
        <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
          <i className={`${sc.icon} ${sc.iconColor} text-base`} />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-xs font-black text-white leading-tight">
            {status === 'ok'   ? 'Sonido: todo bien' :
             status === 'fail' ? 'Sonido: hay problema' :
             status === 'testing' ? 'Prueba en curso...' :
             'Prueba de sonido'}
          </p>
          <p className="text-[10px] text-gray-500 leading-tight mt-0.5">
            {status === 'ok'   ? 'El audio llega correctamente al equipo' :
             status === 'fail' ? 'Revisa cables, volumen o bocinas' :
             status === 'testing' ? 'Escucha si sale el tono en los bocinas' :
             'Verifica que el audio llegue al equipo del bar'}
          </p>
        </div>
        <i className={`text-gray-600 text-xs transition-transform duration-200 flex-shrink-0 ${
          open ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'
        }`} />
      </button>

      {/* Panel expandido */}
      {open && (
        <div className={`mt-1 rounded-xl border overflow-hidden ${sc.bg} ${sc.border}`}>

          {/* Paso 0 — idle: botón de inicio */}
          {status === 'idle' && step === 0 && (
            <div className="px-3 py-3">
              <p className="text-[10px] text-gray-400 mb-3 leading-relaxed">
                La prueba hace lo siguiente en orden:
              </p>
              <ol className="space-y-1.5 mb-3">
                {[
                  { icon: 'ri-volume-up-line', text: 'Reproduce tonos de prueba por los bocinas del dispositivo' },
                  { icon: 'ri-youtube-line',   text: 'Abre una canción de prueba en YouTube para verificar el equipo del bar' },
                  { icon: 'ri-checkbox-circle-line', text: 'Tú confirmas si el sonido llegó bien o hay problema' },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-800 text-[10px] font-black text-gray-400 flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div className="flex items-center gap-1.5 flex-1">
                      <i className={`${item.icon} text-gray-500 text-xs flex-shrink-0`} />
                      <span className="text-[10px] text-gray-400 leading-tight">{item.text}</span>
                    </div>
                  </li>
                ))}
              </ol>
              <button
                onClick={startTest}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black cursor-pointer transition-colors"
              >
                <i className="ri-play-circle-line text-base" />
                Iniciar prueba de sonido
              </button>
            </div>
          )}

          {/* Paso 1 → beeps sonando */}
          {status === 'testing' && step === 1 && (
            <div className="px-3 py-3 flex flex-col items-center gap-2 text-center">
              {/* Ecualizador animado */}
              <div className="flex items-end gap-1 h-8 my-1">
                {[5,9,6,12,8,14,7,11,5,9].map((h, i) => (
                  <div
                    key={i}
                    className="w-2 bg-amber-500 rounded-full"
                    style={{
                      height: `${h}px`,
                      animation: `pulse ${0.4 + (i % 4) * 0.1}s ease-in-out infinite alternate`,
                    }}
                  />
                ))}
              </div>
              <p className="text-sm font-black text-amber-400">Reproduciendo tono de prueba...</p>
              <p className="text-[10px] text-gray-500">¿Escuchas los tonos en los bocinas del bar?</p>
            </div>
          )}

          {/* Paso 2 → ofrecer YouTube */}
          {status === 'testing' && step === 2 && (
            <div className="px-3 py-3">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-emerald-500/20 flex-shrink-0">
                  <i className="ri-checkbox-circle-fill text-emerald-400 text-base" />
                </div>
                <div>
                  <p className="text-xs font-black text-emerald-400">Tonos enviados</p>
                  <p className="text-[10px] text-gray-500">¿Salieron por los bocinas?</p>
                </div>
              </div>

              <div className="bg-gray-900/60 border border-gray-700/50 rounded-xl px-3 py-2.5 mb-2.5">
                <p className="text-[10px] text-gray-400 mb-1.5 font-bold">
                  Ahora: prueba con canción real en YouTube
                </p>
                <p className="text-[10px] text-gray-500 mb-2 leading-relaxed">
                  Abre el video, dale play en la pantalla del bar y verifica que el sonido sale bien por todas las bocinas.
                </p>
                <button
                  onClick={openYoutube}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-black cursor-pointer transition-colors"
                >
                  <i className="ri-youtube-fill text-sm" />
                  Abrir canción de prueba en YouTube
                </button>
              </div>

              <div className="flex gap-1.5">
                <button onClick={() => confirmResult(false)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-900/40 hover:bg-red-800/60 border border-red-700/40 rounded-xl text-[10px] font-bold text-red-300 cursor-pointer transition-colors">
                  <i className="ri-close-circle-line text-xs" />
                  No salió el sonido
                </button>
                <button onClick={() => confirmResult(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black cursor-pointer transition-colors">
                  <i className="ri-checkbox-circle-line text-xs" />
                  Sonido perfecto
                </button>
              </div>
            </div>
          )}

          {/* Paso 3 → YouTube abierto, esperando confirmación */}
          {status === 'testing' && step === 3 && (
            <div className="px-3 py-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-600/20 flex-shrink-0">
                  <i className="ri-youtube-fill text-red-400 text-base" />
                </div>
                <div>
                  <p className="text-xs font-black text-white">YouTube abierto</p>
                  <p className="text-[10px] text-gray-500">Dale play y sube el volumen en el equipo del bar</p>
                </div>
              </div>

              {/* Checklist visual */}
              <div className="space-y-1.5 mb-3">
                {[
                  'Dale play al video en YouTube',
                  'Asegúrate de que el dispositivo no está en silencio',
                  'Sube el volumen del receptor o amplificador del bar',
                  'Verifica que los bocinas estén encendidos',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    <span className="text-[10px] text-gray-400">{item}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-1.5">
                <button onClick={() => confirmResult(false)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-900/40 hover:bg-red-800/60 border border-red-700/40 rounded-xl text-[10px] font-bold text-red-300 cursor-pointer transition-colors">
                  <i className="ri-close-circle-line text-xs" />
                  Hay problema
                </button>
                <button onClick={() => confirmResult(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black cursor-pointer transition-colors">
                  <i className="ri-checkbox-circle-line text-xs" />
                  Todo bien
                </button>
              </div>
            </div>
          )}

          {/* Resultado OK */}
          {status === 'ok' && (
            <div className="px-3 py-3 flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 flex items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-emerald-500/40">
                <i className="ri-checkbox-circle-fill text-emerald-400 text-2xl" />
              </div>
              <p className="text-sm font-black text-emerald-400">Sonido verificado</p>
              <p className="text-[10px] text-gray-500">El audio llega bien al equipo del bar. Listo para poner la música.</p>
              <p className="text-[9px] text-gray-700 mt-1">Este panel se cerrará en 5 segundos</p>
            </div>
          )}

          {/* Resultado FAIL */}
          {status === 'fail' && (
            <div className="px-3 py-3">
              <div className="flex flex-col items-center gap-2 text-center mb-3">
                <div className="w-12 h-12 flex items-center justify-center rounded-full bg-red-500/20 ring-2 ring-red-500/40">
                  <i className="ri-error-warning-fill text-red-400 text-2xl" />
                </div>
                <p className="text-sm font-black text-red-400">Problema de sonido detectado</p>
                <p className="text-[10px] text-gray-400">Revisa lo siguiente:</p>
              </div>
              <div className="space-y-1.5 mb-3">
                {[
                  { icon: 'ri-volume-mute-line', text: 'Volumen del dispositivo no está en cero o silencio' },
                  { icon: 'ri-bluetooth-line',   text: 'Conexión Bluetooth o cable de audio al equipo del bar' },
                  { icon: 'ri-plug-line',         text: 'Bocinas encendidas y con energía' },
                  { icon: 'ri-settings-3-line',   text: 'App de música / YouTube con salida de audio correcta' },
                  { icon: 'ri-wifi-line',          text: 'Amplificador o receptor de audio encendido' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <i className={`${item.icon} text-red-400 text-xs flex-shrink-0 mt-0.5`} />
                    <span className="text-[10px] text-gray-400 leading-tight">{item.text}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={reset}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                <i className="ri-refresh-line text-sm" />
                Volver a intentar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Detector de intención de imprimir comanda ────────────────────────────────────────
function detectPrintIntent(text: string): boolean {
  const t = text.toLowerCase();
  return (
    (t.includes('imprimir') || t.includes('imprime') || t.includes('imprim') ||
     t.includes('ticket') || t.includes('comanda') || t.includes('print') ||
     t.includes('impresión') || t.includes('impresion') ||
     (t.includes('sacar') && (t.includes('ticket') || t.includes('comanda') || t.includes('recibo'))) ||
     (t.includes('generar') && (t.includes('ticket') || t.includes('comanda') || t.includes('recibo')))) &&
    (t.includes('ronda') || t.includes('mesa') || t.includes('cuenta') || t.includes('comanda') ||
     t.includes('pedido') || t.match(/\d+/) !== null || t.includes('ticket'))
  );
}

function parsePrintIntent(
  text: string,
  accounts: PosAccount[]
): { options: PrintRondaOption[]; ambiguous: boolean } {
  const t = text.toLowerCase();
  const folioMatch = t.match(/ronda[\s#]*(\d+)/) ?? t.match(/folio[\s#]*(\d+)/);
  const targetFolio = folioMatch ? parseInt(folioMatch[1], 10) : 0;
  const numMatch = t.match(/(\d+)/);
  const targetNum = numMatch ? numMatch[1] : null;

  const matchedAccounts = accounts.filter(a => {
    const spot = (a.spot ?? '').toLowerCase();
    const name = (a.customer_name ?? '').toLowerCase();
    if (targetNum && spot.includes(targetNum)) return true;
    if (name && t.includes(name.split(' ')[0])) return true;
    const spotWords = spot.split(/[\s-]+/);
    return spotWords.some(w => w.length > 2 && t.includes(w));
  });

  const candidates = matchedAccounts.length > 0 ? matchedAccounts : accounts;
  const options: PrintRondaOption[] = [];

  candidates.forEach(acc => {
    const items = acc.pos_account_items ?? [];
    if (items.length === 0) return;

    if (targetFolio > 0) {
      const folioItems = items.filter(i => i.folio_number === targetFolio);
      if (folioItems.length > 0) {
        options.push({
          account: acc,
          folio: targetFolio,
          itemCount: folioItems.length,
          label: `Ronda #${String(targetFolio).padStart(2, '0')} — ${acc.customer_name || acc.spot} (${folioItems.length} ítem${folioItems.length !== 1 ? 's' : ''})`,
        });
      }
    } else {
      const folios = [...new Set(items.map(i => i.folio_number))].sort((a, b) => b - a);
      const lastFolio = folios[0];
      if (lastFolio !== undefined) {
        const fi = items.filter(i => i.folio_number === lastFolio);
        options.push({
          account: acc,
          folio: lastFolio,
          itemCount: fi.length,
          label: `Ronda #${String(lastFolio).padStart(2, '0')} — ${acc.customer_name || acc.spot} (${fi.length} ítem${fi.length !== 1 ? 's' : ''})`,
        });
      }
    }
  });

  const ambiguous = options.length > 1 && matchedAccounts.length !== 1;
  return { options, ambiguous };
}

// ── Props principales ─────────────────────────────────────────────────────
interface CapitanBotProps {
  accounts: PosAccount[];
  onGoToAccount: (id: number) => void;
  onCloseAccount?: (accountId: number, method: ChatPayMethod, total: number) => void;
  /** Imprimir comanda desde el chat */
  onPrintComanda?: (account: PosAccount, items: PosAccountItem[], folioNumber: number) => void;
  /** Incrementar este valor abre el panel directo en el tab Música */
  openMusicTabSignal?: number;
  /** Nombre visible del bot. Default: 'El Capitán' */
  botName?: string;
}

export default function CapitanBot({ accounts, onGoToAccount, onCloseAccount, onPrintComanda, openMusicTabSignal = 0, botName = 'El Capitán' }: CapitanBotProps) {
  const [open, setOpen]           = useState(false);
  const [tab, setTab]             = useState<'mapa' | 'alertas' | 'chat' | 'musica'>('mapa');

  // ── Abrir directo en tab Música cuando cambia el signal ───────────────────
  const prevMusicSignalRef = useRef(0);
  useEffect(() => {
    if (openMusicTabSignal > 0 && openMusicTabSignal !== prevMusicSignalRef.current) {
      prevMusicSignalRef.current = openMusicTabSignal;
      setTab('musica');
      setOpen(true);
      setScreensaver(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openMusicTabSignal]);



  // ── Modo Descanso (Screensaver) ────────────────────────────────────────
  const [screensaver, setScreensaver] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const IDLE_MS = 5 * 60 * 1000; // 5 minutos sin actividad

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setScreensaver(true);
    }, IDLE_MS);
  }, []);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    const handler = () => {
      setScreensaver(false);
      resetIdleTimer();
    };
    events.forEach(ev => window.addEventListener(ev, handler, { passive: true }));
    resetIdleTimer();
    return () => {
      events.forEach(ev => window.removeEventListener(ev, handler));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  // ── YouTube embebido ────────────────────────────────────────────────────
  // Convierte URL de YouTube a embed URL
  const toEmbedUrl = useCallback((url: string): string => {
    try {
      const u = new URL(url);
      // youtube.com/watch?v=ID
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}?autoplay=1&rel=0`;
      // youtu.be/ID
      if (u.hostname === 'youtu.be') {
        const id = u.pathname.replace('/', '');
        return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
      }
      // youtube.com/playlist?list=ID
      const list = u.searchParams.get('list');
      if (list) return `https://www.youtube.com/embed/videoseries?list=${list}&autoplay=1`;
      // search URL — no podemos embeber búsquedas, abrimos en nueva pestaña
    } catch { /* noop */ }
    return '';
  }, []);
  const [input, setInput]         = useState('');
  const [messages, setMessages]   = useState<ChatMessage[]>(() => {
    const hour = new Date().getHours();
    const initMessages: ChatMessage[] = [];
    
    // Saludo variado según la hora del día
    if (hour >= 6 && hour < 12) {
      initMessages.push({
        id: 'init', from: 'capitan',
        text: '¡Buenos días! Listo para el turno. Monitoreo cuentas, pedidos, entregas, stock y billar en tiempo real. ¿Qué necesitas?',
        timestamp: new Date(),
      });
    } else if (hour >= 12 && hour < 18) {
      initMessages.push({
        id: 'init', from: 'capitan',
        text: '¡Buenas tardes! Turno activo. Cuento cuentas, pedidos, entregas, stock y billar. Escríbeme o usa el micrófono. ¿Qué ocupas?',
        timestamp: new Date(),
      });
    } else if (hour >= 18 && hour < 22) {
      initMessages.push({
        id: 'init', from: 'capitan',
        text: '¡Buenas noches! El bar se está animando. Monitoreo todo en tiempo real. ¿Qué necesitas?',
        timestamp: new Date(),
      });
    } else {
      initMessages.push({
        id: 'init', from: 'capitan',
        text: 'Turno nocturno activo. Monitoreo cuentas, pedidos, entregas, stock y billar. Escríbeme o usa el micrófono. ¿Qué necesitas?',
        timestamp: new Date(),
      });
    }
    
    return initMessages;
  });
  const [typing, setTyping]       = useState(false);
  const [pausedProducts, setPausedProducts] = useState<PausedProductItem[]>([]);
  const [billarMesas, setBillarMesas]       = useState<BillarMesa[]>([]);
  const [pendingWaiterRequests, setPendingWaiterRequests] = useState<WaiterRequest[]>([]);
  const [clientMusicRequests, setClientMusicRequests] = useState<ClientMusicRequest[]>([]);
  const [currentPlaylist, setCurrentPlaylist] = useState<MusicPlaylist | null>(null);
  const [musicEnabled, setMusicEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem('lc_music_enabled') !== 'false'; } catch { return true; }
  });
  const [tvsEnabled, setTvsEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem('lc_tvs_enabled') !== 'false'; } catch { return true; }
  });
  // ── Estado modo fútbol ─────────────────────────────────────────────
  const [futbolGame, setFutbolGame] = useState<FutbolGame>({
    name: 'Final Chivas vs Cruz Azul',
    startHour: 19,
    startMinute: 0,
    durationMinutes: 120,
    youtubeUrl: '',
  });
  const [futbolPhase, setFutbolPhase] = useState<FutbolPhase>('idle');
  const [futbolCountdown, setFutbolCountdown] = useState<string>('');
  // Modo fútbol: OFF por defecto, solo se activa si el usuario lo enciende manualmente
  const [futbolEnabled, setFutbolEnabled] = useState(() => {
    try {
      const raw = localStorage.getItem('lc_futbol_game');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      // Solo considerar activo si fue guardado hoy y tiene una fase válida
      return parsed.savedAt === new Date().toDateString() && parsed.phase !== 'finished';
    } catch { return false; }
  });
  const futbolAlertedRef = useRef<Set<string>>(new Set());
  const fixturesCheckedRef = useRef(false);
  const [matchHistory, setMatchHistory] = useState<MatchRecord[]>(() => loadMatchHistory());
  const [historyOpen, setHistoryOpen] = useState(false);
  const matchRecordIdRef = useRef<string | null>(null); // ID del partido en curso
  // Voz
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking]   = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [hidePausedPanel, setHidePausedPanel] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const messagesEndRef   = useRef<HTMLDivElement>(null);
  const inputRef         = useRef<HTMLInputElement>(null);
  const prevUrgentRef    = useRef<number>(0);
  const prevAccountCountRef = useRef<number>(-1);
  const alertedRondasRef  = useRef<Set<string>>(new Set());
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const prevVibeLevelRef  = useRef<VibeLevel>('tranquilo');

  // ── Rondas vencidas 20+ min (se recalcula en cada render) ────────────
  const overdue20Rondas = buildOverdueRondas(accounts);

  // ── Helper sonido reutilizable ─────────────────────────────────────────
  const playBeepSound = useCallback((freq: number, duration: number, gainVal: number, startOffset = 0) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;

      const scheduleNote = () => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        const startAt = ctx.currentTime + startOffset;
        osc.frequency.setValueAtTime(freq, startAt);
        gain.gain.setValueAtTime(0, startAt);
        gain.gain.linearRampToValueAtTime(gainVal, startAt + 0.01);
        gain.gain.linearRampToValueAtTime(0, startAt + duration - 0.01);
        osc.start(startAt);
        osc.stop(startAt + duration);
      };

      // Desbloquear AudioContext si está suspendido (política de autoplay del navegador)
      if (ctx.state === 'suspended') {
        ctx.resume().then(scheduleNote).catch(() => { /* ignore */ });
      } else {
        scheduleNote();
      }
    } catch (_) { /* ignore */ }
  }, []);

  // ── Sonido grave de urgencia MÁXIMA para rondas 20+ min ───────────────
  const playOverdueSound = useCallback(() => {
    // Patrón: grave descendente + alerta (diferente al beep ascendente de 15min)
    // "Bum-bum-BUM" — tono bajo, urgente, tipo alarma de cocina
    playBeepSound(440, 0.15, 0.5, 0);
    playBeepSound(330, 0.15, 0.55, 0.18);
    playBeepSound(220, 0.3,  0.6,  0.36);
    // Segunda ola corta
    playBeepSound(440, 0.1,  0.4,  0.75);
    playBeepSound(220, 0.25, 0.5,  0.90);
    if ('vibrate' in navigator) navigator.vibrate([200, 80, 200, 80, 400]);
  }, [playBeepSound]);

  // ── Agrega mensaje proactivo del Capitán sin input del usuario ────────
  const addProactiveMessage = useCallback((text: string, extra?: Partial<ChatMessage>) => {
    setMessages(prev => [...prev, {
      id: `auto-${Date.now()}-${Math.random()}`,
      from: 'capitan' as const,
      text,
      timestamp: new Date(),
      ...extra,
    }]);
  }, []);

  // ── Cargar productos pausados ────────────────────────────────────────
  const fetchPaused = useCallback(async () => {
    const { data } = await supabase.from('paused_products').select('id, name, category');
    setPausedProducts((data ?? []) as PausedProductItem[]);
  }, []);

  // ── Cargar mesas de billar ──────────────────────────────────────
  const fetchBillar = useCallback(async () => {
    const { data } = await supabase.from('billar_mesas').select('*').order('numero');
    setBillarMesas((data ?? []) as BillarMesa[]);
  }, []);

  // ── Cargar llamadas de mesero pendientes ────────────────────────────
  const fetchWaiterRequests = useCallback(async () => {
    const { data } = await supabase
      .from('waiter_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setPendingWaiterRequests((data ?? []) as WaiterRequest[]);
  }, []);

  useEffect(() => {
    fetchPaused();
    fetchBillar();
    fetchWaiterRequests();

    const ch = supabase.channel('capitan-paused-billar-waiter')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paused_products' }, fetchPaused)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'billar_mesas' }, fetchBillar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_requests' }, async (payload) => {
        await fetchWaiterRequests();
        if (payload.eventType === 'INSERT') {
          const req = payload.new as WaiterRequest;
          const isCheckRequest = ['check', 'request_bill'].includes(
            (req as WaiterRequest & { request_type?: string }).request_type ?? ''
          );
          // Solo emitir sonido sutil en el bot — WaiterCallNotifier ya muestra la tarjeta principal
          // Así evitamos duplicar la alerta visual en el chat y en la tarjeta al mismo tiempo
          if (isCheckRequest) {
            playBeepSound(1047, 0.12, 0.3, 0);
            playBeepSound(1175, 0.1, 0.3, 0.2);
          } else {
            playBeepSound(880, 0.07, 0.25, 0);
          }
          // El estado del radar/alertas del bot ya se actualiza por fetchWaiterRequests()
          // NO llamar addProactiveMessage para evitar duplicar con WaiterCallNotifier
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchPaused, fetchBillar, fetchWaiterRequests, playBeepSound]);

  const handleResumePaused = useCallback(async (id: string) => {
    await supabase.from('paused_products').delete().eq('id', id);
    fetchPaused();
  }, [fetchPaused]);

  // ── Análisis ─────────────────────────────────────────────────────────
  const alerts     = analyzeAccounts(accounts);
  const topLevel   = getTopAlertLevel(alerts);
  const colors     = LEVEL_COLORS[topLevel];
  const urgentCount = alerts.filter(a => a.level === 'danger' || a.level === 'warning').length;
  const totalAcum  = accounts.reduce((s, a) =>
    s + (a.pos_account_items ?? []).reduce((ss, i) => ss + i.unit_price * i.quantity, 0), 0);
  const allItems   = accounts.flatMap(a => a.pos_account_items ?? []);
  const pending    = allItems.filter(i => !i.delivered).length;
  const delivered  = allItems.filter(i => i.delivered).length;

  // Alertas de billar
  const billarOcupadas = billarMesas.filter(m => m.estado === 'ocupada');
  const billarAlertas  = billarOcupadas.filter(m => {
    const mins = Math.floor((Date.now() - new Date(m.updated_at).getTime()) / 60000);
    return mins >= 60;
  });
  const billarUrgente  = billarOcupadas.filter(m => {
    const mins = Math.floor((Date.now() - new Date(m.updated_at).getTime()) / 60000);
    return mins >= 90;
  });
  const totalBillarCount = urgentCount + billarUrgente.length + pendingWaiterRequests.length;

  // ── Genera el mensaje de voz de alerta automático ──────────────────────
  const buildVoiceAlert = useCallback((newAlerts: AccountAlert[], newBillarUrgente: BillarMesa[]): string => {
    const parts: string[] = [];

    // Alertas de cuentas peligrosas (danger)
    const dangers = newAlerts.filter(a => a.level === 'danger');
    if (dangers.length > 0) {
      const names = dangers.map(a => a.customerName).join(', ');
      parts.push(`Atención, ${names} ${dangers.length === 1 ? 'lleva' : 'llevan'} mucho tiempo esperando pedido.`);
    }

    // Alertas de billar urgentes
    if (newBillarUrgente.length > 0) {
      const mesasStr = newBillarUrgente.map(m => `mesa ${m.numero}`).join(' y ');
      parts.push(`Billar: ${mesasStr} ${newBillarUrgente.length === 1 ? 'lleva' : 'llevan'} más de 90 minutos. Hay que cobrar.`);
    }

    // Productos recién agotados
    if (pausedProducts.length > 0 && parts.length === 0) {
      parts.push(`Hay ${pausedProducts.length} producto${pausedProducts.length > 1 ? 's' : ''} agotado${pausedProducts.length > 1 ? 's' : ''} en el menú.`);
    }

    return parts.join(' ');
  }, [pausedProducts]);

  // ── Re-mostrar banner cuando llegan nuevas alertas ─────────────────────
  const prevTotalBillarRef = useRef(0);
  useEffect(() => {
    if (totalBillarCount > prevTotalBillarRef.current) {
      setBannerDismissed(false);
    }
    prevTotalBillarRef.current = totalBillarCount;
  }, [totalBillarCount]);

  // ── Alerta sonora/vibración/voz cuando aumentan urgentes ─────────────────
  useEffect(() => {
    const prev = prevUrgentRef.current;
    if (totalBillarCount > prev && prev >= 0) {
      if ('vibrate' in navigator) navigator.vibrate([120, 60, 120, 60, 200]);
      playBeepSound(880, 0.12, 0.35, 0);
      playBeepSound(880, 0.12, 0.35, 0.18);
      playBeepSound(660, 0.25, 0.4, 0.40);
      if (voiceEnabled) {
        const alertMsg = buildVoiceAlert(alerts, billarUrgente);
        if (alertMsg) {
          setTimeout(() => { setIsSpeaking(true); speak(alertMsg, () => setIsSpeaking(false)); }, 700);
        }
      }
    }
    prevUrgentRef.current = totalBillarCount;
  }, [totalBillarCount, buildVoiceAlert, alerts, billarUrgente, voiceEnabled, playBeepSound]);

  // ── Alerta proactiva cuando se abre una cuenta nueva ─────────────────
  useEffect(() => {
    const prev = prevAccountCountRef.current;
    if (prev === -1) {
      prevAccountCountRef.current = accounts.length;
      return;
    }
    if (accounts.length > prev) {
      const newest = [...accounts].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      if (newest) {
        const name = newest.customer_name || newest.spot || 'Cliente';
        const zona = newest.zona ? ` (${newest.zona})` : '';
        addProactiveMessage(`Nueva cuenta abierta: ${name}${zona}. Ya hay ${accounts.length} cuenta${accounts.length !== 1 ? 's' : ''} activa${accounts.length !== 1 ? 's' : ''}.`);
      }
    }
    prevAccountCountRef.current = accounts.length;
  }, [accounts, addProactiveMessage]);

  // ── Alerta proactiva de rondas urgentes (revisar cada 2 min) ─────────
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      accounts.forEach(acc => {
        const items = acc.pos_account_items ?? [];
        if (items.length === 0) return;
        const folioMap = new Map<number, typeof items>();
        items.forEach(i => {
          if (!folioMap.has(i.folio_number)) folioMap.set(i.folio_number, []);
          folioMap.get(i.folio_number)!.push(i);
        });
        folioMap.forEach((folioItems, folio) => {
          const pending = folioItems.filter(i => !i.delivered);
          if (pending.length === 0) return;
          const oldest = Math.min(...pending.map(i => new Date(i.created_at).getTime()));
          const mins = Math.floor((now - oldest) / 60000);
          const name = acc.customer_name || acc.spot || 'Cliente';
          const itemStr = `${pending.length} ítem${pending.length !== 1 ? 's' : ''}`;

          // ── CRÍTICO: 20+ min → sonido grave diferenciado, alerta roja ─────
          if (mins >= 20) {
            // Alertar cada 5 min a partir de 20min
            const keyOverdue = `${acc.id}-${folio}-overdue-${Math.floor(mins / 5)}`;
            if (!alertedRondasRef.current.has(keyOverdue)) {
              alertedRondasRef.current.add(keyOverdue);
              const msg = `CRÍTICO: Ronda #${String(folio).padStart(2, '0')} de ${name} lleva ${mins} minutos sin entregarse (${itemStr}). Atención urgente.`;
              addProactiveMessage(msg);
              playOverdueSound();
              if (voiceEnabled) {
                setTimeout(() => { setIsSpeaking(true); speak(msg, () => setIsSpeaking(false)); }, 600);
              }
            }
            return; // No emitir también la alerta de 15min
          }

          // ── AVISO: 15-19 min → beep suave ascendente ──────────────────
          if (mins >= 15) {
            const key15 = `${acc.id}-${folio}-warn-${Math.floor(mins / 5)}`;
            if (!alertedRondasRef.current.has(key15)) {
              alertedRondasRef.current.add(key15);
              const msg = `Aviso: Ronda #${String(folio).padStart(2, '0')} de ${name} lleva ${mins} minutos sin entregarse (${itemStr}).`;
              addProactiveMessage(msg);
              playBeepSound(880, 0.1, 0.3, 0);
              playBeepSound(660, 0.2, 0.35, 0.15);
              if (voiceEnabled) {
                setTimeout(() => { setIsSpeaking(true); speak(msg, () => setIsSpeaking(false)); }, 400);
              }
            }
          }
        });
      });
    };
    check();
    const iv = setInterval(check, 2 * 60 * 1000);
    return () => clearInterval(iv);
  }, [accounts, addProactiveMessage, playBeepSound, playOverdueSound, voiceEnabled]);

  // ── Sincronizar estado del partido al localStorage (para el menú web) ──
  useEffect(() => {
    const key = 'lc_futbol_game';
    if (futbolEnabled) {
      const timeStr = `${String(futbolGame.startHour).padStart(2,'0')}:${String(futbolGame.startMinute).padStart(2,'0')}`;
      const hour = futbolGame.startHour;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const payload: Record<string, unknown> = {
        name: futbolGame.name,
        startHour: futbolGame.startHour,
        startMinute: futbolGame.startMinute,
        timeStr,
        timeStr12: `${h12}:${String(futbolGame.startMinute).padStart(2,'0')} ${ampm}`,
        phase: futbolPhase,
        enabled: true,
        savedAt: new Date().toDateString(),
      };
      // Cuando termina, guardar la hora de fin para que el banner web sepa cuándo expirar
      if (futbolPhase === 'finished') {
        const existing = (() => {
          try { return JSON.parse(localStorage.getItem(key) ?? '{}'); } catch { return {}; }
        })();
        payload.finishedAt = existing.finishedAt ?? new Date().toISOString();
      }
      localStorage.setItem(key, JSON.stringify(payload));
    } else {
      localStorage.removeItem(key);
    }
  }, [futbolEnabled, futbolGame.startHour, futbolGame.startMinute, futbolGame.name, futbolPhase]);

  // ── Motor del modo fútbol ─────────────────────────────────────────────
  useEffect(() => {
    if (!futbolEnabled) {
      setFutbolPhase('idle');
      setFutbolCountdown('');
      futbolAlertedRef.current.clear();
      return;
    }
    const tick = () => {
      const now = new Date();
      const gameStart = new Date(now);
      gameStart.setHours(futbolGame.startHour, futbolGame.startMinute, 0, 0);
      const gameEnd = new Date(gameStart.getTime() + futbolGame.durationMinutes * 60 * 1000);
      const nowMs = now.getTime();
      const msToEnd = gameEnd.getTime() - nowMs;
      const msToStart = gameStart.getTime() - nowMs;

      if (nowMs >= gameEnd.getTime()) {
        if (!futbolAlertedRef.current.has('ended')) {
          futbolAlertedRef.current.add('ended');
          setFutbolPhase('finished');
          setFutbolCountdown('');
          // ── Completar registro en historial ──
          const endNow = new Date();
          const endTimeStr = `${String(endNow.getHours()).padStart(2, '0')}:${String(endNow.getMinutes()).padStart(2, '0')}`;
          const recId = matchRecordIdRef.current;
          setMatchHistory(prev => {
            const updated = prev.map(r =>
              r.id === recId
                ? { ...r, phase: 'finished' as const, endTime: endTimeStr }
                : r
            );
            // Si no encontr\u00f3 el registro (p.ej. recarg\u00f3 la p\u00e1gina), crear uno nuevo
            const found = updated.find(r => r.id === recId);
            const finalList = found ? updated : [
              ...prev,
              {
                id: recId ?? `match-${Date.now()}`,
                name: futbolGame.name,
                date: endNow.toISOString().slice(0, 10),
                startTime: `${String(futbolGame.startHour).padStart(2,'0')}:${String(futbolGame.startMinute).padStart(2,'0')}`,
                endTime: endTimeStr,
                durationMinutes: futbolGame.durationMinutes,
                phase: 'finished' as const,
                youtubeUrl: futbolGame.youtubeUrl || undefined,
              },
            ];
            saveMatchHistory(finalList);
            return finalList;
          });
          const endMsg = `El partido terminó. ¡Regresa la música al bar! Elige una playlist en el tab de Música.`;
          addProactiveMessage(endMsg, { musicOptions: suggestPlaylistByTime(accounts.length).slice(0, 3) });
          playBeepSound(660, 0.1, 0.3, 0);
          playBeepSound(880, 0.1, 0.3, 0.15);
          playBeepSound(1100, 0.2, 0.4, 0.32);
          if (voiceEnabled) setTimeout(() => { setIsSpeaking(true); speak(endMsg, () => setIsSpeaking(false)); }, 300);
        } else {
          setFutbolPhase('finished');
          setFutbolCountdown('');
        }
        return;
      }

      if (nowMs >= gameStart.getTime()) {
        const minsLeft = Math.floor(msToEnd / 60000);
        const secsLeft = Math.floor((msToEnd % 60000) / 1000);
        setFutbolCountdown(`${minsLeft}:${String(secsLeft).padStart(2, '0')}`);
        if (!futbolAlertedRef.current.has('started')) {
          futbolAlertedRef.current.add('started');
          setFutbolPhase('live');
          // ── Crear registro en historial al iniciar el partido ──
          const recId = `match-${Date.now()}`;
          matchRecordIdRef.current = recId;
          const nowDate = now.toISOString().slice(0, 10);
          const nowTime = `${String(futbolGame.startHour).padStart(2, '0')}:${String(futbolGame.startMinute).padStart(2, '0')}`;
          const newRec: MatchRecord = {
            id: recId,
            name: futbolGame.name,
            date: nowDate,
            startTime: nowTime,
            durationMinutes: futbolGame.durationMinutes,
            phase: 'live',
            youtubeUrl: futbolGame.youtubeUrl || undefined,
          };
          setMatchHistory(prev => {
            const updated = [...prev.filter(r => r.id !== recId), newRec];
            saveMatchHistory(updated);
            return updated;
          });
          const gameUrl = futbolGame.youtubeUrl || 'https://www.youtube.com/results?search_query=futbol+en+vivo+hoy';
          const startMsg = `¡Hora del partido! ${futbolGame.name} comienza ahora. Se apaga la música. Duración aprox: ${futbolGame.durationMinutes} minutos.`;
          addProactiveMessage(startMsg);
          window.open(gameUrl, '_blank', 'noopener,noreferrer');
          playBeepSound(440, 0.1, 0.5, 0); playBeepSound(550, 0.1, 0.5, 0.12);
          playBeepSound(660, 0.1, 0.5, 0.24); playBeepSound(880, 0.3, 0.6, 0.36);
          if ('vibrate' in navigator) navigator.vibrate([100, 50, 100, 50, 300]);
          if (voiceEnabled) setTimeout(() => { setIsSpeaking(true); speak(startMsg, () => setIsSpeaking(false)); }, 500);
        } else {
          setFutbolPhase('live');
        }
        return;
      }

      setFutbolPhase('idle');
      const minsToStart = Math.floor(msToStart / 60000);
      const secsToStart = Math.floor((msToStart % 60000) / 1000);
      setFutbolCountdown(minsToStart < 60 ? `${minsToStart}:${String(secsToStart).padStart(2, '0')}` : `${Math.floor(minsToStart / 60)}h ${minsToStart % 60}m`);

      if (msToStart > 0 && msToStart <= 15 * 60 * 1000 && !futbolAlertedRef.current.has('warn15')) {
        futbolAlertedRef.current.add('warn15');
        const warn = `Aviso: ${futbolGame.name} empieza en 15 minutos. A las ${String(futbolGame.startHour).padStart(2,'0')}:${String(futbolGame.startMinute).padStart(2,'0')} se apaga la música.`;
        addProactiveMessage(warn);
        playBeepSound(660, 0.12, 0.35, 0); playBeepSound(880, 0.12, 0.35, 0.18);
        if (voiceEnabled) setTimeout(() => { setIsSpeaking(true); speak(warn, () => setIsSpeaking(false)); }, 400);
      }
      if (msToStart > 0 && msToStart <= 5 * 60 * 1000 && !futbolAlertedRef.current.has('warn5')) {
        futbolAlertedRef.current.add('warn5');
        const warn5 = `¡5 minutos para el partido! ${futbolGame.name}. Baja la música ya.`;
        addProactiveMessage(warn5);
        playBeepSound(880, 0.1, 0.4, 0); playBeepSound(880, 0.1, 0.4, 0.2); playBeepSound(660, 0.25, 0.5, 0.4);
        if ('vibrate' in navigator) navigator.vibrate([150, 75, 150]);
        if (voiceEnabled) setTimeout(() => { setIsSpeaking(true); speak(warn5, () => setIsSpeaking(false)); }, 300);
      }
    };
    tick();
    const iv = setInterval(tick, 10000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [futbolEnabled, futbolGame.startHour, futbolGame.startMinute, futbolGame.durationMinutes, futbolGame.name, futbolGame.youtubeUrl, accounts.length]);

  // ── Alerta proactiva cuando cambia el nivel de ambiente ───────────────
  useEffect(() => {
    const currentVibe = getVibeInfo(accounts.length);
    const prevVibe = prevVibeLevelRef.current;

    if (currentVibe.level !== prevVibe) {
      // Solo avisar cuando SUBE de nivel (tranquilo→activo→lleno)
      const levels: VibeLevel[] = ['tranquilo', 'activo', 'lleno'];
      const currentIdx = levels.indexOf(currentVibe.level);
      const prevIdx = levels.indexOf(prevVibe);

      if (currentIdx > prevIdx && accounts.length > 0) {
        const vibe = getVibeInfo(accounts.length);
        const suggestions = vibe.autoPlaylist.slice(0, 2).map(p => p.name).join(' o ');
        const msgs: Record<VibeLevel, string> = {
          tranquilo: '',
          activo: `El bar ya tiene ${accounts.length} cuentas activas. Buen momento para subir un poco el ritmo — te sugiero ${suggestions}.`,
          lleno: `¡Bar lleno! ${accounts.length} cuentas. ${botName} recomienda subir el ritmo ahora — ${suggestions} para mantener el ambiente.`,
        };
        const msg = msgs[currentVibe.level];
        if (msg) {
          addProactiveMessage(msg, {
            musicOptions: vibe.autoPlaylist.slice(0, 2),
          });
          // Beep suave de aviso de ambiente
          playBeepSound(660, 0.08, 0.25, 0);
          playBeepSound(880, 0.08, 0.25, 0.12);
        }
      }

      prevVibeLevelRef.current = currentVibe.level;
    }
  }, [accounts.length, addProactiveMessage, playBeepSound]);

  // ── Consultar partidos de hoy al abrir el panel ─────────────────────
  useEffect(() => {
    if (!open || fixturesCheckedRef.current) return;
    fixturesCheckedRef.current = true;

    const checkFixtures = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('chivas-fixtures', {});
        if (error || !data) return;

        const { matches = [] } = data as {
          date: string;
          matches: {
            id: string;
            name: string;
            homeTeam: string;
            awayTeam: string;
            league: string;
            timeMexico: string;
            hourMexico: number;
            minuteMexico: number;
            involvesFavorite: boolean;
            status: string;
          }[];
        };

        if (matches.length === 0) return;

        const favorites = matches.filter(m => m.involvesFavorite);
        const others = matches.filter(m => !m.involvesFavorite);

        let msgText = '';
        if (favorites.length > 0) {
          const fav = favorites[0];
          msgText = `⚽ Partido hoy: ${fav.homeTeam} vs ${fav.awayTeam} (${fav.league}) a las ${fav.timeMexico}. El modo fútbol está configurado — confirma la hora en el tab Música si quieres ajustarla.`;
          setFutbolGame(prev => {
            const nameNorm = prev.name.toLowerCase();
            const isDefaultOrMatch =
              nameNorm.includes('chivas') || nameNorm.includes('cruz azul') ||
              nameNorm.includes('final') || nameNorm.includes('partido importante');
            if (isDefaultOrMatch) {
              return {
                ...prev,
                name: `${fav.homeTeam} vs ${fav.awayTeam}`,
                startHour: fav.hourMexico,
                startMinute: fav.minuteMexico,
              };
            }
            return prev;
          });
          if (others.length > 0) {
            msgText += ` También hay ${others.length} partido${others.length !== 1 ? 's' : ''} más en Liga MX hoy.`;
          }
        } else {
          const names = matches.slice(0, 3).map(m => `${m.homeTeam} vs ${m.awayTeam} a las ${m.timeMexico}`);
          msgText = `📅 Partidos de hoy en Liga MX: ${names.join('; ')}.${matches.length > 3 ? ` Y ${matches.length - 3} más.` : ''}`;
        }

        addProactiveMessage(msgText);
        playBeepSound(660, 0.08, 0.25, 0);
        playBeepSound(880, 0.08, 0.25, 0.14);
      } catch {
        // Silently ignore — fixtures check is best-effort
      }
    };

    checkFixtures();
  }, [open, addProactiveMessage, playBeepSound]);

  // ── Auto-scroll chat ─────────────────────────────────────────────────
  useEffect(() => {
    if (open && tab === 'chat') messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, tab]);

  useEffect(() => {
    if (open && tab === 'chat') setTimeout(() => inputRef.current?.focus(), 100);
  }, [open, tab]);

  // ── Pausar producto desde el chat ────────────────────────────────────
  const pauseProductFromChat = useCallback(async (product: MenuProduct) => {
    await supabase.from('paused_products').upsert({
      id: product.id,
      name: product.name,
      category: product.category,
      paused_at: new Date().toISOString(),
    });
    fetchPaused();
    const confirmMsg: ChatMessage = {
      id: Date.now().toString(),
      from: 'capitan',
      text: `✓ Pausé "${product.name}" del menú. El menú web ya no lo mostrará. Puedes reactivarlo diciendo "ya hay ${product.name}" o desde el Mapa.`,
      timestamp: new Date(),
      pausedProduct: product.name,
    };
    setMessages(prev => [
      ...prev.map(m => ({ ...m, pauseOptions: undefined })),
      confirmMsg,
    ]);
    if (voiceEnabled) {
      setIsSpeaking(true);
      speak(confirmMsg.text, () => setIsSpeaking(false));
    }
  }, [fetchPaused, voiceEnabled]);

  // ── Reactivar producto desde el chat ────────────────────────────────
  const resumeProductFromChat = useCallback(async (product: PausedProductItem) => {
    await supabase.from('paused_products').delete().eq('id', product.id);
    fetchPaused();
    const confirmMsg: ChatMessage = {
      id: Date.now().toString(),
      from: 'capitan',
      text: `✅ Reactivé "${product.name}". Ya aparece en el menú web y los clientes pueden pedirlo.`,
      timestamp: new Date(),
      resumedProduct: product.name,
    };
    setMessages(prev => [
      ...prev.map(m => ({ ...m, resumeOptions: undefined })),
      confirmMsg,
    ]);
    if (voiceEnabled) {
      setIsSpeaking(true);
      speak(confirmMsg.text, () => setIsSpeaking(false));
    }
  }, [fetchPaused, voiceEnabled]);

  // ── Estado de cobro pendiente + agregar item pendiente ──────────────────
  const [pendingCharge, setPendingCharge] = useState<{ account: PosAccount; total: number } | null>(null);
  const [pendingAdd, setPendingAdd] = useState<{ product: MenuProduct; qty: number; msgId: string } | null>(null);

  // ── Agregar producto a cuenta desde el chat ────────────────────────────
  const addItemToAccount = useCallback(async (product: MenuProduct, qty: number, acc: PosAccount) => {
    const accName = acc.customer_name || acc.spot || 'Cliente';
    const accId = acc.id;
    const folioNumber = acc.pos_account_items?.reduce((max, i) => i.folio_number > max ? i.folio_number : max, -1) + 1;
    try {
      await supabase.from('pos_account_items').insert({
        account_id: accId,
        product_name: product.name,
        unit_price: product.price,
        quantity: qty,
        delivered: false,
        size: product.category,
        created_at: new Date().toISOString(),
        folio_number: folioNumber,
        origin: 'bot',
      });
      await deductStockFromBot(product.name, qty, { accountId: accId, spot: acc.spot, folio: folioNumber });
      setPendingAdd(null);
      const subtotal = product.price * qty;
      const confirmMsg: ChatMessage = {
        id: Date.now().toString(),
        from: 'capitan',
        text: `✅ Agrégué ${qty > 1 ? qty + 'x ' : ''}"${product.name}" a la cuenta de ${accName}. +$${subtotal.toFixed(2)} al total.`,
        timestamp: new Date(),
        addConfirmed: `${qty > 1 ? qty + 'x ' : ''}${product.name} → ${accName}`,
      };
      setMessages(prev => [
        ...prev.map(m => ({ ...m, addContext: undefined })),
        confirmMsg,
      ]);
      if (voiceEnabled) { setIsSpeaking(true); speak(confirmMsg.text, () => setIsSpeaking(false)); }
      if (onCloseAccount) onCloseAccount(accId, 'cash', 0);
    } catch (error) {
      const errorMsg = `Error al agregar producto: ${error instanceof Error ? error.message : 'Desconocido'}`;
      const botMsg: ChatMessage = {
        id: Date.now().toString(),
        from: 'capitan',
        text: errorMsg,
        timestamp: new Date(),
      };
      setMessages(prev => [
        ...prev.map(m => ({ ...m, addContext: undefined })),
        botMsg,
      ]);
      if (voiceEnabled) { setIsSpeaking(true); speak(errorMsg, () => setIsSpeaking(false)); }
    }
  }, [voiceEnabled, onCloseAccount]);

  // ── Cobrar cuenta desde el chat ──────────────────────────────────────
  const chargeAccountFromChat = useCallback(async (acc: PosAccount, method: ChatPayMethod) => {
    const items = acc.pos_account_items ?? [];
    const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const cardFee = (method === 'credit_card' || method === 'debit_card') ? subtotal * 0.03 : 0;
    const total = subtotal + cardFee;
    const accName = acc.customer_name || acc.spot || 'Cliente';
    const methodLabel = CHAT_PAY_OPTIONS.find(o => o.value === method)?.label ?? method;
    await supabase.from('pos_payments').insert({
      account_id: acc.id,
      payment_method: method,
      subtotal,
      card_fee: cardFee,
      total,
    });
    await supabase.from('pos_accounts').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', acc.id);

    let resolvedCustId: number | null = acc.customer_id ?? null;
    const custName = acc.customer_name?.trim();
    const custPhone = acc.customer_phone?.trim();

    if (!resolvedCustId && custPhone) {
      const cleanPhone = custPhone.replace(/\D/g, '');
      if (cleanPhone.length >= 7) {
        const { data: foundByPhone } = await supabase
          .from('pos_customers')
          .select('id, name')
          .ilike('phone', `%${cleanPhone.slice(-10)}%`)
          .maybeSingle();
        if (foundByPhone?.id) resolvedCustId = foundByPhone.id;
      }
    }

    if (!resolvedCustId && custName) {
      const { data: foundExact } = await supabase
        .from('pos_customers')
        .select('id')
        .ilike('name', custName)
        .maybeSingle();
      if (foundExact?.id) {
        resolvedCustId = foundExact.id;
      } else {
        const { data: foundByName } = await supabase
          .from('pos_customers')
          .select('id')
          .ilike('name', `%${custName}%`)
          .maybeSingle();
        if (foundByName?.id) resolvedCustId = foundByName.id;
      }
    }

    if (resolvedCustId) {
      const { data: custData } = await supabase
        .from('pos_customers')
        .select('total_spent, loyalty_points')
        .eq('id', resolvedCustId)
        .maybeSingle();
      const prevTotal = Number(custData?.total_spent ?? 0);
      const prevPoints = Number(custData?.loyalty_points ?? 0);
      const newTotalSpent = prevTotal + total;
      const pointsEarned = Math.floor(total / 100);
      const newPoints = prevPoints + pointsEarned;

      await supabase
        .from('pos_customers')
        .update({
          total_spent: newTotalSpent,
          loyalty_points: newPoints,
          last_visit: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', resolvedCustId);

      if (pointsEarned > 0) {
        await supabase.from('loyalty_point_adjustments').insert({
          customer_id: resolvedCustId,
          delta: pointsEarned,
          points_before: prevPoints,
          points_after: newPoints,
          reason: `Cobro desde chat bot — ${accName} — Total $${total.toFixed(2)} · Pago: ${methodLabel}`,
          adjusted_by: 'pos_auto',
        });
      }

      await supabase.from('pos_account_events').insert({
        account_id: acc.id,
        customer_id: resolvedCustId,
        event_type: 'account_closed',
        description: `Cuenta cerrada (chat bot) — $${total.toFixed(2)} · ${methodLabel}${pointsEarned > 0 ? ` · +${pointsEarned} pts (total: ${newPoints})` : ''}`,
        metadata: {
          spot: acc.spot,
          total,
          payment_method: methodLabel,
          points_earned: pointsEarned,
          loyalty_points_before: prevPoints,
          loyalty_points_after: newPoints,
          closed_from: 'capitan_bot',
        },
      });
    } else {
      await supabase.from('pos_account_events').insert({
        account_id: acc.id,
        event_type: 'account_closed',
        description: `Cuenta cerrada (chat bot) — $${total.toFixed(2)} · ${methodLabel} · ⚠️ Sin cliente vinculado (no se sumaron puntos)`,
        metadata: {
          spot: acc.spot,
          total,
          payment_method: methodLabel,
          customer_name: custName ?? null,
          customer_phone: custPhone ?? null,
          customer_id_attempted: acc.customer_id ?? null,
          loyalty_error: 'Cliente no encontrado en pos_customers',
          closed_from: 'capitan_bot',
        },
      });
    }

    setPendingCharge(null);
    const confirmMsg: ChatMessage = {
      id: Date.now().toString(),
      from: 'capitan',
      text: `✅ Cobré la cuenta de ${accName} — $${total.toFixed(2)} con ${methodLabel}.${cardFee > 0 ? ` (incluye $${cardFee.toFixed(2)} de comisión terminal)` : ''} Cuenta cerrada.`,
      timestamp: new Date(),
      cobrarConfirmed: `${accName} · $${total.toFixed(2)} · ${methodLabel}`,
    };
    setMessages(prev => [
      ...prev.map(m => ({ ...m, cobrarOptions: undefined })),
      confirmMsg,
    ]);
    if (voiceEnabled) { setIsSpeaking(true); speak(confirmMsg.text, () => setIsSpeaking(false)); }
    if (onCloseAccount) onCloseAccount(acc.id, method, total);
  }, [voiceEnabled, onCloseAccount]);

  const selectChargeMethod = useCallback((method: ChatPayMethod) => {
    if (!pendingCharge) return;
    chargeAccountFromChat(pendingCharge.account, method);
  }, [pendingCharge, chargeAccountFromChat]);

  const markOverdueRondaDelivered = useCallback(async (ronda: OverdueRonda) => {
    const acc = accounts.find(a => a.id === ronda.accountId);
    if (!acc) return;
    const folioItems = (acc.pos_account_items ?? [])
      .filter(i => i.folio_number === ronda.folio && !i.delivered)
      .map(i => i.id);
    if (folioItems.length === 0) return;
    await supabase.from('pos_account_items').update({ delivered: true }).in('id', folioItems);
    const confirmed = `Ronda #${String(ronda.folio).padStart(2, '0')} de ${ronda.accountLabel} — ${folioItems.length} ítem${folioItems.length !== 1 ? 's' : ''} marcados como entregados.`;
    addProactiveMessage(confirmed, { deliveryConfirmed: confirmed });
    if (voiceEnabled) { setIsSpeaking(true); speak(confirmed, () => setIsSpeaking(false)); }
    if (onCloseAccount) onCloseAccount(ronda.accountId, 'cash', 0);
  }, [accounts, addProactiveMessage, voiceEnabled, onCloseAccount]);

  const markRondaFromChat = useCallback(async (opt: MarkDeliveredOption) => {
    const folioItems = (opt.account.pos_account_items ?? [])
      .filter(i => i.folio_number === opt.folio && !i.delivered)
      .map(i => i.id);
    if (folioItems.length === 0) return;
    await supabase.from('pos_account_items').update({ delivered: true }).in('id', folioItems);
    const label = opt.account.customer_name || opt.account.spot || 'Cliente';
    const confirmed = `Ronda #${String(opt.folio).padStart(2, '0')} de ${label} - ${folioItems.length} ítem${folioItems.length !== 1 ? 's' : ''} entregados`;
    setMessages(prev => [
      ...prev.map(m => ({ ...m, markDeliveredOptions: undefined })),
      { id: (Date.now() + 2).toString(), from: 'capitan' as const, text: confirmed, timestamp: new Date(), deliveryConfirmed: confirmed },
    ]);
    if (voiceEnabled) { setIsSpeaking(true); speak(confirmed, () => setIsSpeaking(false)); }
  }, [voiceEnabled]);

  const markWaiterAttended = useCallback(async (req: WaiterRequest) => {
    await supabase.from('waiter_requests').update({ status: 'resolved' }).eq('id', req.id);
    await fetchWaiterRequests();
    const spotLabel = req.spot || req.area || 'la mesa';
    const confirmed = `Llamada de ${spotLabel} marcada como atendida.`;
    setMessages(prev => [
      ...prev.map(m => ({
        ...m,
        waiterOptions: m.waiterOptions?.filter(w => w.id !== req.id),
      })),
      {
        id: `watt-${Date.now()}`,
        from: 'capitan' as const,
        text: confirmed,
        timestamp: new Date(),
        waiterAttended: spotLabel,
      },
    ]);
    if (voiceEnabled) { setIsSpeaking(true); speak(confirmed, () => setIsSpeaking(false)); }
  }, [fetchWaiterRequests, voiceEnabled]);

  const markAllWaiterAttended = useCallback(async () => {
    if (pendingWaiterRequests.length === 0) return;
    const ids = pendingWaiterRequests.map(r => r.id);
    await supabase.from('waiter_requests').update({ status: 'resolved' }).in('id', ids);
    await fetchWaiterRequests();
    const count = ids.length;
    const confirmed = `Todas las llamadas atendidas (${count}). El equipo está al tanto.`;
    setMessages(prev => [
      ...prev.map(m => ({ ...m, waiterOptions: undefined })),
      {
        id: `watt-all-${Date.now()}`,
        from: 'capitan' as const,
        text: confirmed,
        timestamp: new Date(),
        waiterAttended: `${count} llamada${count !== 1 ? 's' : ''} atendidas`,
      },
    ]);
    if (voiceEnabled) { setIsSpeaking(true); speak(confirmed, () => setIsSpeaking(false)); }
  }, [pendingWaiterRequests, fetchWaiterRequests, voiceEnabled]);

  const fetchCashCut = useCallback(async (): Promise<CashCutData> => {
    const turnoStart = new Date();
    turnoStart.setHours(0, 0, 0, 0);
    const { data: payments } = await supabase
      .from('pos_payments')
      .select('payment_method, subtotal, card_fee, total, created_at')
      .gte('created_at', turnoStart.toISOString())
      .order('created_at', { ascending: false });
    const pays = (payments ?? []) as {
      payment_method: string; subtotal: number; card_fee: number; total: number; created_at: string;
    }[];
    const { data: closedToday } = await supabase
      .from('pos_accounts')
      .select('id')
      .eq('status', 'closed')
      .gte('updated_at', turnoStart.toISOString());
    const prevStart = new Date(turnoStart);
    prevStart.setDate(prevStart.getDate() - 1);
    const prevEnd = new Date(prevStart);
    prevEnd.setHours(23, 59, 59, 999);
    const { data: prevPays } = await supabase
      .from('pos_payments')
      .select('total')
      .gte('created_at', prevStart.toISOString())
      .lte('created_at', prevEnd.toISOString());
    const { data: prevClosed } = await supabase
      .from('pos_accounts')
      .select('id')
      .eq('status', 'closed')
      .gte('updated_at', prevStart.toISOString())
      .lte('updated_at', prevEnd.toISOString());
    const methodMap: Record<string, { count: number; total: number }> = {};
    let totalCobrado = 0;
    let cardFeeTotal = 0;
    for (const p of pays) {
      const m = p.payment_method ?? 'cash';
      if (!methodMap[m]) methodMap[m] = { count: 0, total: 0 };
      methodMap[m].count += 1;
      methodMap[m].total += Number(p.total);
      totalCobrado += Number(p.total);
      cardFeeTotal += Number(p.card_fee ?? 0);
    }
    const breakdown: PayBreakdown[] = Object.entries(methodMap)
      .map(([method, v]) => ({
        method,
        label: PAY_METHOD_META[method]?.label ?? method,
        icon:  PAY_METHOD_META[method]?.icon  ?? 'ri-cash-line',
        count: v.count,
        total: v.total,
      }))
      .sort((a, b) => b.total - a.total);
    const prevTotal = prevPays ? prevPays.reduce((s, p) => s + Number((p as { total: number }).total), 0) : null;
    return {
      turnoStart,
      totalCobrado,
      cardFeeTotal,
      cuentasCerradas: (closedToday ?? []).length,
      cuentasAbiertas: accounts.length,
      breakdown,
      prevTurnoTotal:   prevTotal,
      prevTurnoCuentas: (prevClosed ?? []).length,
      generatedAt: new Date(),
    };
  }, [accounts.length]);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), from: 'user', text: trimmed, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    setTimeout(async () => {
      try {
        const qLower = trimmed.toLowerCase();
        const isMusicOnIntent = (qLower.includes('encender') || qLower.includes('prender') || qLower.includes('activar')) && (qLower.includes('música') || qLower.includes('musica') || qLower.includes('audio') || qLower.includes('sonido'));
        const isMusicOffIntent = (qLower.includes('apagar') || qLower.includes('quitar') || qLower.includes('silenciar') || qLower.includes('desactivar')) && (qLower.includes('música') || qLower.includes('musica') || qLower.includes('audio') || qLower.includes('sonido'));
        const isTvsOnIntent = (qLower.includes('encender') || qLower.includes('prender') || qLower.includes('activar')) && (qLower.includes('tv') || qLower.includes('televisión') || qLower.includes('television') || qLower.includes('pantalla'));
        const isTvsOffIntent = (qLower.includes('apagar') || qLower.includes('quitar') || qLower.includes('desactivar')) && (qLower.includes('tv') || qLower.includes('televisión') || qLower.includes('television') || qLower.includes('pantalla'));

        if (isMusicOnIntent || isMusicOffIntent) {
          const turnOn = isMusicOnIntent;
          if (turnOn === musicEnabled) {
            const already = turnOn ? 'La música ya está encendida.' : 'La música ya está apagada.';
            setMessages(prev => [...prev, { id: (Date.now()+1).toString(), from: 'capitan', text: already, timestamp: new Date() }]);
            setTyping(false); return;
          }
          setMusicEnabled(turnOn);
          try { localStorage.setItem('lc_music_enabled', String(turnOn)); } catch { /**/ }
          if (!turnOn) setCurrentPlaylist(null);
          const confText = turnOn ? 'Música encendida. Elige una playlist en el tab Música.' : 'Música apagada.';
          setMessages(prev => [...prev, { id: (Date.now()+1).toString(), from: 'capitan', text: confText, timestamp: new Date(), goToMusicTab: true }]);
          setTyping(false);
          playBeepSound(turnOn ? 880 : 440, 0.15, 0.3, 0);
          if (voiceEnabled) { setIsSpeaking(true); speak(confText, () => setIsSpeaking(false)); }
          return;
        }

        if (isTvsOnIntent || isTvsOffIntent) {
          const turnOn = isTvsOnIntent;
          if (turnOn === tvsEnabled) {
            const already = turnOn ? 'Las TVs ya están encendidas.' : 'Las TVs ya están apagadas.';
            setMessages(prev => [...prev, { id: (Date.now()+1).toString(), from: 'capitan', text: already, timestamp: new Date() }]);
            setTyping(false); return;
          }
          setTvsEnabled(turnOn);
          try { localStorage.setItem('lc_tvs_enabled', String(turnOn)); } catch { /**/ }
          const confText = turnOn ? 'TVs encendidas.' : 'TVs apagadas.';
          setMessages(prev => [...prev, { id: (Date.now()+1).toString(), from: 'capitan', text: confText, timestamp: new Date(), goToMusicTab: true }]);
          setTyping(false);
          playBeepSound(turnOn ? 660 : 330, 0.12, 0.3, 0);
          if (voiceEnabled) { setIsSpeaking(true); speak(confText, () => setIsSpeaking(false)); }
          return;
        }

        // — Respuesta normal —
        const response = generateResponse(trimmed, accounts, alerts, pausedProducts, billarMesas);
        const botMsg: ChatMessage = { id: (Date.now() + 1).toString(), from: 'capitan', text: response, timestamp: new Date() };
        setMessages(prev => [...prev, botMsg]);
        setTyping(false);
        if (voiceEnabled) { setIsSpeaking(true); speak(response, () => setIsSpeaking(false)); }
      } catch (err) {
        const errorText = err instanceof Error ? err.message : 'Error desconocido';
        const errorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          from: 'capitan',
          text: `Ups, algo salió mal: ${errorText}.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMsg]);
        setTyping(false);
      }
    }, 500 + Math.random() * 400);
  }, [accounts, alerts, pausedProducts, billarMesas, voiceEnabled, pendingCharge, fetchCashCut]);

  const handleSend = useCallback(() => sendMessage(input), [input, sendMessage]);
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const SpeechRecognitionClass = getSpeechRecognition();
  const voiceSupported = !!SpeechRecognitionClass;

  const startListening = useCallback(() => {
    if (!SpeechRecognitionClass) return;
    if (recognitionRef.current) recognitionRef.current.stop();
    const rec = new SpeechRecognitionClass();
    rec.lang = 'es-MX';
    rec.interimResults = false;
    rec.continuous = false;
    recognitionRef.current = rec;
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from({ length: e.results.length }, (_, i) => e.results[i]).map((r) => r[0].transcript).join('');
      setIsListening(false);
      sendMessage(transcript);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    rec.start();
    setIsListening(true);
  }, [SpeechRecognitionClass, sendMessage]);

  const stopListening = useCallback(() => { recognitionRef.current?.stop(); setIsListening(false); }, []);
  const toggleVoice = () => { if (isSpeaking) window.speechSynthesis?.cancel(); setVoiceEnabled(v => !v); setIsSpeaking(false); };
  const formatTime = (d: Date) => d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  const currentVibe = getVibeInfo(accounts.length);
  const quickQuestions = [
    '¿Cómo va el turno?',
    '¿Qué falta entregar?',
    'Resumen completo',
    'Corte de caja',
    accounts.length > 0 ? 'Cobrar cuenta' : '¿Hay agotados?',
    currentVibe.level === 'lleno' ? 'Bar lleno — subir ritmo' : 'Música para el bar',
  ].slice(0, 6);

  const openPlaylist = useCallback((playlist: MusicPlaylist) => {
    setCurrentPlaylist(playlist);
    const embedUrl = toEmbedUrl(playlist.youtubeUrl);
    if (!embedUrl) window.open(playlist.youtubeUrl, '_blank', 'noopener,noreferrer');
    const confirmMsg: ChatMessage = {
      id: `music-${Date.now()}`,
      from: 'capitan',
      text: embedUrl
        ? `Cargué "${playlist.name}" en el reproductor. ${playlist.vibe}.`
        : `Abrí "${playlist.name}" en YouTube. ${playlist.vibe}.`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev.map(m => ({ ...m, musicOptions: undefined })), confirmMsg]);
    if (voiceEnabled) { setIsSpeaking(true); speak(confirmMsg.text, () => setIsSpeaking(false)); }
  }, [voiceEnabled, toEmbedUrl]);

  const toggleMusic = useCallback(() => {
    setMusicEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('lc_music_enabled', String(next)); } catch { /**/ }
      if (!next) { setCurrentPlaylist(null); window.speechSynthesis?.cancel(); }
      addProactiveMessage(next ? 'Música encendida.' : 'Música apagada.');
      playBeepSound(next ? 880 : 440, 0.15, 0.3, 0);
      return next;
    });
  }, [addProactiveMessage, playBeepSound]);

  const toggleTvs = useCallback(() => {
    setTvsEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('lc_tvs_enabled', String(next)); } catch { /**/ }
      addProactiveMessage(next ? 'TVs encendidas.' : 'TVs apagadas.');
      playBeepSound(next ? 660 : 330, 0.12, 0.3, 0);
      return next;
    });
  }, [addProactiveMessage, playBeepSound]);

  const tabItems: { key: 'mapa' | 'alertas' | 'chat' | 'musica'; icon: string; label: string; badge?: number }[] = [
    { key: 'mapa',    icon: 'ri-map-2-line',   label: 'Mapa' },
    { key: 'alertas', icon: 'ri-radar-line',    label: 'Radar', badge: (urgentCount + overdue20Rondas.length) > 0 ? (urgentCount + overdue20Rondas.length) : undefined },
    { key: 'musica',  icon: 'ri-music-2-line',  label: 'Música' },
    { key: 'chat',    icon: 'ri-chat-3-line',   label: 'Chat' },
  ];

  const [ssTime, setSsTime] = useState(() => new Date());
  useEffect(() => { const iv = setInterval(() => setSsTime(new Date()), 1000); return () => clearInterval(iv); }, []);

  // Suppress unused variable warning
  void pendingAdd;
  void selectChargeMethod;

  return (
    <>
      {screensaver && (
        <div className="fixed inset-0 z-[200] bg-gray-950 flex flex-col" onClick={() => setScreensaver(false)}>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-6xl font-black text-white tabular-nums">
                {ssTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-gray-500 text-lg mt-2">
                {ssTime.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <p className="text-gray-600 text-sm mt-6">Toca la pantalla para despertar</p>
            </div>
          </div>
          <div className="border-t border-gray-800 px-6 py-4 flex items-center gap-4" onClick={e => e.stopPropagation()}>
            <p className="text-gray-400 text-sm flex-1">{accounts.length} cuenta{accounts.length !== 1 ? 's' : ''} activa{accounts.length !== 1 ? 's' : ''}</p>
            <button onClick={() => setScreensaver(false)} className="px-4 py-2 bg-white text-gray-900 rounded-xl font-black text-sm cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap">
              Despertar POS
            </button>
          </div>
        </div>
      )}

      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}

      <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-3">
        {open && (
          <div className="bg-gray-950 rounded-2xl shadow-2xl border border-gray-800 flex flex-col overflow-hidden" style={{ width: 360, height: 580 }} onClick={e => e.stopPropagation()}>
            <div className={`px-4 py-3 flex items-center gap-3 flex-shrink-0 ${colors.bg}`}>
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <i className="ri-anchor-line text-white text-base" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-sm leading-tight">{botName}</p>
                <p className="text-white/70 text-xs leading-tight">{colors.label} · {accounts.length} cuenta{accounts.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => { setScreensaver(true); setOpen(false); }} className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white cursor-pointer transition-all">
                  <i className="ri-moon-line text-xs" />
                </button>
                {voiceSupported && (
                  <button onClick={toggleVoice} className={`flex items-center gap-1 px-2 py-1 rounded-full cursor-pointer transition-all ${ voiceEnabled ? 'bg-white/30 text-white' : 'bg-white/10 text-white/50 hover:bg-white/20' }`}>
                    <i className={`text-xs ${voiceEnabled ? 'ri-volume-up-line' : 'ri-volume-mute-line'}`} />
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white cursor-pointer transition-colors">
                  <i className="ri-close-line text-sm" />
                </button>
              </div>
            </div>

            <div className="flex border-b border-gray-800 bg-gray-950 flex-shrink-0">
              {tabItems.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} className={`relative flex-1 py-2.5 text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1 ${ tab === t.key ? `${colors.text} border-b-2 border-current` : 'text-gray-500 hover:text-gray-300' }`}>
                  <i className={`${t.icon} text-sm`} />{t.label}
                  {t.badge !== undefined && (
                    <span className="absolute top-1 right-2 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{t.badge}</span>
                  )}
                </button>
              ))}
            </div>

            {tab === 'mapa' && (
              <div className="flex-1 overflow-y-auto p-3">
                {pausedProducts.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-wider mb-1.5">Agotados ({pausedProducts.length})</p>
                    <PausedPanel paused={pausedProducts} onResume={handleResumePaused} />
                  </div>
                )}
                {accounts.length === 0 ? (
                  <div className="text-center py-10">
                    <i className="ri-store-3-line text-4xl text-gray-700 block mb-2" />
                    <p className="text-gray-500 text-xs">Sin cuentas abiertas</p>
                  </div>
                ) : (
                  alerts.map(alert => {
                    const acc = accounts.find(a => a.id === alert.accountId);
                    if (!acc) return null;
                    return <AccountMapCard key={acc.id} account={acc} alert={alert} onClick={() => { onGoToAccount(acc.id); setOpen(false); }} />;
                  })
                )}
              </div>
            )}

            {tab === 'alertas' && (
              <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
                {overdue20Rondas.length > 0 && (
                  <div className="px-1 py-2 border-b border-gray-800 mb-2">
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <i className="ri-alarm-warning-line animate-pulse" /> Rondas &gt;20min ({overdue20Rondas.length})
                    </p>
                    {overdue20Rondas.map((ronda, idx) => (
                      <div key={`${ronda.accountId}-${ronda.folio}-${idx}`} className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-red-900/30 border border-red-600/40 mb-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-white">{ronda.accountLabel} — Ronda #{String(ronda.folio).padStart(2, '0')}</p>
                          <p className="text-[10px] text-red-300">{ronda.minutesWaiting}min sin entregar · {ronda.pendingCount} ítem{ronda.pendingCount !== 1 ? 's' : ''}</p>
                        </div>
                        <button onClick={() => markOverdueRondaDelivered(ronda)} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer text-[10px] font-bold whitespace-nowrap">
                          Entregado
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {pendingWaiterRequests.length > 0 && (
                  <div className="px-1 py-2 border-b border-gray-800 mb-2">
                    <p className="text-[10px] font-black text-orange-400 uppercase tracking-wider mb-1.5">Llamadas ({pendingWaiterRequests.length})</p>
                    {pendingWaiterRequests.map(req => (
                      <div key={req.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-orange-900/25 border border-orange-700/30 mb-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-orange-300">{req.spot || req.area}</p>
                          {req.message && <p className="text-[10px] text-gray-400 truncate">&ldquo;{req.message}&rdquo;</p>}
                        </div>
                        <button onClick={() => markWaiterAttended(req)} className="px-2 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-[10px] font-bold cursor-pointer whitespace-nowrap">
                          Atendida
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {accounts.length === 0 ? (
                  <div className="text-center py-10"><p className="text-gray-500 text-xs">Sin cuentas abiertas</p></div>
                ) : (
                  alerts.map(alert => {
                    const c = LEVEL_COLORS[alert.level];
                    return (
                      <button key={alert.accountId} onClick={() => { onGoToAccount(alert.accountId); setOpen(false); }} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-left hover:bg-gray-800/80 ${alert.level !== 'ok' ? 'bg-gray-900/60' : 'bg-gray-900/30'}`}>
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.dot} ${alert.level !== 'ok' ? 'animate-pulse' : ''}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold leading-tight truncate ${alert.level !== 'ok' ? 'text-white' : 'text-gray-400'}`}>{alert.message}</p>
                          {alert.detail && <p className="text-xs text-gray-600 mt-0.5 truncate">{alert.detail}</p>}
                        </div>
                        <i className="ri-arrow-right-s-line text-gray-600 text-sm flex-shrink-0" />
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {tab === 'musica' && (
              <div className="flex-1 overflow-y-auto pb-4">
                <div className="mx-3 mt-3 bg-gray-900 border border-gray-700/60 rounded-xl overflow-hidden">
                  <div className="flex gap-0 divide-x divide-gray-800">
                    <button onClick={toggleMusic} className={`flex-1 flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-all ${ musicEnabled ? 'bg-violet-900/20' : 'bg-gray-900/60 hover:bg-gray-800/60' }`}>
                      <i className={`text-base ${ musicEnabled ? 'ri-music-2-fill text-violet-400' : 'ri-volume-mute-line text-gray-600' }`} />
                      <span className={`text-xs font-black ${ musicEnabled ? 'text-violet-300' : 'text-gray-500' }`}>{musicEnabled ? 'Música ON' : 'Música OFF'}</span>
                    </button>
                    <button onClick={toggleTvs} className={`flex-1 flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-all ${ tvsEnabled ? 'bg-sky-900/20' : 'bg-gray-900/60 hover:bg-gray-800/60' }`}>
                      <i className={`text-base ${ tvsEnabled ? 'ri-tv-2-fill text-sky-400' : 'ri-tv-2-line text-gray-600' }`} />
                      <span className={`text-xs font-black ${ tvsEnabled ? 'text-sky-300' : 'text-gray-500' }`}>{tvsEnabled ? 'TVs ON' : 'TVs OFF'}</span>
                    </button>
                  </div>
                </div>
                <div className="mx-3 mt-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Playlists</p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {MUSIC_PLAYLISTS.map(pl => {
                      const isPlaying = currentPlaylist?.id === pl.id;
                      return (
                        <button key={pl.id} onClick={() => openPlaylist(pl)} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left cursor-pointer transition-all border ${ isPlaying ? 'bg-violet-900/40 border-violet-600/60' : 'bg-gray-900/60 border-gray-700/40 hover:border-violet-600/40' }`}>
                          <span className="text-lg flex-shrink-0">{pl.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-black truncate ${isPlaying ? 'text-violet-300' : 'text-white'}`}>{pl.name}</p>
                            <p className="text-[10px] text-gray-500 truncate">{pl.vibe}</p>
                          </div>
                          {isPlaying ? <i className="ri-play-fill text-violet-400 text-sm flex-shrink-0" /> : <i className="ri-play-fill text-gray-600 text-sm flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <VolumeAdvisor accountCount={accounts.length} playBeepSound={playBeepSound} />
                <SoundCheckPanel playBeepSound={playBeepSound} />
              </div>
            )}

            {tab === 'chat' && (
              <>
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0" style={{ maxHeight: 280 }}>
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex gap-2 ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.from === 'capitan' && (
                        <div className={`w-6 h-6 rounded-full ${colors.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          <i className="ri-anchor-line text-white text-xs" />
                        </div>
                      )}
                      <div className="max-w-[78%]">
                        <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${ msg.from === 'user' ? 'bg-gray-700 text-white rounded-tr-sm' : 'bg-gray-800 text-gray-200 rounded-tl-sm' }`}>
                          <p className="whitespace-pre-line">{msg.text}</p>
                          <p className="text-gray-500 text-[10px] mt-1 text-right">{formatTime(msg.timestamp)}</p>
                        </div>
                        {msg.pauseOptions && msg.pauseOptions.length > 0 && (
                          <div className="flex flex-col gap-1 mt-1">
                            {msg.pauseOptions.map(product => (
                              <button key={product.id} onClick={() => pauseProductFromChat(product)} className="flex items-center gap-2 px-3 py-2 bg-red-900/40 hover:bg-red-800/60 border border-red-700/40 rounded-xl text-left cursor-pointer transition-all">
                                <i className="ri-pause-circle-line text-red-400 text-sm flex-shrink-0" />
                                <span className="text-xs font-bold text-white truncate">{product.name}</span>
                                <span className="text-[10px] text-red-400 font-semibold whitespace-nowrap ml-auto">Pausar →</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {msg.resumeOptions && msg.resumeOptions.length > 0 && (
                          <div className="flex flex-col gap-1 mt-1">
                            {msg.resumeOptions.map(product => (
                              <button key={product.id} onClick={() => resumeProductFromChat(product)} className="flex items-center gap-2 px-3 py-2 bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-700/40 rounded-xl text-left cursor-pointer transition-all">
                                <i className="ri-play-circle-line text-emerald-400 text-sm flex-shrink-0" />
                                <span className="text-xs font-bold text-white truncate">{product.name}</span>
                                <span className="text-[10px] text-emerald-400 font-semibold whitespace-nowrap ml-auto">Activar →</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {msg.musicOptions && msg.musicOptions.length > 0 && (
                          <div className="flex flex-col gap-1.5 mt-1">
                            {msg.musicOptions.map(pl => (
                              <button key={pl.id} onClick={() => openPlaylist(pl)} className="flex items-center gap-2.5 px-3 py-2.5 bg-violet-900/30 hover:bg-violet-800/50 border border-violet-700/40 rounded-xl text-left cursor-pointer transition-all">
                                <span className="text-lg flex-shrink-0">{pl.emoji}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-black text-white truncate">{pl.name}</p>
                                  <p className="text-[10px] text-violet-300/70 truncate">{pl.vibe}</p>
                                </div>
                                <span className="text-[10px] text-violet-400 font-bold whitespace-nowrap">Poner →</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {msg.goToMusicTab && (
                          <button onClick={() => setTab('musica')} className="mt-1 flex items-center gap-2 w-full px-3 py-2 bg-violet-900/40 hover:bg-violet-800/60 border border-violet-600/50 rounded-xl cursor-pointer transition-all">
                            <i className="ri-music-2-line text-violet-300 text-base" />
                            <span className="text-xs font-bold text-violet-200">Ir al tab Música</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {typing && (
                    <div className="flex gap-2 justify-start">
                      <div className={`w-6 h-6 rounded-full ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                        <i className="ri-anchor-line text-white text-xs" />
                      </div>
                      <div className="bg-gray-800 px-3 py-2.5 rounded-2xl rounded-tl-sm flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto">
                  {quickQuestions.map(q => (
                    <button key={q} onClick={() => sendMessage(q)} className="flex-shrink-0 text-[10px] px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 rounded-full cursor-pointer transition-colors whitespace-nowrap">{q}</button>
                  ))}
                </div>
                <div className="px-3 pb-3 flex gap-2 border-t border-gray-800 pt-2">
                  {voiceSupported && (
                    <button onClick={isListening ? stopListening : startListening} className={`w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer transition-all flex-shrink-0 ${ isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-800 hover:bg-gray-700 text-gray-400' }`}>
                      <i className={`text-sm ${isListening ? 'ri-stop-circle-line' : 'ri-mic-line'}`} />
                    </button>
                  )}
                  <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={`Pregúntale a ${botName}...`} className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-gray-500" />
                  <button onClick={handleSend} disabled={!input.trim()} className={`w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer transition-all flex-shrink-0 ${ input.trim() ? `${colors.bg} hover:opacity-80 text-white` : 'bg-gray-800 text-gray-600 cursor-not-allowed' }`}>
                    <i className="ri-send-plane-fill text-sm" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <button onClick={() => setOpen(prev => !prev)} className={`relative flex items-center gap-2.5 pl-2 pr-4 py-2 rounded-full shadow-xl cursor-pointer transition-all active:scale-95 ring-2 ${colors.ring} ${colors.bg} hover:opacity-90`}>
          <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <i className="ri-anchor-line text-white text-base" />
          </div>
          <div className="text-left">
            <p className="text-white/70 text-[10px] leading-none mb-0.5">Asistente de turno</p>
            <p className="text-white font-black text-sm leading-none">{botName}</p>
          </div>
          {totalBillarCount > 0 && (
            <span className={`absolute -top-1 -right-1 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-white text-xs font-black ${colors.text} border-2 border-gray-950 animate-pulse`}>{totalBillarCount}</span>
          )}
          {pausedProducts.length > 0 && (
            <span className="absolute -bottom-1 -right-1 min-w-[18px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-black border-2 border-gray-950">
              {pausedProducts.length}
            </span>
          )}
          <span className={`absolute bottom-0.5 right-3 w-2.5 h-2.5 rounded-full border-2 border-gray-950 ${colors.dot} ${topLevel !== 'ok' ? 'animate-pulse' : ''}`} />
        </button>
      </div>
    </>
  );
}