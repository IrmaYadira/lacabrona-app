import { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { supabasePos } from "@/pages/pos/supabasePos";
import { useLoyaltyCustomer, saveLoyaltyCustomerToStorage, type LoyaltyCustomer } from "@/hooks/useLoyaltyCustomer";
import { useLoyaltyRewards, REWARD_TIERS, PESOS_PER_POINT, getTierProgress } from "@/hooks/useLoyaltyRewards";
import { useActiveAccount, getActiveAccount, type ActiveAccount } from "@/hooks/useActiveAccount";
import { loyaltyRewards } from "@/hooks/useLoyaltyRewards";
import { PhotoEditorSheet } from "./components/PhotoEditorSheet";

interface LoyaltyRedemption {
  id: number;
  tier_label: string;
  tier_emoji: string;
  points_redeemed: number;
  items_description: string;
  created_at: string;
}

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285';

const WA_NUMBER = '523348567795';

function buildWaLink(msg: string) {
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}

// ── Botón compartir progreso con amigos ──
function ShareProgressButton({
  message,
  label,
  accent,
}: {
  message: string;
  label: string;
  accent: 'amber' | 'orange' | 'pink' | 'yellow';
}) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

  const accentMap = {
    amber: 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10',
    orange: 'border-orange-500/40 text-orange-400 hover:bg-orange-500/10',
    pink: 'border-pink-500/40 text-pink-400 hover:bg-pink-500/10',
    yellow: 'border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10',
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-800">
      <a
        href={shareUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border bg-transparent transition-colors cursor-pointer whitespace-nowrap ${accentMap[accent]}`}
      >
        <i className="ri-whatsapp-line text-base" />
        {label}
      </a>
      <button
        onClick={handleCopy}
        title="Copiar mensaje"
        className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-700 text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors cursor-pointer flex-shrink-0"
      >
        <i className={`${copied ? 'ri-check-line text-green-400' : 'ri-file-copy-line'} text-base`} />
      </button>
    </div>
  );
}

// ── Banner de notificación WhatsApp ──
interface WaNotifProps {
  icon: string;
  iconBg: string;
  title: string;
  subtitle: string;
  waMessage: string;
  borderColor: string;
  bgColor: string;
  btnLabel: string;
  btnColor: string;
  dismissKey: string;
}

function WhatsAppNotification({
  icon, iconBg, title, subtitle, waMessage,
  borderColor, bgColor, btnLabel, btnColor, dismissKey,
}: WaNotifProps) {
  const [dismissed, setDismissed] = useState(() =>
    sessionStorage.getItem(`wa_notif_${dismissKey}`) === '1'
  );

  if (dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(`wa_notif_${dismissKey}`, '1');
    setDismissed(true);
  };

  return (
    <div className={`rounded-2xl border-2 ${borderColor} ${bgColor} px-4 py-4 flex flex-col gap-3`}>
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
          <i className={`${icon} text-xl`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-sm leading-tight">{title}</p>
          <p className="text-gray-400 text-xs mt-0.5 leading-snug">{subtitle}</p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-600 hover:text-gray-400 cursor-pointer flex-shrink-0 mt-0.5 w-6 h-6 flex items-center justify-center"
        >
          <i className="ri-close-line text-base" />
        </button>
      </div>
      <div className="flex gap-2">
        <a
          href={buildWaLink(waMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-sm ${btnColor} transition-colors cursor-pointer whitespace-nowrap`}
        >
          <i className="ri-whatsapp-line text-base" />
          {btnLabel}
        </a>
        <button
          onClick={handleDismiss}
          className="px-3 py-2.5 border border-gray-700 rounded-xl text-gray-500 text-xs cursor-pointer hover:bg-gray-800 transition-colors whitespace-nowrap"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

// Imágenes para cada nivel de campaña
const TIER_BANNER_IMAGES: Record<string, string> = {
  tier1: 'https://readdy.ai/api/search-image?query=cold%20beer%20glass%20frosty%20mug%20dark%20rustic%20bar%20counter%20with%20golden%20light%20dramatic%20moody%20lighting%20amber%20liquid%20bubbles%20close%20up%20professional%20food%20photography%20warm%20tones%20dark%20background%20simple%20elegant&width=600&height=350&seq=tier1-beer-banner&orientation=landscape',
  tier2: 'https://readdy.ai/api/search-image?query=gourmet%20burger%20with%20crispy%20french%20fries%20dark%20slate%20background%20dramatic%20moody%20lighting%20golden%20tones%20food%20photography%20restaurant%20quality%20juicy%20patty%20sesame%20bun%20close%20up%20vibrant%20warm%20light&width=600&height=350&seq=tier2-burger-banner&orientation=landscape',
};

// ── Botón de canje ──
function RedeemButton({ tier, onRedeem }: { tier: typeof REWARD_TIERS[0]; onRedeem: () => void }) {
  const [status, setStatus] = useState<'idle' | 'confirm' | 'done'>('idle');

  if (status === 'confirm') {
    return (
      <div className={`rounded-2xl border-2 ${tier.borderColor} p-4 space-y-3`}>
        <p className="text-white text-sm font-black text-center">¿Canjear {tier.title}?</p>
        <p className="text-gray-400 text-xs text-center leading-snug">
          Avísale al mesero y muéstrale esta pantalla para confirmar tu premio
        </p>
        <div className="bg-gray-800 rounded-xl px-4 py-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Tu premio incluye una de estas opciones:</p>
          {tier.items.map((item, i) => (
            <p key={i} className={`text-sm font-bold ${tier.textColor}`}>• {item}</p>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setStatus('idle')}
            className="flex-1 py-2.5 border border-gray-700 rounded-xl text-gray-400 text-sm cursor-pointer hover:bg-gray-800 transition-colors whitespace-nowrap"
          >
            Cancelar
          </button>
          <button
            onClick={() => { setStatus('done'); onRedeem(); }}
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-black cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-gift-2-fill mr-1" />
            ¡Mostrar al mesero!
          </button>
        </div>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="bg-green-900/30 border-2 border-green-500 rounded-2xl px-5 py-4 text-center">
        <i className="ri-checkbox-circle-fill text-green-400 text-3xl block mb-2" />
        <p className="text-green-300 font-black text-base">¡Mostrando al mesero!</p>
        <p className="text-green-500 text-xs mt-1">El mesero confirmará y descontará tus puntos</p>
        <div className="mt-3 bg-green-900/40 rounded-xl p-3">
          <p className="text-green-500 text-xs mb-1">Seleccionaste una de estas opciones:</p>
          {tier.items.map((item, i) => (
            <p key={i} className="text-green-300 text-sm font-bold">• {item}</p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setStatus('confirm')}
      className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm cursor-pointer transition-all active:scale-95 whitespace-nowrap border-2 ${tier.borderColor} ${tier.bgColor} ${tier.textColor} hover:opacity-90`}
    >
      <i className="ri-gift-2-fill text-base" />
      Canjear {tier.emoji} {tier.title}
    </button>
  );
}

// ── Tarjeta de campaña con banner ──
function CampaignCard({
  tier,
  points,
  bannerImage,
  customerName,
}: {
  tier: typeof REWARD_TIERS[0];
  points: number;
  bannerImage: string;
  customerName: string;
}) {
  const achieved = points >= tier.points;
  const progress = Math.min((points / tier.points) * 100, 100);
  const remaining = Math.max(tier.points - points, 0);
  const extra = achieved ? Math.floor((points - tier.points) / tier.points) : 0;

  const shareMsg = achieved
    ? `🍗 ¡Logré canjear mi *${tier.title}* en La Cabrona Alitas & Beer! ${tier.emoji}\nPremio: ${tier.items.join(', ')}.\n\n¿Ya tienes tu Tarjeta Lealtad Cabrona? Regístrate acumulando puntos en cada visita. ¡Te llevo! 🔥`
    : `🍗 Llevo *${points} de ${tier.points} puntos* en La Cabrona Alitas & Beer y voy por mi premio: ${tier.items[0]} ${tier.emoji}\n\n¿Te apuntas a ir? ¡Así acumulamos juntos! 🔥`;

  return (
    <div className={`rounded-2xl border-2 overflow-hidden transition-all ${
      achieved ? `${tier.borderColor} bg-gray-900` : 'border-gray-800 bg-gray-900/50'
    }`}>
      {/* Banner imagen */}
      <div className="relative w-full h-36 overflow-hidden">
        <img
          src={bannerImage}
          alt={tier.title}
          className="w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent" />
        {/* Badge estado */}
        <div className="absolute top-3 right-3">
          {achieved ? (
            <span className={`text-xs font-black px-2.5 py-1 rounded-full ${tier.bgColor} ${tier.textColor} border ${tier.borderColor} backdrop-blur-sm`}>
              ¡DESBLOQUEADO!
            </span>
          ) : (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-900/70 text-gray-400 border border-gray-700 backdrop-blur-sm">
              {tier.points} pts requeridos
            </span>
          )}
        </div>
        {/* Emoji flotante */}
        <div className="absolute bottom-3 left-4">
          <span className="text-4xl drop-shadow-lg">{tier.emoji}</span>
        </div>
      </div>

      {/* Contenido */}
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className={`font-black text-lg leading-tight ${achieved ? 'text-white' : 'text-gray-500'}`}>
              {tier.title}
            </h3>
            <p className={`text-xs mt-0.5 ${achieved ? 'text-gray-400' : 'text-gray-600'}`}>
              {tier.points} puntos · ${tier.pesos.toLocaleString()} pesos de consumo
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className={`text-3xl font-black ${achieved ? tier.textColor : 'text-gray-700'}`}>
              {tier.points}
            </p>
            <p className="text-gray-600 text-xs">pts</p>
          </div>
        </div>

        {/* Premios */}
        <div className={`rounded-xl p-3 mb-3 ${achieved ? 'bg-gray-800' : 'bg-gray-800/40'}`}>
          <p className="text-gray-500 text-xs mb-1.5 uppercase tracking-wide font-bold">Elige una opción:</p>
          <div className="space-y-1">
            {tier.items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <i className={`ri-checkbox-circle-fill text-sm flex-shrink-0 ${achieved ? tier.textColor : 'text-gray-700'}`} />
                <span className={`text-sm ${achieved ? 'text-white' : 'text-gray-600'}`}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Barra de progreso */}
        {!achieved && (
          <div className="space-y-2 mb-1">
            <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">{points} pts actuales</span>
              <span className="text-amber-500 font-bold">Faltan {remaining} pts</span>
              <span className="text-gray-600">{tier.points} pts meta</span>
            </div>
          </div>
        )}

        {/* Botón de canje */}
        {achieved && (
          <div className="space-y-2">
            {extra > 0 && (
              <p className={`text-xs text-center ${tier.textColor} font-bold`}>
                ¡Tienes {extra} canje{extra > 1 ? 's' : ''} extra disponible{extra > 1 ? 's' : ''}!
              </p>
            )}
            <RedeemButton tier={tier} onRedeem={() => {}} />
          </div>
        )}

        {/* Botón compartir con amigos */}
        <ShareProgressButton
          message={shareMsg}
          label={achieved ? 'Compartir logro' : 'Invitar amigos'}
          accent={tier.color === 'amber' ? 'amber' : 'orange'}
        />
      </div>
    </div>
  );
}

// ── Página principal ──
export default function MiTarjetaPage() {
  const { customer, refresh, logout } = useLoyaltyCustomer();
  const [refreshing, setRefreshing] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [redemptions, setRedemptions] = useState<LoyaltyRedemption[]>([]);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);

  // ── Phone lookup state (when no customer in localStorage) ──
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');

  const handlePhoneLookup = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = lookupPhone.trim().replace(/\s/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      setLookupError('Ingresa un número de teléfono válido');
      return;
    }

    setLookupLoading(true);
    setLookupError('');

    try {
      // Check if customer exists by phone
      const { data: found, error } = await supabasePos
        .from('pos_customers')
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (error) throw error;

      if (found) {
        const c = found as LoyaltyCustomer;
        saveLoyaltyCustomerToStorage(c);
        // Force re-render by reloading the hook state
        window.location.reload();
      } else {
        setLookupError('No encontramos ninguna tarjeta con ese teléfono. Si es tu primera vez, regístrate desde el menú.');
      }
    } catch (err) {
      setLookupError('Error al buscar. Intenta de nuevo.');
    } finally {
      setLookupLoading(false);
    }
  }, [lookupPhone]);

  const fetchRedemptions = useCallback(async (customerId: number) => {
    setRedemptionsLoading(true);
    const { data } = await supabase
      .from('loyalty_redemptions')
      .select('id, tier_label, tier_emoji, points_redeemed, items_description, created_at')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(10);
    setRedemptions((data ?? []) as LoyaltyRedemption[]);
    setRedemptionsLoading(false);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Al montar, refrescar desde BD para obtener selfie_url y puntos actualizados
  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling cada 30s para mantener puntos sincronizados con POS/admin
  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (!customer?.id) return;
    fetchRedemptions(customer.id);
  }, [customer?.id, fetchRedemptions]);

  const handleLogout = () => {
    logout();
    setShowLogoutConfirm(false);
  };

  // Active account for shortcut
  const [activeAccount, setActiveAccountShortcut] = useState<ActiveAccount | null>(null);

  useEffect(() => {
    const saved = getActiveAccount();
    if (saved) {
      setActiveAccountShortcut(saved);
    }
  }, []);

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center px-6 text-center gap-6">
        <div className="pt-16">
          <img src={LOGO_URL} alt="La Cabrona" title="La Cabrona Alitas & Beer" className="w-24 h-24 rounded-full object-cover border-2 border-amber-500 mx-auto" />
        </div>
        <div>
          <i className="ri-vip-crown-2-line text-5xl text-gray-700 block mb-3" />
          <h1 className="text-white text-2xl font-black">Tarjeta Lealtad Cabrona</h1>
          <p className="text-gray-500 text-sm mt-2 leading-relaxed max-w-xs mx-auto">
            ¿Ya tienes tarjeta? Busca tu registro con tu número de teléfono.
          </p>
        </div>

        {/* ── Phone lookup form ── */}
        <form onSubmit={handlePhoneLookup} className="w-full max-w-sm space-y-3">
          <div className="relative">
            <i className="ri-phone-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg pointer-events-none" />
            <input
              type="tel"
              inputMode="numeric"
              value={lookupPhone}
              onChange={e => { setLookupPhone(e.target.value); setLookupError(''); }}
              placeholder="Tu número de teléfono (ej. 3338093998)"
              className="w-full bg-gray-900 border border-gray-700 focus:border-amber-500 text-white placeholder-gray-500 text-base rounded-2xl pl-11 pr-4 py-4 outline-none transition-colors"
            />
          </div>

          {lookupError && (
            <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 flex items-start gap-2">
              <i className="ri-error-warning-line text-red-400 text-sm mt-0.5 flex-shrink-0" />
              <p className="text-red-300 text-xs text-left leading-snug">{lookupError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={lookupLoading || !lookupPhone.trim()}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-700 disabled:text-gray-500 text-white py-4 rounded-2xl font-black text-base transition-colors cursor-pointer whitespace-nowrap"
          >
            {lookupLoading ? (
              <>
                <i className="ri-loader-4-line animate-spin text-lg" />
                Buscando...
              </>
            ) : (
              <>
                <i className="ri-search-line" />
                Buscar mi tarjeta
              </>
            )}
          </button>
        </form>

        {/* ── Divider ── */}
        <div className="flex items-center gap-3 w-full max-w-sm">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-gray-600 text-xs font-bold">o</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4">
          <p className="text-gray-400 text-xs leading-relaxed mb-3">
            <i className="ri-information-line text-amber-400 mr-1" />
            Si es tu primera vez, regístrate desde el menú al hacer tu pedido. Te pedimos tu nombre y teléfono para empezar a acumular puntos.
          </p>
          <Link
            to="/"
            className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-2xl font-bold text-sm transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-restaurant-line" />
            Ir al menú y registrarme
          </Link>
        </div>

        <p className="text-gray-700 text-xs pb-8">
          ¿Problemas? Mándanos WhatsApp al 33-4856-7795
        </p>
      </div>
    );
  }

  const points = customer.loyalty_points ?? 0;
  const tierProgress = getTierProgress(points);
  const isBirthdayMonth = customer.birthday
    ? new Date(customer.birthday).getMonth() === new Date().getMonth()
    : false;
  const unlockedTiers = tierProgress.filter(t => t.achieved);

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      {/* ── Header dorado ── */}
      <div
        className="relative px-5 pt-12 pb-8"
        style={{ background: 'linear-gradient(135deg, #b45309 0%, #d97706 50%, #f59e0b 100%)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={LOGO_URL} alt="La Cabrona" title="La Cabrona Alitas & Beer" className="w-10 h-10 rounded-full object-cover border-2 border-white/40" />
            <div>
              <p className="text-white font-black text-sm leading-tight" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.1em' }}>
                LA CABRONA
              </p>
              <p className="text-amber-200 text-xs">Alitas &amp; Beer</p>
            </div>
          </Link>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 cursor-pointer transition-colors"
          >
            <i className={`ri-refresh-line text-white text-base ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* ── Atajo a cuenta activa ── */}
        {activeAccount && (
          <Link
            to={`/cuenta?id=${activeAccount.accountId}`}
            className="block bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl px-4 py-3 mb-5 flex items-center gap-3 hover:bg-white/30 transition-all active:scale-[0.98]"
          >
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 bg-white/25 rounded-full flex items-center justify-center">
                <i className="ri-receipt-line text-white text-lg" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-amber-600 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-sm leading-tight">Mi Cuenta</p>
              <p className="text-amber-100 text-xs mt-0.5 truncate">
                {activeAccount.spot} · Toca para ver tu cuenta
              </p>
            </div>
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <i className="ri-arrow-right-s-line text-white text-lg" />
            </div>
          </Link>
        )}

        {/* Tarjeta de cliente — nombre "Tarjeta Lealtad Cabrona" */}
        <div className="bg-white/15 backdrop-blur-sm rounded-3xl p-5 border border-white/20">
          {/* Label de tarjeta */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <i className="ri-vip-crown-2-fill text-amber-200 text-lg" />
              <span className="text-white font-black text-base tracking-wide" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.12em' }}>
                TARJETA LEALTAD CABRONA
              </span>
            </div>
            <img src={LOGO_URL} alt="logo" title="La Cabrona Alitas & Beer" className="w-8 h-8 rounded-full object-cover border border-white/30" />
          </div>

          {/* Info cliente */}
          <div className="flex items-center gap-3 mb-4">
            {/* Avatar simple sin foto */}
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <span className="text-white text-2xl font-black">{customer.name.charAt(0).toUpperCase()}</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-white font-black text-base leading-tight">{customer.name}</p>
                {isBirthdayMonth && <span className="text-lg">🎂</span>}
              </div>
              <p className="text-amber-100 text-sm">{customer.phone}</p>
              <p className="text-amber-200/70 text-xs mt-0.5">
                {customer.visit_count} visita{customer.visit_count !== 1 ? 's' : ''} · ${Math.round(customer.total_spent ?? 0)} consumido
              </p>
            </div>
          </div>

          {/* Puntos grandes */}
          <div className="text-center py-3 bg-white/10 rounded-2xl">
            <p className="text-amber-100 text-xs uppercase tracking-widest font-bold">Puntos acumulados</p>
            <p className="text-white text-7xl font-black leading-none mt-1">{points}</p>
            <p className="text-amber-200 text-sm mt-1">
              1 punto = ${PESOS_PER_POINT} pesos consumidos
            </p>
            {unlockedTiers.length > 0 && (
              <div className="mt-2 flex items-center justify-center gap-1.5">
                <i className="ri-gift-2-fill text-green-400 text-sm" />
                <span className="text-green-300 text-xs font-bold">
                  {unlockedTiers.length} premio{unlockedTiers.length > 1 ? 's' : ''} disponible{unlockedTiers.length > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Contenido ── */}
      <div className="px-4 pt-5 space-y-4">

        {/* ── 2 CAMPAÑAS CON BANNERS — AL INICIO ── */}
        <div>
          <div className="flex items-center gap-2 px-1 mb-3">
            <i className="ri-award-fill text-amber-400 text-lg" />
            <div>
              <h2 className="text-white font-black text-base leading-tight">Mis Campañas &amp; Recompensas</h2>
              <p className="text-gray-500 text-xs">Acumula puntos y canjéalos por premios</p>
            </div>
          </div>
          <div className="space-y-4">
            <CampaignCard
              tier={tierProgress[0]}
              points={points}
              bannerImage={TIER_BANNER_IMAGES.tier1}
              customerName={customer.name}
            />
            <CampaignCard
              tier={tierProgress[1]}
              points={points}
              bannerImage={TIER_BANNER_IMAGES.tier2}
              customerName={customer.name}
            />
          </div>
        </div>

        {/* Banner: casi llegás */}
        {(() => {
          const nextTier = REWARD_TIERS.find(t => points < t.points);
          if (!nextTier) return null;
          const remaining = nextTier.points - points;
          if (remaining > 2) return null;
          return (
            <div className="bg-gradient-to-r from-amber-600/30 to-amber-400/20 border-2 border-amber-500 rounded-2xl px-5 py-4 flex items-center gap-4">
              <div className="w-14 h-14 bg-amber-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                <span className="text-3xl">{nextTier.emoji ?? '🎯'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-amber-300 font-black text-base leading-tight">
                  ¡Solo te falta{remaining === 1 ? '' : 'n'} {remaining} punto{remaining === 1 ? '' : 's'}!
                </p>
                <p className="text-amber-400/80 text-sm mt-0.5">
                  {remaining === 1
                    ? 'Con tu próxima visita desbloqueas tu premio'
                    : 'Estás a punto de ganar tu próximo premio'}
                </p>
                <p className="text-amber-500/70 text-xs mt-1">
                  Premio: {nextTier.items?.[0]}
                </p>
              </div>
              <i className="ri-gift-2-fill text-amber-400 text-3xl flex-shrink-0" />
            </div>
          );
        })()}

        {/* Cumpleaños */}
        {isBirthdayMonth && (
          <div className="bg-pink-900/30 border border-pink-500/50 rounded-2xl px-5 py-4 flex items-center gap-3">
            <span className="text-3xl">🎂</span>
            <div>
              <p className="text-pink-300 font-black text-base">¡Mes de tu cumpleaños!</p>
              <p className="text-pink-400/70 text-xs mt-0.5">Avísale al mesero para tu sorpresa especial</p>
            </div>
          </div>
        )}

        {/* ── NOTIFICACIONES WHATSAPP ── */}

        {/* Falta 1 punto para el siguiente nivel */}
        {(() => {
          const nextTier = REWARD_TIERS.find(t => points < t.points);
          if (!nextTier) return null;
          const rem = nextTier.points - points;
          if (rem !== 1) return null;
          return (
            <WhatsAppNotification
              dismissKey={`almost_${nextTier.id}_${points}`}
              icon="ri-medal-line"
              iconBg="bg-amber-500/20 text-amber-300"
              title={`¡Solo 1 punto para ${nextTier.title}! ${nextTier.emoji}`}
              subtitle={`Premio que te espera: ${nextTier.items[0]}. Avisa al mesero en tu próxima visita.`}
              borderColor="border-amber-500/70"
              bgColor="bg-amber-500/10"
              btnLabel="Avisar al mesero"
              btnColor="bg-green-600 hover:bg-green-700 text-white"
              waMessage={`Hola La Cabrona! 🍗 Soy ${customer.name} y me falta 1 punto para desbloquear mi ${nextTier.title} ${nextTier.emoji}. Tengo ${points} puntos. ¿Me ayudan a confirmarlo en mi próxima visita?`}
            />
          );
        })()}

        {/* Premio Nivel 1 desbloqueado */}
        {tierProgress[0]?.achieved && (
          <WhatsAppNotification
            dismissKey={`unlocked_tier1_${points}`}
            icon="ri-gift-2-fill"
            iconBg="bg-amber-500/20 text-amber-400"
            title={`¡Premio Nivel 1 desbloqueado! ${REWARD_TIERS[0].emoji}`}
            subtitle={`Tienes ${points} pts — canjea: ${REWARD_TIERS[0].items[0]}. Avisa al mesero o manda WhatsApp ahora.`}
            borderColor="border-amber-500"
            bgColor="bg-amber-900/20"
            btnLabel="Canjear por WhatsApp"
            btnColor="bg-green-600 hover:bg-green-700 text-white"
            waMessage={`Hola La Cabrona! 🍺 Soy ${customer.name} (${customer.phone}) y desbloqueé mi Premio Nivel 1 con ${points} puntos. Quiero canjear: ${REWARD_TIERS[0].items.join(', ')}. ¿Me confirman?`}
          />
        )}

        {/* Premio Nivel 2 desbloqueado */}
        {tierProgress[1]?.achieved && (
          <WhatsAppNotification
            dismissKey={`unlocked_tier2_${points}`}
            icon="ri-restaurant-2-fill"
            iconBg="bg-orange-500/20 text-orange-400"
            title={`¡Premio Nivel 2 desbloqueado! ${REWARD_TIERS[1].emoji}`}
            subtitle={`${points} pts acumulados — tienes derecho a: ${REWARD_TIERS[1].items[0]}. ¡No lo dejes perder!`}
            borderColor="border-orange-500"
            bgColor="bg-orange-900/20"
            btnLabel="Canjear por WhatsApp"
            btnColor="bg-green-600 hover:bg-green-700 text-white"
            waMessage={`Hola La Cabrona! 🍔 Soy ${customer.name} (${customer.phone}) y desbloqueé mi Premio Nivel 2 con ${points} puntos. Quiero canjear: ${REWARD_TIERS[1].items.join(', ')}. ¿Me ayudan?`}
          />
        )}

        {/* ── Cómo funciona ── */}
        <div className="bg-gray-900 rounded-2xl p-5">
          <h3 className="text-white font-black text-base mb-4 flex items-center gap-2">
            <i className="ri-question-line text-amber-400" />
            ¿Cómo funciona?
          </h3>
          <div className="space-y-3">
            {[
              { icon: 'ri-restaurant-line', text: 'Consume en La Cabrona — alitas, cervezas, lo que quieras', color: 'text-amber-400' },
              { icon: 'ri-coin-line', text: 'Por cada $100 pesos de consumo, ganas 1 punto automáticamente', color: 'text-amber-400' },
              { icon: 'ri-beer-line', text: '10 puntos ($1,000) = 1 cerveza de medio, o 1 michelada de 1 litro, o 1 tarro de cerveza de barril clara u oscura. ¿Cuál de estas 3 opciones quieres?', color: 'text-amber-400' },
              { icon: 'ri-restaurant-2-line', text: '15 puntos ($1,500) = 1 hamburguesa con papas (gajo o francesa) + 1 cerveza de medio', color: 'text-orange-400' },
              { icon: 'ri-cake-2-line', text: 'En tu mes de cumpleaños hay sorpresa especial 🎂', color: 'text-pink-400' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-800 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className={`${item.icon} ${item.color} text-sm`} />
                </div>
                <p className="text-gray-400 text-sm leading-snug flex-1">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── HISTORIAL DE CANJES ── */}
        <div className="bg-gray-900 rounded-2xl overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <i className="ri-history-line text-amber-400 text-sm" />
              </div>
              <h3 className="text-white font-black text-base">Mis canjes</h3>
              {redemptions.length > 0 && (
                <span className="text-xs font-black bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded-full">
                  {redemptions.length}
                </span>
              )}
            </div>
            {redemptions.length > 0 && (
              <span className="text-xs text-gray-500">
                {redemptions.reduce((s, r) => s + r.points_redeemed, 0)} pts canjeados en total
              </span>
            )}
          </div>

          {redemptionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : redemptions.length === 0 ? (
            <div className="px-5 pb-5 text-center">
              <div className="bg-gray-800/60 rounded-2xl px-4 py-6">
                <span className="text-4xl block mb-2">🎁</span>
                <p className="text-gray-400 text-sm font-semibold">Aún no has canjeado ningún premio</p>
                <p className="text-gray-600 text-xs mt-1">Acumula 10 puntos para tu primera recompensa</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {redemptions.map((r, idx) => {
                const date = new Date(r.created_at);
                const dateStr = date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
                const timeStr = date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={r.id} className={`px-5 py-3.5 flex items-start gap-3 ${idx === 0 ? 'bg-amber-900/10' : ''}`}>
                    <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
                      {r.tier_emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-white text-sm font-bold leading-tight">{r.tier_label}</p>
                        <span className="text-xs font-black text-red-400 bg-red-900/20 border border-red-800/40 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                          − {r.points_redeemed} pts
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs mt-0.5 leading-snug">
                        {r.items_description.split(' | ').join(' · ')}
                      </p>
                      <p className="text-gray-600 text-xs mt-1">
                        {dateStr} · {timeStr}
                        {idx === 0 && (
                          <span className="ml-2 text-amber-500 font-bold">← Último canje</span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div className="px-5 py-3 bg-gray-800/40 flex items-center justify-between">
                <span className="text-gray-500 text-xs font-semibold">Total de premios cobrados</span>
                <div className="flex items-center gap-3">
                  <span className="text-amber-400 font-black text-sm">{redemptions.length} premio{redemptions.length !== 1 ? 's' : ''}</span>
                  <span className="text-gray-600 text-xs">{redemptions.reduce((s, r) => s + r.points_redeemed, 0)} pts usados</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900 rounded-2xl p-4 text-center">
            <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-2">
              <i className="ri-store-3-line text-amber-400 text-xl" />
            </div>
            <p className="text-2xl font-black text-amber-400">{customer.visit_count}</p>
            <p className="text-gray-500 text-xs mt-0.5">Visitas</p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 text-center">
            <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-2">
              <i className="ri-vip-crown-2-line text-amber-400 text-xl" />
            </div>
            <p className="text-2xl font-black text-amber-400">{points}</p>
            <p className="text-gray-500 text-xs mt-0.5">Puntos disponibles</p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 text-center">
            <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-2">
              <i className="ri-money-dollar-circle-line text-green-400 text-xl" />
            </div>
            <p className="text-2xl font-black text-green-400">${Math.round(customer.total_spent ?? 0)}</p>
            <p className="text-gray-500 text-xs mt-0.5">Total consumido</p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 text-center">
            <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-2">
              <i className="ri-gift-2-fill text-amber-400 text-xl" />
            </div>
            <p className="text-2xl font-black text-amber-400">{redemptions.length}</p>
            <p className="text-gray-500 text-xs mt-0.5">Premios cobrados</p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-2">
          <Link
            to="/"
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white py-4 rounded-2xl font-black text-base transition-colors whitespace-nowrap"
          >
            <i className="ri-restaurant-line" />
            Ir al menú
          </Link>
          <Link
            to={`/cuenta?nombre=${encodeURIComponent(customer.name)}`}
            className="w-full flex items-center justify-center gap-2 bg-gray-900 border border-gray-700 hover:bg-gray-800 text-gray-300 py-3.5 rounded-2xl font-bold text-sm transition-colors whitespace-nowrap"
          >
            <i className="ri-receipt-line" />
            Ver mi cuenta
          </Link>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full text-gray-600 hover:text-gray-400 text-sm cursor-pointer transition-colors py-2"
          >
            <i className="ri-logout-circle-line mr-1" />
            Cambiar de cuenta
          </button>
        </div>
      </div>

      {/* Confirm logout */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowLogoutConfirm(false)} />
          <div className="relative bg-gray-900 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-white font-black text-lg mb-2">¿Cambiar de cuenta?</h3>
            <p className="text-gray-400 text-sm mb-5 leading-snug">
              Tus puntos seguirán guardados. Solo dejarás de ver esta tarjeta en este dispositivo.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 border border-gray-700 rounded-xl text-gray-400 text-sm cursor-pointer hover:bg-gray-800 transition-colors whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 rounded-xl text-white text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
              >
                Sí, cambiar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}