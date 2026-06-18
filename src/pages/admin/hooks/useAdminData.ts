import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type DateRange = 'today' | 'week' | 'month';

function getDateFrom(range: DateRange): string {
  const now = new Date();
  if (range === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return start.toISOString();
  }
  if (range === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }
  const d = new Date(now);
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

export interface AccountWithItems {
  id: number;
  area: string;
  spot: string;
  customer_name?: string;
  customer_phone?: string;
  status: string;
  created_at: string;
  closed_at?: string;
  folio_counter: number;
  source: 'web' | 'pos';
  opened_by?: string;
  pos_account_items: {
    id: number;
    product_name: string;
    size?: string;
    quantity: number;
    unit_price: number;
    folio_number: number;
    created_at: string;
  }[];
  pos_payments: {
    id: number;
    payment_method: string;
    subtotal: number;
    card_fee: number;
    total: number;
    split_count: number;
    tip: number;
    closed_by?: string;
    created_at: string;
  }[];
}

export interface TopProduct {
  product_name: string;
  total_qty: number;
  total_revenue: number;
}

export interface PaymentBreakdown {
  payment_method: string;
  count: number;
  total: number;
}

export function useAdminData(dateRange: DateRange) {
  const [accounts, setAccounts] = useState<AccountWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const from = getDateFrom(dateRange);

    const { data } = await supabase
      .from('pos_accounts')
      .select('*, pos_account_items(*), pos_payments(*)')
      .gte('created_at', from)
      .order('created_at', { ascending: false });

    if (data) {
      const mapped = (data as AccountWithItems[]).map(acc => ({
        ...acc,
        source: (acc.area === 'web' || acc.spot?.toLowerCase().includes('web')) ? 'web' as const : 'pos' as const,
      }));
      setAccounts(mapped);
    }
    setLoading(false);
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- derived stats ----
  const closedAccounts = accounts.filter(a => a.status === 'closed');
  const openAccounts = accounts.filter(a => a.status === 'open');

  // Suma TODOS los pagos de cada cuenta (pagos mixtos incluidos)
  const totalRevenue = closedAccounts.reduce((sum, a) => {
    const paymentsTotal = (a.pos_payments ?? []).reduce((s, p) => s + Number(p.total ?? 0), 0);
    return sum + paymentsTotal;
  }, 0);

  const avgTicket = closedAccounts.length > 0 ? totalRevenue / closedAccounts.length : 0;

  const totalItems = accounts.reduce((sum, a) =>
    sum + (a.pos_account_items?.reduce((s, i) => s + i.quantity, 0) ?? 0), 0
  );

  // top products
  const productMap: Record<string, { qty: number; revenue: number }> = {};
  accounts.forEach(a => {
    (a.pos_account_items ?? []).forEach(item => {
      const key = item.product_name;
      if (!productMap[key]) productMap[key] = { qty: 0, revenue: 0 };
      productMap[key].qty += item.quantity;
      productMap[key].revenue += item.unit_price * item.quantity;
    });
  });
  const topProducts: TopProduct[] = Object.entries(productMap)
    .map(([product_name, v]) => ({ product_name, total_qty: v.qty, total_revenue: v.revenue }))
    .sort((a, b) => b.total_qty - a.total_qty)
    .slice(0, 15);

  // payment breakdown — suma TODOS los pagos por método (pagos mixtos)
  const payMap: Record<string, { count: number; total: number }> = {};
  closedAccounts.forEach(a => {
    (a.pos_payments ?? []).forEach(pay => {
      const key = pay.payment_method;
      if (!payMap[key]) payMap[key] = { count: 0, total: 0 };
      payMap[key].count += 1;
      payMap[key].total += Number(pay.total ?? 0);
    });
  });
  const paymentBreakdown: PaymentBreakdown[] = Object.entries(payMap)
    .map(([payment_method, v]) => ({ payment_method, count: v.count, total: v.total }))
    .sort((a, b) => b.total - a.total);

  // web vs pos
  const webOrders = accounts.filter(a => a.source === 'web');
  const posOrders = accounts.filter(a => a.source === 'pos');

  return {
    accounts,
    closedAccounts,
    openAccounts,
    loading,
    refetch: fetchData,
    stats: {
      totalRevenue,
      avgTicket,
      totalItems,
      closedCount: closedAccounts.length,
      openCount: openAccounts.length,
      totalAccounts: accounts.length,
    },
    topProducts,
    paymentBreakdown,
    webOrders,
    posOrders,
  };
}

export const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  credit_card: 'Tarjeta Crédito',
  debit_card: 'Tarjeta Débito',
};

export const PAYMENT_COLORS: Record<string, string> = {
  cash: 'bg-green-500',
  transfer: 'bg-amber-500',
  credit_card: 'bg-violet-500',
  debit_card: 'bg-sky-500',
};