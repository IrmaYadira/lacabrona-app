import { useState, useEffect, useRef } from "react";
import { useCart } from "../context/CartContext";
import CartOrderHistory from "./CartOrderHistory";

type SendMode = "close" | "keep-open";

const TIP_OPTIONS = [
  { value: 0, label: 'Sin', sub: 'propina' },
  { value: 10, label: '10%', sub: null },
  { value: 15, label: '15%', sub: null },
  { value: 20, label: '20%', sub: null },
  { value: -1, label: 'Otra', sub: 'cantidad' },
] as const;

const PAYMENT_OPTS = [
  { value: 'cash', label: 'Efectivo', icon: 'ri-money-dollar-circle-line' },
  { value: 'transfer', label: 'Transferencia', icon: 'ri-bank-line' },
  { value: 'terminal', label: 'Tarjeta', icon: 'ri-bank-card-line' },
] as const;

type TipPercent = 0 | 10 | 15 | 20 | -1;
type PayMethod = 'cash' | 'transfer' | 'terminal';

const PAY_LABELS: Record<PayMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia bancaria',
  terminal: 'Tarjeta (terminal)',
};

interface TipSelectorProps {
  subtotal: number;
  tipPercent: TipPercent;
  customTip: string;
  onChangePct: (v: TipPercent) => void;
  onChangeCustom: (v: string) => void;
  grandTotal: number;
  tipAmount: number;
}
function TipSelector({ subtotal, tipPercent, customTip, onChangePct, onChangeCustom, grandTotal, tipAmount }: TipSelectorProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Propina <span className="text-gray-400 font-normal normal-case">(opcional)</span>
      </label>
      <div className="flex gap-1.5 mb-2">
        {TIP_OPTIONS.map(opt => {
          const active = tipPercent === opt.value;
          const pesos = opt.value > 0 ? (subtotal * opt.value / 100).toFixed(0) : null;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChangePct(opt.value as TipPercent); if (opt.value !== -1) onChangeCustom(""); }}
              className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold cursor-pointer transition-all flex flex-col items-center ${
                active ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-amber-300'
              }`}
            >
              <span className="whitespace-nowrap">{opt.label}</span>
              <span className={`text-[10px] font-normal mt-0.5 ${active ? 'text-amber-100' : 'text-gray-400'}`}>
                {pesos ? `$${pesos}` : opt.sub ?? ''}
              </span>
            </button>
          );
        })}
      </div>
      {tipPercent === -1 && (
        <div className="flex items-center gap-2 bg-amber-50 border-2 border-amber-300 rounded-xl px-3 py-2">
          <span className="text-amber-600 font-bold text-sm">$</span>
          <input
            type="number"
            min="0"
            step="1"
            value={customTip}
            onChange={e => onChangeCustom(e.target.value)}
            placeholder="0.00"
            autoFocus
            className="flex-1 bg-transparent text-sm font-bold text-gray-800 focus:outline-none placeholder:text-gray-400"
          />
          {tipAmount > 0 && (
            <span className="text-xs text-amber-600 font-semibold whitespace-nowrap">
              Total ${grandTotal.toFixed(2)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function CartDrawer() {
  const {
    items, discountedItems, tableNumber, setTableNumber,
    customerName, setCustomerName,
    customerPhone, setCustomerPhone,
    orderMode, setOrderMode,
    removeItem, updateQuantity, clearCart,
    subtotal, flashDiscount, total, itemCount, isOpen, setIsOpen,
    sendToPOS, closeExistingAccount, accountId,
  } = useCart();

  const [showConfirm, setShowConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'order' | 'history'>('order');
  const [sendMode, setSendMode] = useState<SendMode>("close");
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>("cash");
  const [showClabe, setShowClabe] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successKeptOpen, setSuccessKeptOpen] = useState(false);
  const [lastFolio, setLastFolio] = useState<number | null>(null);
  const [lastTotal, setLastTotal] = useState('');
  const [lastMode, setLastMode] = useState('');
  const [lastPayment, setLastPayment] = useState('');
  const [sendingToPOS, setSendingToPOS] = useState(false);
  const [posResult, setPosResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showCloseEmpty, setShowCloseEmpty] = useState(false);
  const [closingEmpty, setClosingEmpty] = useState(false);
  // Controla si el panel de datos del cliente está expandido
  const [showClientForm, setShowClientForm] = useState(false);

  const [showEditClient, setShowEditClient] = useState(false);
  const autoLoadAttempted = useRef(false);

  const [tipPercent, setTipPercent] = useState<TipPercent>(0);
  const [customTip, setCustomTip] = useState("");

  const [emptyTipPercent, setEmptyTipPercent] = useState<TipPercent>(0);
  const [emptyCustomTip, setEmptyCustomTip] = useState("");

  // Auto-cargar nombre/tel desde localStorage al abrir el carrito si está vacío
  useEffect(() => {
    if (!isOpen) {
      autoLoadAttempted.current = false;
      return;
    }
    if (autoLoadAttempted.current) return;
    autoLoadAttempted.current = true;
    if (customerName.trim()) return;

    try {
      const raw = localStorage.getItem('lc_customer_profiles');
      if (!raw) return;
      const profiles = JSON.parse(raw) as Array<{ name?: string; phone?: string; lastUsed?: number }>;
      if (!Array.isArray(profiles) || profiles.length === 0) return;
      const mostRecent = profiles
        .filter(p => p.name?.trim())
        .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))[0];
      if (mostRecent?.name) {
        setCustomerName(mostRecent.name);
        if (mostRecent.phone) setCustomerPhone(mostRecent.phone);
      }
    } catch (e) {
      console.warn('[CartDrawer] auto-load customer failed:', e);
    }
  }, [isOpen, customerName, setCustomerName, setCustomerPhone]);

  // Resetear modo edición cuando se cierra el carrito
  useEffect(() => {
    if (!isOpen) setShowEditClient(false);
  }, [isOpen]);

  const calcTip = (pct: TipPercent, custom: string, base: number) =>
    pct === -1 ? Number(parseFloat(custom || "0").toFixed(2)) : Number((base * pct / 100).toFixed(2));

  const tipAmount = calcTip(tipPercent, customTip, subtotal);
  const grandTotal = Number((total + tipAmount).toFixed(2));

  const copyClabe = () => {
    navigator.clipboard.writeText("036320500328209850");
    setShowClabe(true);
    setTimeout(() => setShowClabe(false), 2000);
  };

  const handleOpenConfirm = (mode: SendMode) => { setSendMode(mode); setShowConfirm(true); };

  const canSend = !!customerName.trim();

  const handleSendOrder = async () => {
    if (items.length === 0) return;
    if (!canSend) return;

    setSendingToPOS(true);
    setPosResult(null);

    const folio = Math.floor(1000 + Math.random() * 9000);
    const curTip = tipAmount;
    const curTotal = grandTotal;

    const shouldClose = orderMode === 'dine-in' && sendMode === 'close';
    const posRes = await sendToPOS(items, tableNumber, customerName, customerPhone, orderMode, shouldClose, paymentMethod);
    setSendingToPOS(false);

    if (!posRes.success) {
      setPosResult({ ok: false, msg: posRes.error ?? 'Error al registrar en el POS. Intenta de nuevo.' });
      return;
    }
    setPosResult({ ok: true, msg: '¡Pedido registrado en el POS!' });

    let msg = "";
    if (orderMode === "dine-in") {
      const lbl = sendMode === "keep-open" ? "CUENTA ABIERTA" : "CERRAR CUENTA";
      const clientLabel = customerName.trim() || "Cliente";
      msg = `🍗 *LA CABRONA ALITAS*\n━━━━━━━━━━━━━━━━━━━━\n*FOLIO #${folio}*\n*${lbl} - ${clientLabel}*\n`;
      if (customerPhone.trim()) msg += `*Cel:* ${customerPhone}\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    } else {
      msg = `🍗 *LA CABRONA ALITAS*\n━━━━━━━━━━━━━━━━━━━━\n*FOLIO #${folio}*\n*PEDIDO PARA LLEVAR*\n━━━━━━━━━━━━━━━━━━━━\n*Nombre:* ${customerName}\n*Teléfono:* ${customerPhone}\n\n`;
    }
    items.forEach(item => {
      const di = discountedItems.find(d => d.id === item.id && d.size === item.size && d.notes === item.notes);
      const finalPrice = di?.finalPrice ?? item.price;
      const hasDiscount = (di?.discountPct ?? 0) > 0;
      msg += `• ${item.name}${item.size ? ` (${item.size})` : ""}\n`;
      if (hasDiscount) {
        msg += `  ${item.quantity} x ~$${item.price.toFixed(2)}~ → $${finalPrice.toFixed(2)} = $${(finalPrice * item.quantity).toFixed(2)} 🔥 −${di?.discountPct}%\n`;
      } else {
        msg += `  ${item.quantity} x $${item.price.toFixed(2)} = $${(item.price * item.quantity).toFixed(2)}\n`;
      }
      if (item.notes) msg += `  _${item.notes}_\n`;
      // Badges de extras con cobro en el ticket de WhatsApp
      if (item.notes) {
        if (item.notes.includes("extra ranch (+$15)")) msg += `  🧴 *Extra ranch +$15*\n`;
        if (item.notes.includes("Extra queso (+$10)")) msg += `  🧀 *Extra queso +$10*\n`;
        if (item.notes.includes("Extra salsa BBQ (+$10)")) msg += `  🍖 *Extra salsa BBQ +$10*\n`;
        if (item.notes.includes("Extra aderezo ranch (+$15)")) msg += `  🧴 *Extra ranch +$15*\n`;
      }
      msg += `\n`;
    });
    msg += `*Subtotal: $${subtotal.toFixed(2)}*\n`;
    if (flashDiscount > 0) msg += `*Ofertas flash: −$${flashDiscount.toFixed(2)}*\n`;
    if (curTip > 0) msg += `*Propina${tipPercent > 0 ? ` (${tipPercent}%)` : ''}: $${curTip.toFixed(2)}*\n`;
    msg += `*TOTAL: $${curTotal.toFixed(2)}*\n`;
    msg += `\n*Pago:* ${PAY_LABELS[paymentMethod]}\n`;
    if (paymentMethod === "transfer") {
      msg += `\n*Datos para transferencia:*\nBanco: Inbursa\nNombre: Irma Leal\nCLABE: 036320500328209850\n\n📎 *Favor de enviar comprobante al WhatsApp 3348567795*\n`;
    }
    msg += sendMode === "keep-open"
      ? `\n⚠️ *CUENTA ABIERTA - El cliente seguirá pidiendo*`
      : `\n✅ *CUENTA CERRADA - Favor de cobrar*`;
    msg += `\n\n¡Gracias!`;

    const enc = encodeURIComponent(msg);
    window.open(`https://wa.me/523348567795?text=${enc}`, "_blank");
    setTimeout(() => window.open(`https://wa.me/523316108329?text=${enc}`, "_blank"), 800);

    const clientPhone = customerPhone.trim().replace(/\D/g, '');
    if (clientPhone.length >= 10) {
      const fullClientPhone = clientPhone.startsWith('52') ? clientPhone : `52${clientPhone}`;
      let clientMsg = `🍗 *¡Hola! Tu pedido fue recibido en La Cabrona Alitas*\n━━━━━━━━━━━━━━━━━━━━\n*FOLIO #${folio}*\n`;
      if (orderMode === 'dine-in') {
        clientMsg += `*Cliente: ${customerName}*\n`;
      } else {
        clientMsg += `*Para Llevar · ${customerName}*\n`;
      }
      clientMsg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      items.forEach(item => {
        const di = discountedItems.find(d => d.id === item.id && d.size === item.size && d.notes === item.notes);
        const finalPrice = di?.finalPrice ?? item.price;
        const hasDiscount = (di?.discountPct ?? 0) > 0;
        clientMsg += `• ${item.name}${item.size ? ` (${item.size})` : ''} x${item.quantity}`;
        if (hasDiscount) clientMsg += ` ~$${item.price.toFixed(0)}~ → $${finalPrice.toFixed(0)} 🔥 −${di?.discountPct}%`;
        clientMsg += `\n`;
        if (item.notes) clientMsg += `  _${item.notes}_\n`;
        // Badges de extras con cobro en el ticket al cliente
        if (item.notes) {
          if (item.notes.includes("extra ranch (+$15)")) clientMsg += `  🧴 *Extra ranch +$15*\n`;
          if (item.notes.includes("Extra queso (+$10)")) clientMsg += `  🧀 *Extra queso +$10*\n`;
          if (item.notes.includes("Extra salsa BBQ (+$10)")) clientMsg += `  🍖 *Extra salsa BBQ +$10*\n`;
          if (item.notes.includes("Extra aderezo ranch (+$15)")) clientMsg += `  🧴 *Extra ranch +$15*\n`;
        }
      });
      clientMsg += `\n`;
      if (flashDiscount > 0) {
        clientMsg += `*Subtotal: $${subtotal.toFixed(2)}*\n`;
        clientMsg += `*Ofertas flash: −$${flashDiscount.toFixed(2)}*\n`;
      }
      clientMsg += `*Total: $${curTotal.toFixed(2)}*\n`;
      clientMsg += `*Pago:* ${PAY_LABELS[paymentMethod]}\n`;
      if (paymentMethod === 'transfer') {
        clientMsg += `\n*Datos para transferencia:*\nBanco: Inbursa · Irma Leal\nCLABE: 036320500328209850\n📎 Envía tu comprobante al WA: 3348567795\n`;
      }
      clientMsg += sendMode === 'keep-open'
        ? `\n⏳ Tu cuenta está abierta, puedes seguir pidiendo.`
        : `\n✅ ¡Gracias por tu visita! Te esperamos pronto.`;
      clientMsg += `\n\n🍺 *Bar La Cabrona*`;
      const clientEnc = encodeURIComponent(clientMsg);
      setTimeout(() => window.open(`https://wa.me/${fullClientPhone}?text=${clientEnc}`, '_blank'), 1600);
    }

    setLastFolio(folio);
    setLastTotal(curTotal.toString());
    setLastMode(orderMode === "dine-in" ? `${customerName.trim() || 'Cliente'}` : `Para Llevar · ${customerName}`);
    setLastPayment(PAY_LABELS[paymentMethod]);
    setSuccessKeptOpen(sendMode === "keep-open");
    setShowConfirm(false);
    clearCart();
    setShowSuccess(true);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={() => { setIsOpen(false); setShowSuccess(false); }} />

      <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-white z-50 flex flex-col">

        {/* ══ PANTALLA ÉXITO ══ */}
        {showSuccess ? (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <i className={`text-xl ${successKeptOpen ? "ri-time-line text-amber-500" : "ri-check-double-line text-green-500"}`} />
                <h2 className="text-base font-bold text-gray-900">
                  {successKeptOpen ? "¡Pedido Enviado!" : "¡Cuenta Cerrada!"}
                </h2>
              </div>
              <button onClick={() => { setShowSuccess(false); if (!successKeptOpen) setIsOpen(false); }}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer">
                <i className="ri-close-line text-xl text-gray-600" />
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center px-5 text-center overflow-y-auto py-6">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-5 ${successKeptOpen ? "bg-amber-100" : "bg-green-100"}`}>
                <i className={`text-5xl ${successKeptOpen ? "ri-time-line text-amber-500" : "ri-check-double-line text-green-500"}`} />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-1">{successKeptOpen ? "Pedido enviado al bar" : "¡Listo!"}</h2>
              <p className="text-gray-500 text-sm mb-6">{successKeptOpen ? "La cuenta sigue abierta" : "Tu pedido fue enviado por WhatsApp al bar"}</p>

              <div className="w-full bg-gray-900 rounded-2xl px-4 py-4 mb-4 text-left">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-0.5">Folio</p>
                    <p className="text-3xl font-black text-amber-400">#{lastFolio}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${successKeptOpen ? "bg-amber-500/20" : "bg-green-500/20"}`}>
                    <i className={`text-2xl ${successKeptOpen ? "ri-time-line text-amber-400" : "ri-whatsapp-line text-green-400"}`} />
                  </div>
                </div>
                <div className="border-t border-gray-700 pt-3 space-y-1.5">
                  <div className="flex justify-between text-sm gap-2">
                    <span className="text-gray-400 flex-shrink-0">Pedido</span>
                    <span className="text-white font-semibold text-right truncate">{lastMode}</span>
                  </div>
                  <div className="flex justify-between text-sm gap-2">
                    <span className="text-gray-400 flex-shrink-0">Pago</span>
                    <span className="text-white font-semibold text-right">{lastPayment}</span>
                  </div>
                  <div className="flex justify-between text-lg font-black pt-1 border-t border-gray-700">
                    <span className="text-gray-300">Total</span>
                    <span className="text-amber-400">${lastTotal}</span>
                  </div>
                </div>
              </div>

              {posResult && (
                <div className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold mb-4 ${posResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  <i className={posResult.ok ? 'ri-store-3-line' : 'ri-error-warning-line'} />
                  {posResult.msg}
                </div>
              )}
              {successKeptOpen ? (
                <button onClick={() => setShowSuccess(false)}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white py-4 rounded-xl font-bold text-base cursor-pointer transition-colors whitespace-nowrap">
                  <i className="ri-add-circle-line mr-2" />Seguir Pidiendo
                </button>
              ) : (
                <button onClick={() => { setShowSuccess(false); setIsOpen(false); }}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white py-4 rounded-xl font-bold text-base cursor-pointer transition-colors whitespace-nowrap">
                  <i className="ri-restaurant-line mr-2" />Volver al Menú
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            {/* ══ PANTALLA NORMAL ══ */}
            {/* Header compacto */}
            <div className="flex items-center justify-between px-4 pt-3 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <i className="ri-bill-line text-amber-500 text-xl" />
                <div>
                  <h2 className="text-base font-bold text-gray-900">Mi Cuenta</h2>
                  <p className="text-xs text-gray-500">{itemCount} artículo{itemCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer">
                <i className="ri-close-line text-xl text-gray-600" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 border-b border-gray-100 bg-gray-50">
              <button
                onClick={() => setActiveTab('order')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold cursor-pointer transition-all border-b-2 ${
                  activeTab === 'order'
                    ? 'border-amber-500 text-amber-600 bg-amber-50/50'
                    : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
              >
                <i className="ri-shopping-cart-2-line text-sm" />
                Pedido actual
                {itemCount > 0 && (
                  <span className={`text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center ${
                    activeTab === 'order' ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold cursor-pointer transition-all border-b-2 ${
                  activeTab === 'history'
                    ? 'border-amber-500 text-amber-600 bg-amber-50/50'
                    : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
              >
                <i className="ri-history-line text-sm" />
                Historial de rondas
              </button>
            </div>

            {/* ── TAB HISTORIAL ── */}
            {activeTab === 'history' && (
              <div className="flex-1 overflow-y-auto">
                <CartOrderHistory />
              </div>
            )}

            {/* ── TAB PEDIDO ACTUAL ── */}
            {activeTab === 'order' && (<>

            {/* ── ÁREA SCROLLABLE: solo productos ── */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {items.length === 0 ? (
                <div className="flex flex-col items-center py-8 px-2">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <i className="ri-receipt-line text-2xl text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium">No hay productos nuevos</p>
                  <p className="text-gray-400 text-xs mt-1 mb-5">Agrega algo del menú o cierra tu cuenta</p>
                  <button onClick={() => setIsOpen(false)}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold text-sm cursor-pointer transition-colors whitespace-nowrap">
                    <i className="ri-restaurant-line mr-1.5" />Ver Menú
                  </button>
                  {orderMode === "dine-in" && (tableNumber || accountId) && (
                    <button onClick={() => setShowCloseEmpty(true)}
                      className="mt-3 w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold text-sm cursor-pointer transition-colors whitespace-nowrap">
                      <i className="ri-close-circle-line mr-1.5" />
                      {tableNumber ? `Cerrar Mi Cuenta · Mesa #${tableNumber}` : 'Cerrar Mi Cuenta'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-0">
                  {/* Banner ahorro */}
                  {flashDiscount > 0 && (
                    <div className="mb-3 rounded-xl bg-green-50 border border-green-200 px-3 py-2.5 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <i className="ri-fire-fill text-green-600 text-sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-green-800 text-xs font-black leading-tight">
                          Ahorro acumulado: ${flashDiscount.toFixed(2)}
                        </p>
                        <p className="text-green-600 text-[10px] leading-tight mt-0.5">
                          Gracias a las ofertas flash aplicadas
                        </p>
                      </div>
                      <div className="text-green-600 text-lg font-black flex-shrink-0">
                        −${flashDiscount.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {/* Encabezado tabla */}
                  <div className="flex text-xs text-gray-400 border-b border-dashed border-gray-200 pb-2 mb-2">
                    <span className="w-14 text-center flex-shrink-0">CANT</span>
                    <span className="flex-1 text-center">DESCRIPCIÓN</span>
                    <span className="w-16 text-right flex-shrink-0">IMPORTE</span>
                  </div>

                  {discountedItems.map(item => (
                    <div key={`${item.id}-${item.size || ""}-${item.notes || ""}`} className="flex items-start gap-2 py-2.5 border-b border-gray-50">
                      <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1, item.size)}
                          className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-200 hover:border-amber-500 hover:text-amber-600 text-gray-400 cursor-pointer">
                          <i className="ri-add-line text-xs" />
                        </button>
                        <span className="w-6 text-center text-sm font-bold text-gray-900">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1, item.size)}
                          className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-200 hover:border-amber-500 hover:text-amber-600 text-gray-400 cursor-pointer">
                          <i className="ri-subtract-line text-xs" />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 leading-tight">{item.name}</p>
                        {item.size && <p className="text-xs text-gray-500 mt-0.5">{item.size}</p>}
                        {item.notes && <p className="text-xs text-amber-600 mt-0.5 italic line-clamp-2">{item.notes}</p>}
                        {/* Badges de extras con cobro para que el POS los vea claro */}
                        {item.notes && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {item.notes.includes("extra ranch (+$15)") && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200">
                                <i className="ri-add-line" />
                                Extra ranch +$15
                              </span>
                            )}
                            {item.notes.includes("Extra queso (+$10)") && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200">
                                <i className="ri-add-line" />
                                Extra queso +$10
                              </span>
                            )}
                            {item.notes.includes("Extra salsa BBQ (+$10)") && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200">
                                <i className="ri-add-line" />
                                Extra salsa BBQ +$10
                              </span>
                            )}
                            {item.notes.includes("Extra aderezo ranch (+$15)") && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200">
                                <i className="ri-add-line" />
                                Extra ranch +$15
                              </span>
                            )}
                          </div>
                        )}
                        {item.discountPct > 0 ? (
                          <div className="mt-0.5">
                            <p className="text-xs text-gray-400 line-through">${item.price.toFixed(2)} c/u</p>
                            <p className="text-xs text-amber-600 font-semibold">${item.finalPrice.toFixed(2)} c/u</p>
                            <p className="text-[10px] text-green-600 font-semibold">🔥 {item.offerTitle} −{item.discountPct}%</p>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 mt-0.5">${item.price.toFixed(2)} c/u</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                        <p className="text-sm font-bold text-gray-900">${(item.finalPrice * item.quantity).toFixed(2)}</p>
                        {item.discountPct > 0 && (
                          <span className="text-[10px] text-green-600 font-semibold bg-green-50 px-1.5 py-0.5 rounded">
                            −{item.discountPct}%
                          </span>
                        )}
                        <button onClick={() => removeItem(item.id, item.size)}
                          className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 cursor-pointer">
                          <i className="ri-delete-bin-line text-sm" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Totales inline (dentro del scroll, al final de los items) */}
                  <div className="border-t-2 border-dashed border-gray-200 mt-1 pt-3 pb-1 space-y-1 text-sm">
                    <div className="flex justify-between text-gray-500">
                      <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
                    </div>
                    {flashDiscount > 0 && (
                      <div className="flex justify-between items-center text-green-700 bg-green-50 rounded-lg px-2 py-1 -mx-1">
                        <span className="flex items-center gap-1.5 text-xs font-bold">
                          <i className="ri-fire-fill text-green-500" />
                          Ofertas flash
                        </span>
                        <span className="font-bold">−${flashDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    {tipAmount > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>Propina{tipPercent > 0 ? ` (${tipPercent}%)` : ''}</span>
                        <span>+${tipAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-100">
                      <span>TOTAL</span>
                      <span className="text-amber-600">${grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Botón limpiar carrito */}
                  <div className="pt-1 pb-2">
                    <button
                      onClick={() => setShowClearConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-gray-400 hover:text-red-500 cursor-pointer transition-colors rounded-lg hover:bg-red-50 group"
                    >
                      <i className="ri-delete-bin-2-line text-sm group-hover:text-red-500 transition-colors" />
                      Limpiar carrito
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── FOOTER FIJO: datos del cliente + pago + botones ── */}
            {items.length > 0 && (
              <div className="border-t border-gray-200 bg-white">

                {/* Modo comer aquí / para llevar — siempre visible */}
                <div className="px-4 pt-3 pb-2">
                  <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                    {(['dine-in', 'pickup'] as const).map(m => (
                      <button key={m} onClick={() => setOrderMode(m)}
                        className={`flex-1 py-2 text-xs font-semibold rounded-md cursor-pointer transition-all whitespace-nowrap ${orderMode === m ? "bg-amber-500 text-white shadow-sm" : "text-gray-500 hover:bg-white hover:text-gray-700"}`}>
                        <i className={`${m === 'dine-in' ? 'ri-restaurant-line' : 'ri-shopping-bag-3-line'} mr-1`} />
                        {m === 'dine-in' ? 'Comer Aquí' : 'Para Llevar'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cliente */}
                <div className="px-4 pb-2">
                  {customerName.trim() && !showEditClient ? (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <i className="ri-user-line text-green-600 text-sm" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{customerName}</p>
                          {customerPhone.trim() && (
                            <p className="text-xs text-gray-500">{customerPhone}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setShowEditClient(true)}
                        className="text-xs font-semibold text-amber-600 hover:text-amber-700 cursor-pointer whitespace-nowrap ml-2 px-2 py-1 rounded-md hover:bg-amber-50 transition-colors"
                      >
                        <i className="ri-edit-line mr-1" />Editar
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <div className="flex-1 min-w-0">
                          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-colors ${
                            customerName.trim() ? 'border-green-400 bg-green-50' : 'border-red-300 bg-red-50'
                          }`}>
                            <i className={`ri-user-line text-sm flex-shrink-0 ${customerName.trim() ? 'text-green-600' : 'text-red-400'}`} />
                            <input
                              type="text"
                              value={customerName}
                              onChange={e => setCustomerName(e.target.value)}
                              placeholder="Tu nombre *"
                              className="flex-1 bg-transparent text-sm font-semibold focus:outline-none placeholder:text-red-400 placeholder:font-normal min-w-0"
                            />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-gray-200 bg-gray-50">
                            <i className="ri-whatsapp-line text-sm text-green-500 flex-shrink-0" />
                            <input
                              type="tel"
                              value={customerPhone}
                              onChange={e => setCustomerPhone(e.target.value)}
                              placeholder="WhatsApp (opcional)"
                              className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-gray-400 min-w-0"
                            />
                          </div>
                        </div>
                      </div>
                      {!customerName.trim() && (
                        <p className="pt-1 text-xs text-red-500 font-medium flex items-center gap-1">
                          <i className="ri-error-warning-line" />
                          Escribe tu nombre para poder enviar el pedido
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Propinas + Pago — colapsable */}
                <div className="px-4 pb-2">
                  <button
                    onClick={() => setShowClientForm(v => !v)}
                    className="w-full flex items-center justify-between py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <i className="ri-settings-3-line text-sm" />
                      Propina &amp; Forma de pago
                      {(tipPercent !== 0 || paymentMethod !== 'cash') && (
                        <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {tipPercent !== 0 ? (tipPercent === -1 ? `$${tipAmount.toFixed(0)} propina` : `${tipPercent}% propina`) : ''}
                          {tipPercent !== 0 && paymentMethod !== 'cash' ? ' · ' : ''}
                          {paymentMethod !== 'cash' ? PAY_LABELS[paymentMethod] : ''}
                        </span>
                      )}
                    </span>
                    <i className={`text-gray-400 transition-transform ${showClientForm ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`} />
                  </button>

                  {showClientForm && (
                    <div className="space-y-3 pb-2">
                      <TipSelector
                        subtotal={subtotal}
                        tipPercent={tipPercent}
                        customTip={customTip}
                        onChangePct={setTipPercent}
                        onChangeCustom={setCustomTip}
                        grandTotal={grandTotal}
                        tipAmount={tipAmount}
                      />

                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Forma de Pago</label>
                        <div className="flex gap-2">
                          {PAYMENT_OPTS.map(opt => (
                            <button key={opt.value} type="button" onClick={() => setPaymentMethod(opt.value)}
                              className={`flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === opt.value ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'}`}>
                              <i className={`${opt.icon} text-lg`} />
                              <span className="text-xs font-semibold whitespace-nowrap">{opt.label}</span>
                            </button>
                          ))}
                        </div>
                        {paymentMethod === 'transfer' && (
                          <button type="button" onClick={copyClabe}
                            className="w-full mt-2 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-medium cursor-pointer hover:bg-amber-100 transition-colors">
                            <i className="ri-bank-card-line flex-shrink-0" />
                            <div className="flex-1 text-left min-w-0">
                              <p className="text-xs font-bold truncate">Banco Inbursa · Irma Leal</p>
                              <p className="text-xs truncate">CLABE: 036320500328209850</p>
                              <p className="text-xs text-amber-600 truncate">Comprobante al WA: 3348567795</p>
                            </div>
                            <i className="ri-file-copy-line flex-shrink-0" />
                          </button>
                        )}
                        {showClabe && <p className="text-xs text-green-600 font-medium mt-1 text-center"><i className="ri-check-line" /> CLABE copiada</p>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Botones de acción */}
                <div className="px-4 pb-4 space-y-2">
                  {orderMode === "dine-in" && (
                    <button onClick={() => handleOpenConfirm("keep-open")} disabled={!canSend}
                      className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3.5 rounded-md font-bold text-sm uppercase tracking-wide cursor-pointer transition-all whitespace-nowrap">
                      <i className="ri-time-line text-lg" />Enviar y Seguir Pidiendo
                    </button>
                  )}
                  <button onClick={() => handleOpenConfirm("close")} disabled={!canSend}
                    className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-md font-bold text-sm uppercase tracking-wide cursor-pointer transition-colors whitespace-nowrap">
                    <i className="ri-send-plane-line mr-1.5" />
                    {orderMode === "dine-in"
                      ? customerName.trim()
                        ? `Cerrar Cuenta · ${customerName}`
                        : `Cerrar Cuenta`
                      : "Enviar Pedido Para Llevar"}
                  </button>
                  {orderMode === "pickup" && (
                    <button onClick={() => setIsOpen(false)}
                      className="w-full flex items-center justify-center gap-2 border-2 border-amber-500 text-amber-600 hover:bg-amber-50 py-2.5 rounded-md text-sm font-bold cursor-pointer transition-colors whitespace-nowrap">
                      <i className="ri-add-circle-line text-lg" />Pedir Algo Más
                    </button>
                  )}
                </div>
              </div>
            )}

            </>)}
          </>
        )}
      </div>

      {/* ══ MODAL CERRAR CUENTA VACÍA ══ */}
      {showCloseEmpty && (() => {
        const emptyTip = calcTip(emptyTipPercent, emptyCustomTip, 0);
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowCloseEmpty(false)} />
            <div className="relative bg-white rounded-2xl p-5 max-w-sm w-full overflow-y-auto max-h-[90vh]">
              <div className="text-center mb-4">
                <div className="w-12 h-12 mx-auto mb-3 bg-red-100 rounded-full flex items-center justify-center">
                  <i className="ri-close-circle-line text-xl text-red-500" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1">Cerrar Cuenta</h3>
                <p className="text-sm text-gray-500">
                  {tableNumber ? (
                    <>Mesa <strong>#{tableNumber}</strong></>
                  ) : customerName.trim() ? (
                    <><strong>{customerName}</strong></>
                  ) : (
                    <>Cuenta abierta</>
                  )}
                </p>
              </div>

              <div className="mb-4">
                <TipSelector
                  subtotal={0}
                  tipPercent={emptyTipPercent}
                  customTip={emptyCustomTip}
                  onChangePct={setEmptyTipPercent}
                  onChangeCustom={setEmptyCustomTip}
                  grandTotal={emptyTip}
                  tipAmount={emptyTip}
                />
              </div>

              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Forma de Pago</p>
              <div className="flex gap-2 mb-4">
                {PAYMENT_OPTS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => setPaymentMethod(opt.value)}
                    className={`flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === opt.value ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'}`}>
                    <i className={`${opt.icon} text-lg`} />
                    <span className="text-xs font-semibold whitespace-nowrap">{opt.label}</span>
                  </button>
                ))}
              </div>

              {paymentMethod === 'transfer' && (
                <button type="button" onClick={copyClabe}
                  className="w-full mb-4 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 cursor-pointer hover:bg-amber-100">
                  <i className="ri-bank-card-line flex-shrink-0" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-xs font-bold truncate">Banco Inbursa · Irma Leal</p>
                    <p className="text-xs truncate">CLABE: 036320500328209850</p>
                  </div>
                  <i className="ri-file-copy-line flex-shrink-0" />
                </button>
              )}

              <div className="flex gap-3">
                <button onClick={() => setShowCloseEmpty(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                  Cancelar
                </button>
                <button
                  disabled={closingEmpty}
                  onClick={async () => {
                    setClosingEmpty(true);
                    const closeSpot = tableNumber || customerName || '';
                    const res = await closeExistingAccount(closeSpot, paymentMethod);
                    setClosingEmpty(false);
                    if (res.success) {
                      const base = res.total ?? 0;
                      const tip = emptyTipPercent === -1
                        ? Number(parseFloat(emptyCustomTip || "0").toFixed(2))
                        : Number((base * emptyTipPercent / 100).toFixed(2));
                      const finalTotal = base + tip;
                      const folio = Math.floor(1000 + Math.random() * 9000);
                      const spotLabel = tableNumber ? `Mesa #${tableNumber}` : customerName.trim() || 'Cuenta';
                      let wMsg = `🍗 *LA CABRONA ALITAS*\n━━━━━━━━━━━━━━━━━━━━\n*FOLIO #${folio}*\n*CERRAR CUENTA - ${spotLabel}*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
                      wMsg += `*Subtotal: $${base.toFixed(2)}*\n`;
                      if (tip > 0) wMsg += `*Propina${emptyTipPercent > 0 ? ` (${emptyTipPercent}%)` : ''}: $${tip.toFixed(2)}*\n`;
                      wMsg += `*TOTAL: $${finalTotal.toFixed(2)}*\n`;
                      wMsg += `*Pago:* ${PAY_LABELS[paymentMethod]}\n`;
                      wMsg += `\n✅ *CUENTA CERRADA - Favor de cobrar*\n\n¡Gracias!`;
                      const enc = encodeURIComponent(wMsg);
                      window.open(`https://wa.me/523348567795?text=${enc}`, '_blank');
                      setTimeout(() => window.open(`https://wa.me/523316108329?text=${enc}`, '_blank'), 800);
                      setShowCloseEmpty(false);
                      setLastFolio(folio);
                      setLastTotal(finalTotal.toFixed(2));
                      setLastMode(spotLabel);
                      setLastPayment(PAY_LABELS[paymentMethod]);
                      setSuccessKeptOpen(false);
                      setPosResult({ ok: true, msg: '¡Cuenta cerrada correctamente!' });
                      setShowSuccess(true);
                    } else {
                      setPosResult({ ok: false, msg: res.error ?? 'Error al cerrar la cuenta' });
                      setShowCloseEmpty(false);
                      setShowSuccess(true);
                      setSuccessKeptOpen(false);
                      setLastFolio(null);
                      setLastTotal('0');
                      const spotLabel = tableNumber ? `Mesa #${tableNumber}` : customerName.trim() || 'Cuenta';
                      setLastMode(spotLabel);
                      setLastPayment('');
                    }
                  }}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap disabled:opacity-60">
                  {closingEmpty ? <><i className="ri-loader-4-line animate-spin mr-1" />Cerrando...</> : 'Confirmar Cierre'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ MODAL LIMPIAR CARRITO ══ */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center px-0 sm:px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowClearConfirm(false)} />
          <div className="relative bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <i className="ri-delete-bin-2-line text-red-500 text-lg" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 leading-tight">¿Limpiar carrito?</h3>
                  <p className="text-xs text-gray-400">Esta acción no se puede deshacer</p>
                </div>
              </div>
              <button onClick={() => setShowClearConfirm(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer flex-shrink-0">
                <i className="ri-close-line text-gray-500" />
              </button>
            </div>
            <div className="mx-5 mb-4 bg-gray-50 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-500">{itemCount} {itemCount === 1 ? 'producto' : 'productos'}</span>
                <span className="font-bold text-gray-900">${Number(total).toFixed(2)}</span>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {items.slice(0, 4).map(item => (
                  <div key={`${item.id}-${item.size || ''}`} className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 flex-shrink-0 text-[10px]">
                      {item.quantity}
                    </span>
                    <span className="truncate">{item.name}</span>
                  </div>
                ))}
                {items.length > 4 && <p className="text-xs text-gray-400 pl-6">+{items.length - 4} más...</p>}
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors whitespace-nowrap">
                Cancelar
              </button>
              <button onClick={() => { clearCart(); setShowClearConfirm(false); }}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-2">
                <i className="ri-delete-bin-line" />Limpiar todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL CONFIRMAR PEDIDO ══ */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-white rounded-xl p-5 max-w-sm w-full">
            <div className="text-center">
              <div className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${sendMode === "keep-open" ? "bg-green-100" : "bg-amber-100"}`}>
                <i className={`text-xl ${sendMode === "keep-open" ? "ri-time-line text-green-600" : "ri-send-plane-line text-amber-600"}`} />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">
                {sendMode === "keep-open" ? "Enviar y Seguir Pidiendo" : orderMode === "dine-in" ? "Cerrar Cuenta" : "Confirmar Pedido"}
              </h3>
              {sendMode === "keep-open" && (
                <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-3 font-medium">
                  La cuenta quedará abierta para seguir pidiendo
                </p>
              )}
              <p className="text-sm text-gray-500 mb-3">
                {orderMode === "dine-in" ? <>Cliente: <strong>{customerName || 'Sin nombre'}</strong></> : <>Cliente: <strong>{customerName}</strong></>}
              </p>

              {/* Lista de items con badges de extras */}
              <div className="bg-gray-50 rounded-xl px-4 py-3 mb-3 text-left space-y-2 max-h-48 overflow-y-auto">
                {discountedItems.map(item => {
                  const di = discountedItems.find(d => d.id === item.id && d.size === item.size && d.notes === item.notes);
                  const finalPrice = di?.finalPrice ?? item.price;
                  const hasDiscount = (di?.discountPct ?? 0) > 0;
                  return (
                    <div key={`${item.id}-${item.size || ""}-${item.notes || ""}`} className="text-sm">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-gray-800 font-medium flex-1">
                          {item.quantity}x {item.name}{item.size ? ` (${item.size})` : ""}
                        </span>
                        <span className="text-gray-900 font-bold whitespace-nowrap">
                          ${(finalPrice * item.quantity).toFixed(2)}
                        </span>
                      </div>
                      {hasDiscount && (
                        <p className="text-[10px] text-green-600 font-semibold mt-0.5">
                          🔥 {di?.offerTitle} −{di?.discountPct}%
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-gray-500 mt-0.5 italic line-clamp-2">{item.notes}</p>
                      )}
                      {item.notes && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.notes.includes("extra ranch (+$15)") && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200">🧴 Extra ranch +$15</span>
                          )}
                          {item.notes.includes("Extra queso (+$10)") && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200">🧀 Extra queso +$10</span>
                          )}
                          {item.notes.includes("Extra salsa BBQ (+$10)") && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200">🍖 Extra salsa BBQ +$10</span>
                          )}
                          {item.notes.includes("Extra aderezo ranch (+$15)") && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200">🧴 Extra ranch +$15</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 text-sm space-y-1 text-left">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
                </div>
                {flashDiscount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Ofertas flash</span><span>−${flashDiscount.toFixed(2)}</span>
                  </div>
                )}
                {tipAmount > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Propina{tipPercent > 0 ? ` (${tipPercent}%)` : ''}</span>
                    <span>+${tipAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200">
                  <span>Total</span><span className="text-amber-600">${grandTotal.toFixed(2)}</span>
                </div>
              </div>
              {posResult && !posResult.ok && (
                <div className="mb-3 flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 text-left">
                  <i className="ri-error-warning-line flex-shrink-0" />
                  <span>{posResult.msg}</span>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => { setShowConfirm(false); setPosResult(null); }}
                  className="flex-1 py-2.5 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                  Cancelar
                </button>
                <button onClick={handleSendOrder} disabled={sendingToPOS}
                  className={`flex-1 py-2.5 text-white rounded-md text-sm font-semibold cursor-pointer whitespace-nowrap disabled:opacity-60 ${sendMode === "keep-open" ? "bg-green-500 hover:bg-green-600" : "bg-amber-500 hover:bg-amber-600"}`}>
                  {sendingToPOS ? <><i className="ri-loader-4-line animate-spin mr-1" />Enviando...</> : posResult && !posResult.ok ? 'Reintentar' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}