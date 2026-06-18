import { useState, useEffect, useCallback } from 'react';
import { supabasePos } from '../supabasePos';

import { REWARD_TIERS, getTierProgress } from '@/hooks/useLoyaltyRewards';

interface PosCustomer {
  id: number;
  name: string;
  phone?: string;
  notes?: string;
  visit_count: number;
  total_spent: number;
  loyalty_points: number;
  birthday?: string;
  last_visit?: string;
  created_at: string;
}

interface AccountSummary {
  id: number;
  spot: string;
  area: string;
  status: string;
  created_at: string;
  closed_at?: string;
  total: number;
  items: { product_name: string; quantity: number; unit_price: number; size?: string; folio_number: number }[];
}

interface LoyaltyRedemption {
  id: number;
  tier_label: string;
  tier_emoji: string;
  points_redeemed: number;
  items_description: string;
  redeemed_by: string;
  notes?: string;
  created_at: string;
}

interface LoyaltyAdjustment {
  id: number;
  delta: number;
  points_before: number;
  points_after: number;
  reason: string;
  adjusted_by: string;
  created_at: string;
}

interface AccountEvent {
  id: number;
  account_id: number;
  event_type: string;
  description?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface CustomerProfileModalProps {
  customerId: number;
  onClose: () => void;
  onGoToAccount?: (accountId: number) => void;
}

const AREA_LABELS: Record<string, string> = {
  principal: 'Principal',
  af1: 'AF1',
  af2: 'AF2',
  llevar: 'Para Llevar',
};

const EVENT_ICONS: Record<string, string> = {
  account_opened: 'ri-door-open-line',
  account_closed: 'ri-close-circle-line',
  account_merged: 'ri-git-merge-line',
  item_added: 'ri-add-circle-line',
  payment: 'ri-bank-card-line',
};

const EVENT_COLORS: Record<string, string> = {
  account_opened: 'text-green-600 bg-green-100',
  account_closed: 'text-red-500 bg-red-100',
  account_merged: 'text-indigo-600 bg-indigo-100',
  item_added: 'text-amber-600 bg-amber-100',
  payment: 'text-emerald-600 bg-emerald-100',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function elapsed(start: string, end?: string) {
  const diff = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return hrs > 0 ? `${hrs}h ${remMins}m` : `${mins}m`;
}

export default function CustomerProfileModal({ customerId, onClose, onGoToAccount }: CustomerProfileModalProps) {
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [todayAccounts, setTodayAccounts] = useState<AccountSummary[]>([]);
  const [allEvents, setAllEvents] = useState<AccountEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'hoy' | 'lealtad' | 'eventos' | 'notas'>('hoy');
  const [editNotes, setEditNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [redemptions, setRedemptions] = useState<LoyaltyRedemption[]>([]);
  const [adjustments, setAdjustments] = useState<LoyaltyAdjustment[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    // Fetch customer
    const { data: cust } = await supabasePos
      .from('pos_customers')
      .select('*')
      .eq('id', customerId)
      .maybeSingle();
    if (cust) {
      setCustomer(cust as PosCustomer);
      setNotesText((cust as PosCustomer).notes ?? '');
    }

    // Fetch redemption history
    const { data: redemptionData } = await supabasePos
      .from('loyalty_redemptions')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20);
    setRedemptions((redemptionData ?? []) as LoyaltyRedemption[]);

    // Fetch point adjustment history
    const { data: adjustmentData } = await supabasePos
      .from('loyalty_point_adjustments')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20);
    setAdjustments((adjustmentData ?? []) as LoyaltyAdjustment[]);

    // Fetch today's accounts linked to this customer
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: accounts } = await supabasePos
      .from('pos_accounts')
      .select('*, pos_account_items(*)')
      .eq('customer_id', customerId)
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false });

    if (accounts) {
      const summaries: AccountSummary[] = accounts.map((acc: Record<string, unknown>) => {
        const items = (acc.pos_account_items as { product_name: string; quantity: number; unit_price: number; size?: string; folio_number: number }[]) ?? [];
        const total = items.reduce((s: number, i: { quantity: number; unit_price: number }) => s + i.unit_price * i.quantity, 0);
        return {
          id: acc.id as number,
          spot: acc.spot as string,
          area: acc.area as string,
          status: acc.status as string,
          created_at: acc.created_at as string,
          closed_at: acc.closed_at as string | undefined,
          total,
          items,
        };
      });
      setTodayAccounts(summaries);

      // Fetch events for these accounts
      const accountIds = summaries.map(a => a.id);
      if (accountIds.length > 0) {
        const { data: events } = await supabasePos
          .from('pos_account_events')
          .select('*')
          .in('account_id', accountIds)
          .order('created_at', { ascending: false });
        setAllEvents((events ?? []) as AccountEvent[]);
      }
    }
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    fetchData();

    // Realtime: actualizar si cambian los puntos del cliente
    const channel = supabasePos
      .channel(`customer-profile-${customerId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pos_customers', filter: `id=eq.${customerId}` },
        (payload) => {
          const updated = payload.new as PosCustomer;
          setCustomer(prev => prev ? { ...prev, loyalty_points: updated.loyalty_points, notes: updated.notes ?? prev.notes } : prev);
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'loyalty_point_adjustments', filter: `customer_id=eq.${customerId}` },
        () => { fetchData(); },
      )
      .subscribe();

    return () => { supabasePos.removeChannel(channel); };
  }, [fetchData, customerId]);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    await supabasePos
      .from('pos_customers')
      .update({ notes: notesText, updated_at: new Date().toISOString() })
      .eq('id', customerId);
    setSavingNotes(false);
    setEditNotes(false);
    if (customer) setCustomer({ ...customer, notes: notesText });
  };

  const totalHoy = todayAccounts.reduce((s, a) => s + a.total, 0);
  const cuentasAbiertas = todayAccounts.filter(a => a.status === 'open').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gray-900 text-white px-5 py-4 flex items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center bg-amber-500 rounded-xl flex-shrink-0">
            <i className="ri-user-line text-white text-xl" />
          </div>
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="h-5 w-32 bg-gray-700 rounded animate-pulse" />
            ) : (
              <>
                <h2 className="font-bold text-base leading-tight">{customer?.name}</h2>
                {customer?.phone && (
                  <p className="text-gray-300 text-xs mt-0.5 flex items-center gap-1">
                    <i className="ri-phone-line" />
                    {customer.phone}
                    <a
                      href={`https://wa.me/52${customer.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-1 text-green-400 hover:text-green-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <i className="ri-whatsapp-line" />
                    </a>
                  </p>
                )}
              </>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-gray-400">{customer?.visit_count ?? 0} visitas</p>
            <p className="text-sm font-bold text-amber-400">${(customer?.total_spent ?? 0).toFixed(2)} total</p>
            {(customer?.loyalty_points ?? 0) > 0 && (
              <p className="text-xs font-bold text-amber-300 flex items-center gap-1 justify-end mt-0.5">
                <i className="ri-vip-crown-2-fill" />
                {customer?.loyalty_points} pts
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-700 cursor-pointer transition-colors flex-shrink-0"
          >
            <i className="ri-close-line text-gray-300" />
          </button>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs text-gray-500">Hoy</span>
              <span className="text-sm font-bold text-amber-600">${totalHoy.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="ri-receipt-line text-gray-400 text-sm" />
              <span className="text-xs text-gray-500">{todayAccounts.length} cuenta{todayAccounts.length !== 1 ? 's' : ''}</span>
            </div>
            {cuentasAbiertas > 0 && (
              <div className="flex items-center gap-1.5 bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-semibold">{cuentasAbiertas} abierta{cuentasAbiertas !== 1 ? 's' : ''}</span>
              </div>
            )}
            {customer?.last_visit && (
              <span className="text-xs text-gray-400 ml-auto">
                Última visita: {formatDate(customer.last_visit)}
              </span>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white overflow-x-auto">
          {(['hoy', 'lealtad', 'eventos', 'notas'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-xs font-semibold whitespace-nowrap px-2 transition-colors cursor-pointer border-b-2 ${
                activeTab === tab
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'hoy' ? 'Hoy' : tab === 'lealtad' ? '⭐ Lealtad' : tab === 'eventos' ? 'Movimientos' : 'Notas'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* TAB: Cuentas de hoy */}
              {activeTab === 'hoy' && (
                <div className="p-4 space-y-3">
                  {todayAccounts.length === 0 ? (
                    <div className="text-center py-10">
                      <i className="ri-receipt-line text-3xl text-gray-300 block mb-2" />
                      <p className="text-gray-400 text-sm">Sin cuentas hoy</p>
                    </div>
                  ) : (
                    todayAccounts.map(acc => (
                      <div key={acc.id} className="rounded-xl border border-gray-200 overflow-hidden">
                        {/* Account header */}
                        <div className={`flex items-center justify-between px-3 py-2.5 border-b ${
                          acc.status === 'open' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'
                        }`}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${
                              acc.status === 'open' ? 'bg-green-500' : 'bg-gray-400'
                            }`}>
                              {acc.status === 'open' ? 'Abierta' : 'Cerrada'}
                            </span>
                            <span className="text-sm font-semibold text-gray-900">{acc.spot}</span>
                            <span className="text-xs text-gray-400">{AREA_LABELS[acc.area] ?? acc.area}</span>
                            <span className="text-xs text-gray-400">
                              {formatTime(acc.created_at)}
                              {acc.closed_at && ` → ${formatTime(acc.closed_at)}`}
                              {` · ${elapsed(acc.created_at, acc.closed_at)}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">${acc.total.toFixed(2)}</span>
                            {acc.status === 'open' && onGoToAccount && (
                              <button
                                onClick={() => { onClose(); onGoToAccount(acc.id); }}
                                className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
                              >
                                <i className="ri-arrow-right-line" />
                                Ir
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Items grouped by folio */}
                        {acc.items.length > 0 && (
                          <div className="bg-white px-3 py-2">
                            {(() => {
                              const folioNums = [...new Set(acc.items.map(i => i.folio_number))].sort((a, b) => a - b);
                              return folioNums.map(folio => {
                                const folioItems = acc.items.filter(i => i.folio_number === folio);
                                const folioTotal = folioItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
                                return (
                                  <div key={folio} className="mb-2 last:mb-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                        Ronda #{String(folio).padStart(2, '0')}
                                      </span>
                                      <span className="text-xs text-gray-400">${folioTotal.toFixed(2)}</span>
                                    </div>
                                    <div className="space-y-0.5 pl-2">
                                      {folioItems.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-xs text-gray-600">
                                          <span>
                                            {item.quantity}x {item.product_name}
                                            {item.size && <span className="text-amber-600 ml-1">({item.size})</span>}
                                          </span>
                                          <span className="text-gray-400">${(item.unit_price * item.quantity).toFixed(2)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB: Lealtad */}
              {activeTab === 'lealtad' && (() => {
                const pts = customer?.loyalty_points ?? 0;
                const tiers = getTierProgress(pts);
                const isBirthdayMonth = customer?.birthday
                  ? new Date(customer.birthday).getMonth() === new Date().getMonth()
                  : false;

                // Siguiente nivel al que no ha llegado aún
                const nextTier = tiers.find(t => !t.achieved);
                // Total de premios canjeables activos
                const totalRedeemable = tiers.filter(t => t.achieved).length;

                const TIER_GRADIENT: Record<string, string> = {
                  amber: 'from-amber-600 to-amber-400',
                  orange: 'from-orange-600 to-orange-400',
                  red: 'from-red-600 to-red-400',
                  green: 'from-green-600 to-green-400',
                  emerald: 'from-emerald-600 to-emerald-400',
                };

                const TIER_BAR: Record<string, string> = {
                  amber: 'bg-amber-400',
                  orange: 'bg-orange-400',
                  red: 'bg-red-400',
                  green: 'bg-green-400',
                  emerald: 'bg-emerald-400',
                };

                const TIER_TEXT: Record<string, string> = {
                  amber: 'text-amber-300',
                  orange: 'text-orange-300',
                  red: 'text-red-300',
                  green: 'text-green-300',
                  emerald: 'text-emerald-300',
                };

                const TIER_BADGE_BG: Record<string, string> = {
                  amber: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
                  orange: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
                  red: 'bg-red-500/20 border-red-500/40 text-red-300',
                  green: 'bg-green-500/20 border-green-500/40 text-green-300',
                  emerald: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
                };

                return (
                  <div className="p-4 space-y-4">

                    {/* ── Tarjeta de puntos totales ── */}
                    <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-4 flex items-center gap-4">
                      <div className="w-14 h-14 flex items-center justify-center bg-amber-500/20 border-2 border-amber-500/50 rounded-2xl flex-shrink-0">
                        <i className="ri-vip-crown-2-fill text-amber-400 text-2xl" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-400 text-xs uppercase tracking-widest font-bold">Puntos acumulados</p>
                        <p className="text-4xl font-black text-white leading-none mt-0.5">{pts}</p>
                        {nextTier ? (
                          <p className="text-xs text-gray-500 mt-1">
                            Faltan <span className="text-amber-400 font-bold">{nextTier.remaining} pts</span> para {nextTier.title}
                          </p>
                        ) : (
                          <p className="text-xs text-green-400 font-bold mt-1">¡Todos los premios desbloqueados!</p>
                        )}
                      </div>
                      {totalRedeemable > 0 && (
                        <div className="text-right flex-shrink-0">
                          <div className="bg-green-500/20 border border-green-500/40 rounded-xl px-2.5 py-1.5 text-center">
                            <p className="text-green-400 font-black text-xl leading-none">{totalRedeemable}</p>
                            <p className="text-green-500 text-xs font-semibold">canjeable{totalRedeemable !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Barras de progreso por nivel ── */}
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Progreso por nivel</p>
                      {tiers.map((tier, idx) => {
                        const grad = TIER_GRADIENT[tier.color] ?? TIER_GRADIENT.amber;
                        const bar = TIER_BAR[tier.color] ?? TIER_BAR.amber;
                        const textCol = TIER_TEXT[tier.color] ?? TIER_TEXT.amber;
                        const badge = TIER_BADGE_BG[tier.color] ?? TIER_BADGE_BG.amber;
                        const isNext = !tier.achieved && (idx === 0 || tiers[idx - 1].achieved);

                        return (
                          <div
                            key={tier.id}
                            className={`rounded-2xl border overflow-hidden transition-all ${
                              tier.achieved
                                ? 'border-gray-600 bg-gray-800/60'
                                : isNext
                                  ? 'border-amber-500/30 bg-gray-800/80'
                                  : 'border-gray-700/50 bg-gray-900/60 opacity-70'
                            }`}
                          >
                            {/* Top row */}
                            <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                              {/* Emoji + nivel */}
                              <div className={`w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0 bg-gradient-to-br ${grad}`}>
                                <span className="text-xl leading-none">{tier.emoji}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-black text-white">{tier.title}</p>
                                  {tier.achieved ? (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/40 text-green-400">
                                      <i className="ri-check-line mr-0.5" />Desbloqueado
                                    </span>
                                  ) : isNext ? (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 animate-pulse">
                                      Próximo
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">{tier.description}</p>
                              </div>
                              {/* Pts badge */}
                              <div className={`text-right flex-shrink-0 border rounded-xl px-2.5 py-1.5 ${badge}`}>
                                <p className={`font-black text-base leading-none ${textCol}`}>{tier.points}</p>
                                <p className="text-gray-500 text-xs">pts</p>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="px-4 pb-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-600">{Math.min(pts, tier.points)}/{tier.points} pts</span>
                                <span className="text-xs font-bold text-gray-500">{Math.round(tier.progress)}%</span>
                              </div>
                              <div className="w-full h-2.5 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-700 ${bar} ${tier.achieved ? 'opacity-100' : 'opacity-80'}`}
                                  style={{ width: `${tier.progress}%` }}
                                />
                              </div>
                              {!tier.achieved && (
                                <p className={`text-xs mt-1.5 font-semibold ${isNext ? 'text-amber-400' : 'text-gray-500'}`}>
                                  Faltan {tier.remaining} pts
                                </p>
                              )}
                            </div>

                            {/* Items incluidos (siempre visibles) */}
                            <div className="px-4 pb-3 pt-1">
                              <div className="flex flex-wrap gap-1.5">
                                {tier.items.map((item, i) => (
                                  <span
                                    key={i}
                                    className={`text-xs px-2 py-1 rounded-lg border ${
                                      tier.achieved
                                        ? 'bg-gray-700 border-gray-600 text-gray-300'
                                        : 'bg-gray-800 border-gray-700 text-gray-500'
                                    }`}
                                  >
                                    {item}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Cumpleaños */}
                    {customer?.birthday && (
                      <div className={`rounded-xl px-4 py-3 flex items-center gap-3 border ${
                        isBirthdayMonth
                          ? 'bg-pink-50 border-pink-200'
                          : 'bg-gray-50 border-gray-100'
                      }`}>
                        <i className={`ri-cake-2-line text-xl ${
                          isBirthdayMonth ? 'text-pink-500' : 'text-gray-400'
                        }`} />
                        <div>
                          <p className={`text-sm font-bold ${isBirthdayMonth ? 'text-pink-700' : 'text-gray-600'}`}>
                            {isBirthdayMonth ? '¡Mes de cumpleaños! 🎂' : 'Cumpleaños'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(customer.birthday + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className="text-lg font-black text-gray-900">{customer?.visit_count ?? 0}</p>
                        <p className="text-xs text-gray-400">Visitas</p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3 text-center">
                        <p className="text-lg font-black text-amber-600">{pts}</p>
                        <p className="text-xs text-gray-400">Puntos</p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-3 text-center">
                        <p className="text-lg font-black text-green-700">${Math.round(customer?.total_spent ?? 0)}</p>
                        <p className="text-xs text-gray-400">Gastado</p>
                      </div>
                    </div>

                    {/* Info regla */}
                    <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-500 space-y-1">
                      <p className="font-semibold text-gray-700 mb-1">Reglas del programa</p>
                      <p>• 1 punto por cada $100 consumidos</p>
                      {REWARD_TIERS.map(t => (
                        <p key={t.id}>• {t.points} puntos = {t.title} ({t.items[0]}...)</p>
                      ))}
                      <p>• Los puntos se acumulan al cerrar la cuenta</p>
                    </div>

                    {/* Historial de canjes */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <i className="ri-history-line text-amber-500 text-sm" />
                        <p className="text-sm font-bold text-gray-800">Historial de canjes</p>
                        {redemptions.length > 0 && (
                          <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            {redemptions.length} canje{redemptions.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {redemptions.length === 0 ? (
                        <div className="bg-gray-50 rounded-xl px-4 py-5 text-center">
                          <i className="ri-gift-2-line text-2xl text-gray-300 block mb-1" />
                          <p className="text-xs text-gray-400">Sin canjes registrados todavía</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {redemptions.map(r => (
                            <div key={r.id} className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 flex items-start gap-3">
                              <span className="text-xl flex-shrink-0 mt-0.5">{r.tier_emoji}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <p className="text-sm font-bold text-gray-800">{r.tier_label}</p>
                                  <span className="text-xs font-bold text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                                    − {r.points_redeemed} pts
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5 leading-snug">{r.items_description.split(' | ').join(' · ')}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <p className="text-xs text-gray-400">
                                    {new Date(r.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    {' · '}
                                    {new Date(r.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                  <span className="text-xs text-gray-300">·</span>
                                  <span className="text-xs text-gray-400">{r.redeemed_by === 'admin' ? 'Por admin' : r.redeemed_by}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Historial de ajustes manuales */}
                    {adjustments.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <i className="ri-equalizer-2-line text-gray-400 text-sm" />
                          <p className="text-sm font-bold text-gray-700">Ajustes manuales</p>
                          <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                            {adjustments.length}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {adjustments.map(adj => (
                            <div key={adj.id} className={`rounded-xl px-3 py-2.5 flex items-start gap-3 border ${
                              adj.delta > 0
                                ? 'bg-green-50 border-green-100'
                                : 'bg-red-50 border-red-100'
                            }`}>
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                adj.delta > 0 ? 'bg-green-100' : 'bg-red-100'
                              }`}>
                                <i className={`text-sm ${
                                  adj.delta > 0
                                    ? 'ri-add-circle-fill text-green-600'
                                    : 'ri-indeterminate-circle-fill text-red-500'
                                }`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs text-gray-600 leading-snug">{adj.reason}</p>
                                  <span className={`text-xs font-black whitespace-nowrap ${
                                    adj.delta > 0 ? 'text-green-600' : 'text-red-500'
                                  }`}>
                                    {adj.delta > 0 ? '+' : ''}{adj.delta} pts
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-xs text-gray-400">
                                    {new Date(adj.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                    {' · '}
                                    {new Date(adj.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                  <span className="text-xs text-gray-300">·</span>
                                  <span className="text-xs text-gray-400">{adj.points_before} → {adj.points_after} pts</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* TAB: Movimientos/Eventos */}
              {activeTab === 'eventos' && (
                <div className="p-4">
                  {allEvents.length === 0 ? (
                    <div className="text-center py-10">
                      <i className="ri-history-line text-3xl text-gray-300 block mb-2" />
                      <p className="text-gray-400 text-sm">Sin movimientos registrados hoy</p>
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Timeline line */}
                      <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-gray-100" />
                      <div className="space-y-3">
                        {allEvents.map(evt => {
                          const iconClass = EVENT_ICONS[evt.event_type] ?? 'ri-information-line';
                          const colorClass = EVENT_COLORS[evt.event_type] ?? 'text-gray-500 bg-gray-100';
                          return (
                            <div key={evt.id} className="flex items-start gap-3 pl-0">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${colorClass}`}>
                                <i className={`${iconClass} text-sm`} />
                              </div>
                              <div className="flex-1 min-w-0 pt-1.5">
                                <p className="text-sm font-medium text-gray-800 leading-tight">
                                  {evt.description ?? evt.event_type}
                                </p>
                                {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                                  <div className="mt-1 bg-gray-50 rounded-lg px-2 py-1 text-xs text-gray-500 space-y-0.5">
                                    {evt.metadata.spot && <span className="mr-2">📍 {String(evt.metadata.spot)}</span>}
                                    {evt.metadata.total && <span className="mr-2">💰 ${Number(evt.metadata.total).toFixed(2)}</span>}
                                    {evt.metadata.merged_from && (
                                      <span className="mr-2">🔀 Desde: {String(evt.metadata.merged_from)}</span>
                                    )}
                                    {evt.metadata.payment_method && (
                                      <span className="mr-2">💳 {String(evt.metadata.payment_method)}</span>
                                    )}
                                  </div>
                                )}
                                <p className="text-xs text-gray-400 mt-0.5">{formatTime(evt.created_at)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: Notas */}
              {activeTab === 'notas' && (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700">Notas del cliente</p>
                    {!editNotes && (
                      <button
                        onClick={() => setEditNotes(true)}
                        className="flex items-center gap-1 text-amber-600 hover:text-amber-700 text-xs font-semibold cursor-pointer"
                      >
                        <i className="ri-edit-line" />
                        Editar
                      </button>
                    )}
                  </div>
                  {editNotes ? (
                    <div className="space-y-2">
                      <textarea
                        value={notesText}
                        onChange={e => setNotesText(e.target.value)}
                        placeholder="Alergias, preferencias, comentarios..."
                        rows={5}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setEditNotes(false); setNotesText(customer?.notes ?? ''); }}
                          className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 cursor-pointer transition-colors whitespace-nowrap"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleSaveNotes}
                          disabled={savingNotes}
                          className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap disabled:opacity-50"
                        >
                          {savingNotes ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="bg-gray-50 rounded-xl p-3 min-h-24 cursor-pointer hover:bg-amber-50 transition-colors"
                      onClick={() => setEditNotes(true)}
                    >
                      {customer?.notes ? (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{customer.notes}</p>
                      ) : (
                        <p className="text-sm text-gray-400 italic">Sin notas. Toca para agregar...</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}