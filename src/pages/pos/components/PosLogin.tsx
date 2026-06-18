import { useState } from 'react';

interface PosLoginProps {
  onLogin: () => void;
}

const POS_PASSWORD = '2016';

const WAITER_OPTIONS = [
  { value: 'Edgar', label: 'Edgar' },
  { value: 'Nallely', label: 'Nallely' },
  { value: 'Irma', label: 'Irma' },
  { value: 'Gerente', label: 'Gerente' },
  { value: 'Otro', label: 'Otro...' },
];

export default function PosLogin({ onLogin }: PosLoginProps) {
  const [password, setPassword] = useState('');
  const [waiterName, setWaiterName] = useState('');
  const [waiterCustom, setWaiterCustom] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === POS_PASSWORD) {
      const resolvedName = waiterName === 'Otro' ? waiterCustom.trim() : waiterName;
      if (!resolvedName) {
        setError(true);
        setShake(true);
        setTimeout(() => setShake(false), 500);
        return;
      }
      sessionStorage.setItem('pos_auth', '1');
      sessionStorage.setItem('pos_waiter_name', resolvedName);
      onLogin();
    } else {
      setError(true);
      setShake(true);
      setPassword('');
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-amber-500 rounded-2xl flex items-center justify-center">
            <i className="ri-store-3-line text-3xl text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">La Cabrona POS</h1>
          <p className="text-gray-400 text-sm mt-1">Sistema de Punto de Venta</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className={`bg-gray-900 rounded-2xl p-6 border border-gray-800 ${shake ? 'animate-pulse' : ''}`}
        >
          {/* Nombre del mesero */}
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            ¿Quién atiende?
          </label>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {WAITER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setWaiterName(opt.value)}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
                  waiterName === opt.value
                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                }`}
              >
                <i className={`ri-user-line ${waiterName === opt.value ? 'text-amber-600' : 'text-gray-500'}`} />
                {opt.label}
              </button>
            ))}
          </div>
          {waiterName === 'Otro' && (
            <input
              type="text"
              value={waiterCustom}
              onChange={(e) => setWaiterCustom(e.target.value)}
              placeholder="Escribe tu nombre..."
              autoFocus
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 mb-3"
            />
          )}

          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Contraseña de acceso
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false); }}
            placeholder="••••••••"
            className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all ${
              error ? 'border-red-500' : 'border-gray-700'
            }`}
          />
          {error && (
            <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
              <i className="ri-error-warning-line" />
              Contraseña incorrecta o falta nombre
            </p>
          )}
          <button
            type="submit"
            className="w-full mt-4 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-login-box-line mr-2" />
            Entrar al Sistema
          </button>
        </form>

        <p className="text-center text-gray-600 text-xs mt-6">
          Solo para uso del personal autorizado
        </p>
      </div>
    </div>
  );
}