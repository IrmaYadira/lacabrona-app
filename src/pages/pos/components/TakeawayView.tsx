import { useState, useEffect, useCallback } from 'react';
import { supabasePos } from '../supabasePos';
import type { PosAccount, PaymentMethod } from '../types';
import MenuPickerModal, { type CartEntry } from './MenuPickerModal';
import CloseAccountModal from './CloseAccountModal';
import { deductStockOnSale } from '../utils/inventory';

interface TakeawayViewProps {
  onBack: () => void;
}

// ── Print ticket helper ──────────────────────────────────────────────────────
function printOrderTicket(order: PosAccount) {
  const items = order.pos_account_items ?? [];
  const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const now = new Date().toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const rows = items.map(i =>
    `<tr>
      <td style="padding:2px 4px">${i.quantity}x ${i.product_name}${i.size ? ` (${i.size})` : ''}</td>
      <td style="padding:2px 4px;text-align:right">$${(i.unit_price * i.quantity).toFixed(2)}</td>
    </tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Pedido Para Llevar</title>
  <style>
    body { font-family: monospace; font-size: 13px; width: 280px; margin: 0 auto; padding: 8px; }
    h2 { text-align: center; margin: 0 0 2px; font-size: 15px; }
    .sub { text-align: center; font-size: 11px; color: #555; margin-bottom: 8px; }
    hr { border: none; border-top: 1px dashed #999; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    .total { font-weight: bold; font-size: 15px; }
    .footer { text-align: center; font-size: 11px; margin-top: 8px; color: #555; }
  </style>
</head>
<body>
  <h2>🍗 LA CABRONA 🍺</h2>
  <div class="sub">Alitas &amp; Beer — Zapopan, Jal.</div>
  <hr/>
  <div><strong>PARA LLEVAR / RECOGER</strong></div>
  <div>Cliente: <strong>${order.customer_name}</strong></div>
  ${order.customer_phone ? `<div>Tel: ${order.customer_phone}</div>` : ''}
  <div style="font-size:11px;color:#666">${now}</div>
  <hr/>
  <table>${rows}</table>
  <hr/>
  <table>
    <tr class="total">
      <td>TOTAL</td>
      <td style="text-align:right">$${total.toFixed(2)}</td>
    </tr>
  </table>
  <div class="footer">¡Gracias por tu pedido!<br/>Domicilio Sinaloa 690, Zapopan</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=320,height=600');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

export default function TakeawayView({ onBack }: TakeawayViewProps) {
  const [orders, setOrders] = useState<PosAccount[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabasePos
      .from('pos_accounts')
      .select('*, pos_account_items(*)')
      .eq('area', 'llevar')
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    setOrders((data ?? []) as PosAccount[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
    const channel = supabasePos
      .channel('takeaway-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_accounts' }, fetchOrders)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_account_items' }, fetchOrders)
      .subscribe();
    return () => { supabasePos.removeChannel(channel); };
  }, [fetchOrders]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const { data } = await supabasePos.from('pos_accounts').insert({
      area: 'llevar',
      spot: `Para Llevar/Recoger - ${newName.trim()}`,
      customer_name: newName.trim(),
      customer_phone: newPhone.trim() || null,
      status: 'open',
      seen: false,
    }).select().maybeSingle();
    if (data) {
      setActiveOrderId(data.id);
      setShowMenu(true);
    }
    setNewName('');
    setNewPhone('');
    setShowNewForm(false);
    fetchOrders();
  };

  const activeOrder = orders.find(o => o.id === activeOrderId);

  // ── Toggle "visto" ──────────────────────────────────────────────────────────
  const handleToggleSeen = async (order: PosAccount) => {
    const newSeen = !(order as PosAccount & { seen?: boolean }).seen;
    await supabasePos.from('pos_accounts').update({ seen: newSeen }).eq('id', order.id);
    fetchOrders();
  };

  const sendComandaWhatsAppTakeaway = (folioNumber: number, entries: CartEntry[], order: PosAccount) => {
    const barPhone = '5213348567795';
    const folioTotal = entries.reduce((s, e) => s + e.menuItem.price * e.quantity, 0);
    let msg = `🛄 *PEDIDO PARA LLEVAR - Comanda #${String(folioNumber).padStart(2, '0')}*\n`;
    msg += `👤 *Cliente:* ${order.customer_name}`;
    if (order.customer_phone) msg += ` | 📱 ${order.customer_phone}`;
    msg += `\n\n`;
    entries.forEach(e => {
      msg += `  • ${e.quantity}x ${e.menuItem.name}`;
      if (e.note) msg += ` _(${e.note})_`;
      msg += ` — $${(e.menuItem.price * e.quantity).toFixed(2)}\n`;
    });
    msg += `\n*Subtotal comanda: $${folioTotal.toFixed(2)}*\n`;
    msg += `⏰ ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}\n`;
    msg += `\n_La Cabrona POS_`;
    window.open(`https://wa.me/${barPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    setTimeout(() => {
      window.open(`https://wa.me/523316108329?text=${encodeURIComponent(msg)}`, '_blank');
    }, 800);
  };

  const handleAddItems = async (entries: CartEntry[]) => {
    if (!activeOrderId) return;
    const order = orders.find(o => o.id === activeOrderId);
    const newFolio = (order?.folio_counter ?? 0) + 1;
    await supabasePos.from('pos_accounts').update({ folio_counter: newFolio }).eq('id', activeOrderId);
    const inserts = entries.map(entry => ({
      account_id: activeOrderId,
      product_name: entry.menuItem.name,
      size: entry.note || null,
      quantity: entry.quantity,
      unit_price: entry.menuItem.price,
      folio_number: newFolio,
    }));
    await supabasePos.from('pos_account_items').insert(inserts);
    await deductStockOnSale(
      entries.map(e => ({ product_name: e.menuItem.name, quantity: e.quantity })),
      { accountId: activeOrderId, spot: order?.spot ?? 'Para llevar', folio: newFolio }
    );
    setShowMenu(false);
    fetchOrders();
    if (order) sendComandaWhatsAppTakeaway(newFolio, entries, order);
  };

  const handleCloseOrder = async (method: PaymentMethod, splitCount: number, total: number, fee: number, mixedPayments?: unknown, tip?: number, closedBy?: string) => {
    if (!activeOrderId || !activeOrder) return;
    await supabasePos.from('pos_payments').insert({
      account_id: activeOrderId,
      payment_method: method,
      subtotal: total - fee - (tip ?? 0),
      card_fee: fee,
      tip: tip ?? 0,
      total,
      split_count: splitCount,
    });
    await supabasePos.from('pos_accounts').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', activeOrderId);

    // ===== PUNTOS DE LEALTAD =====
    let resolvedCustId: number | null = activeOrder.customer_id ?? null;
    const custName = activeOrder.customer_name?.trim();
    const custPhone = activeOrder.customer_phone?.trim();

    // Buscar primero por teléfono (más preciso)
    if (!resolvedCustId && custPhone) {
      const cleanPhone = custPhone.replace(/\D/g, '');
      if (cleanPhone.length >= 7) {
        const { data: foundByPhone } = await supabasePos
          .from('pos_customers')
          .select('id, name')
          .ilike('phone', `%${cleanPhone.slice(-10)}%`)
          .maybeSingle();
        if (foundByPhone?.id) resolvedCustId = foundByPhone.id;
      }
    }

    // Si no hay, buscar por nombre exacto primero, luego parcial
    if (!resolvedCustId && custName) {
      const { data: foundExact } = await supabasePos
        .from('pos_customers')
        .select('id')
        .ilike('name', custName)
        .maybeSingle();
      if (foundExact?.id) {
        resolvedCustId = foundExact.id;
      } else {
        const { data: foundByName } = await supabasePos
          .from('pos_customers')
          .select('id')
          .ilike('name', `%${custName}%`)
          .maybeSingle();
        if (foundByName?.id) resolvedCustId = foundByName.id;
      }
    }

    if (resolvedCustId) {
      const { data: custData } = await supabasePos
        .from('pos_customers')
        .select('total_spent, loyalty_points')
        .eq('id', resolvedCustId)
        .maybeSingle();
      const prevTotal = Number(custData?.total_spent ?? 0);
      const prevPoints = Number(custData?.loyalty_points ?? 0);
      const newTotal = prevTotal + total;
      const pointsEarned = Math.floor(total / 100);
      const newPoints = prevPoints + pointsEarned;

      await supabasePos
        .from('pos_customers')
        .update({
          total_spent: newTotal,
          loyalty_points: newPoints,
          last_visit: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', resolvedCustId);

      if (pointsEarned > 0) {
        await supabasePos.from('loyalty_point_adjustments').insert({
          customer_id: resolvedCustId,
          delta: pointsEarned,
          points_before: prevPoints,
          points_after: newPoints,
          reason: `Pedido para llevar — ${activeOrder.customer_name || 'Cliente'} — Total $${total.toFixed(2)} · Pago: ${method}`,
          adjusted_by: 'pos_auto',
        });
      }

      await supabasePos.from('pos_account_events').insert({
        account_id: activeOrderId,
        customer_id: resolvedCustId,
        event_type: 'account_closed',
        description: `Pedido para llevar cerrado — $${total.toFixed(2)} · ${method}${pointsEarned > 0 ? ` · +${pointsEarned} pts (total: ${newPoints})` : ''}`,
        metadata: {
          spot: activeOrder.spot,
          total,
          payment_method: method,
          points_earned: pointsEarned,
          loyalty_points_before: prevPoints,
          loyalty_points_after: newPoints,
          closed_from: 'takeaway',
        },
      });
    } else {
      await supabasePos.from('pos_account_events').insert({
        account_id: activeOrderId,
        event_type: 'account_closed',
        description: `Pedido para llevar cerrado — $${total.toFixed(2)} · ${method} · ⚠️ Sin cliente vinculado (no se sumaron puntos)`,
        metadata: {
          spot: activeOrder.spot,
          total,
          payment_method: method,
          customer_name: custName ?? null,
          customer_phone: custPhone ?? null,
          customer_id_attempted: activeOrder.customer_id ?? null,
          loyalty_error: 'Cliente no encontrado en pos_customers',
          closed_from: 'takeaway',
        },
      });
    }
    // ===== FIN PUNTOS DE LEALTAD =====

    const items = activeOrder.pos_account_items ?? [];
    const methodLabels: Record<PaymentMethod, string> = {
      cash: 'Efectivo', transfer: 'Transferencia', credit_card: 'Tarjeta de Crédito', debit_card: 'Tarjeta de Débito',
    };
    let msg = `🍗🍺 *LA CABRONA* 🍺🍗\n`;
    msg += `      *Alitas & Beer*\n`;
    msg += `📍 Zapopan, Jalisco\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `Hola ${activeOrder.customer_name}! Aquí está tu pedido para llevar/recoger:\n\n`;
    items.forEach(i => {
      msg += `  • ${i.quantity}x ${i.product_name}${i.size ? ` (${i.size})` : ''} — $${(i.unit_price * i.quantity).toFixed(2)}\n`;
    });
    msg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `Subtotal: $${(total - fee).toFixed(2)}\n`;
    if (fee > 0) msg += `Cargo terminal (3%): +$${fee.toFixed(2)}\n`;
    msg += `\n*TOTAL: $${total.toFixed(2)}*\n`;
    msg += `Forma de pago: ${methodLabels[method]}\n`;
    msg += `\n¡Gracias por visitarnos! Vuelve pronto 🍗🍺\n`;
    msg += `📍 Domicilio Sinaloa 690, Zapopan`;
    const phone = '52' + (activeOrder.customer_phone?.replace(/\D/g, '') || '3348567795');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');

    setShowClose(false);
    setActiveOrderId(null);
    fetchOrders();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer">
          <i className="ri-arrow-left-line text-gray-600" />
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-gray-900">Pedidos Para Llevar/Recoger</h2>
          <p className="text-xs text-gray-500">{orders.length} pedido(s) activo(s)</p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
        >
          <i className="ri-add-line mr-1" />
          Nuevo Pedido
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
              <i className="ri-shopping-bag-3-line text-2xl text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm font-medium">Sin pedidos para llevar</p>
            <button
              onClick={() => setShowNewForm(true)}
              className="mt-4 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
            >
              Crear Primer Pedido
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const isSeen = !!(order as PosAccount & { seen?: boolean }).seen;
              const items = order.pos_account_items ?? [];
              const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
              const isActive = activeOrderId === order.id;
              return (
                <div key={order.id} className={`bg-white rounded-xl border-2 p-4 transition-all ${isActive ? 'border-amber-400' : isSeen ? 'border-green-300 bg-green-50/30' : 'border-gray-200'}`}>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {isSeen && (
                        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                          <i className="ri-check-double-line" /> Visto
                        </span>
                      )}
                      <div>
                        <p className="font-bold text-gray-900">{order.customer_name}</p>
                        {order.customer_phone && <p className="text-xs text-gray-500">{order.customer_phone}</p>}
                      </div>
                    </div>
                    <span className="text-lg font-bold text-amber-600">${total.toFixed(2)}</span>
                  </div>

                  {/* Items */}
                  <div className="space-y-1 mb-3">
                    {items.slice(0, 3).map(i => (
                      <p key={i.id} className="text-xs text-gray-600">
                        {i.quantity}x {i.product_name}{i.size ? ` (${i.size})` : ''}
                      </p>
                    ))}
                    {items.length > 3 && <p className="text-xs text-gray-400">+{items.length - 3} más...</p>}
                    {items.length === 0 && <p className="text-xs text-gray-400 italic">Sin productos aún</p>}
                  </div>

                  {/* Actions row 1: Agregar + Cerrar */}
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => { setActiveOrderId(order.id); setShowMenu(true); }}
                      className="flex-1 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <i className="ri-add-line mr-1" />
                      Agregar
                    </button>
                    <button
                      onClick={() => { setActiveOrderId(order.id); setShowClose(true); }}
                      className="flex-1 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <i className="ri-check-line mr-1" />
                      Cerrar
                    </button>
                  </div>

                  {/* Actions row 2: Visto + Imprimir */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleSeen(order)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap border ${
                        isSeen
                          ? 'bg-green-500 hover:bg-green-600 text-white border-green-500'
                          : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200'
                      }`}
                    >
                      <i className={`mr-1 ${isSeen ? 'ri-check-double-fill' : 'ri-eye-line'}`} />
                      {isSeen ? 'Visto ✓' : 'Marcar Visto'}
                    </button>
                    <button
                      onClick={() => printOrderTicket(order)}
                      className="flex-1 py-2 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <i className="ri-printer-line mr-1" />
                      Imprimir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New order form */}
      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowNewForm(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-900 mb-4">Nuevo Pedido Para Llevar/Recoger</h3>
            <form onSubmit={handleCreateOrder} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Nombre *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nombre del cliente"
                  required
                  autoFocus
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">WhatsApp</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Teléfono (opcional)"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowNewForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 cursor-pointer whitespace-nowrap">Cancelar</button>
                <button type="submit" className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">Crear Pedido</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMenu && <MenuPickerModal onConfirm={handleAddItems} onClose={() => setShowMenu(false)} />}
      {showClose && activeOrder && (
        <CloseAccountModal
          account={activeOrder}
          onClose={() => setShowClose(false)}
          onConfirm={handleCloseOrder}
        />
      )}
    </div>
  );
}