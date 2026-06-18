import { useState, useRef, useEffect } from 'react';

const ADMIN_PIN = 'Irmabar2016*';

interface AdminLoginProps {
  onLogin: () => void;
}

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      onLogin();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => {
        setPin('');
        setShake(false);
        setError(false);
        inputRef.current?.focus();
      }, 700);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-10 text-center">
        <div className="w-16 h-16 flex items-center justify-center bg-amber-500 rounded-2xl mx-auto mb-3">
          <i className="ri-store-3-line text-white text-3xl" />
        </div>
        <h1 className="text-white text-xl font-black tracking-tight">La Cabrona</h1>
        <p className="text-gray-500 text-sm mt-0.5">Panel Administrador</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2 text-center">
            Contraseña de acceso
          </label>
          <div className={`relative transition-all ${shake ? 'animate-bounce' : ''}`}>
            <input
              ref={inputRef}
              type={showPin ? 'text' : 'password'}
              value={pin}
              onChange={e => { setPin(e.target.value); setError(false); }}
              placeholder="Ingresa tu contraseña"
              autoComplete="current-password"
              className={`w-full px-4 py-3.5 pr-11 bg-gray-800 border-2 rounded-xl text-white placeholder-gray-600 text-sm font-medium focus:outline-none transition-all ${
                error
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-gray-700 focus:border-amber-500'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPin(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-300 cursor-pointer transition-colors"
            >
              <i className={showPin ? 'ri-eye-off-line' : 'ri-eye-line'} />
            </button>
          </div>
          {error && (
            <p className="text-red-400 text-xs mt-2 text-center font-medium flex items-center justify-center gap-1">
              <i className="ri-error-warning-line" />
              Contraseña incorrecta, intenta de nuevo
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={pin.length === 0}
          className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-xl cursor-pointer transition-all active:scale-95 whitespace-nowrap"
        >
          <i className="ri-login-box-line mr-2" />
          Entrar al Panel
        </button>
      </form>

      <p className="text-gray-700 text-xs mt-10">Acceso restringido · La Cabrona Alitas</p>
    </div>
  );
}