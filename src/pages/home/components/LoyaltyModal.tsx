import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLoyaltyCustomer, getLoyaltyCustomerFromStorage } from '@/hooks/useLoyaltyCustomer';
import { REWARD_TIERS, PESOS_PER_POINT } from '@/hooks/useLoyaltyRewards';
import { Link } from 'react-router-dom';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285';

// Re-exportar para compatibilidad con otros archivos
export const LOYALTY_POINTS_PER_PESO = 1 / PESOS_PER_POINT;
export const LOYALTY_REWARD_THRESHOLD = REWARD_TIERS[0].points;
export const LOYALTY_REWARD_LABEL = REWARD_TIERS[0].items[0];

interface LoyaltyModalProps {
  onDismiss: () => void;
}

type Step = 'form' | 'success' | 'already';

// ── Barra de puntos ─────────────────────────────────────────────────────────
function PointsBar({ points }: { points: number }) {
  const maxTier = REWARD_TIERS[REWARD_TIERS.length - 1];
  const progress = Math.min((points / maxTier.points) * 100, 100);
  const nextTier = REWARD_TIERS.find(t => points < t.points);
  const allUnlocked = points >= maxTier.points;
  const unlockedTiers = REWARD_TIERS.filter(t => points >= t.points);
  const hasReward = unlockedTiers.length > 0;

  return (
    <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-amber-800 text-xs font-bold uppercase tracking-wide">Puntos de lealtad</span>
        <span className="text-amber-700 text-sm font-black">{points} pts</span>
      </div>
      <div className="relative w-full h-3 bg-amber-100 rounded-full overflow-hidden mb-1">
        <div
          className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-amber-700/40"
          style={{ left: `${(REWARD_TIERS[0].points / maxTier.points) * 100}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-amber-600 text-xs">
          {allUnlocked ? '¡Todos los premios desbloqueados!' : nextTier ? `Faltan ${nextTier.points - points} pts para ${nextTier.emoji}` : ''}
        </span>
        <Link
          to="/mi-tarjeta"
          className={`inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-gray-950 text-sm font-black px-3 py-1.5 rounded-lg transition-colors ${hasReward ? 'animate-reward-pulse' : ''}`}
        >
          Ver premios →
        </Link>
      </div>
    </div>
  );
}

// ── Modal principal ──────────────────────────────────────────────────────────
export default function LoyaltyModal({ onDismiss }: LoyaltyModalProps) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [error, setError] = useState('');
  const [checkedIn, setCheckedIn] = useState<ReturnType<typeof getLoyaltyCustomerFromStorage>>(null);

  const { registerOrCheckin, loading } = useLoyaltyCustomer();

  // Leer accountId desde los parámetros de URL para vincularlo al registrarse
  const [searchParams] = useSearchParams();
  const urlAccountId = (() => {
    const raw = searchParams.get('volver_cuenta') || searchParams.get('cuenta_id');
    const parsed = raw ? parseInt(raw, 10) : null;
    return parsed && !isNaN(parsed) ? parsed : null;
  })();

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const stored = getLoyaltyCustomerFromStorage();
    if (stored?.id) {
      setCheckedIn(stored);
      setStep('already');
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 280);
  };

  // Paso 1: registrar datos → ir al éxito directo
  const handleSubmit = async () => {
    if (!name.trim()) { setError('Escribe tu nombre'); return; }
    if (!phone.trim() || phone.trim().length < 8) { setError('Escribe un celular válido'); return; }
    setError('');
    const result = await registerOrCheckin(name.trim(), phone.trim(), birthday || undefined, urlAccountId);
    if (result) {
      setCheckedIn(result);
      setStep('success');
    }
  };

  const handleContinueAsNew = () => {
    setStep('form');
    setCheckedIn(null);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center px-0 sm:px-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleDismiss}
      />

      {/* Modal */}
      <div
        className={`relative bg-gray-950 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden transition-all duration-300 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
      >
        {/* Header dorado */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-400 px-6 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="La Cabrona" title="La Cabrona Alitas & Beer" loading="lazy" decoding="async" className="w-12 h-12 rounded-full object-cover border-2 border-white/30 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-white/80 text-xs font-semibold uppercase tracking-widest">La Cabrona</p>
              <h2 className="text-white text-xl font-black leading-tight">Tarjeta de Lealtad</h2>
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="ri-vip-crown-2-fill text-white text-xl" />
            </div>
          </div>
          <p className="text-amber-100 text-xs mt-3 leading-snug">
            Acumula puntos en cada visita y canjéalos por productos gratis
          </p>
        </div>

        {/* ── FORM ── */}
        {step === 'form' && (
          <div className="px-6 py-6 space-y-4">
            <p className="text-gray-300 text-sm leading-snug">
              Regístrate para llevar el control de tus puntos y que nunca se pierdan.
            </p>

            {/* Nombre */}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                Nombre <span className="text-amber-400">*</span>
              </label>
              <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-xl px-3 py-3 focus-within:border-amber-500 transition-colors">
                <i className="ri-user-line text-gray-500 flex-shrink-0" />
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setError(''); }}
                  placeholder="Tu nombre completo"
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder:text-gray-600"
                  autoFocus
                />
              </div>
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                Celular <span className="text-amber-400">*</span>
              </label>
              <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-xl px-3 py-3 focus-within:border-amber-500 transition-colors">
                <i className="ri-smartphone-line text-gray-500 flex-shrink-0" />
                <input
                  type="tel"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setError(''); }}
                  placeholder="33 1234 5678"
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder:text-gray-600"
                />
              </div>
              <p className="text-gray-600 text-xs mt-1">Usamos tu cel para identificarte en tu próxima visita</p>
            </div>

            {/* Cumpleaños */}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                Fecha de nacimiento <span className="text-gray-600 font-normal normal-case">(opcional)</span>
              </label>
              <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-xl px-3 py-3 focus-within:border-amber-500 transition-colors">
                <i className="ri-cake-2-line text-gray-500 flex-shrink-0" />
                <input
                  type="date"
                  value={birthday}
                  onChange={e => setBirthday(e.target.value)}
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none [color-scheme:dark]"
                />
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm flex items-center gap-1.5">
                <i className="ri-error-warning-line" />{error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-black py-4 rounded-2xl text-base transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
            >
              {loading
                ? <><i className="ri-loader-4-line animate-spin" /> Registrando...</>
                : <><i className="ri-check-double-line" /> Crear mi tarjeta</>
              }
            </button>

            <button
              onClick={handleDismiss}
              className="w-full text-gray-600 hover:text-gray-400 text-sm cursor-pointer transition-colors py-1 text-center"
            >
              Ahora no, entrar sin puntos
            </button>
          </div>
        )}

        {/* ── YA REGISTRADO ── */}
        {step === 'already' && checkedIn && (
          <div className="px-6 py-6 space-y-4">
            {/* Avatar con inicial */}
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                <span className="text-white font-black text-2xl">{checkedIn.name.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-400 text-xs">Bienvenido de vuelta</p>
                <p className="text-white font-black text-lg leading-tight">{checkedIn.name}</p>
                <p className="text-gray-500 text-xs">{checkedIn.visit_count} visita{checkedIn.visit_count !== 1 ? 's' : ''} · {checkedIn.phone}</p>
              </div>
            </div>

            <PointsBar points={checkedIn.loyalty_points ?? 0} />

            <div className="bg-gray-900 rounded-2xl px-4 py-3 flex items-center gap-3">
              <i className="ri-information-line text-amber-400 text-lg flex-shrink-0" />
              <p className="text-gray-400 text-xs leading-snug">
                Tus puntos se actualizan automáticamente cada vez que el mesero cierra tu cuenta.
              </p>
            </div>

            <button
              onClick={handleDismiss}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-4 rounded-2xl text-base transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
            >
              <i className="ri-restaurant-line" /> Entrar al menú
            </button>

            <button
              onClick={handleContinueAsNew}
              className="w-full text-gray-600 hover:text-gray-400 text-sm cursor-pointer transition-colors py-1 text-center"
            >
              No soy yo, registrar otro número
            </button>
          </div>
        )}

        {/* ── ÉXITO ── */}
        {step === 'success' && checkedIn && (
          <div className="px-6 py-6 space-y-4">
            <div className="text-center py-2">
              <div className="w-16 h-16 bg-green-500/20 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-checkbox-circle-fill text-green-400 text-3xl" />
              </div>
              <h3 className="text-white text-xl font-black">
                {checkedIn.visit_count === 1 ? `¡Bienvenida, ${checkedIn.name.split(' ')[0]}!` : '¡Check-in registrado!'}
              </h3>
              <p className="text-gray-400 text-sm mt-1">
                {checkedIn.visit_count === 1
                  ? 'Tu tarjeta de lealtad está lista'
                  : `Visita #${checkedIn.visit_count} registrada hoy`}
              </p>
            </div>

            <PointsBar points={checkedIn.loyalty_points ?? 0} />

            <div className="bg-gray-900 rounded-2xl px-4 py-3 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-amber-400 text-lg font-black">{checkedIn.visit_count}</p>
                <p className="text-gray-500 text-xs">Visita{checkedIn.visit_count !== 1 ? 's' : ''}</p>
              </div>
              <div className="border-x border-gray-800">
                <p className="text-amber-400 text-lg font-black">{checkedIn.loyalty_points ?? 0}</p>
                <p className="text-gray-500 text-xs">Puntos</p>
              </div>
              <div>
                <p className="text-amber-400 text-lg font-black">${(checkedIn.total_spent ?? 0).toFixed(0)}</p>
                <p className="text-gray-500 text-xs">Total gastado</p>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-4 rounded-2xl text-base transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
            >
              <i className="ri-restaurant-line" /> Ver menú y pedir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}