import { useState, useMemo } from 'react';
import {
  wingsMenu, bonelessMenu, beerMenu, halfBeersMenu,
  sodasMenu, sidesMenu,
} from '@/mocks/menu';
import type { CartEntry } from './MenuPickerModal';
import type { PosAccountItem } from '../types';
import { useBluetoothPrinterContext } from '../context/BluetoothPrinterContext';
import type { EscPosTicketData } from '../hooks/useBluetoothPrinter';
import { usePausedProducts } from '@/hooks/usePausedProducts';

// ── Menú rápido fijo ───────────────────────────────────────────────────────
interface YaSabeItem {
  id: string;
  pausedId: string;
  emoji: string;
  name: string;
  shortName: string;
  price: number;
}

const YA_SABE_ITEMS: YaSabeItem[] = [
  { id: 'ys-wing-media',     pausedId: 'wing-media',     emoji: '🍗', name: 'Alitas Media Orden (5 pzas)',     shortName: 'Alitas Media (5 pzas)',     price: wingsMenu.prices['Media Orden (5 pzas)'] },
  { id: 'ys-wing-completa',  pausedId: 'wing-completa',  emoji: '🍗', name: 'Alitas Orden Completa (10 pzas)', shortName: 'Alitas Completa (10 pzas)', price: wingsMenu.prices['Orden Completa (10 pzas)'] },
  { id: 'ys-boneless-media', pausedId: 'boneless-media', emoji: '🍗', name: 'Boneless Media Orden (5 pzas)',   shortName: 'Boneless Media (5 pzas)',   price: bonelessMenu.prices['Media Orden (5 pzas)'] },
  { id: 'ys-cerveza-mega',   pausedId: String(beerMenu[0]?.id ?? '1'),       emoji: '🍺', name: beerMenu[0]?.name      ?? 'Corona Mega',  shortName: beerMenu[0]?.name      ?? 'Corona Mega',  price: beerMenu[0]?.price      ?? 0 },
  { id: 'ys-cerveza-medio',  pausedId: `half-${halfBeersMenu[0]?.id ?? 1}`,   emoji: '🍺', name: halfBeersMenu[0]?.name ?? 'Corona Medio', shortName: halfBeersMenu[0]?.name ?? 'Corona Medio', price: halfBeersMenu[0]?.price ?? 0 },
  { id: 'ys-refresco',       pausedId: `soda-${sodasMenu[0]?.id ?? 1}`,       emoji: '🥤', name: sodasMenu[0]?.name     ?? 'Refresco',      shortName: sodasMenu[0]?.name     ?? 'Refresco',      price: sodasMenu[0]?.price     ?? 0 },
  { id: 'ys-papas',          pausedId: `side-${sidesMenu[0]?.id ?? 1}`,       emoji: '🍟', name: sidesMenu[0]?.name     ?? 'Papas',         shortName: sidesMenu[0]?.name     ?? 'Papas',         price: sidesMenu[0]?.price     ?? 0 },
];

// ── Emoji heurístico ───────────────────────────────────────────────────────
function getEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('alita') || n.includes('wing'))    return '🍗';
  if (n.includes('boneless'))                        return '🍗';
  if (n.includes('cerveza') || n.includes('corona') || n.includes('modelo') ||
      n.includes('pacifico') || n.includes('beer')  || n.includes('mega') ||
      n.includes('medio'))                            return '🍺';
  if (n.includes('michelada'))                        return '🍺';
  if (n.includes('refresco') || n.includes('coca')   || n.includes('pepsi') || n.includes('soda')) return '🥤';
  if (n.includes('agua'))                             return '💧';
  if (n.includes('papa') || n.includes('fries'))      return '🍟';
  if (n.includes('burger') || n.includes('hambur'))   return '🍔';
  if (n.includes('hot dog'))                          return '🌭';
  if (n.includes('shot') || n.includes('tequila') || n.includes('ampol')) return '🥃';
  if (n.includes('preparado') || n.includes('vaso')  || n.includes('azulit')) return '🍹';
  if (n.includes('combo'))                            return '🎁';
  return '🍽️';
}

// ── Resumen de ronda ───────────────────────────────────────────────────────
interface RondaSummary {
  folio: number;
  items: PosAccountItem[];
  total: number;
}

function buildRondas(items: PosAccountItem[]): RondaSummary[] {
  const folios = [...new Set(items.map(i => i.folio_number))].sort((a, b) => a - b);
  return folios.map(folio => {
    const fi = items.filter(i => i.folio_number === folio);
    return { folio, items: fi, total: fi.reduce((s, i) => s + i.unit_price * i.quantity, 0) };
  });
}

function preloadQty(items: PosAccountItem[]): Record<string, number> {
  const map: Record<string, number> = {};
  items.forEach(i => { map[`repeat-${i.id}`] = i.quantity; });
  return map;
}

// ── Props ──────────────────────────────────────────────────────────────────
interface YaSabeMenuProps {
  onAdd: (entries: CartEntry[]) => void;
  onOpenFullMenu: () => void;
  onUpdateQty: (itemId: number, qty: number) => void;
  onPrintComanda?: (entries: CartEntry[], folioNumber: number) => void;
  accountItems?: PosAccountItem[];
  currentFolio?: number;
  // Datos de la cuenta para construir ticket ESC/POS directo
  accountSpot?: string;
  accountArea?: string;
  accountCustomerName?: string;
  accountCreatedAt?: string;
}

type Tab = 'menu' | 'repeat' | 'cambios';

export default function YaSabeMenu({
  onAdd,
  onOpenFullMenu,
  onUpdateQty,
  onPrintComanda,
  accountItems = [],
  currentFolio = 0,
  accountSpot = '',
  accountArea = '',
  accountCustomerName,
  accountCreatedAt,
}: YaSabeMenuProps) {
  const bt = useBluetoothPrinterContext();
  const { isPaused } = usePausedProducts();
  const [open, setOpen]               = useState(false);
  const [tab, setTab]                 = useState<Tab>('menu');
  const [selected, setSelected]       = useState<Record<string, number>>({});
  const [sent, setSent]               = useState(false);
  const [lastEntries, setLastEntries] = useState<CartEntry[]>([]);
  const [lastFolioSent, setLastFolioSent] = useState<number>(0);
  const [selectedFolio, setSelectedFolio] = useState<number | null>(null);
  // Para cambios: ediciones locales pendientes de guardar
  const [cambiosQty, setCambiosQty]   = useState<Record<number, number>>({});
  const [cambiosSaved, setCambiosSaved] = useState(false);

  // ── Datos derivados ────────────────────────────────────────────────────
  const rondas = useMemo(() => buildRondas(accountItems), [accountItems]);
  const hasRondas      = rondas.length > 0;
  const lastFolio      = hasRondas ? rondas[rondas.length - 1].folio : 0;

  const activeRondaItems = useMemo(() => {
    if (!selectedFolio) return [];
    return accountItems.filter(i => i.folio_number === selectedFolio);
  }, [selectedFolio, accountItems]);

  // Totales menú / repetir
  const totalItems = Object.values(selected).reduce((s, q) => s + q, 0);
  const totalPrice = useMemo(() => {
    if (tab === 'menu') return YA_SABE_ITEMS.reduce((s, item) => s + (selected[item.id] ?? 0) * item.price, 0);
    return activeRondaItems.reduce((s, i) => s + (selected[`repeat-${i.id}`] ?? 0) * i.unit_price, 0);
  }, [selected, tab, activeRondaItems]);

  // ── Helpers ────────────────────────────────────────────────────────────
  const handleOpen = () => {
    setSent(false);
    setCambiosSaved(false);
    if (hasRondas) {
      setTab('repeat');
      setSelectedFolio(lastFolio);
      setSelected(preloadQty(rondas[rondas.length - 1].items));
    } else {
      setTab('menu');
      setSelectedFolio(null);
      setSelected({});
    }
    // Inicializar cambios con qtys actuales
    const init: Record<number, number> = {};
    accountItems.forEach(i => { init[i.id] = i.quantity; });
    setCambiosQty(init);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelected({});
    setSent(false);
    setCambiosSaved(false);
  };

  const handleTabChange = (t: Tab) => {
    setTab(t);
    setSent(false);
    setCambiosSaved(false);
    if (t === 'repeat' && hasRondas) {
      const folio = selectedFolio ?? lastFolio;
      setSelectedFolio(folio);
      const r = rondas.find(r2 => r2.folio === folio);
      setSelected(r ? preloadQty(r.items) : {});
    } else if (t !== 'repeat') {
      setSelected({});
    }
  };

  const handleSelectFolio = (folio: number) => {
    setSelectedFolio(folio);
    setSent(false);
    const r = rondas.find(r2 => r2.folio === folio);
    setSelected(r ? preloadQty(r.items) : {});
  };

  const handleQty = (id: string, delta: number) => {
    setSelected(prev => {
      const next = (prev[id] ?? 0) + delta;
      if (next <= 0) { const u = { ...prev }; delete u[id]; return u; }
      return { ...prev, [id]: next };
    });
  };

  // ── Imprimir directo por BT ──────────────────────────────────────────
  const [btPrinting, setBtPrinting] = useState(false);
  const [btPrinted, setBtPrinted]   = useState(false);

  const handleBtPrintDirect = async (entries: CartEntry[], folioNumber: number) => {
    if (!bt.isConnected) return;
    setBtPrinting(true);
    setBtPrinted(false);
    const ticketData: EscPosTicketData = {
      mode: 'comanda',
      spot: accountSpot,
      area: accountArea,
      customerName: accountCustomerName,
      createdAt: accountCreatedAt,
      folioNumber,
      items: entries.map(e => ({
        product_name: e.menuItem.name,
        size: e.note || undefined,
        quantity: e.quantity,
        unit_price: e.menuItem.price,
        folio_number: folioNumber,
      })),
      subtotal: entries.reduce((s, e) => s + e.menuItem.price * e.quantity, 0),
      finalTotal: entries.reduce((s, e) => s + e.menuItem.price * e.quantity, 0),
    };
    await bt.print(ticketData);
    setBtPrinting(false);
    setBtPrinted(true);
    setTimeout(() => setBtPrinted(false), 2500);
  };

  // ── Confirm añadir ────────────────────────────────────────────────────
  const handleConfirm = () => {
    if (totalItems === 0) return;
    let entries: CartEntry[] = [];
    if (tab === 'menu') {
      entries = YA_SABE_ITEMS.filter(item => (selected[item.id] ?? 0) > 0).map(item => ({
        menuItem: { id: item.id, name: item.name, price: item.price },
        quantity: selected[item.id], note: '',
      }));
    } else {
      entries = activeRondaItems.filter(i => (selected[`repeat-${i.id}`] ?? 0) > 0).map(i => ({
        menuItem: { id: `repeat-${i.id}`, name: i.product_name, price: i.unit_price },
        quantity: selected[`repeat-${i.id}`], note: i.size ?? '',
      }));
    }
    if (entries.length === 0) return;
    onAdd(entries);
    setLastEntries(entries);
    // El folio que se usará: si es repeat usamos selectedFolio, si es menu usamos currentFolio (o currentFolio+1 si es primera ronda)
    const folioUsado = tab === 'repeat'
      ? (selectedFolio ?? currentFolio)
      : currentFolio === 0 ? 1 : currentFolio;
    setLastFolioSent(folioUsado);
    setSent(true);
    // No cerrar automáticamente — el usuario elige si imprime o no
  };

  const handleFullMenu = () => { handleClose(); setTimeout(onOpenFullMenu, 80); };

  // ── Guardar cambios de cantidades ─────────────────────────────────────
  const handleSaveCambios = async () => {
    const promises = accountItems
      .filter(item => cambiosQty[item.id] !== undefined && cambiosQty[item.id] !== item.quantity)
      .map(item => onUpdateQty(item.id, cambiosQty[item.id] ?? 0));
    await Promise.all(promises);
    setCambiosSaved(true);
    setTimeout(() => { setCambiosSaved(false); }, 1800);
  };

  const handleCambioQty = (itemId: number, delta: number) => {
    setCambiosQty(prev => {
      const current = prev[itemId] ?? 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [itemId]: next };
    });
  };

  // Cuenta cuántos items tienen cambio respecto a original
  const cambiosCount = accountItems.filter(i =>
    cambiosQty[i.id] !== undefined && cambiosQty[i.id] !== i.quantity
  ).length;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      {open && <div className="fixed inset-0 z-40" onClick={handleClose} />}

      <div className="fixed bottom-6 right-20 z-50 flex flex-col items-end gap-3">

        {/* ── Panel ── */}
        {open && (
          <div className="bg-gray-900 rounded-2xl shadow-2xl w-80 overflow-hidden">

            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-gray-700/60">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <p className="text-white font-black text-base">¿Lo de siempre? 🍗🍺</p>
                  {/* Indicador BT compacto */}
                  {bt.isSupported && (
                    bt.isConnected ? (
                      <div className="flex items-center gap-1 bg-green-500/20 border border-green-500/30 rounded-full px-2 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-[10px] text-green-400 font-bold leading-none truncate max-w-[64px]">
                          {bt.deviceName ?? 'BT'}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={bt.connect}
                        title="Conectar impresora Bluetooth"
                        className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-amber-500/50 rounded-full px-2 py-0.5 cursor-pointer transition-all group"
                      >
                        <i className="ri-bluetooth-line text-[10px] text-gray-500 group-hover:text-amber-400" />
                        <span className="text-[10px] text-gray-500 group-hover:text-amber-400 font-medium leading-none">BT</span>
                      </button>
                    )
                  )}
                </div>
                <button onClick={handleClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 cursor-pointer transition-colors">
                  <i className="ri-close-line text-sm" />
                </button>
              </div>

              {/* Tabs — 3 opciones */}
              <div className="grid grid-cols-3 gap-1 bg-gray-800 rounded-xl p-1">
                {/* Menú rápido */}
                <button onClick={() => handleTabChange('menu')}
                  className={`flex flex-col items-center py-1.5 px-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${tab === 'menu' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  <i className="ri-menu-line text-sm" />
                  <span className="text-[10px] mt-0.5 leading-none">Menú</span>
                </button>
                {/* Repetir */}
                <button onClick={() => handleTabChange('repeat')}
                  disabled={!hasRondas}
                  className={`flex flex-col items-center py-1.5 px-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${tab === 'repeat' ? 'bg-green-500 text-white' : hasRondas ? 'text-gray-400 hover:text-gray-200' : 'text-gray-700 cursor-not-allowed'}`}
                >
                  <i className="ri-repeat-line text-sm" />
                  <span className="text-[10px] mt-0.5 leading-none">Repetir</span>
                </button>
                {/* Cambios */}
                <button onClick={() => handleTabChange('cambios')}
                  disabled={accountItems.length === 0}
                  className={`relative flex flex-col items-center py-1.5 px-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${tab === 'cambios' ? 'bg-orange-500 text-white' : accountItems.length > 0 ? 'text-gray-400 hover:text-gray-200' : 'text-gray-700 cursor-not-allowed'}`}
                >
                  <i className="ri-edit-2-line text-sm" />
                  <span className="text-[10px] mt-0.5 leading-none">Cambios</span>
                  {cambiosCount > 0 && tab !== 'cambios' && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full text-white text-[8px] font-black flex items-center justify-center">{cambiosCount}</span>
                  )}
                </button>
              </div>
            </div>

            {/* ── Tab: Menú rápido ── */}
            {tab === 'menu' && (
              <div className="px-3 py-2 space-y-0.5 max-h-64 overflow-y-auto">
                {YA_SABE_ITEMS.map(item => {
                  const qty = selected[item.id] ?? 0;
                  const paused = isPaused(item.pausedId);
                  return (
                    <div key={item.id} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${paused ? 'bg-red-500/10 ring-1 ring-red-500/20 opacity-70' : qty > 0 ? 'bg-amber-500/15 ring-1 ring-amber-500/30' : 'hover:bg-gray-800/60'}`}>
                      <span className={`text-lg leading-none flex-shrink-0 w-6 text-center ${paused ? 'grayscale' : ''}`}>{item.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold leading-tight truncate ${paused ? 'text-red-400 line-through' : qty > 0 ? 'text-amber-300' : 'text-gray-200'}`}>
                          {item.shortName}
                          {paused && <span className="ml-1.5 text-[10px] font-black text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded-full">AGOTADO</span>}
                        </p>
                        <p className="text-xs text-gray-500 tabular-nums">${item.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {paused ? (
                          <span className="text-[10px] font-bold text-red-400 px-2 py-1 rounded-lg bg-red-500/10 whitespace-nowrap">No disponible</span>
                        ) : qty > 0 ? (
                          <>
                            <button onClick={() => handleQty(item.id, -1)} className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-700 hover:bg-red-500/80 text-white cursor-pointer transition-colors"><i className="ri-subtract-line text-xs" /></button>
                            <span className="w-5 text-center text-sm font-black text-white tabular-nums">{qty}</span>
                            <button onClick={() => handleQty(item.id, 1)} className="w-6 h-6 flex items-center justify-center rounded-full bg-amber-500 hover:bg-amber-400 text-white cursor-pointer transition-colors"><i className="ri-add-line text-xs" /></button>
                          </>
                        ) : (
                          <button onClick={() => handleQty(item.id, 1)} className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-700 hover:bg-amber-500 text-gray-500 hover:text-white cursor-pointer transition-all"><i className="ri-add-line text-xs" /></button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Tab: Repetir ronda ── */}
            {tab === 'repeat' && (
              <div className="flex flex-col max-h-[380px]">
                {/* Selector de ronda */}
                <div className="px-3 pt-2.5 pb-2 border-b border-gray-700/40">
                  <p className="text-xs text-gray-500 mb-1.5 font-medium">Elige la ronda a repetir:</p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {rondas.map(r => {
                      const isActive = selectedFolio === r.folio;
                      const isLast   = r.folio === lastFolio;
                      return (
                        <button key={r.folio} onClick={() => handleSelectFolio(r.folio)}
                          className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl cursor-pointer transition-all border ${isActive ? 'bg-green-500 border-green-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'}`}
                        >
                          <span className="font-black tabular-nums text-sm leading-none">#{String(r.folio).padStart(2, '0')}</span>
                          <span className={`text-xs mt-0.5 font-semibold tabular-nums ${isActive ? 'text-green-100' : 'text-gray-500'}`}>${r.total.toFixed(0)}</span>
                          {isLast && <span className={`text-[10px] mt-0.5 font-bold ${isActive ? 'text-green-200' : 'text-green-500'}`}>última</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Items de la ronda */}
                {selectedFolio && activeRondaItems.length > 0 && (
                  <div className="px-3 py-2 space-y-0.5 overflow-y-auto flex-1">
                    <div className="flex items-center gap-2 px-2.5 py-1.5 mb-1 bg-green-500/10 rounded-xl border border-green-500/20">
                      <i className="ri-repeat-line text-green-400 text-xs flex-shrink-0" />
                      <p className="text-xs text-green-300 font-medium">Ronda #{String(selectedFolio).padStart(2, '0')} — ajusta si quieres</p>
                    </div>
                    {activeRondaItems.map(item => {
                      const key = `repeat-${item.id}`;
                      const qty = selected[key] ?? 0;
                      return (
                        <div key={item.id} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${qty > 0 ? 'bg-green-500/15 ring-1 ring-green-500/30' : 'opacity-50 hover:opacity-80 hover:bg-gray-800/60'}`}>
                          <span className="text-lg leading-none flex-shrink-0 w-6 text-center">{getEmoji(item.product_name)}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold leading-tight truncate ${qty > 0 ? 'text-green-300' : 'text-gray-400'}`}>
                              {item.product_name}{item.size && <span className="text-gray-500 ml-1">({item.size})</span>}
                            </p>
                            <p className="text-xs text-gray-500 tabular-nums">${item.unit_price.toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {qty > 0 ? (
                              <>
                                <button onClick={() => handleQty(key, -1)} className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-700 hover:bg-red-500/80 text-white cursor-pointer transition-colors"><i className="ri-subtract-line text-xs" /></button>
                                <span className="w-5 text-center text-sm font-black text-white tabular-nums">{qty}</span>
                                <button onClick={() => handleQty(key, 1)} className="w-6 h-6 flex items-center justify-center rounded-full bg-green-500 hover:bg-green-400 text-white cursor-pointer transition-colors"><i className="ri-add-line text-xs" /></button>
                              </>
                            ) : (
                              <button onClick={() => handleQty(key, 1)} className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-700 hover:bg-green-500 text-gray-500 hover:text-white cursor-pointer transition-all"><i className="ri-add-line text-xs" /></button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Cambios ── */}
            {tab === 'cambios' && (
              <div className="px-3 py-2 max-h-72 overflow-y-auto space-y-1">
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-orange-500/10 rounded-xl border border-orange-500/20 mb-1">
                  <i className="ri-edit-2-line text-orange-400 text-xs flex-shrink-0" />
                  <p className="text-xs text-orange-300 font-medium">Modifica cantidades — luego guarda los cambios</p>
                </div>

                {rondas.map(ronda => (
                  <div key={ronda.folio} className="mb-2">
                    {/* Header de ronda */}
                    <div className="flex items-center gap-2 px-1 py-1 mb-1">
                      <span className="text-xs font-black text-gray-500 uppercase tracking-wide">
                        Ronda #{String(ronda.folio).padStart(2, '0')}
                      </span>
                      <div className="flex-1 h-px bg-gray-800" />
                    </div>

                    {ronda.items.map(item => {
                      const currentQty = cambiosQty[item.id] ?? item.quantity;
                      const originalQty = item.quantity;
                      const changed = currentQty !== originalQty;
                      const deleted = currentQty === 0;
                      return (
                        <div key={item.id} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all mb-0.5 ${deleted ? 'bg-red-500/10 ring-1 ring-red-500/20' : changed ? 'bg-orange-500/10 ring-1 ring-orange-500/20' : 'hover:bg-gray-800/60'}`}>
                          <span className="text-base leading-none flex-shrink-0 w-6 text-center">{getEmoji(item.product_name)}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold leading-tight truncate ${deleted ? 'text-red-400 line-through' : changed ? 'text-orange-300' : 'text-gray-200'}`}>
                              {item.product_name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <p className="text-xs text-gray-500 tabular-nums">${item.unit_price.toFixed(2)}</p>
                              {changed && (
                                <span className={`text-[10px] font-bold ${deleted ? 'text-red-400' : 'text-orange-400'}`}>
                                  {deleted ? '✕ quitar' : `era ${originalQty}`}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleCambioQty(item.id, -1)}
                              className={`w-6 h-6 flex items-center justify-center rounded-full text-white cursor-pointer transition-colors ${currentQty === 0 ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-700 hover:bg-red-500/80'}`}
                              disabled={currentQty === 0}
                            >
                              <i className="ri-subtract-line text-xs" />
                            </button>
                            <span className={`w-5 text-center text-sm font-black tabular-nums ${deleted ? 'text-red-400' : changed ? 'text-orange-300' : 'text-white'}`}>{currentQty}</span>
                            <button
                              onClick={() => handleCambioQty(item.id, 1)}
                              className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-700 hover:bg-orange-500 text-gray-400 hover:text-white cursor-pointer transition-colors"
                            >
                              <i className="ri-add-line text-xs" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* ── Footer ── */}
            <div className="px-3 pb-3 pt-2 border-t border-gray-700/60 space-y-2">

              {/* Footer Menú / Repetir */}
              {(tab === 'menu' || tab === 'repeat') && (
                sent ? (
                  <div className="space-y-2">
                    {/* Confirmación visual */}
                    <div className="flex items-center justify-center gap-2 py-1.5 bg-green-500/10 rounded-xl border border-green-500/20">
                      <i className="ri-checkbox-circle-fill text-green-400 text-lg" />
                      <span className="text-green-400 font-black text-sm">¡Va pa&apos; dentro!</span>
                      <span className="text-xs text-green-600 tabular-nums font-semibold">
                        Ronda #{String(lastFolioSent).padStart(2, '0')}
                      </span>
                    </div>
                    {/* Acciones post-confirmación */}
                    <div className={`grid gap-2 ${onPrintComanda ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {onPrintComanda && (
                        bt.isConnected ? (
                          /* BT conectado → imprimir directo */
                          <button
                            onClick={() => handleBtPrintDirect(lastEntries, lastFolioSent)}
                            disabled={btPrinting}
                            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap active:scale-95 ${
                              btPrinted
                                ? 'bg-green-600 text-white'
                                : btPrinting
                                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                : 'bg-green-500 hover:bg-green-400 text-white'
                            }`}
                          >
                            {btPrinting ? (
                              <>
                                <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                Imprimiendo…
                              </>
                            ) : btPrinted ? (
                              <><i className="ri-checkbox-circle-fill" />¡Impreso!</>
                            ) : (
                              <>
                                <i className="ri-bluetooth-line text-sm" />
                                Imprimir BT
                              </>
                            )}
                          </button>
                        ) : (
                          /* Sin BT → abrir modal */
                          <button
                            onClick={() => {
                              onPrintComanda(lastEntries, lastFolioSent);
                              handleClose();
                            }}
                            className="flex items-center justify-center gap-1.5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap active:scale-95"
                          >
                            <i className="ri-printer-line text-sm" />
                            Imprimir
                          </button>
                        )
                      )}
                      <button
                        onClick={handleClose}
                        className="flex items-center justify-center gap-1.5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap active:scale-95"
                      >
                        <i className="ri-check-line text-sm" />
                        Listo
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {totalItems > 0 && (
                      <div className="flex items-center justify-between px-1 py-0.5">
                        <span className="text-gray-400 text-xs">{totalItems} producto{totalItems !== 1 ? 's' : ''}</span>
                        <span className={`font-black text-sm tabular-nums ${tab === 'repeat' ? 'text-green-400' : 'text-amber-400'}`}>${totalPrice.toFixed(2)}</span>
                      </div>
                    )}
                    <button onClick={handleConfirm} disabled={totalItems === 0}
                      className={`w-full py-3 rounded-xl font-black text-base cursor-pointer transition-all whitespace-nowrap ${
                        totalItems > 0
                          ? tab === 'repeat' ? 'bg-green-500 hover:bg-green-400 text-white active:scale-[0.98]' : 'bg-amber-500 hover:bg-amber-400 text-white active:scale-[0.98]'
                          : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                      }`}
                    >
                      {totalItems > 0 ? (tab === 'repeat' ? `🔁 Repetir Ronda #${String(selectedFolio ?? 0).padStart(2, '0')}` : `👍 Sí, eso pido`) : 'Selecciona algo primero'}
                    </button>
                    <button onClick={handleFullMenu} className="w-full py-2.5 rounded-xl font-semibold text-sm cursor-pointer transition-all bg-gray-800 hover:bg-gray-700 text-gray-300 flex items-center justify-center gap-2 whitespace-nowrap">
                      <i className="ri-menu-2-line text-base" />Seguir ordenando (ver menú completo)
                    </button>
                  </>
                )
              )}

              {/* Footer Cambios */}
              {tab === 'cambios' && (
                cambiosSaved ? (
                  <div className="flex items-center justify-center gap-2 py-2.5">
                    <i className="ri-checkbox-circle-fill text-orange-400 text-xl" />
                    <span className="text-orange-300 font-black text-sm">Cambios guardados</span>
                  </div>
                ) : (
                  <button onClick={handleSaveCambios} disabled={cambiosCount === 0}
                    className={`w-full py-3 rounded-xl font-black text-sm cursor-pointer transition-all whitespace-nowrap ${
                      cambiosCount > 0
                        ? 'bg-orange-500 hover:bg-orange-400 text-white active:scale-[0.98]'
                        : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    {cambiosCount > 0 ? `Guardar ${cambiosCount} cambio${cambiosCount !== 1 ? 's' : ''}` : 'Sin cambios por guardar'}
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {/* ── Chip flotante compacto ── */}
        {!open && (
          <button
            onClick={handleOpen}
            title={hasRondas ? `${rondas.length} ronda${rondas.length !== 1 ? 's' : ''} — tap para repetir` : 'Menú rápido'}
            className="relative w-11 h-11 flex items-center justify-center bg-gray-900 hover:bg-gray-800 text-white rounded-full cursor-pointer transition-all active:scale-95"
          >
            <i className="ri-menu-line text-white text-lg" />
            {/* Punto verde = hay rondas; esquina opuesta si BT conectado */}
            {hasRondas && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-gray-900" />
            )}
            {bt.isConnected && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-400 rounded-full border-2 border-gray-900 flex items-center justify-center">
                <i className="ri-bluetooth-line text-[6px] text-white" />
              </span>
            )}
          </button>
        )}
      </div>
    </>
  );
}