import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabasePos } from '@/pages/pos/supabasePos';
import { getLoyaltyCustomerFromStorage } from '@/hooks/useLoyaltyCustomer';
import { saveCustomerProfile } from '@/hooks/usePersistentCustomer';
import type { LoyaltyCustomer } from '@/hooks/useLoyaltyCustomer';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285';

const STORAGE_KEY = 'lc_loyalty_customer';

interface AccountPreview {
  id: number;
  spot: string;
  status: 'open' | 'closed';
  total: number;
  itemCount: number;
  folioCounter: number;
}

function loadCustomerName(): string | null {
  try {
    const profilesRaw = localStorage.getItem('lc_customer_profiles');
    if (profilesRaw) {
      const profiles = JSON.parse(profilesRaw) as { name: string; lastUsed: number }[];
      if (Array.isArray(profiles) && profiles.length > 0) {
        const mostRecent = profiles.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))[0];
        if (mostRecent?.name) return mostRecent.name;
      }
    }
    return localStorage.getItem('lc_customer_name');
  } catch {
    return null;
  }
}

// ─── Phone lookup / switch panel ─────────────────────────────────────────────
interface PhoneLookupProps {
  mode: 'register' | 'switch';
  currentName?: string;
  onFound: (customer: LoyaltyCustomer) => void;
  onCancel: () => void;
}

function PhoneLookup({ mode, currentName, onFound, onCancel }: PhoneLookupProps) {
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'not_found' | 'error'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const isValid = /^\d{10}$/.test(phone);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(raw);
    setStatus('idle');
  };

  const handleSearch = async () => {
    if (!isValid) return;
    setStatus('loading');
    try {
      const { data, error } = await supabasePos
        .from('pos_customers')
        .select('*')
        .eq('phone', phone.trim())
        .maybeSingle();

      if (error) { setStatus('error'); return; }
      if (!data) { setStatus('not_found'); return; }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      onFound(data as LoyaltyCustomer);
    } catch {
      setStatus('error');
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="w-full bg-gray-900 border border-amber-500/30 rounded-2xl p-5 mb-6">
      {/* Header según modo */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 flex items-center justify-center bg-amber-500/15 rounded-xl shrink-0 mt-0.5">
          <i className={`${mode === 'switch' ? 'ri-refresh-line' : 'ri-smartphone-line'} text-amber-400 text-base`} />
        </div>
        <div>
          {mode === 'switch' ? (
            <>
              <p className="text-white text-sm font-bold">Cambiar de cuenta</p>
              <p className="text-gray-400 text-xs leading-relaxed">
                Ahora vinculado como{' '}
                <span className="text-amber-400 font-bold">{currentName?.split(' ')[0]}</span>.
                Ingresa otro número para cambiar.
              </p>
            </>
          ) : (
            <>
              <p className="text-white text-sm font-bold">Ingresa tu número</p>
              <p className="text-gray-400 text-xs">10 dígitos sin espacios ni guiones</p>
            </>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="relative mb-3">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400 font-bold text-sm select-none">+52</span>
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          value={phone}
          onChange={handleInput}
          onKeyDown={handleKey}
          placeholder="5512345678"
          maxLength={10}
          className={`w-full pl-14 pr-12 py-3.5 bg-gray-800 border rounded-xl text-white text-lg font-mono tracking-widest placeholder-gray-600 focus:outline-none transition-colors ${
            status === 'not_found' || status === 'error'
              ? 'border-red-500/60 focus:border-red-400'
              : isValid
              ? 'border-green-500/60 focus:border-green-400'
              : 'border-gray-700 focus:border-amber-500/60'
          }`}
        />
        <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold tabular-nums ${phone.length === 10 ? 'text-green-400' : 'text-gray-600'}`}>
          {phone.length}/10
        </span>
      </div>

      {/* Mensajes de estado */}
      {status === 'not_found' && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">
          <i className="ri-close-circle-line text-red-400 text-sm" />
          <p className="text-red-300 text-xs">No encontramos ese número. Verifica que sean 10 dígitos correctos.</p>
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">
          <i className="ri-wifi-off-line text-red-400 text-sm" />
          <p className="text-red-300 text-xs">Error de conexión. Intenta de nuevo.</p>
        </div>
      )}

      {/* Botones */}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white rounded-xl text-sm font-bold transition-colors cursor-pointer whitespace-nowrap"
        >
          Cancelar
        </button>
        <button
          onClick={handleSearch}
          disabled={!isValid || status === 'loading'}
          className="flex-grow py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-black transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
        >
          {status === 'loading' ? (
            <><i className="ri-loader-4-line animate-spin" /> Buscando...</>
          ) : (
            <><i className="ri-search-line" /> {mode === 'switch' ? 'Cambiar' : 'Buscar cuenta'}</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Chip del cliente activo ──────────────────────────────────────────────────
interface ActiveCustomerChipProps {
  customer: LoyaltyCustomer;
  onSwitch: () => void;
}

function ActiveCustomerChip({ customer, onSwitch }: ActiveCustomerChipProps) {
  return (
    <div className="w-full bg-gray-900 border border-amber-500/20 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar inicial */}
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
            {customer.selfie_url ? (
              <img src={customer.selfie_url} alt={customer.name} title={`Selfie de ${customer.name}`} className="w-10 h-10 rounded-xl object-cover" />
            ) : (
              <span className="text-amber-400 text-base font-black">
                {customer.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-black truncate">{customer.name}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-gray-500 text-xs font-mono">{customer.phone}</span>
              <span className="text-amber-400 text-xs font-bold flex items-center gap-1">
                <i className="ri-star-fill text-amber-400" style={{ fontSize: '10px' }} />
                {customer.loyalty_points} pts
              </span>
            </div>
          </div>
        </div>
        {/* Botón cambiar */}
        <button
          onClick={onSwitch}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-amber-500/40 text-gray-400 hover:text-amber-400 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-refresh-line text-sm" />
          Cambiar
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function BienvenidaPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  // Esta página es un flujo de onboarding interno, no debe indexarse

  const mesa = params.get('mesa') || params.get('spot') || '';
  const area = params.get('area') || '';
  const mesaLabel = mesa || area || 'Tu Mesa';

  // Estado del cliente activo — inicializar desde storage
  const [activeCustomer, setActiveCustomer] = useState<LoyaltyCustomer | null>(
    () => getLoyaltyCustomerFromStorage(),
  );
  const [savedName, setSavedName] = useState<string | null>(() => {
    const stored = getLoyaltyCustomerFromStorage();
    if (stored?.name) return stored.name;
    return loadCustomerName();
  });

  const [showPhoneLookup, setShowPhoneLookup] = useState(false);
  const [lookupMode, setLookupMode] = useState<'register' | 'switch'>('register');

  // Número de visitas previas del cliente
  const [visitCount, setVisitCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchVisits = async () => {
      const customer = getLoyaltyCustomerFromStorage();
      if (!customer?.phone) { setVisitCount(null); return; }
      try {
        const { count } = await supabasePos
          .from('pos_accounts')
          .select('id', { count: 'exact', head: true })
          .eq('customer_phone', customer.phone)
          .eq('status', 'closed');
        setVisitCount(count ?? 0);
      } catch {
        setVisitCount(null);
      }
    };
    fetchVisits();
  }, [activeCustomer]);

  const [account, setAccount] = useState<AccountPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  const AUTO_REDIRECT_MS = 6000;
  const [countdown, setCountdown] = useState(Math.floor(AUTO_REDIRECT_MS / 1000));
  const countdownPaused = showPhoneLookup;

  useEffect(() => {
    const fetchAccount = async () => {
      const spotVariants = mesa
        ? [mesa, `Mesa ${mesa}`, mesa.replace(/^Mesa\s*/i, '')]
        : [];

      let found: AccountPreview | null = null;

      const trySpot = async (spot: string) => {
        const { data } = await supabasePos
          .from('pos_accounts')
          .select('id, spot, status, folio_counter, pos_account_items(unit_price, quantity)')
          .eq('spot', spot)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        return data;
      };

      if (mesa) {
        for (const s of spotVariants) {
          const d = await trySpot(s);
          if (d) {
            found = {
              id: d.id,
              spot: d.spot,
              status: d.status,
              total: (d.pos_account_items ?? []).reduce(
                (sum: number, i: { unit_price: number; quantity: number }) => sum + i.unit_price * i.quantity,
                0,
              ),
              itemCount: (d.pos_account_items ?? []).length,
              folioCounter: d.folio_counter,
            };
            break;
          }
        }
      } else if (area) {
        const { data } = await supabasePos
          .from('pos_accounts')
          .select('id, spot, status, folio_counter, pos_account_items(unit_price, quantity)')
          .eq('area', area)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          found = {
            id: data.id,
            spot: data.spot,
            status: data.status,
            total: (data.pos_account_items ?? []).reduce(
              (sum: number, i: { unit_price: number; quantity: number }) => sum + i.unit_price * i.quantity,
              0,
            ),
            itemCount: (data.pos_account_items ?? []).length,
            folioCounter: data.folio_counter,
          };
        }
      }

      setAccount(found);
      setLoading(false);
    };

    fetchAccount();
  }, [mesa, area]);

  // Countdown y auto-redirect
  useEffect(() => {
    if (loading || countdownPaused) return;

    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(interval);
          handleGoToCuenta();
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, countdownPaused]);

  const handleGoToCuenta = () => {
    setRedirecting(true);
    const cuentaUrl = mesa
      ? `/cuenta?mesa=${encodeURIComponent(mesa)}`
      : area
      ? `/cuenta?area=${encodeURIComponent(area)}`
      : '/cuenta';
    navigate(cuentaUrl, { replace: true });
  };

  const handleGoToMenu = () => {
    setRedirecting(true);
    const menuUrl = mesa
      ? `/menu?mesa=${encodeURIComponent(mesa)}`
      : area
      ? `/menu?area=${encodeURIComponent(area)}`
      : '/menu';
    navigate(menuUrl);
  };

  const handlePhoneFound = (customer: LoyaltyCustomer) => {
    setActiveCustomer(customer);
    setSavedName(customer.name);
    // Guardar en sistema persistente unificado
    saveCustomerProfile(customer.name, customer.phone);
    setShowPhoneLookup(false);
  };

  const handleOpenSwitch = () => {
    setLookupMode('switch');
    setShowPhoneLookup(true);
  };

  const handleOpenRegister = () => {
    setLookupMode('register');
    setShowPhoneLookup(true);
  };

  const hasStoredCustomer = !!activeCustomer;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-between px-6 py-10 overflow-hidden relative">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-amber-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm mx-auto">

        {/* Logo */}
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full border-2 border-amber-500 overflow-hidden">
            <img src={LOGO_URL} alt="La Cabrona" title="La Cabrona Alitas & Beer" className="w-full h-full object-cover" />
          </div>
          {!loading && (
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 rounded-full border-2 border-gray-950 flex items-center justify-center">
              <i className="ri-check-line text-white text-xs" />
            </div>
          )}
        </div>

        {/* Nombre y eslogan */}
        <h1
          className="text-white text-4xl tracking-widest mb-1 text-center"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          LA CABRONA
        </h1>
        <p className="text-amber-500 text-xs font-bold tracking-widest uppercase mb-2 text-center">
          Alitas &amp; Beer · Zapopan
        </p>

        {/* Saludo personalizado */}
        {savedName && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2 mb-4 flex items-center gap-2">
            <i className="ri-user-smile-line text-amber-400 text-sm" />
            <span className="text-amber-300 text-sm font-bold">
              ¡Hola, {savedName.split(' ')[0]}!
            </span>
          </div>
        )}

        {/* Mesa pill */}
        <div className="bg-amber-500/15 border border-amber-500/40 rounded-full px-5 py-2 mb-6 flex items-center gap-2">
          <i className="ri-table-line text-amber-400 text-sm" />
          <span className="text-amber-300 text-sm font-bold tracking-wide">{mesaLabel}</span>
        </div>

        {/* ── Chip del cliente activo (con botón Cambiar) ── */}
        {!loading && hasStoredCustomer && activeCustomer && !showPhoneLookup && (
          <ActiveCustomerChip customer={activeCustomer} onSwitch={handleOpenSwitch} />
        )}

        {/* ── Banner bienvenido de regreso ── */}
        {!loading && hasStoredCustomer && visitCount !== null && visitCount > 0 && !showPhoneLookup && (
          <div className="w-full mb-4 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-500/15 border border-amber-500/30 rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center bg-amber-500/20 rounded-xl shrink-0">
              <i className="ri-heart-fill text-amber-400 text-base" />
            </div>
            <div className="min-w-0">
              <p className="text-amber-300 text-xs font-black uppercase tracking-widest mb-0.5">
                ¡Bienvenido de regreso!
              </p>
              <p className="text-white text-sm font-bold leading-tight">
                Es tu visita #{visitCount + 1} —{' '}
                <span className="text-amber-400">gracias por volver</span>{' '}
                <span className="text-gray-400 font-normal">🍺</span>
              </p>
            </div>
          </div>
        )}

        {/* Estado de la cuenta */}
        {loading ? (
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Verificando tu cuenta...</p>
          </div>
        ) : account ? (
          /* Cuenta activa */
          <div className="w-full bg-gray-900 border border-green-500/40 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-xs font-bold uppercase tracking-widest">Cuenta abierta</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs mb-1">Total acumulado</p>
                <p className="text-amber-400 text-3xl font-black">${account.total.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-xs mb-1">Rondas</p>
                <p className="text-white text-2xl font-black">{account.folioCounter}</p>
              </div>
            </div>
            {account.itemCount > 0 && (
              <p className="text-gray-500 text-xs mt-2">
                {account.itemCount} producto{account.itemCount !== 1 ? 's' : ''} pedido{account.itemCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        ) : (
          /* Sin cuenta activa */
          <div className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6 text-center">
            <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-3">
              <i className="ri-receipt-line text-gray-500 text-2xl" />
            </div>
            <p className="text-gray-300 text-sm font-bold mb-1">Sin cuenta activa</p>
            <p className="text-gray-500 text-xs leading-relaxed">
              Pídele al mesero que abra tu cuenta para ver tu consumo aquí
            </p>
          </div>
        )}

        {/* ── Panel de búsqueda / cambio de número ── */}
        {!loading && showPhoneLookup && (
          <PhoneLookup
            mode={lookupMode}
            currentName={activeCustomer?.name}
            onFound={handlePhoneFound}
            onCancel={() => setShowPhoneLookup(false)}
          />
        )}

        {/* Botones de acción */}
        {!loading && (
          <div className="w-full space-y-3">
            <button
              onClick={handleGoToCuenta}
              disabled={redirecting}
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-60 text-white rounded-2xl text-base font-black transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
            >
              {redirecting ? (
                <><i className="ri-loader-4-line animate-spin" /> Cargando...</>
              ) : account ? (
                <><i className="ri-receipt-line" /> Ver mi cuenta</>
              ) : (
                <><i className="ri-receipt-line" /> Ir a mi cuenta</>
              )}
            </button>

            <button
              onClick={handleGoToMenu}
              disabled={redirecting}
              className="w-full py-3.5 bg-gray-900 border border-gray-700 hover:border-amber-500/50 hover:bg-gray-800 disabled:opacity-60 text-gray-300 hover:text-white rounded-2xl text-sm font-bold transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
            >
              <i className="ri-restaurant-line text-amber-500" />
              Ver el menú completo
            </button>

            {/* Opción para registrados en otro dispositivo (solo si no hay cuenta guardada) */}
            {!hasStoredCustomer && !showPhoneLookup && (
              <button
                onClick={handleOpenRegister}
                className="w-full py-3 border border-dashed border-gray-700 hover:border-amber-500/40 hover:bg-gray-900/60 text-gray-500 hover:text-amber-400 rounded-2xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                <i className="ri-smartphone-line" />
                ¿Ya estás registrado? Ingresa tu número
              </button>
            )}

            {/* Countdown */}
            {!redirecting && !showPhoneLookup && (
              <p className="text-center text-gray-600 text-xs pt-1 flex items-center justify-center gap-1.5">
                <i className="ri-time-line" />
                Continuando en {countdown}s...
              </p>
            )}

            {/* Aviso mientras busca */}
            {!redirecting && showPhoneLookup && (
              <p className="text-center text-gray-600 text-xs pt-1 flex items-center justify-center gap-1.5">
                <i className="ri-pause-circle-line text-amber-600" />
                Cuenta pausada mientras buscamos tu perfil
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="relative z-10 text-center">
        <p className="text-gray-700 text-xs">barlacabrona.com</p>
      </div>
    </div>
  );
}