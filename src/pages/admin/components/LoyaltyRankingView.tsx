import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface LoyaltyCustomer {
  id: number;
  name: string;
  phone?: string;
  birthday?: string;
  visit_count: number;
  total_spent: number;
  loyalty_points: number;
  last_visit?: string;
  created_at: string;
}

interface RewardFromDb {
  id: number;
  tier_order: number;
  points_required: number;
  pesos_equivalent: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  items: string[];
  emoji: string | null;
  color: string | null;
  bg_color: string | null;
  border_color: string | null;
  text_color: string | null;
  is_active: boolean;
}

interface RedemptionRecord {
  id: number;
  customer_id: number;
  tier_label: string;
  tier_emoji: string;
  points_redeemed: number;
  items_description: string;
  redeemed_by: string;
  notes: string | null;
  created_at: string;
}

interface AdjustmentRecord {
  id: number;
  customer_id: number;
  delta: number;
  points_before: number;
  points_after: number;
  reason: string;
  adjusted_by: string;
  created_at: string;
}

/* ── Helpers dinámicos ── */
function getActiveRewards(rewards: RewardFromDb[]) {
  return [...rewards].filter(r => r.is_active).sort((a, b) => a.points_required - b.points_required);
}

function getTierLabel(rewards: RewardFromDb[], points: number) {
  const active = getActiveRewards(rewards);
  const achieved = active.filter(t => points >= t.points_required);
  if (achieved.length === 0) return null;
  return achieved[achieved.length - 1];
}

function getNextTierInfo(rewards: RewardFromDb[], points: number) {
  const active = getActiveRewards(rewards);
  const next = active.find(t => points < t.points_required);
  if (!next) return null;
  return { ...next, remaining: next.points_required - points };
}

function getMinPointsForPrize(rewards: RewardFromDb[]) {
  const active = getActiveRewards(rewards);
  return active.length > 0 ? active[0].points_required : Infinity;
}

// ── Modal de Historial de Cliente ──
interface HistoryModalProps {
  customer: LoyaltyCustomer;
  onClose: () => void;
}

function HistoryModal({ customer, onClose }: HistoryModalProps) {
  const [redemptions, setRedemptions] = useState<RedemptionRecord[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todos' | 'canjes' | 'ajustes'>('todos');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const [{ data: redData }, { data: adjData }] = await Promise.all([
      supabase.from('loyalty_redemptions').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }),
      supabase.from('loyalty_point_adjustments').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }),
    ]);
    setRedemptions((redData ?? []) as RedemptionRecord[]);
    setAdjustments((adjData ?? []) as AdjustmentRecord[]);
    setLoading(false);
  }, [customer.id]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const allEvents = [
    ...redemptions.map(r => ({ type: 'canje' as const, date: r.created_at, data: r })),
    ...adjustments.map(a => ({ type: 'ajuste' as const, date: a.created_at, data: a })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filtered = filter === 'todos' ? allEvents : allEvents.filter(e => e.type === filter);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-700 to-amber-500 px-5 pt-5 pb-4 flex items-center gap-3 flex-shrink-0">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
            <i className="ri-history-line text-white text-xl" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-amber-100 text-xs font-semibold uppercase tracking-wide">Historial de movimientos</p>
            <h3 className="text-white font-black text-lg leading-tight truncate">{customer.name}</h3>
            <p className="text-amber-200 text-sm">{customer.loyalty_points} pts actuales</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 cursor-pointer transition-colors flex-shrink-0">
            <i className="ri-close-line text-white text-sm" />
          </button>
        </div>

        {/* Filtros */}
        <div className="px-5 pt-4 pb-2 flex-shrink-0">
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            {([
              { id: 'todos', label: 'Todos', icon: 'ri-list-check' },
              { id: 'canjes', label: 'Canjes', icon: 'ri-gift-line' },
              { id: 'ajustes', label: 'Ajustes', icon: 'ri-equalizer-line' },
            ] as const).map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
                  filter === f.id ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <i className={f.icon} />
                {f.label}
                <span className="bg-white/20 rounded-full px-1.5 text-xs">
                  {f.id === 'todos' ? allEvents.length : f.id === 'canjes' ? redemptions.length : adjustments.length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <i className="ri-file-list-3-line text-3xl text-gray-700 mb-2 block" />
              <p className="text-gray-500 text-sm">Sin movimientos registrados</p>
            </div>
          ) : (
            <div className="space-y-3 mt-2">
              {filtered.map((evt, idx) => (
                <div key={idx} className="bg-gray-800 rounded-xl p-3.5 border border-gray-700/60">
                  {evt.type === 'canje' ? (
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center flex-shrink-0">
                        <span className="text-lg">{(evt.data as RedemptionRecord).tier_emoji}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white text-sm font-bold">Canje: {(evt.data as RedemptionRecord).tier_label}</p>
                          <span className="text-xs font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                            -{(evt.data as RedemptionRecord).points_redeemed} pts
                          </span>
                        </div>
                        <p className="text-gray-500 text-xs mt-1">{(evt.data as RedemptionRecord).items_description}</p>
                        <p className="text-gray-600 text-xs mt-1.5 flex items-center gap-1">
                          <i className="ri-time-line" />
                          {formatDate((evt.data as RedemptionRecord).created_at)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                        (evt.data as AdjustmentRecord).delta >= 0
                          ? 'bg-green-500/10 border-green-500/30'
                          : 'bg-red-500/10 border-red-500/30'
                      }`}>
                        <i className={`text-lg ${(evt.data as AdjustmentRecord).delta >= 0 ? 'ri-add-circle-line text-green-400' : 'ri-indeterminate-circle-line text-red-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white text-sm font-bold">Ajuste manual</p>
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                            (evt.data as AdjustmentRecord).delta >= 0
                              ? 'text-green-400 bg-green-500/10'
                              : 'text-red-400 bg-red-500/10'
                          }`}>
                            {(evt.data as AdjustmentRecord).delta >= 0 ? '+' : ''}{(evt.data as AdjustmentRecord).delta} pts
                          </span>
                        </div>
                        <p className="text-gray-500 text-xs mt-1">{(evt.data as AdjustmentRecord).reason}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-600">
                          <span>Antes: <span className="text-gray-400">{(evt.data as AdjustmentRecord).points_before}</span></span>
                          <span>→</span>
                          <span>Después: <span className="text-gray-400">{(evt.data as AdjustmentRecord).points_after}</span></span>
                        </div>
                        <p className="text-gray-600 text-xs mt-1 flex items-center gap-1">
                          <i className="ri-time-line" />
                          {formatDate((evt.data as AdjustmentRecord).created_at)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal de Canje ──
interface RedeemModalProps {
  customer: LoyaltyCustomer;
  rewards: RewardFromDb[];
  onClose: () => void;
  onRedeemed: (customerId: number, newPoints: number) => void;
}

function RedeemModal({ customer, rewards, onClose, onRedeemed }: RedeemModalProps) {
  const activeRewards = getActiveRewards(rewards);
  const availableTiers = activeRewards.filter(t => customer.loyalty_points >= t.points_required);
  const [selectedTier, setSelectedTier] = useState<RewardFromDb | null>(availableTiers[availableTiers.length - 1] ?? null);
  const [step, setStep] = useState<'select' | 'select_item' | 'confirm' | 'done'>('select');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [accountAdded, setAccountAdded] = useState<{ accountId: number; spot: string; itemsCount: number } | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const handleContinueFromSelect = () => {
    if (!selectedTier) return;
    setError('');
    if (selectedTier.items.length === 1) {
      setSelectedItem(selectedTier.items[0]);
      setStep('confirm');
    } else {
      setSelectedItem(null);
      setStep('select_item');
    }
  };

  const handleSelectItem = (item: string) => {
    setSelectedItem(item);
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (!selectedTier || !selectedItem) return;
    setSaving(true);
    setError('');
    setAccountAdded(null);

    const newPoints = Math.max(customer.loyalty_points - selectedTier.points_required, 0);

    const { error: errUpdate } = await supabase
      .from('pos_customers')
      .update({
        loyalty_points: newPoints,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customer.id);

    if (errUpdate) {
      setSaving(false);
      setError('Error al actualizar los puntos. Intenta de nuevo.');
      return;
    }

    await supabase.from('loyalty_redemptions').insert({
      customer_id: customer.id,
      tier_label: selectedTier.title,
      tier_emoji: selectedTier.emoji ?? '🎁',
      points_redeemed: selectedTier.points_required,
      items_description: selectedItem,
      redeemed_by: 'admin',
      delivered: false,
    });

    // Buscar cuenta abierta del cliente y agregar item del premio
    try {
      const { data: openAccount } = await supabase
        .from('pos_accounts')
        .select('id, spot, folio_counter, area')
        .eq('customer_id', customer.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openAccount) {
        const nextFolio = (openAccount.folio_counter ?? 0) + 1;
        const itemToInsert = {
          account_id: openAccount.id,
          product_name: `🎁 ${selectedItem}`,
          quantity: 1,
          unit_price: 0,
          notes: `Canje Lealtad: ${selectedTier.title}`,
          origin: 'loyalty',
          folio_number: nextFolio,
        };

        await supabase.from('pos_account_items').insert(itemToInsert);

        await supabase
          .from('pos_accounts')
          .update({ folio_counter: nextFolio, updated_at: new Date().toISOString() })
          .eq('id', openAccount.id);

        setAccountAdded({
          accountId: openAccount.id,
          spot: openAccount.spot,
          itemsCount: 1,
        });
      }
    } catch (accErr) {
      // eslint-disable-next-line no-console
      console.warn('[Redeem] Error agregando item a cuenta:', accErr);
    }

    setSaving(false);
    onRedeemed(customer.id, newPoints);
    setStep('done');
  };

  const tierStyle = (tier: RewardFromDb) => ({
    border: tier.border_color ?? 'border-amber-500',
    bg: tier.bg_color ?? 'bg-amber-900/30',
    color: tier.text_color ?? 'text-amber-400',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={step !== 'done' ? onClose : undefined} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-700 to-amber-500 px-5 pt-5 pb-4 flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
            <i className="ri-gift-2-fill text-white text-xl" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-amber-100 text-xs font-semibold uppercase tracking-wide">Canjear premio</p>
            <h3 className="text-white font-black text-lg leading-tight">{customer.name}</h3>
            <p className="text-amber-200 text-sm">{customer.loyalty_points} puntos disponibles</p>
          </div>
          {step !== 'done' && (
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 cursor-pointer transition-colors flex-shrink-0"
            >
              <i className="ri-close-line text-white text-sm" />
            </button>
          )}
        </div>

        <div className="p-5">
          {/* ── STEP: SELECCIONAR ── */}
          {step === 'select' && (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">Selecciona el premio a canjear:</p>
              <div className="space-y-2">
                {activeRewards.map(tier => {
                  const available = customer.loyalty_points >= tier.points_required;
                  const isSelected = selectedTier?.id === tier.id;
                  const s = tierStyle(tier);
                  return (
                    <button
                      key={tier.id}
                      disabled={!available}
                      onClick={() => available && setSelectedTier(tier)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        !available
                          ? 'border-gray-800 bg-gray-800/40 opacity-40 cursor-not-allowed'
                          : isSelected
                          ? `${s.border} ${s.bg}`
                          : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl flex-shrink-0 mt-0.5">{tier.emoji ?? '🎁'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-black text-sm ${available ? 'text-white' : 'text-gray-600'}`}>{tier.title}</p>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              available
                                ? `${s.color} bg-gray-800 border ${s.border}`
                                : 'text-gray-600 bg-gray-800 border-gray-700'
                            }`}>
                              {tier.points_required} pts
                            </span>
                            {!available && (
                              <span className="text-xs text-gray-600">
                                Faltan {tier.points_required - customer.loyalty_points} pts
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 space-y-0.5">
                            {tier.items.length > 1 && (
                              <p className="text-gray-500 text-xs mb-1">Elige 1 de {tier.items.length} opciones:</p>
                            )}
                            {tier.items.map((item, i) => (
                              <p key={i} className={`text-xs flex items-center gap-1.5 ${available ? 'text-gray-400' : 'text-gray-700'}`}>
                                <i className={`ri-checkbox-circle-fill text-xs flex-shrink-0 ${available ? s.color : 'text-gray-700'}`} />
                                {item}
                              </p>
                            ))}
                          </div>
                          {available && (
                            <p className={`text-xs mt-2 font-bold ${s.color}`}>
                              Quedarán {customer.loyalty_points - tier.points_required} pts después del canje
                            </p>
                          )}
                        </div>
                        {isSelected && available && (
                          <i className={`ri-checkbox-circle-fill text-xl flex-shrink-0 ${s.color}`} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {error && (
                <p className="text-red-400 text-sm flex items-center gap-1.5">
                  <i className="ri-error-warning-line" />{error}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 border border-gray-700 rounded-xl text-gray-400 text-sm font-medium cursor-pointer hover:bg-gray-800 transition-colors whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleContinueFromSelect}
                  disabled={!selectedTier}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl text-sm font-black cursor-pointer transition-colors whitespace-nowrap"
                >
                  <i className="ri-arrow-right-line mr-1" />
                  Continuar
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: ELEGIR ITEM ── */}
          {step === 'select_item' && selectedTier && (
            <div className="space-y-4">
              {(() => {
                const s = tierStyle(selectedTier);
                return (
                  <div className={`rounded-xl border ${s.border} ${s.bg} p-3 text-center`}>
                    <p className="text-2xl mb-1">{selectedTier.emoji ?? '🎁'}</p>
                    <p className={`font-black text-sm ${s.color}`}>{selectedTier.title}</p>
                    <p className="text-gray-400 text-xs mt-1">Elige 1 de {selectedTier.items.length} opciones</p>
                  </div>
                );
              })()}

              <p className="text-gray-400 text-sm">Selecciona qué item se entregará:</p>
              <div className="space-y-2">
                {selectedTier.items.map((item) => {
                  const isPicked = selectedItem === item;
                  return (
                    <button
                      key={item}
                      onClick={() => handleSelectItem(item)}
                      className={`w-full text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                        isPicked
                          ? 'border-amber-500 bg-amber-900/30'
                          : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isPicked ? 'bg-amber-500' : 'bg-gray-700'
                        }`}>
                          {isPicked ? (
                            <i className="ri-check-line text-white text-sm" />
                          ) : (
                            <i className="ri-gift-line text-gray-400 text-sm" />
                          )}
                        </div>
                        <span className={`text-sm font-semibold flex-1 ${isPicked ? 'text-white' : 'text-gray-300'}`}>
                          {item}
                        </span>
                        {isPicked && (
                          <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                            Seleccionado
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setStep(selectedTier && selectedTier.items.length > 1 ? 'select_item' : 'select'); setError(''); }}
                  className="flex-1 py-3 border border-gray-700 rounded-xl text-gray-400 text-sm font-medium cursor-pointer hover:bg-gray-800 transition-colors whitespace-nowrap"
                >
                  <i className="ri-arrow-left-line mr-1" />
                  Atrás
                </button>
                <button
                  onClick={() => {
                    if (!selectedItem) { setError('Selecciona qué item se entregará'); return; }
                    setError('');
                    setStep('confirm');
                  }}
                  disabled={!selectedItem}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl text-sm font-black cursor-pointer transition-colors whitespace-nowrap"
                >
                  <i className="ri-arrow-right-line mr-1" />
                  Continuar
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: CONFIRMAR ── */}
          {step === 'confirm' && selectedTier && selectedItem && (
            <div className="space-y-4">
              {(() => {
                const s = tierStyle(selectedTier);
                return (
                  <div className={`rounded-xl border ${s.border} ${s.bg} p-4 text-center`}>
                    <p className="text-4xl mb-2">{selectedTier.emoji ?? '🎁'}</p>
                    <p className={`font-black text-lg ${s.color}`}>{selectedTier.title}</p>
                    <p className="text-white text-sm font-semibold mt-2">• {selectedItem}</p>
                  </div>
                );
              })()}

              <div className="bg-gray-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Cliente</span>
                  <span className="text-white font-bold">{customer.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Puntos actuales</span>
                  <span className="text-amber-400 font-bold">{customer.loyalty_points} pts</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Se descontarán</span>
                  <span className="text-red-400 font-bold">− {selectedTier.points_required} pts</span>
                </div>
                <div className="border-t border-gray-700 pt-2 flex items-center justify-between text-sm">
                  <span className="text-gray-300 font-bold">Saldo después del canje</span>
                  <span className="text-green-400 font-black text-base">
                    {Math.max(customer.loyalty_points - selectedTier.points_required, 0)} pts
                  </span>
                </div>
              </div>

              <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl px-4 py-3 flex items-start gap-2">
                <i className="ri-information-line text-amber-400 text-base flex-shrink-0 mt-0.5" />
                <p className="text-amber-300 text-xs leading-snug">
                  Confirma solo después de haber entregado el premio físicamente al cliente. Esta acción no se puede deshacer.
                </p>
              </div>

              {error && (
                <p className="text-red-400 text-sm flex items-center gap-1.5">
                  <i className="ri-error-warning-line" />{error}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep(selectedTier && selectedTier.items.length > 1 ? 'select_item' : 'select'); setError(''); }}
                  className="flex-1 py-3 border border-gray-700 rounded-xl text-gray-400 text-sm font-medium cursor-pointer hover:bg-gray-800 transition-colors whitespace-nowrap"
                >
                  <i className="ri-arrow-left-line mr-1" />
                  Atrás
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-xl text-sm font-black cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <><i className="ri-loader-4-line animate-spin" />Guardando...</>
                  ) : (
                    <><i className="ri-check-double-line" />Premio entregado</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: LISTO ── */}
          {step === 'done' && selectedTier && (
            <div className="text-center space-y-4 py-2">
              <div className="w-20 h-20 bg-green-500/20 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto">
                <i className="ri-checkbox-circle-fill text-green-400 text-4xl" />
              </div>
              <div>
                <h4 className="text-white font-black text-xl">¡Canje registrado!</h4>
                <p className="text-gray-400 text-sm mt-1">
                  Se descontaron <span className="text-red-400 font-bold">{selectedTier.points_required} puntos</span> de {customer.name}
                </p>
              </div>
              {(() => {
                const s = tierStyle(selectedTier);
                return (
                  <div className={`rounded-xl border ${s.border} ${s.bg} px-4 py-3`}>
                    <p className={`font-black text-sm ${s.color}`}>
                      {selectedTier.emoji ?? '🎁'} {selectedTier.title}
                    </p>
                    <p className="text-white text-xs font-semibold mt-1">• {selectedItem}</p>
                    <p className="text-gray-300 text-xs mt-1">
                      Nuevo saldo: <span className="text-amber-400 font-bold">
                        {Math.max(customer.loyalty_points - selectedTier.points_required, 0)} pts
                      </span>
                    </p>
                  </div>
                );
              })()}

              {/* Info cuenta abierta */}
              {accountAdded ? (
                <div className="bg-green-900/20 border border-green-500/40 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 justify-center mb-1">
                    <i className="ri-receipt-line text-green-400 text-sm" />
                    <p className="text-green-300 text-sm font-bold">Premio agregado a cuenta</p>
                  </div>
                  <p className="text-gray-400 text-xs">
                    Mesa/spot: <span className="text-white font-bold">{accountAdded.spot}</span> ·{' '}
                    {accountAdded.itemsCount} item{accountAdded.itemsCount !== 1 ? 's' : ''} a $0
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    Ya aparece en la cuenta del POS para preparación y entrega
                  </p>
                </div>
              ) : (
                <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 justify-center mb-1">
                    <i className="ri-information-line text-amber-400 text-sm" />
                    <p className="text-amber-300 text-sm font-bold">Sin cuenta abierta</p>
                  </div>
                  <p className="text-gray-400 text-xs">
                    El cliente no tiene una cuenta abierta actualmente. El canje quedó registrado en lealtad.
                  </p>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-sm cursor-pointer transition-colors whitespace-nowrap"
              >
                Listo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal de Ajuste Manual ──
interface AdjustModalProps {
  customer: LoyaltyCustomer;
  onClose: () => void;
  onAdjusted: (customerId: number, newPoints: number) => void;
}

const ADJUST_REASONS = [
  'Corrección de error del sistema',
  'Promoción especial',
  'Compensación por mala experiencia',
  'Puntos de bienvenida',
  'Ajuste por cumpleaños',
  'Error al cerrar cuenta',
  'Otro motivo',
];

function AdjustModal({ customer, onClose, onAdjusted }: AdjustModalProps) {
  const [mode, setMode] = useState<'add' | 'subtract'>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [step, setStep] = useState<'form' | 'confirm' | 'done'>('form');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const pts = parseInt(amount || '0', 10);
  const isOtherReason = reason === 'Otro motivo';
  const finalReason = isOtherReason ? customReason.trim() : reason;
  const delta = mode === 'add' ? pts : -pts;
  const newPoints = Math.max(customer.loyalty_points + delta, 0);
  const realDelta = newPoints - customer.loyalty_points;

  const handleNext = () => {
    setError('');
    if (!amount || pts <= 0) { setError('Ingresa una cantidad válida mayor a 0'); return; }
    if (!finalReason) { setError('Selecciona o escribe el motivo del ajuste'); return; }
    setStep('confirm');
  };

  const handleConfirm = async () => {
    setSaving(true);
    setError('');

    const { error: errUpdate } = await supabase
      .from('pos_customers')
      .update({ loyalty_points: newPoints, updated_at: new Date().toISOString() })
      .eq('id', customer.id);

    if (errUpdate) {
      setSaving(false);
      setError('Error al guardar. Intenta de nuevo.');
      return;
    }

    await supabase.from('loyalty_point_adjustments').insert({
      customer_id: customer.id,
      delta: realDelta,
      points_before: customer.loyalty_points,
      points_after: newPoints,
      reason: finalReason,
      adjusted_by: 'admin',
    });

    setSaving(false);
    onAdjusted(customer.id, newPoints);
    setStep('done');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={step !== 'done' ? onClose : undefined} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-700 to-gray-600 px-5 pt-5 pb-4 flex items-center gap-3">
          <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center flex-shrink-0">
            <i className="ri-equalizer-2-line text-white text-xl" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-gray-300 text-xs font-semibold uppercase tracking-wide">Ajuste manual de puntos</p>
            <h3 className="text-white font-black text-lg leading-tight">{customer.name}</h3>
            <p className="text-gray-400 text-sm">{customer.loyalty_points} puntos actuales</p>
          </div>
          {step !== 'done' && (
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 cursor-pointer transition-colors flex-shrink-0">
              <i className="ri-close-line text-white text-sm" />
            </button>
          )}
        </div>

        <div className="p-5">
          {/* ── FORM ── */}
          {step === 'form' && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Tipo de ajuste</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMode('add')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-black cursor-pointer transition-all ${
                      mode === 'add'
                        ? 'border-green-500 bg-green-500/15 text-green-400'
                        : 'border-gray-700 bg-gray-800 text-gray-500 hover:border-gray-600'
                    }`}
                  >
                    <i className="ri-add-circle-fill text-lg" />
                    Agregar puntos
                  </button>
                  <button
                    onClick={() => setMode('subtract')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-black cursor-pointer transition-all ${
                      mode === 'subtract'
                        ? 'border-red-500 bg-red-500/15 text-red-400'
                        : 'border-gray-700 bg-gray-800 text-gray-500 hover:border-gray-600'
                    }`}
                  >
                    <i className="ri-indeterminate-circle-fill text-lg" />
                    Quitar puntos
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Cantidad de puntos</p>
                <div className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 ${
                  mode === 'add' ? 'border-green-600/50 bg-green-900/10' : 'border-red-600/50 bg-red-900/10'
                }`}>
                  <span className={`text-2xl font-black flex-shrink-0 ${
                    mode === 'add' ? 'text-green-400' : 'text-red-400'
                  }`}>{mode === 'add' ? '+' : '−'}</span>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={amount}
                    onChange={e => { setAmount(e.target.value); setError(''); }}
                    placeholder="0"
                    className="flex-1 bg-transparent text-white text-3xl font-black focus:outline-none w-full min-w-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    autoFocus
                  />
                  <span className="text-gray-500 text-sm flex-shrink-0">pts</span>
                </div>
                {pts > 0 && (
                  <p className={`text-xs font-bold mt-1.5 ${
                    mode === 'add' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {mode === 'add' ? '+' : '−'}{pts} pts → nuevo saldo:{' '}
                    <span className="text-amber-400">{newPoints} pts</span>
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Motivo <span className="text-red-500">*</span></p>
                <div className="space-y-1.5">
                  {ADJUST_REASONS.map(r => (
                    <button
                      key={r}
                      onClick={() => { setReason(r); setError(''); }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all ${
                        reason === r
                          ? 'bg-gray-600 border border-gray-500 text-white font-semibold'
                          : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <i className={`text-sm flex-shrink-0 ${
                          reason === r ? 'ri-checkbox-circle-fill text-amber-400' : 'ri-circle-line text-gray-600'
                        }`} />
                        {r}
                      </div>
                    </button>
                  ))}
                </div>
                {isOtherReason && (
                  <input
                    type="text"
                    value={customReason}
                    onChange={e => { setCustomReason(e.target.value); setError(''); }}
                    placeholder="Describe el motivo..."
                    className="mt-2 w-full px-3 py-2.5 bg-gray-800 border border-gray-600 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 placeholder:text-gray-600"
                    autoFocus
                  />
                )}
              </div>

              {error && (
                <p className="text-red-400 text-sm flex items-center gap-1.5">
                  <i className="ri-error-warning-line" />{error}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="flex-1 py-3 border border-gray-700 rounded-xl text-gray-400 text-sm font-medium cursor-pointer hover:bg-gray-800 transition-colors whitespace-nowrap">
                  Cancelar
                </button>
                <button
                  onClick={handleNext}
                  className={`flex-1 py-3 text-white rounded-xl text-sm font-black cursor-pointer transition-colors whitespace-nowrap ${
                    mode === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  <i className="ri-arrow-right-line mr-1" />
                  Revisar ajuste
                </button>
              </div>
            </div>
          )}

          {/* ── CONFIRM ── */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div className={`rounded-xl border-2 p-4 ${
                mode === 'add' ? 'border-green-600 bg-green-900/20' : 'border-red-600 bg-red-900/20'
              }`}>
                <p className="text-gray-300 text-xs uppercase tracking-wide font-bold mb-3">Resumen del ajuste</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Cliente</span>
                    <span className="text-white font-bold">{customer.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Puntos antes</span>
                    <span className="text-amber-400 font-bold">{customer.loyalty_points} pts</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Ajuste</span>
                    <span className={`font-black text-base ${mode === 'add' ? 'text-green-400' : 'text-red-400'}`}>
                      {mode === 'add' ? '+' : ''}{realDelta} pts
                    </span>
                  </div>
                  <div className="border-t border-gray-700 pt-2 flex justify-between text-sm">
                    <span className="text-gray-300 font-bold">Puntos después</span>
                    <span className="text-amber-400 font-black text-lg">{newPoints} pts</span>
                  </div>
                  <div className="border-t border-gray-700 pt-2 flex justify-between text-sm">
                    <span className="text-gray-400">Motivo</span>
                    <span className="text-gray-300 font-semibold text-right max-w-48 leading-snug">{finalReason}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-xl px-4 py-3 flex items-start gap-2">
                <i className="ri-information-line text-gray-400 text-base flex-shrink-0 mt-0.5" />
                <p className="text-gray-400 text-xs leading-snug">
                  Este ajuste quedará registrado en el historial del cliente con fecha, hora y motivo.
                </p>
              </div>

              {error && (
                <p className="text-red-400 text-sm flex items-center gap-1.5">
                  <i className="ri-error-warning-line" />{error}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep('form'); setError(''); }}
                  className="flex-1 py-3 border border-gray-700 rounded-xl text-gray-400 text-sm font-medium cursor-pointer hover:bg-gray-800 transition-colors whitespace-nowrap"
                >
                  <i className="ri-arrow-left-line mr-1" />Atrás
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  className={`flex-1 py-3 text-white rounded-xl text-sm font-black cursor-pointer transition-colors whitespace-nowrap disabled:opacity-60 flex items-center justify-center gap-2 ${
                    mode === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {saving ? (
                    <><i className="ri-loader-4-line animate-spin" />Guardando...</>
                  ) : (
                    <><i className="ri-check-double-line" />Confirmar ajuste</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── DONE ── */}
          {step === 'done' && (
            <div className="text-center space-y-4 py-2">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto border-2 ${
                mode === 'add' ? 'bg-green-500/20 border-green-500' : 'bg-red-500/20 border-red-500'
              }`}>
                <i className={`text-4xl ${
                  mode === 'add' ? 'ri-checkbox-circle-fill text-green-400' : 'ri-indeterminate-circle-fill text-red-400'
                }`} />
              </div>
              <div>
                <h4 className="text-white font-black text-xl">¡Ajuste aplicado!</h4>
                <p className="text-gray-400 text-sm mt-1">
                  {customer.name} ahora tiene{' '}
                  <span className="text-amber-400 font-black">{newPoints} puntos</span>
                </p>
              </div>
              <div className="bg-gray-800 rounded-xl px-4 py-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Antes</span>
                  <span className="text-gray-300">{customer.loyalty_points} pts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ajuste</span>
                  <span className={mode === 'add' ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                    {mode === 'add' ? '+' : ''}{realDelta} pts
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-700 pt-1">
                  <span className="text-gray-300 font-bold">Ahora</span>
                  <span className="text-amber-400 font-black">{newPoints} pts</span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-sm cursor-pointer transition-colors whitespace-nowrap"
              >
                Listo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal de Editar Celular ──
interface EditPhoneModalProps {
  customer: LoyaltyCustomer;
  onClose: () => void;
  onSaved: (customerId: number, newPhone: string) => void;
}

function EditPhoneModal({ customer, onClose, onSaved }: EditPhoneModalProps) {
  const [phone, setPhone] = useState(customer.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const clean = phone.trim();
    if (!clean) {
      setError('Ingresa un número de celular');
      return;
    }
    if (!/^\+?\d{10,15}$/.test(clean.replace(/\s/g, ''))) {
      setError('Número inválido. Debe tener entre 10 y 15 dígitos.');
      return;
    }
    setSaving(true);
    setError('');
    const { error: err } = await supabase
      .from('pos_customers')
      .update({ phone: clean, updated_at: new Date().toISOString() })
      .eq('id', customer.id);
    setSaving(false);
    if (err) {
      setError('Error al guardar. Intenta de nuevo.');
      return;
    }
    onSaved(customer.id, clean);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-5 pt-5 pb-4 flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
            <i className="ri-smartphone-line text-white text-xl" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-blue-100 text-xs font-semibold uppercase tracking-wide">Editar número</p>
            <h3 className="text-white font-black text-lg leading-tight truncate">{customer.name}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 cursor-pointer transition-colors flex-shrink-0">
            <i className="ri-close-line text-white text-sm" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Número de celular</p>
            <input
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setError(''); }}
              placeholder="Ej. 6641234567"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white text-lg font-bold focus:outline-none focus:border-blue-500 placeholder:text-gray-600"
              autoFocus
            />
            <p className="text-xs text-gray-600 mt-1.5">Usa formato con o sin +52, sin espacios o con espacios.</p>
          </div>

          {error && (
            <p className="text-red-400 text-sm flex items-center gap-1.5">
              <i className="ri-error-warning-line" />{error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 border border-gray-700 rounded-xl text-gray-400 text-sm font-medium cursor-pointer hover:bg-gray-800 transition-colors whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-sm font-black cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-2"
            >
              {saving ? (
                <><i className="ri-loader-4-line animate-spin" />Guardando...</>
              ) : (
                <><i className="ri-check-double-line" />Guardar</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal de Dar de Baja de Lealtad ──
interface DeactivateModalProps {
  customer: LoyaltyCustomer;
  onClose: () => void;
  onDeactivated: (customerId: number) => void;
}

function DeactivateModal({ customer, onClose, onDeactivated }: DeactivateModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const expected = 'BAJA';
  const canConfirm = confirmText.trim().toUpperCase() === expected;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSaving(true);
    setError('');
    const { error: err } = await supabase
      .from('pos_customers')
      .update({
        loyalty_points: 0,
        notes: `BAJA_LEALTAD:${new Date().toISOString()}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customer.id);
    setSaving(false);
    if (err) {
      setError('Error al dar de baja. Intenta de nuevo.');
      return;
    }
    onDeactivated(customer.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-red-700/40 rounded-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-red-800 to-red-600 px-5 pt-5 pb-4 flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
            <i className="ri-user-unfollow-line text-white text-xl" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-red-100 text-xs font-semibold uppercase tracking-wide">Dar de baja de lealtad</p>
            <h3 className="text-white font-black text-lg leading-tight truncate">{customer.name}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 cursor-pointer transition-colors flex-shrink-0">
            <i className="ri-close-line text-white text-sm" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-red-900/20 border border-red-700/50 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <i className="ri-error-warning-line text-red-400 text-base flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 text-sm font-bold">Esto quitará todos los puntos</p>
              <p className="text-red-400/70 text-xs mt-0.5 leading-snug">
                {customer.name} perderá sus {customer.loyalty_points} puntos acumulados y será marcado como dado de baja del programa de lealtad. Esta acción no se puede deshacer desde aquí.
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">
              Escribe <span className="text-red-400 font-black">{expected}</span> para confirmar
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={e => { setConfirmText(e.target.value); setError(''); }}
              placeholder={expected}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white text-lg font-bold focus:outline-none focus:border-red-500 placeholder:text-gray-700 uppercase"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm flex items-center gap-1.5">
              <i className="ri-error-warning-line" />{error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 border border-gray-700 rounded-xl text-gray-400 text-sm font-medium cursor-pointer hover:bg-gray-800 transition-colors whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm || saving}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-black cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-2"
            >
              {saving ? (
                <><i className="ri-loader-4-line animate-spin" />Procesando...</>
              ) : (
                <><i className="ri-user-unfollow-line" />Dar de baja</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──
type SortKey = 'puntos' | 'visitas' | 'gastado';

export default function LoyaltyRankingView() {
  const [customers, setCustomers] = useState<LoyaltyCustomer[]>([]);
  const [rewards, setRewards] = useState<RewardFromDb[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>('puntos');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'todos' | 'con_premios' | 'de_baja'>('todos');
  const [redeemingCustomer, setRedeemingCustomer] = useState<LoyaltyCustomer | null>(null);
  const [adjustingCustomer, setAdjustingCustomer] = useState<LoyaltyCustomer | null>(null);
  const [historyCustomer, setHistoryCustomer] = useState<LoyaltyCustomer | null>(null);
  const [editingPhoneCustomer, setEditingPhoneCustomer] = useState<LoyaltyCustomer | null>(null);
  const [deactivatingCustomer, setDeactivatingCustomer] = useState<LoyaltyCustomer | null>(null);

  const fetchCustomers = useCallback(async () => {
    const { data } = await supabase
      .from('pos_customers')
      .select('*')
      .order('loyalty_points', { ascending: false });
    setCustomers((data ?? []) as LoyaltyCustomer[]);
    setLoading(false);
  }, []);

  const fetchRewards = useCallback(async () => {
    const { data } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('is_active', true)
      .order('tier_order', { ascending: true });
    setRewards((data ?? []) as RewardFromDb[]);
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      await fetchRewards();
      if (mounted) await fetchCustomers();
    };
    load();
    return () => { mounted = false; };
  }, [fetchCustomers, fetchRewards]);

  useEffect(() => {
    // Realtime
    const channel = supabase
      .channel('loyalty-ranking-customers')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pos_customers' },
        () => { fetchCustomers(); },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'loyalty_point_adjustments' },
        () => { fetchCustomers(); },
      )
      .subscribe();

    // Polling fallback cada 10 segundos
    const interval = setInterval(() => {
      fetchCustomers();
      fetchRewards();
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchCustomers, fetchRewards]);

  const handleRedeemed = (customerId: number, newPoints: number) => {
    setCustomers(prev =>
      prev.map(c => c.id === customerId ? { ...c, loyalty_points: newPoints } : c)
    );
  };

  const handleAdjusted = (customerId: number, newPoints: number) => {
    setCustomers(prev =>
      prev.map(c => c.id === customerId ? { ...c, loyalty_points: newPoints } : c)
    );
    setAdjustingCustomer(null);
  };

  const handlePhoneSaved = (customerId: number, newPhone: string) => {
    setCustomers(prev =>
      prev.map(c => c.id === customerId ? { ...c, phone: newPhone } : c)
    );
  };

  const handleDeactivated = (customerId: number) => {
    setCustomers(prev =>
      prev.map(c =>
        c.id === customerId
          ? { ...c, loyalty_points: 0, notes: `BAJA_LEALTAD:${new Date().toISOString()}` }
          : c
      )
    );
  };

  const isDeactivated = (c: LoyaltyCustomer) =>
    (c.notes ?? '').includes('BAJA_LEALTAD');

  const minPrizePoints = getMinPointsForPrize(rewards);

  const sorted = [...customers]
    .filter(c => {
      const deactivated = isDeactivated(c);
      const matchSearch =
        !search.trim() ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone ?? '').includes(search);
      const matchFilter =
        filter === 'todos' ? !deactivated :
        filter === 'con_premios' ? (!deactivated && c.loyalty_points >= minPrizePoints) :
        filter === 'de_baja' ? deactivated :
        true;
      return matchSearch && matchFilter;
    })
    .sort((a, b) => {
      if (sortBy === 'puntos') return b.loyalty_points - a.loyalty_points;
      if (sortBy === 'visitas') return b.visit_count - a.visit_count;
      if (sortBy === 'gastado') return b.total_spent - a.total_spent;
      return 0;
    });

  const totalPts = customers.reduce((s, c) => s + c.loyalty_points, 0);
  const withPremios = customers.filter(c => c.loyalty_points >= minPrizePoints && !isDeactivated(c)).length;
  const deactivatedCount = customers.filter(c => isDeactivated(c)).length;
  const activeCount = customers.filter(c => !isDeactivated(c)).length;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const activeToday = customers.filter(c => !isDeactivated(c) && c.last_visit && new Date(c.last_visit) >= todayStart).length;

  const isBirthday = (birthday?: string) => {
    if (!birthday) return false;
    const b = new Date(birthday);
    const now = new Date();
    return b.getMonth() === now.getMonth() && b.getDate() === now.getDate();
  };

  const isBirthdayMonth = (birthday?: string) => {
    if (!birthday) return false;
    return new Date(birthday).getMonth() === new Date().getMonth();
  };

  return (
    <div className="space-y-5">
      {/* Stats resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { icon: 'ri-group-line', label: 'Clientes activos', value: activeCount, color: 'text-amber-400' },
          { icon: 'ri-vip-crown-2-fill', label: 'Con premios disponibles', value: withPremios, color: 'text-yellow-400' },
          { icon: 'ri-coin-line', label: 'Puntos totales emitidos', value: totalPts, color: 'text-green-400' },
          { icon: 'ri-walk-line', label: 'Clientes activos hoy', value: activeToday, color: 'text-orange-400' },
          { icon: 'ri-user-unfollow-line', label: 'Dados de baja', value: deactivatedCount, color: 'text-red-400' },
        ].map((s, i) => (
          <div key={i} className="bg-gray-900 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <i className={`${s.icon} ${s.color} text-sm`} />
              <p className="text-gray-500 text-xs">{s.label}</p>
            </div>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros + search */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-40">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o cel..."
            className="w-full pl-8 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500 placeholder:text-gray-600"
          />
        </div>

        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
          {([
            { id: 'todos', label: 'Todos' },
            { id: 'con_premios', label: '🏆 Con premios' },
            { id: 'de_baja', label: '🚫 Dados de baja' },
          ] as const).map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as typeof filter)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
                filter === f.id ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
          {[
            { id: 'puntos', label: 'Puntos' },
            { id: 'visitas', label: 'Visitas' },
            { id: 'gastado', label: 'Gastado' },
          ].map(s => (
            <button
              key={s.id}
              onClick={() => setSortBy(s.id as SortKey)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
                sortBy === s.id ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => { fetchCustomers(); fetchRewards(); }}
          className="w-9 h-9 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
        >
          <i className="ri-refresh-line text-gray-400 text-sm" />
        </button>
      </div>

      {/* Tabla */}
      {loading && customers.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-14 bg-gray-900 rounded-xl">
          <i className="ri-user-search-line text-4xl text-gray-700 mb-3 block" />
          <p className="text-gray-500 text-sm">No se encontraron clientes con ese filtro</p>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl overflow-hidden">
          {/* Header tabla */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wide font-bold">
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-4">Cliente</div>
            <div className="col-span-2 text-center">Puntos</div>
            <div className="col-span-1 text-center">Visitas</div>
            <div className="col-span-2 text-right">Gastado</div>
            <div className="col-span-2 text-right">Acciones</div>
          </div>

          <div className="divide-y divide-gray-800">
            {sorted.map((cust, idx) => {
              const tier = getTierLabel(rewards, cust.loyalty_points);
              const nextTier = getNextTierInfo(rewards, cust.loyalty_points);
              const birthdayToday = isBirthday(cust.birthday);
              const birthdayThisMonth = isBirthdayMonth(cust.birthday);
              const topThree = idx < 3;
              const medals = ['🥇', '🥈', '🥉'];
              const isActiveToday = cust.last_visit && new Date(cust.last_visit) >= todayStart;
              const hasPrize = cust.loyalty_points >= minPrizePoints;

              return (
                <div
                  key={cust.id}
                  className={`grid grid-cols-12 gap-2 px-4 py-3 items-center transition-colors ${
                    isDeactivated(cust)
                      ? 'bg-red-900/5 hover:bg-red-900/10'
                      : hasPrize
                      ? 'bg-amber-900/10 hover:bg-amber-900/20'
                      : topThree
                      ? 'bg-gray-800/20 hover:bg-gray-800/40'
                      : 'hover:bg-gray-800/50'
                  }`}
                >
                  {/* Rank */}
                  <div className="col-span-1 text-center">
                    {topThree ? (
                      <span className="text-lg">{medals[idx]}</span>
                    ) : (
                      <span className="text-gray-600 text-sm font-bold">{idx + 1}</span>
                    )}
                  </div>

                  {/* Cliente */}
                  <div className="col-span-4 flex items-center gap-2 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white font-black text-base ${
                      isDeactivated(cust) ? 'bg-red-600' :
                      hasPrize ? 'bg-amber-500' : isActiveToday ? 'bg-green-600' : 'bg-gray-700'
                    }`}>
                      {cust.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className={`text-sm font-bold truncate ${isDeactivated(cust) ? 'text-red-300' : 'text-white'}`}>{cust.name}</p>
                        {isDeactivated(cust) && <span className="text-xs font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">Baja</span>}
                        {birthdayToday && <span className="text-base leading-none">🎂</span>}
                        {birthdayThisMonth && !birthdayToday && <span className="text-sm leading-none">🎁</span>}
                        {isActiveToday && !isDeactivated(cust) && <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{cust.phone ?? '—'}</p>
                      {isDeactivated(cust) ? (
                        <span className="text-xs text-red-400/70">Dado de baja del programa</span>
                      ) : tier ? (
                        <span className={`text-xs font-bold`} style={{ color: tier.text_color ?? '#fbbf24' }}>
                          {tier.emoji ?? '🎁'} {tier.title}
                        </span>
                      ) : nextTier ? (
                        <span className="text-xs text-gray-600">
                          Falta {nextTier.remaining} pts para {nextTier.emoji ?? '🎁'}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Puntos */}
                  <div className="col-span-2 text-center">
                    <p className={`text-base font-black ${hasPrize ? 'text-amber-400' : 'text-gray-300'}`}>
                      {cust.loyalty_points}
                    </p>
                    {nextTier && (
                      <div className="mt-1 w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mx-auto max-w-16">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all"
                          style={{ width: `${Math.min((cust.loyalty_points / nextTier.points_required) * 100, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Visitas */}
                  <div className="col-span-1 text-center">
                    <p className="text-sm font-bold text-gray-300">{cust.visit_count}</p>
                  </div>

                  {/* Gastado */}
                  <div className="col-span-2 text-right">
                    <p className="text-sm font-bold text-green-400">${Math.round(cust.total_spent)}</p>
                  </div>

                  {/* Acciones */}
                  <div className="col-span-2 flex flex-col items-end gap-1">
                    {isDeactivated(cust) ? (
                      <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap">
                        <i className="ri-user-unfollow-line" />
                        Dado de baja
                      </span>
                    ) : (
                      <>
                        {hasPrize && (
                          <button
                            onClick={() => setRedeemingCustomer(cust)}
                            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-white text-xs font-black px-3 py-1.5 rounded-lg cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                          >
                            <i className="ri-gift-2-fill text-sm" />
                            Canjear
                          </button>
                        )}
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                          <button
                            onClick={() => setEditingPhoneCustomer(cust)}
                            className="flex items-center gap-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-600/30 text-xs font-semibold px-2 py-1.5 rounded-lg cursor-pointer transition-all whitespace-nowrap"
                            title="Editar celular"
                          >
                            <i className="ri-smartphone-line text-xs" />
                            Cel
                          </button>
                          <button
                            onClick={() => setHistoryCustomer(cust)}
                            className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-semibold px-2 py-1.5 rounded-lg cursor-pointer transition-all whitespace-nowrap"
                          >
                            <i className="ri-history-line text-xs" />
                            Historial
                          </button>
                          <button
                            onClick={() => setAdjustingCustomer(cust)}
                            className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-semibold px-2 py-1.5 rounded-lg cursor-pointer transition-all whitespace-nowrap"
                          >
                            <i className="ri-equalizer-2-line text-xs" />
                            Ajustar
                          </button>
                          <button
                            onClick={() => setDeactivatingCustomer(cust)}
                            className="flex items-center gap-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/30 text-xs font-semibold px-2 py-1.5 rounded-lg cursor-pointer transition-all whitespace-nowrap"
                            title="Dar de baja de lealtad"
                          >
                            <i className="ri-user-unfollow-line text-xs" />
                            Baja
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400" />Activo hoy
        </span>
        <span>🎂 Cumpleaños hoy</span>
        <span>🎁 Mes de cumpleaños</span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500" />Premio disponible
        </span>
      </div>

      {/* Modal de canje */}
      {redeemingCustomer && (
        <RedeemModal
          customer={redeemingCustomer}
          rewards={rewards}
          onClose={() => setRedeemingCustomer(null)}
          onRedeemed={handleRedeemed}
        />
      )}

      {/* Modal de ajuste manual */}
      {adjustingCustomer && (
        <AdjustModal
          customer={adjustingCustomer}
          onClose={() => setAdjustingCustomer(null)}
          onAdjusted={handleAdjusted}
        />
      )}

      {/* Modal de historial */}
      {historyCustomer && (
        <HistoryModal
          customer={historyCustomer}
          onClose={() => setHistoryCustomer(null)}
        />
      )}

      {/* Modal de editar celular */}
      {editingPhoneCustomer && (
        <EditPhoneModal
          customer={editingPhoneCustomer}
          onClose={() => setEditingPhoneCustomer(null)}
          onSaved={handlePhoneSaved}
        />
      )}

      {/* Modal de dar de baja */}
      {deactivatingCustomer && (
        <DeactivateModal
          customer={deactivatingCustomer}
          onClose={() => setDeactivatingCustomer(null)}
          onDeactivated={handleDeactivated}
        />
      )}
    </div>
  );
}