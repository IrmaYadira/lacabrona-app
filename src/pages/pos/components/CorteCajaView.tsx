import { useState, useEffect, useCallback } from 'react';
import { supabasePos } from '../supabasePos';
import type { PaymentMethod } from '../types';
import { detectExtras } from '../utils/extrasPrice';

function getWeekRange(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = (day === 0 ? -6 : 1 - day) + offset * 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

interface CorteCajaViewProps {
  onBack: () => void;
}

interface ClosedAccount {
  id: number;
  area: string;
  spot: string;
  customer_name?: string;
  customer_phone?: string;
  closed_at: string;
  pos_account_items: { id: number; product_name: string; quantity: number; unit_price: number; size?: string; notes?: string }[];
  pos_payments: {
    id: number;
    payment_method: PaymentMethod;
    subtotal: number;
    card_fee: number;
    total: number;
    split_count: number;
  }[];
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  credit_card: 'Tarjeta de Crédito',
  debit_card: 'Tarjeta de Débito',
};

const PAYMENT_ICONS: Record<string, string> = {
  cash: 'ri-money-dollar-circle-line',
  transfer: 'ri-bank-line',
  credit_card: 'ri-bank-card-line',
  debit_card: 'ri-bank-card-2-line',
};

const PAYMENT_COLORS: Record<string, string> = {
  cash: 'text-green-600 bg-green-50 border-green-200',
  transfer: 'text-amber-600 bg-amber-50 border-amber-200',
  credit_card: 'text-rose-600 bg-rose-50 border-rose-200',
  debit_card: 'text-orange-600 bg-orange-50 border-orange-200',
};

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'cash', label: 'Efectivo', icon: 'ri-money-dollar-circle-line' },
  { value: 'transfer', label: 'Transferencia', icon: 'ri-bank-line' },
  { value: 'credit_card', label: 'Tarjeta de Crédito', icon: 'ri-bank-card-line' },
  { value: 'debit_card', label: 'Tarjeta de Débito', icon: 'ri-bank-card-2-line' },
];

const CARD_FEE_RATE = 0.03;
type TabView = 'day' | 'week';

const ADMIN_WHATSAPP = '523348567795';
const ADMIN_EMAIL = 'lacabrona2016@hotmail.com';

const TRANSFER_DATA = {
  bank: 'Banco Inbursa',
  name: 'Irma Leal',
  clabe: '036320500328209850',
  whatsapp: '3348567795',
};

export default function CorteCajaView({ onBack }: CorteCajaViewProps) {
  const [tabView, setTabView] = useState<TabView>('day');

  // Day state
  const [accounts, setAccounts] = useState<ClosedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingPayment, setEditingPayment] = useState<{ accountId: number; paymentId: number } | null>(null);
  const [editMethod, setEditMethod] = useState<PaymentMethod>('cash');
  const [editSplit, setEditSplit] = useState(1);
  const [clabeCopied, setClabeCopied] = useState(false);
  const [showCierreConfirm, setShowCierreConfirm] = useState(false);
  const [cierreDone, setCierreDone] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSent, setReportSent] = useState<'whatsapp' | 'email' | null>(null);

  // Reabrir cuenta state
  const [reopeningId, setReopeningId] = useState<number | null>(null);
  const [reopenConfirmId, setReopenConfirmId] = useState<number | null>(null);
  const [reopenDoneId, setReopenDoneId] = useState<number | null>(null);

  // Week state
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekAccounts, setWeekAccounts] = useState<ClosedAccount[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabasePos
      .from('pos_accounts')
      .select('*, pos_account_items(*), pos_payments(*)')
      .eq('status', 'closed')
      .gte('closed_at', `${selectedDate}T00:00:00`)
      .lte('closed_at', `${selectedDate}T23:59:59`)
      .order('closed_at', { ascending: false });
    setAccounts((data ?? []) as ClosedAccount[]);
    setLoading(false);
  }, [selectedDate]);

  const fetchWeekAccounts = useCallback(async () => {
    setWeekLoading(true);
    const { monday, sunday } = getWeekRange(weekOffset);
    const { data } = await supabasePos
      .from('pos_accounts')
      .select('*, pos_account_items(*), pos_payments(*)')
      .eq('status', 'closed')
      .gte('closed_at', monday.toISOString())
      .lte('closed_at', sunday.toISOString())
      .order('closed_at', { ascending: true });
    setWeekAccounts((data ?? []) as ClosedAccount[]);
    setWeekLoading(false);
  }, [weekOffset]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);
  useEffect(() => { if (tabView === 'week') fetchWeekAccounts(); }, [fetchWeekAccounts, tabView]);

  // Day calculations — suma TODOS los pagos por método (mixtos incluidos)
  const totals = accounts.reduce((acc, account) => {
    account.pos_payments.forEach(p => {
      const m = p.payment_method;
      acc[m] = (acc[m] ?? 0) + Number(p.total);
    });
    return acc;
  }, {} as Record<string, number>);

  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);
  const totalCardFee = accounts.reduce((s, a) =>
    s + a.pos_payments.reduce((ps, p) => ps + Number(p.card_fee ?? 0), 0), 0);
  const totalItemsAmount = accounts.reduce((s, a) =>
    s + a.pos_account_items.reduce((ps, i) => ps + i.unit_price * i.quantity, 0), 0);
  const cuadre = grandTotal - totalItemsAmount;

  // Week calculations
  const { monday: wMonday, sunday: wSunday } = getWeekRange(weekOffset);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(wMonday);
    d.setDate(wMonday.getDate() + i);
    return d;
  });
  const weekDayTotals = weekDays.map(day => {
    const dayStr = day.toISOString().split('T')[0];
    const dayAccs = weekAccounts.filter(a => a.closed_at?.split('T')[0] === dayStr);
    const total = dayAccs.reduce((s, a) =>
      s + a.pos_payments.reduce((ps, p) => ps + Number(p.total), 0), 0);
    return { day, total, count: dayAccs.length };
  });
  const weekGrandTotal = weekDayTotals.reduce((s, d) => s + d.total, 0);
  const weekMaxDay = Math.max(...weekDayTotals.map(d => d.total), 1);
  const weekTotalsByMethod = weekAccounts.reduce((acc, a) => {
    a.pos_payments.forEach(p => {
      acc[p.payment_method] = (acc[p.payment_method] ?? 0) + Number(p.total);
    });
    return acc;
  }, {} as Record<string, number>);
  const weekTopProducts = (() => {
    const map: Record<string, { name: string; qty: number; total: number }> = {};
    weekAccounts.forEach(a => {
      a.pos_account_items.forEach(item => {
        if (!map[item.product_name]) map[item.product_name] = { name: item.product_name, qty: 0, total: 0 };
        map[item.product_name].qty += item.quantity;
        map[item.product_name].total += item.unit_price * item.quantity;
      });
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 8);
  })();
  const weekMaxQty = weekTopProducts[0]?.qty ?? 1;

  // Report helpers
  const buildReportText = () => {
    const dateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const productMap: Record<string, { name: string; qty: number; total: number }> = {};
    accounts.forEach(a => {
      a.pos_account_items.forEach(item => {
        if (!productMap[item.product_name]) productMap[item.product_name] = { name: item.product_name, qty: 0, total: 0 };
        productMap[item.product_name].qty += item.quantity;
        productMap[item.product_name].total += item.unit_price * item.quantity;
      });
    });
    const topProducts = Object.values(productMap).sort((a, b) => b.total - a.total).slice(0, 10);
    let msg = `*REPORTE DE VENTAS - BAR LA CABRONA*\n`;
    msg += `*${dateLabel.toUpperCase()}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `*RESUMEN GENERAL*\n`;
    msg += `Total del día: *$${grandTotal.toFixed(2)}*\n`;
    msg += `Cuentas cerradas: ${accounts.length}\n`;
    if (totalCardFee > 0) msg += `Cargos terminal (3%): $${totalCardFee.toFixed(2)}\n`;
    msg += `\n*DESGLOSE POR FORMA DE PAGO*\n`;
    PAYMENT_OPTIONS.forEach(opt => {
      const amount = totals[opt.value] ?? 0;
      if (amount > 0) msg += `${opt.label}: $${amount.toFixed(2)}\n`;
    });
    if (topProducts.length > 0) {
      msg += `\n*TOP PRODUCTOS*\n`;
      topProducts.forEach((p, i) => {
        msg += `${i + 1}. ${p.name} — ${p.qty} uds — $${p.total.toFixed(2)}\n`;
      });
    }
    msg += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `_Reporte generado automáticamente desde el POS_`;
    return msg;
  };

  const handleSendWhatsApp = () => {
    const text = buildReportText();
    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank');
    setReportSent('whatsapp');
    setTimeout(() => setReportSent(null), 3000);
  };

  const handleSendEmail = () => {
    const text = buildReportText();
    const subject = encodeURIComponent(`Reporte de Ventas - ${selectedDate} - Bar La Cabrona`);
    const body = encodeURIComponent(text.replace(/\*/g, '').replace(/━/g, '─'));
    window.open(`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`, '_blank');
    setReportSent('email');
    setTimeout(() => setReportSent(null), 3000);
  };

  const copyClabe = () => {
    navigator.clipboard.writeText(TRANSFER_DATA.clabe);
    setClabeCopied(true);
    setTimeout(() => setClabeCopied(false), 2000);
  };

  const handleEditPayment = (account: ClosedAccount) => {
    const payment = account.pos_payments[0];
    if (!payment) return;
    setEditMethod(payment.payment_method);
    setEditSplit(payment.split_count ?? 1);
    setEditingPayment({ accountId: account.id, paymentId: payment.id });
  };

  const handleSavePayment = async () => {
    if (!editingPayment) return;
    const account = accounts.find(a => a.id === editingPayment.accountId);
    if (!account) return;
    const subtotal = account.pos_account_items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const hasCardFee = editMethod === 'credit_card' || editMethod === 'debit_card';
    const cardFee = hasCardFee ? subtotal * CARD_FEE_RATE : 0;
    const total = subtotal + cardFee;
    await supabasePos.from('pos_payments').update({
      payment_method: editMethod, subtotal, card_fee: cardFee, total, split_count: editSplit,
    }).eq('id', editingPayment.paymentId);
    setEditingPayment(null);
    fetchAccounts();
  };

  // Reabrir cuenta cerrada por accidente
  const handleReopen = async (accountId: number) => {
    setReopeningId(accountId);
    try {
      await supabasePos.from('pos_payments').delete().eq('account_id', accountId);
      await supabasePos.from('pos_accounts').update({
        status: 'open',
        closed_at: null,
      }).eq('id', accountId);
      setReopenDoneId(accountId);
      setReopenConfirmId(null);
      setTimeout(() => {
        setReopenDoneId(null);
        fetchAccounts();
      }, 2500);
    } finally {
      setReopeningId(null);
    }
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 flex-wrap">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer">
          <i className="ri-arrow-left-line text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900">Corte de Caja</h2>
          <p className="text-xs text-gray-500">
            {tabView === 'day'
              ? `${accounts.length} cuenta(s) cerrada(s)`
              : `${fmtDate(wMonday)} — ${fmtDate(wSunday)}`}
          </p>
        </div>
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setTabView('day')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${tabView === 'day' ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <i className="ri-sun-line mr-1" />Día
          </button>
          <button
            onClick={() => setTabView('week')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${tabView === 'week' ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <i className="ri-bar-chart-2-line mr-1" />Semana
          </button>
        </div>
        {tabView === 'day' && (
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer"
          />
        )}
        {tabView === 'day' && isToday && (
          <button
            onClick={() => setShowCierreConfirm(true)}
            className="bg-gray-900 hover:bg-gray-800 text-white px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-lock-line mr-1" />Cerrar Día
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ══ WEEKLY TAB ══ */}
        {tabView === 'week' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3">
              <button onClick={() => setWeekOffset(w => w - 1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer">
                <i className="ri-arrow-left-s-line text-gray-600" />
              </button>
              <div className="text-center">
                <p className="font-bold text-gray-900 text-sm">
                  {weekOffset === 0 ? 'Esta semana' : weekOffset === -1 ? 'Semana pasada' : `Hace ${Math.abs(weekOffset)} semanas`}
                </p>
                <p className="text-xs text-gray-400">{fmtDate(wMonday)} — {fmtDate(wSunday)}</p>
              </div>
              <button
                onClick={() => setWeekOffset(w => Math.min(0, w + 1))}
                disabled={weekOffset === 0}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer disabled:opacity-30"
              >
                <i className="ri-arrow-right-s-line text-gray-600" />
              </button>
            </div>

            {weekLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : weekAccounts.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-14 h-14 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                  <i className="ri-bar-chart-line text-2xl text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm font-medium">Sin ventas esta semana</p>
              </div>
            ) : (
              <>
                <div className="bg-gray-900 rounded-xl p-5 flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-widest">Total de la Semana</p>
                    <p className="text-3xl font-bold text-white mt-1">${weekGrandTotal.toFixed(2)}</p>
                    <p className="text-gray-400 text-xs mt-1">{weekAccounts.length} cuentas cerradas</p>
                  </div>
                  <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center">
                    <i className="ri-bar-chart-2-line text-white text-2xl" />
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="font-bold text-gray-900 text-sm">Ventas por Día</h3>
                  </div>
                  <div className="p-4">
                    <div className="flex items-end gap-2" style={{ height: '120px' }}>
                      {weekDayTotals.map(({ day, total }) => {
                        const heightPct = (total / weekMaxDay) * 100;
                        const isTodayBar = day.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
                        const dayName = day.toLocaleDateString('es-MX', { weekday: 'short' });
                        return (
                          <div key={day.toISOString()} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                            <span className="text-xs text-gray-500 font-medium leading-none">
                              {total > 0 ? (total >= 1000 ? `$${(total / 1000).toFixed(1)}k` : `$${total.toFixed(0)}`) : ''}
                            </span>
                            <div
                              className={`w-full rounded-t-lg transition-all ${isTodayBar ? 'bg-amber-500' : total > 0 ? 'bg-amber-200' : 'bg-gray-100'}`}
                              style={{ height: `${Math.max(heightPct, total > 0 ? 8 : 3)}%`, minHeight: '4px' }}
                            />
                            <span className={`text-xs font-semibold capitalize ${isTodayBar ? 'text-amber-600' : 'text-gray-500'}`}>
                              {dayName}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="font-bold text-gray-900 text-sm">Por Forma de Pago</h3>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-2">
                    {PAYMENT_OPTIONS.map(opt => (
                      <div key={opt.value} className={`rounded-xl border p-3 ${PAYMENT_COLORS[opt.value]}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <i className={`${opt.icon} text-base`} />
                          <span className="text-xs font-semibold">{opt.label}</span>
                        </div>
                        <p className="text-lg font-bold">${(weekTotalsByMethod[opt.value] ?? 0).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {weekTopProducts.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <h3 className="font-bold text-gray-900 text-sm">Top Productos de la Semana</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      {weekTopProducts.map((p, idx) => (
                        <div key={p.name}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                                idx === 0 ? 'bg-amber-500 text-white' :
                                idx === 1 ? 'bg-gray-300 text-gray-700' :
                                idx === 2 ? 'bg-orange-300 text-white' : 'bg-gray-100 text-gray-500'
                              }`}>{idx + 1}</span>
                              <span className="text-sm text-gray-800 truncate">{p.name}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                              <span className="text-xs font-bold text-amber-600">${p.total.toFixed(2)}</span>
                              <span className="text-xs font-bold text-gray-900 w-12 text-right">{p.qty} uds</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(p.qty / weekMaxQty) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══ DAILY TAB ══ */}
        {tabView === 'day' && (
          <div className="space-y-4">
            {/* Summary card */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-sm">Resumen del Día</h3>
                <span className="text-xs text-gray-400">{selectedDate}</span>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {/* Venta Total General */}
                  <div className="bg-gray-900 rounded-2xl p-5">
                    <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">VENTA TOTAL DEL DÍA</p>
                    <p className="text-4xl font-black text-white">${grandTotal.toFixed(2)}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-gray-400 text-xs">{accounts.length} cuenta{accounts.length !== 1 ? 's' : ''} cerrada{accounts.length !== 1 ? 's' : ''}</span>
                      {totalCardFee > 0 && (
                        <span className="text-amber-400 text-xs">Terminal: +${totalCardFee.toFixed(2)}</span>
                      )}
                    </div>
                  </div>

                  {/* Desglose por forma de pago */}
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Desglose por Forma de Pago</p>
                    <div className="grid grid-cols-2 gap-2">
                      {PAYMENT_OPTIONS.map(opt => {
                        const amount = totals[opt.value] ?? 0;
                        const pct = grandTotal > 0 ? (amount / grandTotal) * 100 : 0;
                        return (
                          <div key={opt.value} className={`rounded-xl border p-3 ${PAYMENT_COLORS[opt.value]}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <i className={`${opt.icon} text-base`} />
                              <span className="text-xs font-semibold">{opt.label}</span>
                            </div>
                            <p className="text-lg font-bold">${amount.toFixed(2)}</p>
                            {grandTotal > 0 && (
                              <div className="mt-1.5">
                                <div className="h-1 bg-black/10 rounded-full overflow-hidden">
                                  <div className="h-full bg-current opacity-40 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                                <p className="text-xs opacity-70 mt-0.5">{pct.toFixed(0)}% del total</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cuadre de Caja */}
                  <div className="border border-gray-200 rounded-xl p-3 space-y-1.5">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Cuadre de Caja</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal consumos</span>
                      <span className="font-semibold text-gray-900">${totalItemsAmount.toFixed(2)}</span>
                    </div>
                    {totalCardFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Cargos terminal (3%)</span>
                        <span className="font-semibold text-amber-600">+${totalCardFee.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-gray-200">
                      <span className="text-gray-900">Total cobrado</span>
                      <span className="text-amber-600">${grandTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-gray-900">Suma métodos de pago</span>
                      <span className="text-gray-900">${Object.values(totals).reduce((s, v) => s + v, 0).toFixed(2)}</span>
                    </div>
                    <div className={`flex justify-between text-sm font-bold pt-1 border-t border-gray-200 ${Math.abs(cuadre) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                      <span className="flex items-center gap-1">
                        <i className={Math.abs(cuadre) < 0.01 ? 'ri-check-double-line' : 'ri-alert-line'} />
                        {Math.abs(cuadre) < 0.01 ? 'Cuadre correcto' : 'Diferencia'}
                      </span>
                      <span>{Math.abs(cuadre) < 0.01 ? '✓ $0.00' : `$${cuadre.toFixed(2)}`}</span>
                    </div>
                  </div>

                  {accounts.length > 0 && (
                    <button
                      onClick={() => setShowReportModal(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <i className="ri-send-plane-line text-base" />
                      Enviar Reporte a Irma
                    </button>
                  )}

                  {reportSent && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
                      <i className="ri-check-double-line text-green-600" />
                      <p className="text-green-700 text-xs font-semibold">
                        {reportSent === 'whatsapp' ? 'Reporte enviado por WhatsApp' : 'Reporte enviado por Email'}
                      </p>
                    </div>
                  )}

                  {cierreDone && isToday && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
                      <i className="ri-check-double-line text-green-600" />
                      <p className="text-green-700 text-xs font-semibold">Día cerrado correctamente</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Top products */}
            {!loading && accounts.length > 0 && (() => {
              const productMap: Record<string, { name: string; qty: number; total: number }> = {};
              accounts.forEach(account => {
                account.pos_account_items.forEach(item => {
                  if (!productMap[item.product_name]) productMap[item.product_name] = { name: item.product_name, qty: 0, total: 0 };
                  productMap[item.product_name].qty += item.quantity;
                  productMap[item.product_name].total += item.unit_price * item.quantity;
                });
              });
              const topProducts = Object.values(productMap).sort((a, b) => b.qty - a.qty).slice(0, 8);
              const maxQty = topProducts[0]?.qty ?? 1;
              return (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="font-bold text-gray-900 text-sm">Productos Más Vendidos</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {topProducts.map((p, idx) => (
                      <div key={p.name}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                              idx === 0 ? 'bg-amber-500 text-white' :
                              idx === 1 ? 'bg-gray-300 text-gray-700' :
                              idx === 2 ? 'bg-orange-300 text-white' : 'bg-gray-100 text-gray-500'
                            }`}>{idx + 1}</span>
                            <span className="text-sm text-gray-800 truncate">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                            <span className="text-xs font-bold text-amber-600">${p.total.toFixed(2)}</span>
                            <span className="text-xs font-bold text-gray-900 w-12 text-right">{p.qty} uds</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(p.qty / maxQty) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Empty state */}
            {!loading && accounts.length === 0 && (
              <div className="text-center py-12">
                <div className="w-14 h-14 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                  <i className="ri-receipt-line text-2xl text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm font-medium">Sin ventas en esta fecha</p>
              </div>
            )}

            {/* Accounts list */}
            {!loading && accounts.map(account => {
              const allPayments = account.pos_payments ?? [];
              const payment = allPayments[0];
              const isMixed = allPayments.length > 1;
              const subtotal = account.pos_account_items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
              const total = allPayments.length > 0
                ? allPayments.reduce((s, p) => s + Number(p.total), 0)
                : subtotal;
              const isExpanded = expandedId === account.id;
              const closedTime = account.closed_at
                ? new Date(account.closed_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <div key={account.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : account.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm">{account.spot}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          {account.area === 'llevar' ? 'Para Llevar/Recoger' : account.area.toUpperCase()}
                        </span>
                        {account.customer_name && <span className="text-xs text-gray-500">{account.customer_name}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-400">{closedTime}</span>
                        {isMixed ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200">
                            <i className="ri-split-cells-horizontal mr-1" />Pago Mixto
                          </span>
                        ) : payment ? (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${PAYMENT_COLORS[payment.payment_method]}`}>
                            <i className={`${PAYMENT_ICONS[payment.payment_method]} mr-1`} />
                            {PAYMENT_LABELS[payment.payment_method]}
                          </span>
                        ) : null}
                        {!isMixed && payment && payment.split_count > 1 && (
                          <span className="text-xs text-gray-400">÷{payment.split_count}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-amber-600">${total.toFixed(2)}</p>
                      <p className="text-xs text-gray-400">{account.pos_account_items.length} items</p>
                    </div>
                    {isExpanded
                      ? <i className="ri-arrow-up-s-line text-gray-400" />
                      : <i className="ri-arrow-down-s-line text-gray-400" />
                    }
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                      {/* Items */}
                      <div className="space-y-2">
                        {account.pos_account_items.map(item => {
                          const extras = detectExtras(item.size ?? item.notes ?? '');
                          return (
                            <div key={item.id} className="flex justify-between text-sm">
                              <div className="flex-1 min-w-0">
                                <span className="text-gray-700">
                                  {item.quantity}x {item.product_name}
                                  {item.size && <span className="text-gray-400 text-xs ml-1">({item.size})</span>}
                                </span>
                                {/* Badges de extras con cobro */}
                                {extras.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {extras.map((ex, idx) => (
                                      <span key={idx} className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 whitespace-nowrap">
                                        +{ex.label} ${ex.price}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <span className="font-medium text-gray-900 flex-shrink-0 ml-2">${(item.unit_price * item.quantity).toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Resumen de pagos */}
                      <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-xs">
                        <div className="flex justify-between text-gray-600 pb-1.5 border-b border-gray-200">
                          <span className="font-semibold">Subtotal consumos</span>
                          <span className="font-semibold">${subtotal.toFixed(2)}</span>
                        </div>
                        {isMixed ? (
                          <>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Formas de Pago</p>
                            {allPayments.map((p, idx) => (
                              <div key={p.id} className="space-y-0.5">
                                <div className="flex justify-between">
                                  <span className="flex items-center gap-1 text-gray-700">
                                    <i className={PAYMENT_ICONS[p.payment_method] ?? 'ri-money-dollar-circle-line'} />
                                    {PAYMENT_LABELS[p.payment_method] ?? p.payment_method}
                                    <span className="text-gray-400">#{idx + 1}</span>
                                  </span>
                                  <span className="font-semibold text-gray-900">${Number(p.subtotal).toFixed(2)}</span>
                                </div>
                                {Number(p.card_fee) > 0 && (
                                  <div className="flex justify-between text-amber-600 pl-4">
                                    <span>Cargo terminal</span>
                                    <span>+${Number(p.card_fee).toFixed(2)}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                            <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-gray-200">
                              <span>TOTAL COBRADO</span>
                              <span className="text-amber-600">${total.toFixed(2)}</span>
                            </div>
                          </>
                        ) : payment ? (
                          <>
                            <div className="flex justify-between text-gray-700">
                              <span className="flex items-center gap-1">
                                <i className={PAYMENT_ICONS[payment.payment_method]} />
                                {PAYMENT_LABELS[payment.payment_method]}
                              </span>
                              <span>${Number(payment.subtotal).toFixed(2)}</span>
                            </div>
                            {Number(payment.card_fee) > 0 && (
                              <div className="flex justify-between text-amber-600">
                                <span>Cargo terminal (3%)</span>
                                <span>+${Number(payment.card_fee).toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200">
                              <span>Total</span><span>${Number(payment.total).toFixed(2)}</span>
                            </div>
                            {payment.split_count > 1 && (
                              <div className="flex justify-between text-green-600">
                                <span>Por persona ({payment.split_count})</span>
                                <span>${(Number(payment.total) / payment.split_count).toFixed(2)}</span>
                              </div>
                            )}
                          </>
                        ) : null}
                      </div>

                      {/* Botón modificar pago (solo pago único) */}
                      {!isMixed && (
                        <button
                          onClick={() => handleEditPayment(account)}
                          className="w-full flex items-center justify-center gap-2 py-2 border border-amber-300 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-50 cursor-pointer transition-colors whitespace-nowrap"
                        >
                          <i className="ri-edit-line" />Modificar Forma de Pago
                        </button>
                      )}

                      {/* Botón Reabrir — solo disponible hoy */}
                      {isToday && (
                        reopenDoneId === account.id ? (
                          <div className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-50 border border-green-300 text-green-700 rounded-lg text-xs font-bold">
                            <i className="ri-checkbox-circle-fill" />
                            Cuenta reabierta — ya aparece en el panel de mesas
                          </div>
                        ) : reopenConfirmId === account.id ? (
                          <div className="border border-orange-200 bg-orange-50 rounded-lg p-3 space-y-2">
                            <p className="text-xs font-bold text-orange-800 flex items-center gap-1.5">
                              <i className="ri-alert-line" />
                              ¿Confirmas que se cerró por accidente?
                            </p>
                            <p className="text-xs text-orange-700">Se eliminará el pago registrado y la cuenta regresará al panel de mesas activas.</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setReopenConfirmId(null)}
                                className="flex-1 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors whitespace-nowrap"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => handleReopen(account.id)}
                                disabled={reopeningId === account.id}
                                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap disabled:opacity-60"
                              >
                                {reopeningId === account.id ? (
                                  <><i className="ri-loader-2-line animate-spin mr-1" />Reabriendo...</>
                                ) : (
                                  <><i className="ri-refresh-line mr-1" />Sí, Reabrir</>
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setReopenConfirmId(account.id)}
                            className="w-full flex items-center justify-center gap-2 py-2 border border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap"
                          >
                            <i className="ri-refresh-line" />Se cerró por accidente — Reabrir Cuenta
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowReportModal(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-lg">Enviar Reporte</h3>
              <button onClick={() => setShowReportModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer">
                <i className="ri-close-line text-gray-500" />
              </button>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-4 text-xs text-gray-600 space-y-1 max-h-40 overflow-y-auto">
              <p className="font-bold text-gray-900">REPORTE DE VENTAS - BAR LA CABRONA</p>
              <p className="font-semibold">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}</p>
              <p className="border-t border-gray-200 pt-1 mt-1">Total del día: <span className="font-bold text-amber-600">${grandTotal.toFixed(2)}</span></p>
              <p>Cuentas cerradas: {accounts.length}</p>
              {PAYMENT_OPTIONS.map(opt => {
                const amount = totals[opt.value] ?? 0;
                if (amount === 0) return null;
                return <p key={opt.value}>{opt.label}: ${amount.toFixed(2)}</p>;
              })}
            </div>
            <p className="text-xs text-gray-500 mb-4 text-center">¿Cómo quieres enviar el reporte?</p>
            <div className="space-y-3">
              <button
                onClick={() => { handleSendWhatsApp(); setShowReportModal(false); }}
                className="w-full flex items-center gap-3 p-4 bg-green-500 hover:bg-green-600 text-white rounded-xl cursor-pointer transition-colors whitespace-nowrap"
              >
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="ri-whatsapp-line text-xl" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm">WhatsApp</p>
                  <p className="text-xs text-green-100">Enviar mensaje a Irma</p>
                </div>
                <i className="ri-arrow-right-line ml-auto" />
              </button>
              <button
                onClick={() => { handleSendEmail(); setShowReportModal(false); }}
                className="w-full flex items-center gap-3 p-4 bg-gray-800 hover:bg-gray-900 text-white rounded-xl cursor-pointer transition-colors whitespace-nowrap"
              >
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="ri-mail-line text-xl" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm">Email</p>
                  <p className="text-xs text-gray-300">{ADMIN_EMAIL}</p>
                </div>
                <i className="ri-arrow-right-line ml-auto" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit payment modal */}
      {editingPayment && (() => {
        const account = accounts.find(a => a.id === editingPayment.accountId);
        if (!account) return null;
        const subtotal = account.pos_account_items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
        const hasCardFee = editMethod === 'credit_card' || editMethod === 'debit_card';
        const cardFee = hasCardFee ? subtotal * CARD_FEE_RATE : 0;
        const total = subtotal + cardFee;
        const perPerson = editSplit > 1 ? total / editSplit : total;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setEditingPayment(null)} />
            <div className="relative bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Modificar Pago</h3>
                <button onClick={() => setEditingPayment(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer">
                  <i className="ri-close-line text-gray-500" />
                </button>
              </div>
              <p className="text-xs text-gray-500">{account.spot} · {account.customer_name || 'Sin nombre'}</p>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Forma de Pago</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setEditMethod(opt.value)}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left cursor-pointer transition-all ${editMethod === opt.value ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <i className={`${opt.icon} text-lg ${editMethod === opt.value ? 'text-amber-600' : 'text-gray-400'}`} />
                      <span className={`text-xs font-semibold ${editMethod === opt.value ? 'text-amber-700' : 'text-gray-600'}`}>{opt.label}</span>
                    </button>
                  ))}
                </div>
                {hasCardFee && (
                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                    <i className="ri-information-line" />Se agrega 3% por uso de terminal
                  </p>
                )}
                {editMethod === 'transfer' && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
                    <div className="px-3 py-2 bg-amber-100 border-b border-amber-200 flex items-center gap-2">
                      <i className="ri-bank-line text-amber-700 text-sm" />
                      <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Datos para Transferencia</span>
                    </div>
                    <div className="px-3 py-2.5 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-amber-700 font-medium">Banco</span>
                        <span className="text-amber-900 font-bold">{TRANSFER_DATA.bank}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-amber-700 font-medium">Titular</span>
                        <span className="text-amber-900 font-bold">{TRANSFER_DATA.name}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-amber-700 font-medium">CLABE</span>
                        <button
                          type="button"
                          onClick={copyClabe}
                          className="flex items-center gap-1.5 bg-white border border-amber-300 px-2 py-1 rounded-lg hover:bg-amber-50 cursor-pointer transition-colors"
                        >
                          <span className="font-mono font-bold text-amber-900 tracking-wider">{TRANSFER_DATA.clabe}</span>
                          <i className={`text-amber-500 text-xs ${clabeCopied ? 'ri-check-line' : 'ri-file-copy-line'}`} />
                        </button>
                      </div>
                      {clabeCopied && (
                        <p className="text-xs text-green-600 font-semibold text-center">
                          <i className="ri-check-line mr-1" />CLABE copiada
                        </p>
                      )}
                      <div className="flex justify-between items-center text-xs pt-1 border-t border-amber-200">
                        <span className="text-amber-700 font-medium">Comprobante</span>
                        <span className="text-amber-900 font-bold">WA {TRANSFER_DATA.whatsapp}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dividir Cuenta</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setEditSplit(Math.max(1, editSplit - 1))} className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 hover:border-amber-500 hover:text-amber-600 cursor-pointer transition-colors">
                    <i className="ri-subtract-line" />
                  </button>
                  <span className="text-lg font-bold text-gray-900 w-8 text-center">{editSplit}</span>
                  <button onClick={() => setEditSplit(editSplit + 1)} className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 hover:border-amber-500 hover:text-amber-600 cursor-pointer transition-colors">
                    <i className="ri-add-line" />
                  </button>
                  <span className="text-sm text-gray-500">{editSplit === 1 ? 'Sin dividir' : `${editSplit} personas`}</span>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                {cardFee > 0 && <div className="flex justify-between text-amber-600"><span>Cargo terminal (3%)</span><span>+${cardFee.toFixed(2)}</span></div>}
                <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200"><span>TOTAL</span><span className="text-amber-600">${total.toFixed(2)}</span></div>
                {editSplit > 1 && <div className="flex justify-between text-green-600 text-xs"><span>Por persona ({editSplit})</span><span>${perPerson.toFixed(2)}</span></div>}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setEditingPayment(null)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">Cancelar</button>
                <button onClick={handleSavePayment} className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold cursor-pointer whitespace-nowrap">
                  <i className="ri-save-line mr-1" />Guardar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Cierre del día */}
      {showCierreConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCierreConfirm(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm text-center">
            <div className="w-14 h-14 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
              <i className="ri-lock-line text-2xl text-gray-700" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-2">Cerrar el Día</h3>
            <p className="text-gray-500 text-sm mb-4">Estás a punto de hacer el corte final del día. El resumen es:</p>
            <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 mb-4">
              {PAYMENT_OPTIONS.map(opt => {
                const amount = totals[opt.value] ?? 0;
                if (amount === 0) return null;
                return (
                  <div key={opt.value} className="flex justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1.5"><i className={opt.icon} />{opt.label}</span>
                    <span className="font-bold text-gray-900">${amount.toFixed(2)}</span>
                  </div>
                );
              })}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200">
                <span>TOTAL</span><span className="text-amber-600">${grandTotal.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCierreConfirm(false)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button
                onClick={() => { setCierreDone(true); setShowCierreConfirm(false); }}
                className="flex-1 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-bold cursor-pointer whitespace-nowrap"
              >
                <i className="ri-check-line mr-1" />Confirmar Cierre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}