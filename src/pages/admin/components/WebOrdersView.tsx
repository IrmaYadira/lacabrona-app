import { useState, useEffect, useCallback, useRef } from 'react';
import { supabasePos } from '@/pages/pos/supabasePos';
import { AREA_LABELS } from '@/pages/pos/types';
import type { PaymentMethod, Area, PosAccount, PosAccountItem } from '@/pages/pos/types';
import PrintTicketModal from '@/pages/pos/components/PrintTicketModal';
import { BluetoothPrinterProvider } from '@/pages/pos/context/BluetoothPrinterContext';

const PAYMENT_OPTIONS: { id: PaymentMethod; label: string; icon: string }[] = [
  { id: 'cash', label: 'Efectivo', icon: 'ri-money-dollar-circle-line' },
  { id: 'transfer', label: 'Transferencia', icon: 'ri-bank-line' },
  { id: 'credit_card', label: 'Tarjeta Crédito', icon: 'ri-bank-card-line' },
  { id: 'debit_card', label: 'Tarjeta Débito', icon: 'ri-bank-card-2-line' },
];

const TRANSFER_DATA = { bank: 'Banco Inbursa', name: 'Irma Leal', clabe: '036320500328209850', whatsapp: '3348567795' };
const CARD_FEE = 0.03;

interface OrderItem {
  id: number;
  product_name: string;
  size?: string;
  quantity: number;
  unit_price: number;
  folio_number: number;
}

interface WebOrder {
  id: number;
  spot: string;
  area: string;
  customer_name?: string;
  customer_phone?: string;
  folio_counter: number;
  created_at: string;
  updated_at: string;
  pos_account_items: OrderItem[];
  _subtotal?: number;
  _isNew?: boolean; // llegó en los últimos 2 minutos
  status?: string;
  closed_at?: string;
}

// Genera un bip de alerta usando Web Audio API (sin archivos externos)
function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const playBeep = (freq: number, start: number, duration: number, vol = 0.4) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.01);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration + 0.05);
    };
    playBeep(880, 0, 0.15);
    playBeep(1100, 0.2, 0.15);
    playBeep(880, 0.4, 0.15);
    playBeep(1100, 0.6, 0.25);
  } catch (_) {
    // silencioso si el browser bloquea audio
  }
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `Hace ${diff}s`;
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  return `Hace ${Math.floor(diff / 3600)}h`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

export default function WebOrdersView() {
  const [orders, setOrders] = useState<WebOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [closingId, setClosingId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [splitCount, setSplitCount] = useState(1);
  const [closingLoading, setClosingLoading] = useState(false);
  const [clabeCopied, setClabeCopied] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [filter, setFilter] = useState<'all' | 'dine-in' | 'llevar'>('all');
  const [newOrderIds, setNewOrderIds] = useState<Set<number>>(new Set());
  const knownIdsRef = useRef<Set<number>>(new Set());
  const lastFetchRef = useRef<number>(0);
  const [printData, setPrintData] = useState<{
    account: PosAccount;
    items: PosAccountItem[];
    mode: 'cuenta' | 'comanda';
  } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const fetchOrders = useCallback(async (silent = false) => {
    const now = Date.now();
    if (now - lastFetchRef.current < 800) return;
    lastFetchRef.current = now;

    if (!silent) setLoading(true);

    const { data } = await supabasePos
      .from('pos_accounts')
      .select('id, spot, area, customer_name, customer_phone, folio_counter, created_at, updated_at, pos_account_items(*)')
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (data) {
      const enriched = (data as WebOrder[]).map(o => {
        const subtotal = (o.pos_account_items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
        const isNew = (Date.now() - new Date(o.updated_at ?? o.created_at).getTime()) < 2 * 60 * 1000;
        return { ...o, _subtotal: subtotal, _isNew: isNew };
      });

      // Detectar órdenes nuevas para animación y sonido
      const incoming = new Set(enriched.map(o => o.id));
      const brandNew = enriched.filter(o => !knownIdsRef.current.has(o.id)).map(o => o.id);
      if (brandNew.length > 0 && knownIdsRef.current.size > 0) {
        setNewOrderIds(prev => new Set([...prev, ...brandNew]));
        // Reproducir sonido de alerta
        setSoundEnabled(prev => { if (prev) playAlertSound(); return prev; });
        setTimeout(() => setNewOrderIds(prev => {
          const next = new Set(prev);
          brandNew.forEach(id => next.delete(id));
          return next;
        }), 4000);
      }
      knownIdsRef.current = incoming;
      setOrders(enriched);
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();

    const channel = supabasePos
      .channel('web-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_accounts' }, () => {
        fetchOrders(true);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pos_account_items' }, () => {
        fetchOrders(true);
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          console.log('[Admin/WebOrders] Realtime status:', status);
        }
      });

    const interval = setInterval(() => fetchOrders(true), 8_000);
    return () => { supabasePos.removeChannel(channel); clearInterval(interval); };
  }, [fetchOrders]);

  // Calcular totales del pedido a cerrar
  const closingOrder = orders.find(o => o.id === closingId);
  const closingSubtotal = closingOrder?._subtotal ?? 0;
  const cardFee = (paymentMethod === 'credit_card' || paymentMethod === 'debit_card') ? closingSubtotal * CARD_FEE : 0;
  const grandTotal = closingSubtotal + cardFee;
  const perPerson = splitCount > 1 ? grandTotal / splitCount : grandTotal;

  const handleClose = async () => {
    if (!closingOrder) return;
    setClosingLoading(true);
    await supabasePos.from('pos_payments').insert({
      account_id: closingOrder.id,
      payment_method: paymentMethod,
      subtotal: closingSubtotal,
      card_fee: cardFee,
      total: grandTotal,
      split_count: splitCount,
    });
    await supabasePos.from('pos_accounts').update({
      status: 'closed', closed_at: new Date().toISOString(),
    }).eq('id', closingOrder.id);

    // Mostrar PrintTicketModal de la cuenta cerrada
    const { data: fullAcc } = await supabasePos
      .from('pos_accounts')
      .select('*, pos_account_items(*)')
      .eq('id', closingOrder.id)
      .maybeSingle();
    if (fullAcc) {
      setPrintData({ account: fullAcc as PosAccount, items: (fullAcc.pos_account_items ?? []) as PosAccountItem[], mode: 'cuenta' });
    }

    setClosingLoading(false);
    setClosingId(null);
    setSuccessMsg(`Cuenta cerrada · ${closingOrder.spot} · $${grandTotal.toFixed(2)}`);
    await fetchOrders(true);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handlePrintOrder = async (order: WebOrder) => {
    // Obtener los datos completos de la cuenta para imprimir
    const { data: fullAcc } = await supabasePos
      .from('pos_accounts')
      .select('*, pos_account_items(*)')
      .eq('id', order.id)
      .maybeSingle();
    if (fullAcc) {
      setPrintData({ account: fullAcc as PosAccount, items: (fullAcc.pos_account_items ?? []) as PosAccountItem[], mode: 'comanda' });
    }
  };

  const copyClabe = () => {
    navigator.clipboard.writeText(TRANSFER_DATA.clabe);
    setClabeCopied(true);
    setTimeout(() => setClabeCopied(false), 2000);
  };

  const filteredOrders = orders.filter(o => {
    if (filter === 'llevar') return o.area === 'llevar';
    if (filter === 'dine-in') return o.area !== 'llevar';
    return true;
  });

  const dineInCount = orders.filter(o => o.area !== 'llevar').length;
  const llevarCount = orders.filter(o => o.area === 'llevar').length;
  const newCount = orders.filter(o => o._isNew).length;

  return (
    <div className="max-w-3xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <i className="ri-smartphone-line text-amber-500" />
            Pedidos Activos
            {newCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-full animate-pulse">
                {newCount} nuevo{newCount > 1 ? 's' : ''}
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
            </span>
            Actualizando en tiempo real · {orders.length} cuenta{orders.length !== 1 ? 's' : ''} abierta{orders.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle sonido */}
          <button
            onClick={() => setSoundEnabled(p => !p)}
            title={soundEnabled ? 'Silenciar alertas' : 'Activar alertas de sonido'}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 border rounded-lg cursor-pointer transition-all whitespace-nowrap ${
              soundEnabled
                ? 'border-amber-300 text-amber-600 bg-amber-50 hover:bg-amber-100'
                : 'border-gray-200 text-gray-400 hover:border-gray-300'
            }`}
          >
            <i className={soundEnabled ? 'ri-volume-up-line' : 'ri-volume-mute-line'} />
            {soundEnabled ? 'Sonido activo' : 'Sin sonido'}
          </button>
          <button onClick={() => fetchOrders()} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-amber-600 cursor-pointer transition-colors px-3 py-2 border border-gray-200 rounded-lg hover:border-amber-300 whitespace-nowrap">
            <i className="ri-refresh-line" />Actualizar
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2">
          <i className="ri-check-double-line" />{successMsg}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'all', label: `Todos (${orders.length})`, icon: 'ri-list-check' },
          { id: 'dine-in', label: `Mesa / Barra (${dineInCount})`, icon: 'ri-restaurant-line' },
          { id: 'llevar', label: `Para Llevar (${llevarCount})`, icon: 'ri-shopping-bag-line' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as typeof filter)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer border transition-all whitespace-nowrap ${
              filter === f.id
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300 hover:text-amber-600'
            }`}
          >
            <i className={f.icon} />{f.label}
          </button>
        ))}
      </div>

      {/* Lista de pedidos */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-3 bg-gray-100 rounded-2xl flex items-center justify-center">
            <i className="ri-inbox-line text-2xl text-gray-300" />
          </div>
          <p className="text-gray-500 font-medium text-sm">Sin pedidos activos</p>
          <p className="text-gray-400 text-xs mt-1">Los pedidos del cliente aparecerán aquí al instante</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => {
            const isExpanded = expandedId === order.id;
            const isNew = newOrderIds.has(order.id);
            const isLlevar = order.area === 'llevar';
            const isRecent = order._isNew;
            const agoText = timeAgo(order.updated_at ?? order.created_at);

            return (
              <div
                key={order.id}
                className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${
                  isNew ? 'border-red-400 shadow-lg shadow-red-100' :
                  isRecent ? (isLlevar ? 'border-teal-300' : 'border-amber-300') :
                  'border-gray-200'
                }`}
              >
                {/* Badge nuevo */}
                {isNew && (
                  <div className="bg-red-500 text-white text-xs font-black text-center py-1 flex items-center justify-center gap-1.5 animate-pulse">
                    <i className="ri-alarm-warning-line" />
                    PEDIDO NUEVO — ATENDER AHORA
                  </div>
                )}

                {/* Card header */}
                <div
                  className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  {/* Ícono área */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isLlevar ? 'bg-teal-100' : 'bg-amber-100'
                  }`}>
                    <i className={`text-lg ${isLlevar ? 'ri-shopping-bag-line text-teal-600' : 'ri-restaurant-line text-amber-600'}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 text-sm">{order.spot}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        isLlevar ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {AREA_LABELS[order.area as Area] ?? order.area}
                      </span>
                      {isRecent && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                          Reciente
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {order.customer_name && (
                        <span className="text-xs text-gray-600 flex items-center gap-1">
                          <i className="ri-user-line text-gray-400" />{order.customer_name}
                        </span>
                      )}
                      {order.customer_phone && (
                        <a
                          href={`https://wa.me/52${order.customer_phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="nofollow noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-green-600 flex items-center gap-1 hover:underline"
                        >
                          <i className="ri-whatsapp-line" />{order.customer_phone}
                        </a>
                      )}
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <i className="ri-time-line" />{agoText}
                      </span>
                      <span className="text-xs text-gray-400">{formatTime(order.created_at)}</span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-amber-600 text-lg">${(order._subtotal ?? 0).toFixed(2)}</p>
                    <p className="text-xs text-gray-400">{order.pos_account_items?.length ?? 0} productos</p>
                  </div>

                  <i className={`text-gray-400 text-lg transition-transform ${isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`} />
                </div>

                {/* Detalle expandido */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-4 space-y-4">
                    {/* Items por ronda */}
                    {Array.from(new Set((order.pos_account_items ?? []).map(i => i.folio_number))).sort().map(folio => {
                      const folioItems = (order.pos_account_items ?? []).filter(i => i.folio_number === folio);
                      const folioTotal = folioItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
                      return (
                        <div key={folio}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-gray-100 px-2 py-1 rounded-lg">
                              Ronda #{String(folio).padStart(2, '0')}
                            </span>
                            <span className="text-xs font-bold text-amber-600">${folioTotal.toFixed(2)}</span>
                          </div>
                          <div className="space-y-1.5">
                            {folioItems.map(item => (
                              <div key={item.id} className="flex justify-between items-start text-sm">
                                <div className="flex-1 min-w-0">
                                  <span className="font-semibold text-gray-800">{item.quantity}x </span>
                                  <span className="text-gray-700">{item.product_name}</span>
                                  {item.size && <p className="text-xs text-amber-600 ml-5 italic">{item.size}</p>}
                                </div>
                                <span className="font-medium text-gray-900 ml-2 flex-shrink-0">${(item.unit_price * item.quantity).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {/* Total */}
                    <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center">
                      <span className="text-sm font-bold text-gray-700">Total consumo</span>
                      <span className="text-xl font-black text-amber-600">${(order._subtotal ?? 0).toFixed(2)}</span>
                    </div>

                    {/* Botones */}
                    <div className="flex gap-2 flex-wrap">
                      {order.customer_phone && (
                        <a
                          href={`https://wa.me/52${order.customer_phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="nofollow noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
                        >
                          <i className="ri-whatsapp-line" />WhatsApp
                        </a>
                      )}
                      <button
                        onClick={() => handlePrintOrder(order)}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer transition-colors whitespace-nowrap border border-gray-200"
                      >
                        <i className="ri-printer-line" />Imprimir
                      </button>
                      <button
                        onClick={() => { setClosingId(order.id); setPaymentMethod('cash'); setSplitCount(1); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
                      >
                        <i className="ri-money-dollar-circle-line" />Cobrar y Cerrar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Print Modal */}
      {printData && (
        <BluetoothPrinterProvider>
          <PrintTicketModal
            account={printData.account}
            items={printData.items}
            mode={printData.mode}
            onClose={() => setPrintData(null)}
          />
        </BluetoothPrinterProvider>
      )}

      {/* Modal cobrar */}
      {closingId && closingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setClosingId(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between rounded-t-2xl">
              <div>
                <h3 className="font-bold text-gray-900">Cobrar y Cerrar</h3>
                <p className="text-xs text-gray-500">{closingOrder.spot} {closingOrder.customer_name ? `· ${closingOrder.customer_name}` : ''}</p>
              </div>
              <button onClick={() => setClosingId(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer">
                <i className="ri-close-line text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Total */}
              <div className="bg-gray-900 rounded-2xl p-4 text-center">
                <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Total a cobrar</p>
                <p className="text-4xl font-black text-amber-400">${closingSubtotal.toFixed(2)}</p>
                <p className="text-gray-500 text-xs mt-1">{closingOrder.folio_counter} ronda{closingOrder.folio_counter !== 1 ? 's' : ''} · {closingOrder.pos_account_items?.length ?? 0} productos</p>
              </div>

              {/* Forma de pago */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Forma de Pago</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_OPTIONS.map(opt => (
                    <button key={opt.id} onClick={() => setPaymentMethod(opt.id)}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        paymentMethod === opt.id ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:border-amber-300'
                      }`}
                    >
                      <i className={`${opt.icon} text-lg`} />
                      <span className="text-xs font-semibold whitespace-nowrap">{opt.label}</span>
                    </button>
                  ))}
                </div>
                {(paymentMethod === 'credit_card' || paymentMethod === 'debit_card') && (
                  <p className="text-xs text-rose-600 mt-2 font-medium"><i className="ri-information-line mr-1" />+3% terminal: ${cardFee.toFixed(2)}</p>
                )}
                {paymentMethod === 'transfer' && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
                    <div className="px-3 py-2 bg-amber-100 border-b border-amber-200 flex items-center gap-2">
                      <i className="ri-bank-line text-amber-700 text-sm" />
                      <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Datos para Transferencia</span>
                    </div>
                    <div className="px-3 py-2.5 space-y-1.5">
                      <div className="flex justify-between text-xs"><span className="text-amber-700">Banco</span><span className="font-bold text-amber-900">{TRANSFER_DATA.bank}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-amber-700">Titular</span><span className="font-bold text-amber-900">{TRANSFER_DATA.name}</span></div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-amber-700">CLABE</span>
                        <button type="button" onClick={copyClabe} className="flex items-center gap-1.5 bg-white border border-amber-300 px-2 py-1 rounded-lg cursor-pointer hover:bg-amber-50">
                          <span className="font-mono font-bold text-amber-900">{TRANSFER_DATA.clabe}</span>
                          <i className={`text-amber-500 text-xs ${clabeCopied ? 'ri-check-line' : 'ri-file-copy-line'}`} />
                        </button>
                      </div>
                      {clabeCopied && <p className="text-xs text-green-600 font-semibold text-center"><i className="ri-check-line mr-1" />CLABE copiada</p>}
                      <div className="flex justify-between text-xs pt-1 border-t border-amber-200"><span className="text-amber-700">Comprobante</span><span className="font-bold text-amber-900">WA {TRANSFER_DATA.whatsapp}</span></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Dividir */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Dividir Cuenta</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setSplitCount(Math.max(1, splitCount - 1))} className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 hover:border-amber-500 hover:text-amber-600 cursor-pointer transition-colors"><i className="ri-subtract-line" /></button>
                  <span className="text-base font-bold text-gray-900 w-24 text-center">{splitCount === 1 ? '1 sola' : `${splitCount} personas`}</span>
                  <button onClick={() => setSplitCount(splitCount + 1)} className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 hover:border-amber-500 hover:text-amber-600 cursor-pointer transition-colors"><i className="ri-add-line" /></button>
                </div>
              </div>

              {/* Resumen */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-600"><span>Consumo</span><span>${closingSubtotal.toFixed(2)}</span></div>
                {cardFee > 0 && <div className="flex justify-between text-sm text-rose-600"><span>Terminal (3%)</span><span>+${cardFee.toFixed(2)}</span></div>}
                <div className="flex justify-between text-xl font-black text-gray-900 pt-2 border-t border-gray-200"><span>TOTAL</span><span className="text-amber-600">${grandTotal.toFixed(2)}</span></div>
                {splitCount > 1 && <div className="flex justify-between text-sm font-bold text-green-700 bg-green-50 rounded-lg px-3 py-2"><span>Por persona ({splitCount})</span><span>${perPerson.toFixed(2)}</span></div>}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setClosingId(null)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">Cancelar</button>
                <button
                  onClick={handleClose}
                  disabled={closingLoading}
                  className="flex-1 py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold cursor-pointer whitespace-nowrap"
                >
                  {closingLoading
                    ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Cerrando...</span>
                    : <><i className="ri-check-line mr-1" />Confirmar Cobro</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}