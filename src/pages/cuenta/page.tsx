import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabasePos } from '@/pages/pos/supabasePos';
import { saveAccountToHistory, updateAccountInHistory } from '@/hooks/useAccountHistory';
import { getLoyaltyCustomerFromStorage } from '@/hooks/useLoyaltyCustomer';
import { useActiveAccount, getActiveAccount } from '@/hooks/useActiveAccount';
import { usePersistentCustomer, getActiveCustomer } from '@/hooks/usePersistentCustomer';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { REWARD_TIERS } from '@/hooks/useLoyaltyRewards';
import PaidTicket from './components/PaidTicket';

// ── Compresor de imagen para recibos ──
function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 800;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285';

interface AccountItem {
  id: number;
  product_name: string;
  size?: string;
  quantity: number;
  unit_price: number;
  folio_number: number;
  delivered: boolean;
  created_at: string;
}

interface Account {
  id: number;
  spot: string;
  area: string;
  customer_name?: string;
  customer_phone?: string;
  status: 'open' | 'closed';
  folio_counter: number;
  created_at: string;
  closed_at?: string;
  pos_account_items: AccountItem[];
}

interface PosPayment {
  id: number;
  payment_method: string;
  subtotal: number;
  card_fee: number | null;
  total: number;
  split_count: number | null;
  mixed_payments: Array<{ method: string; amount: number }> | null;
  created_at: string;
}

interface ToastNotif {
  id: string;
  message: string;
  type: 'new_item' | 'delivered' | 'closed';
}

const TIP_OPTIONS = [
  { label: 'Sin propina', pct: 0 },
  { label: '10%', pct: 10 },
  { label: '15%', pct: 15 },
  { label: '20%', pct: 20 },
];

const PAYMENT_METHODS = [
  { id: 'efectivo', label: 'Efectivo', icon: 'ri-money-dollar-circle-line', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/50' },
  { id: 'tarjeta', label: 'Tarjeta', icon: 'ri-bank-card-line', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/50' },
  { id: 'transferencia', label: 'Transferencia', icon: 'ri-exchange-funds-line', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/50' },
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function useElapsed(createdAt?: string) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!createdAt) return;
    const update = () => {
      const diff = Date.now() - new Date(createdAt).getTime();
      if (Number.isNaN(diff)) { setElapsed(''); return; }
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(mins / 60);
      setElapsed(hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`);
    };
    update();
    const iv = setInterval(update, 30000);
    return () => clearInterval(iv);
  }, [createdAt]);
  return elapsed;
}

// ── Toast de notificación ──
function ToastBanner({ toasts, onDismiss }: { toasts: ToastNotif[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  const t = toasts[0];
  const colors: Record<ToastNotif['type'], string> = {
    new_item: 'bg-amber-500',
    delivered: 'bg-green-600',
    closed: 'bg-gray-700',
  };
  const icons: Record<ToastNotif['type'], string> = {
    new_item: 'ri-add-circle-fill',
    delivered: 'ri-checkbox-circle-fill',
    closed: 'ri-receipt-line',
  };
  return (
    <div className="fixed top-4 left-4 right-4 z-50 flex flex-col gap-2">
      <div
        className={`${colors[t.type]} text-white px-4 py-3.5 rounded-2xl flex items-center gap-3`}
        style={{ animation: 'slideDown 0.35s ease-out' }}
      >
        <i className={`${icons[t.type]} text-xl flex-shrink-0`} />
        <p className="flex-1 text-sm font-bold leading-snug">{t.message}</p>
        <button onClick={() => onDismiss(t.id)} className="flex-shrink-0 cursor-pointer opacity-80 hover:opacity-100">
          <i className="ri-close-line text-lg" />
        </button>
      </div>
    </div>
  );
}

// ── Push Notifications Prompt ──
interface PushPromptProps {
  supported: boolean;
  permission: 'granted' | 'denied' | 'default';
  subscribed: boolean;
  loading: boolean;
  error: string | null;
  onRequestPermission: () => Promise<boolean>;
  onSubscribe: () => Promise<boolean>;
}

function PushNotificationPrompt({ supported, permission, subscribed, loading, error, onRequestPermission, onSubscribe }: PushPromptProps) {
  if (!supported || subscribed) return null;

  const handleActivate = async () => {
    if (permission !== 'granted') {
      const granted = await onRequestPermission();
      if (!granted) return;
    }
    await onSubscribe();
  };

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
      <div className="px-4 py-3.5 flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
          <i className="ri-notification-3-line text-amber-400 text-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-bold leading-tight">
            {permission === 'denied'
              ? 'Notificaciones bloqueadas'
              : 'Activa notificaciones push'}
          </p>
          <p className="text-gray-500 text-xs mt-0.5 leading-snug">
            {permission === 'denied'
              ? 'Habilita las notificaciones en la configuración de tu navegador para recibir alertas.'
              : 'Te avisamos cuando tu pedido esté listo o tu cuenta se cierre.'}
          </p>
          {error && (
            <p className="text-red-400 text-xs mt-1">{error}</p>
          )}
        </div>
        {permission !== 'denied' && (
          <button
            onClick={handleActivate}
            disabled={loading}
            className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-black cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5"
          >
            {loading ? (
              <><i className="ri-loader-4-line animate-spin" />Activando...</>
            ) : (
              <><i className="ri-notification-3-fill" />Activar</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Banner "Agregar al inicio" ──
function AddToHomePrompt() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-expect-error — iOS Safari
    window.navigator.standalone === true;

  useEffect(() => {
    if (dismissed || isInStandalone) return;
    const alreadyDismissed = sessionStorage.getItem('add-home-dismissed');
    if (alreadyDismissed) { setDismissed(true); return; }
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    if (isIOS) {
      const timer = setTimeout(() => setShow(true), 2500);
      return () => { clearTimeout(timer); window.removeEventListener('beforeinstallprompt', handler); };
    }
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [dismissed, isInStandalone, isIOS]);

  if (!show || dismissed || isInStandalone) return null;

  const handleInstall = async () => {
    if (deferredPrompt) {
      // @ts-expect-error — prompt is on BeforeInstallPromptEvent
      await deferredPrompt.prompt();
      setShow(false);
    }
    handleDismiss();
  };

  const handleDismiss = () => {
    sessionStorage.setItem('add-home-dismissed', '1');
    setDismissed(true);
    setShow(false);
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40">
      <div className="bg-gray-800 border border-amber-500/40 rounded-2xl p-4 flex gap-3 items-start">
        <img src={LOGO_URL} alt="La Cabrona" title="La Cabrona Alitas & Beer" className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-bold leading-snug">Agregar a tu pantalla de inicio</p>
          <p className="text-gray-400 text-xs mt-1 leading-snug">
            {isIOS
              ? 'Toca el ícono de compartir y luego "Agregar a pantalla de inicio"'
              : 'Ábrela como app en tu celular para verla más rápido'}
          </p>
          {!isIOS && (
            <button
              onClick={handleInstall}
              className="mt-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-add-line mr-1" />Agregar app
            </button>
          )}
        </div>
        <button onClick={handleDismiss} className="text-gray-500 hover:text-white cursor-pointer flex-shrink-0 mt-0.5">
          <i className="ri-close-line text-lg" />
        </button>
      </div>
    </div>
  );
}

// ── Llamar al mesero ──
function CallWaiterButton({ spot, accountId }: { spot?: string; accountId?: number }) {
  const [status, setStatus] = useState<'idle' | 'calling' | 'sent'>('idle');

  const handleCall = async () => {
    if (status !== 'idle') return;
    setStatus('calling');
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    try {
      await supabasePos.from('waiter_requests').insert({
        account_id: accountId ?? null,
        spot: spot ?? null,
        request_type: 'call_waiter',
        status: 'pending',
        notes: 'El cliente solicita atención en su mesa',
      });
    } catch (_) {/* silencioso */}
    setTimeout(() => setStatus('sent'), 1200);
    setTimeout(() => setStatus('idle'), 6000);
  };

  return (
    <div className="px-1">
      <button
        onClick={handleCall}
        disabled={status !== 'idle'}
        className={`w-full flex items-center justify-center gap-3 rounded-2xl py-5 font-black text-base uppercase tracking-wide transition-all cursor-pointer whitespace-nowrap ${
          status === 'sent'
            ? 'bg-green-600/20 border-2 border-green-500 text-green-400'
            : status === 'calling'
            ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-300 animate-pulse'
            : 'bg-gray-900 border-2 border-amber-500 text-amber-400 hover:bg-amber-500/10 active:scale-95'
        }`}
      >
        {status === 'sent' ? (
          <><i className="ri-checkbox-circle-fill text-2xl" />¡Mesero en camino!</>
        ) : status === 'calling' ? (
          <><i className="ri-wireless-charging-line text-2xl animate-bounce" />Llamando...</>
        ) : (
          <>
            <i className="ri-hand-heart-line text-2xl" />
            Llamar al mesero
            {spot && <span className="text-xs font-semibold opacity-60 ml-1">· {spot}</span>}
          </>
        )}
      </button>
    </div>
  );
}

// ── Sección de Propina y Forma de Pago ──
interface TipPaymentSectionProps {
  subtotal: number;
  selectedTip: number;
  onTipChange: (pct: number) => void;
  selectedPayment: string;
  onPaymentChange: (id: string) => void;
  receiptUrl: string | null;
  onReceiptChange: (url: string | null) => void;
}

function TipPaymentSection({ subtotal, selectedTip, onTipChange, selectedPayment, onPaymentChange, receiptUrl, onReceiptChange }: TipPaymentSectionProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tipAmount = subtotal * (selectedTip / 100);
  const grandTotal = subtotal + tipAmount;

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
      {/* Propina */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-amber-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
            <i className="ri-hand-coin-line text-amber-400 text-base" />
          </div>
          <p className="text-white font-black text-sm uppercase tracking-wide">¿Dejar propina?</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {TIP_OPTIONS.map(opt => (
            <button
              key={opt.pct}
              onClick={() => onTipChange(opt.pct)}
              className={`py-2.5 rounded-xl text-sm font-black cursor-pointer transition-all active:scale-95 whitespace-nowrap ${
                selectedTip === opt.pct
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {selectedTip > 0 && (
          <div className="mt-3 flex items-center justify-between bg-amber-500/10 rounded-xl px-3 py-2.5">
            <span className="text-amber-300 text-xs font-semibold">Propina {selectedTip}%</span>
            <span className="text-amber-400 font-black text-base">+${tipAmount.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Forma de pago */}
      <div className="px-4 pt-3 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-green-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
            <i className="ri-secure-payment-line text-green-400 text-base" />
          </div>
          <p className="text-white font-black text-sm uppercase tracking-wide">Forma de pago</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {PAYMENT_METHODS.map(pm => (
            <button
              key={pm.id}
              onClick={() => onPaymentChange(pm.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold cursor-pointer transition-all active:scale-95 whitespace-nowrap ${
                selectedPayment === pm.id
                  ? `${pm.bg} ${pm.color} border-opacity-100`
                  : 'bg-gray-800 text-gray-500 border-gray-700 hover:bg-gray-700'
              }`}
            >
              <i className={`${pm.icon} text-base`} />
              {pm.label}
            </button>
          ))}
        </div>

        {/* Datos de transferencia bancaria */}
        {selectedPayment === 'transferencia' && (
          <div className="mt-4 bg-amber-500/5 border border-amber-500/30 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-amber-500/20 flex items-center gap-2">
              <div className="w-7 h-7 bg-amber-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="ri-bank-line text-amber-400 text-sm" />
              </div>
              <p className="text-amber-300 text-xs font-black uppercase tracking-wide">Datos para transferencia</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Banco</span>
                <span className="text-white text-sm font-bold">Inbursa</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Titular</span>
                <span className="text-white text-sm font-bold">Irma Leal</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Núm. de cuenta</span>
                <span className="text-white text-sm font-bold">50032820985</span>
              </div>
              <div className="bg-amber-500/10 rounded-xl p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-amber-300 text-xs font-semibold uppercase tracking-wide mb-1">CLABE Interbancaria</p>
                  <p className="text-white text-base font-mono font-bold tracking-wider break-all">0363 2050 0328 2098 50</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('036320500328209850');
                    alert('CLABE copiada al portapapeles');
                  }}
                  className="flex-shrink-0 w-9 h-9 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                >
                  <i className="ri-file-copy-line text-base" />
                </button>
              </div>
              <p className="text-gray-600 text-xs leading-relaxed">
                <i className="ri-information-line text-amber-500 mr-1" />
                Realiza la transferencia y muéstrale el comprobante al mesero al momento de pagar.
              </p>

              {/* ── Subir comprobante ── */}
              <div className="border-t border-amber-500/20 pt-3.5 mt-1">
                <p className="text-amber-300 text-xs font-semibold uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                  <i className="ri-camera-line text-sm" />
                  Adjuntar comprobante
                </p>

                {receiptUrl ? (
                  <div className="space-y-2.5">
                    <div className="relative rounded-xl overflow-hidden bg-black/40 border border-amber-500/30">
                      <img
                        src={receiptUrl}
                        alt="Comprobante de transferencia"
                        className="w-full h-48 object-contain"
                      />
                      <button
                        onClick={() => onReceiptChange(null)}
                        className="absolute top-2 right-2 w-8 h-8 bg-red-500/80 hover:bg-red-600 rounded-full flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <i className="ri-close-line text-white text-sm" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
                      <span className="text-green-400 text-xs font-semibold">Comprobante adjuntado</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploading(true);
                        try {
                          const reader = new FileReader();
                          const dataUrl = await new Promise<string>((resolve, reject) => {
                            reader.onload = (ev) => resolve(ev.target?.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(file);
                          });
                          const compressed = await compressImage(dataUrl);
                          const { data, error } = await supabasePos.functions.invoke('upload-receipt', {
                            body: { dataUrl: compressed },
                          });
                          if (error) throw error;
                          const uploadedUrl = data?.url ?? compressed;
                          onReceiptChange(uploadedUrl);
                        } catch {
                          // silencioso
                        } finally {
                          setUploading(false);
                          e.target.value = '';
                        }
                      }}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl border-2 border-dashed border-amber-500/40 hover:border-amber-400 bg-amber-500/5 hover:bg-amber-500/10 text-amber-300 hover:text-amber-200 text-sm font-bold cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-wait whitespace-nowrap"
                    >
                      {uploading ? (
                        <>
                          <i className="ri-loader-4-line animate-spin text-base" />
                          Subiendo comprobante...
                        </>
                      ) : (
                        <>
                          <i className="ri-camera-line text-base" />
                          Tomar foto o subir captura
                        </>
                      )}
                    </button>
                    <p className="text-center text-gray-600 text-[10px]">
                      Adjunta una foto de la transferencia para agilizar el cobro
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Total con propina */}
      {selectedTip > 0 && (
        <div className="mx-4 mb-4 bg-gray-800 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-xs">Consumo</p>
            <p className="text-gray-400 text-sm font-bold">${subtotal.toFixed(2)}</p>
          </div>
          <i className="ri-add-line text-gray-600" />
          <div className="text-right">
            <p className="text-gray-500 text-xs">Propina</p>
            <p className="text-amber-400 text-sm font-bold">${tipAmount.toFixed(2)}</p>
          </div>
          <i className="ri-equal-line text-gray-600" />
          <div className="text-right">
            <p className="text-gray-500 text-xs">Total</p>
            <p className="text-white text-base font-black">${grandTotal.toFixed(2)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dividir la cuenta ──
interface SplitBillSectionProps {
  total: number;
  tipAmount: number;
}

function SplitBillSection({ total, tipAmount }: SplitBillSectionProps) {
  const [splitCount, setSplitCount] = useState(2);
  const [open, setOpen] = useState(false);

  const grandTotal = total + tipAmount;
  const perPerson = grandTotal / splitCount;

  const quickOptions = [2, 3, 4, 5, 6];

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
      {/* Header colapsable */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-4 cursor-pointer active:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-cyan-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
            <i className="ri-group-line text-cyan-400 text-base" />
          </div>
          <div className="text-left">
            <p className="text-white font-black text-sm uppercase tracking-wide">Dividir la cuenta</p>
            {!open && (
              <p className="text-gray-500 text-xs mt-0.5">Toca para calcular por persona</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!open && (
            <span className="text-cyan-400 text-xs font-bold bg-cyan-500/15 px-2.5 py-1 rounded-full whitespace-nowrap">
              ÷ {splitCount} personas
            </span>
          )}
          {open
            ? <i className="ri-arrow-up-s-line text-gray-500 text-lg" />
            : <i className="ri-arrow-down-s-line text-gray-500 text-lg" />
          }
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-800">
          {/* Opciones rápidas */}
          <div className="pt-3 mb-3">
            <p className="text-gray-400 text-xs mb-2">¿Cuántas personas pagan?</p>
            <div className="flex gap-2 flex-wrap">
              {quickOptions.map(n => (
                <button
                  key={n}
                  onClick={() => setSplitCount(n)}
                  className={`w-12 h-12 rounded-xl text-base font-black cursor-pointer transition-all active:scale-90 flex items-center justify-center whitespace-nowrap ${
                    splitCount === n
                      ? 'bg-cyan-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Ajuste manual con +/- */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setSplitCount(v => Math.max(2, v - 1))}
              disabled={splitCount <= 2}
              className="w-10 h-10 rounded-xl bg-gray-800 text-white text-xl font-black cursor-pointer hover:bg-gray-700 active:scale-90 transition-all disabled:opacity-30 flex items-center justify-center"
            >
              <i className="ri-subtract-line" />
            </button>
            <div className="flex-1 text-center">
              <span className="text-white text-2xl font-black">{splitCount}</span>
              <span className="text-gray-500 text-sm ml-1.5">persona{splitCount !== 1 ? 's' : ''}</span>
            </div>
            <button
              onClick={() => setSplitCount(v => Math.min(20, v + 1))}
              disabled={splitCount >= 20}
              className="w-10 h-10 rounded-xl bg-gray-800 text-white text-xl font-black cursor-pointer hover:bg-gray-700 active:scale-90 transition-all disabled:opacity-30 flex items-center justify-center"
            >
              <i className="ri-add-line" />
            </button>
          </div>

          {/* Resultado */}
          <div className="bg-cyan-500/10 border border-cyan-500/40 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-cyan-300 text-xs font-semibold uppercase tracking-wide">Cada persona paga</p>
                <p className="text-cyan-400 text-5xl font-black mt-1 leading-none">${perPerson.toFixed(2)}</p>
              </div>
              <div className="w-14 h-14 bg-cyan-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                <i className="ri-user-line text-cyan-400 text-3xl" />
              </div>
            </div>

            {/* Mini desglose */}
            <div className="border-t border-cyan-500/20 pt-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Total consumo</span>
                <span className="text-gray-400 font-semibold">${total.toFixed(2)}</span>
              </div>
              {tipAmount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Propina incluida</span>
                  <span className="text-amber-400 font-semibold">+${tipAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs pt-1 border-t border-gray-700">
                <span className="text-gray-400 font-semibold">Total a dividir</span>
                <span className="text-white font-black">${grandTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs pt-1">
                <span className="text-gray-500">{grandTotal.toFixed(2)} ÷ {splitCount}</span>
                <span className="text-cyan-300 font-black text-sm">${perPerson.toFixed(2)} c/u</span>
              </div>
            </div>
          </div>

          {/* Tarjetas individuales */}
          {splitCount <= 8 && (
            <div className="mt-3">
              <p className="text-gray-500 text-xs mb-2">Resumen por persona:</p>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: splitCount }, (_, i) => (
                  <div key={i} className="bg-gray-800 rounded-xl p-2.5 text-center">
                    <div className="w-7 h-7 bg-cyan-500/20 rounded-lg flex items-center justify-center mx-auto mb-1.5">
                      <i className="ri-user-smile-line text-cyan-400 text-sm" />
                    </div>
                    <p className="text-gray-400 text-xs">#{i + 1}</p>
                    <p className="text-white text-sm font-black">${perPerson.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Nota del cliente ──
const NOTE_SUGGESTIONS = [
  'Traer cambio exacto',
  'División en dos tarjetas',
  'División entre tres personas',
  'Pago por transferencia',
  'Esperar unos minutos',
];

interface CustomerNoteInputProps {
  value: string;
  onChange: (v: string) => void;
}

function CustomerNoteInput({ value, onChange }: CustomerNoteInputProps) {
  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
      <div className="px-4 pt-4 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-purple-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
            <i className="ri-chat-1-line text-purple-400 text-base" />
          </div>
          <div>
            <p className="text-white font-black text-sm uppercase tracking-wide">Nota para el mesero</p>
            <p className="text-gray-500 text-xs mt-0.5">Opcional · Solo la ve el staff</p>
          </div>
        </div>

        {/* Sugerencias rápidas */}
        <div className="flex flex-wrap gap-2 mb-3">
          {NOTE_SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => onChange(value === s ? '' : s)}
              className={`text-xs px-3 py-2 rounded-full border font-semibold cursor-pointer transition-all active:scale-95 whitespace-nowrap ${
                value === s
                  ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Campo libre */}
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="O escribe tu propia nota..."
          rows={2}
          maxLength={200}
          className="w-full bg-gray-800 border border-gray-700 focus:border-purple-500 rounded-xl px-3 py-3 text-sm text-white placeholder-gray-600 resize-none outline-none transition-colors"
        />
        {value.length > 0 && (
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-gray-600 text-xs">{value.length}/200</span>
            <button
              onClick={() => onChange('')}
              className="text-gray-600 hover:text-red-400 text-xs cursor-pointer transition-colors"
            >
              <i className="ri-close-line mr-0.5" />Borrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pedir la cuenta ──
interface RequestCheckButtonProps {
  spot?: string;
  accountId?: number;
  total: number;
  tipPct: number;
  paymentMethod: string;
  customerName?: string;
  customerPhone?: string;
  customerNote?: string;
  receiptUrl?: string | null;
}

function RequestCheckButton({ spot, accountId, total, tipPct, paymentMethod, customerName, customerPhone, customerNote, receiptUrl }: RequestCheckButtonProps) {
  const [status, setStatus] = useState<'idle' | 'confirm' | 'sending' | 'sent'>('idle');
  const [requestId, setRequestId] = useState<number | null>(null);

  const tipAmount = total * (tipPct / 100);
  const grandTotal = total + tipAmount;
  const pmLabel = PAYMENT_METHODS.find(p => p.id === paymentMethod)?.label ?? paymentMethod;

  // Verificar si ya hay una solicitud de cuenta pendiente al montar
  useEffect(() => {
    if (!accountId && !spot) return;
    const checkExisting = async () => {
      let q = supabasePos.from('waiter_requests').select('id, created_at').eq('request_type', 'request_bill').eq('status', 'pending');
      if (accountId) q = q.eq('account_id', accountId);
      else if (spot) q = q.eq('spot', spot);
      const { data } = await q.order('created_at', { ascending: false }).limit(1);
      if (data && data.length > 0) {
        setRequestId(data[0].id);
        setStatus('sent');
      }
    };
    checkExisting();
  }, [accountId, spot]);

  const handleRequest = async () => {
    if (status === 'sent') return;
    if (status === 'idle') { setStatus('confirm'); return; }
    if (status === 'confirm') {
      setStatus('sending');
      if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
      try {
        const notes = [
          `Total consumo: $${total.toFixed(2)}`,
          tipPct > 0 ? `Propina ${tipPct}%: +$${tipAmount.toFixed(2)} = Total: $${grandTotal.toFixed(2)}` : null,
          `Forma de pago: ${pmLabel}`,
          customerName ? `Cliente: ${customerName}` : null,
          customerPhone ? `Tel: ${customerPhone}` : null,
          customerNote ? `Nota: ${customerNote}` : null,
        ].filter(Boolean).join(' · ');

        const { data, error } = await supabasePos.from('waiter_requests').insert({
          account_id: accountId ?? null,
          spot: spot ?? null,
          request_type: 'request_bill',
          status: 'pending',
          notes,
          receipt_url: receiptUrl ?? null,
        }).select('id');
        if (error) throw error;
        if (data && data[0]) setRequestId(data[0].id);
      } catch (_) {/* silencioso */}
      setStatus('sent');
    }
  };

  const handleCancelRequest = async () => {
    if (!requestId) return;
    try {
      await supabasePos.from('waiter_requests').update({ status: 'resolved' }).eq('id', requestId);
    } catch (_) {/* silencioso */}
    setStatus('idle');
    setRequestId(null);
  };

  const handleCancel = () => setStatus('idle');

  if (status === 'confirm') {
    return (
      <div className="px-1">
        <div className="bg-gray-900 border-2 border-green-500 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="ri-money-dollar-circle-line text-green-400 text-xl" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-black leading-tight">¿Confirmar cobro?</p>
              <p className="text-gray-400 text-xs mt-0.5">El mesero se acercará a tu mesa para cobrar</p>
            </div>
          </div>

          {/* Desglose */}
          <div className="bg-gray-800 rounded-xl px-4 py-3 mb-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Consumo</span>
              <span className="text-white text-sm font-bold">${total.toFixed(2)}</span>
            </div>
            {tipPct > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Propina ({tipPct}%)</span>
                <span className="text-amber-400 text-sm font-bold">+${tipAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-gray-700">
              <span className="text-gray-300 text-base font-bold">Total a pagar</span>
              <span className="text-white text-2xl font-black">${grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Forma de pago seleccionada */}
          <div className="flex items-center gap-2 bg-gray-800/60 rounded-xl px-3 py-2.5 mb-3">
            <i className={`${PAYMENT_METHODS.find(p => p.id === paymentMethod)?.icon ?? 'ri-money-dollar-circle-line'} text-amber-400 text-base`} />
            <span className="text-gray-300 text-sm font-semibold">{pmLabel}</span>
          </div>

          {/* Datos bancarios si es transferencia */}
          {paymentMethod === 'transferencia' && (
            <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-3.5 mb-3 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <i className="ri-bank-line text-amber-400 text-sm" />
                <span className="text-amber-300 text-xs font-black uppercase tracking-wide">Datos de cuenta</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Banco</span>
                <span className="text-gray-200 font-semibold">Inbursa</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Titular</span>
                <span className="text-gray-200 font-semibold">Irma Leal</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Cuenta</span>
                <span className="text-gray-200 font-semibold">50032820985</span>
              </div>
              <div className="bg-amber-500/10 rounded-lg px-3 py-2.5 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-amber-400 text-xs font-semibold mb-0.5">CLABE</p>
                  <p className="text-white text-xs font-mono font-bold tracking-wider">0363 2050 0328 2098 50</p>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText('036320500328209850')}
                  className="flex-shrink-0 w-7 h-7 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg flex items-center justify-center cursor-pointer transition-colors ml-2"
                >
                  <i className="ri-file-copy-line text-sm" />
                </button>
              </div>
            </div>
          )}

          {/* Nota del cliente */}
          {customerNote && (
            <div className="flex items-start gap-2 bg-purple-500/10 border border-purple-500/30 rounded-xl px-3 py-2.5 mb-4">
              <i className="ri-chat-1-line text-purple-400 text-base flex-shrink-0 mt-0.5" />
              <span className="text-purple-300 text-sm italic leading-snug">{customerNote}</span>
            </div>
          )}

          {/* Comprobante adjunto */}
          {receiptUrl && (
            <div className="bg-green-500/5 border border-green-500/30 rounded-xl p-3 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <i className="ri-check-double-fill text-green-400 text-sm" />
                <span className="text-green-300 text-xs font-black uppercase tracking-wide">Comprobante adjunto</span>
              </div>
              <img
                src={receiptUrl}
                alt="Comprobante de transferencia"
                className="w-full h-32 object-contain rounded-lg bg-black/30"
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 text-sm font-bold cursor-pointer hover:bg-gray-800 transition-colors whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              onClick={handleRequest}
              className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-black cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-checkbox-circle-fill mr-1.5" />
              Sí, cerrar cuenta
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'sent') {
    return (
      <div className="px-1 space-y-3">
        <div className="bg-green-600/15 border-2 border-green-500 rounded-2xl px-5 py-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center flex-shrink-0">
            <i className="ri-checkbox-circle-fill text-white text-2xl" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-green-400 font-black text-base leading-tight">¡Cuenta solicitada!</p>
            <p className="text-green-600 text-xs mt-1 leading-snug">
              El mesero se acercará · Pago: {pmLabel}
              {tipPct > 0 ? ` · Propina: ${tipPct}%` : ''}
              {receiptUrl ? ' · Con comprobante' : ''}
            </p>
          </div>
          <p className="text-white font-black text-xl flex-shrink-0">${grandTotal.toFixed(2)}</p>
        </div>
        {receiptUrl && (
          <div className="bg-gray-900 border border-green-500/30 rounded-2xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <i className="ri-check-double-fill text-green-400 text-sm" />
              <span className="text-green-300 text-xs font-bold">Comprobante enviado al staff</span>
            </div>
            <img
              src={receiptUrl}
              alt="Comprobante de transferencia"
              className="w-full h-28 object-contain rounded-lg bg-black/30"
            />
          </div>
        )}
        <button
          onClick={handleCancelRequest}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-700 text-gray-400 hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/10 text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
        >
          <i className="ri-close-circle-line text-base" />
          Cancelar solicitud
        </button>
      </div>
    );
  }

  return (
    <div className="px-1">
      <button
        onClick={handleRequest}
        disabled={status === 'sending'}
        className="w-full flex items-center justify-center gap-3 rounded-2xl py-5 font-black text-lg uppercase tracking-wide transition-all cursor-pointer whitespace-nowrap bg-green-600/15 border-2 border-green-500 text-green-400 hover:bg-green-600/25 active:scale-95 disabled:opacity-60"
      >
        {status === 'sending' ? (
          <><i className="ri-loader-4-line animate-spin text-xl" /> Enviando...</>
        ) : (
          <>
            <i className="ri-money-dollar-circle-line text-2xl" />
            Cerrar cuenta
            {spot && <span className="text-sm font-semibold opacity-60 ml-1">· {spot}</span>}
          </>
        )}
      </button>
      <p className="text-center text-gray-600 text-xs mt-2">El mesero sabrá que quieres pagar</p>
    </div>
  );
}

// ── Botón: Volver al menú / Nueva cuenta ──
function BackToMenuButton({ isClosed, menuUrl }: { isClosed: boolean; menuUrl: string }) {
  return (
    <Link to={menuUrl || '/menu'} className="block w-full">
      <div className="bg-gray-900 border-2 border-amber-500/60 hover:border-amber-400 active:scale-95 rounded-2xl px-5 py-4 flex items-center gap-4 transition-all cursor-pointer">
        <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center flex-shrink-0">
          <i className="ri-restaurant-line text-white text-2xl" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-base leading-tight">
            {isClosed ? 'Abrir nueva cuenta' : 'Seguir pidiendo'}
          </p>
          <p className="text-gray-400 text-xs mt-0.5">
            {isClosed
              ? 'Ve al menú y comienza un nuevo pedido'
              : 'Ve al menú para agregar más productos a tu cuenta'}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-amber-400 text-sm font-bold whitespace-nowrap">Menú</span>
          <i className="ri-arrow-right-s-line text-amber-400 text-xl" />
        </div>
      </div>
    </Link>
  );
}

// ── Ticket: enviar por WhatsApp o correo ──
const WA_NUMBER = '523348567795';

interface TicketShareSectionProps {
  account: Account;
  items: AccountItem[];
  total: number;
  tipPct?: number;
  paymentMethod?: string;
  customerName?: string;
}

function buildTicketText(
  account: Account,
  items: AccountItem[],
  total: number,
  tipPct = 0,
  paymentMethod = '',
): string {
  const date = new Date().toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const tipAmount = total * (tipPct / 100);
  const grandTotal = total + tipAmount;
  const pmLabel = PAYMENT_METHODS.find(p => p.id === paymentMethod)?.label ?? paymentMethod;

  const folios = [...new Set(items.map(i => i.folio_number))].sort((a, b) => a - b);

  const lines: string[] = [
    '🍗 LA CABRONA — Alitas & Beer',
    '─────────────────────────',
    `Mesa: ${account.spot}`,
    `Fecha: ${date}`,
    '─────────────────────────',
  ];

  folios.forEach(folio => {
    const folioItems = items.filter(i => i.folio_number === folio);
    lines.push(`Ronda #${String(folio).padStart(2, '0')}`);
    folioItems.forEach(it => {
      const sub = (it.unit_price * it.quantity).toFixed(2);
      lines.push(`  ${it.quantity > 1 ? `${it.quantity}x ` : ''}${it.product_name}  $${sub}`);
    });
  });

  lines.push('─────────────────────────');
  lines.push(`Consumo:  $${total.toFixed(2)}`);
  if (tipPct > 0) {
    lines.push(`Propina ${tipPct}%: +$${tipAmount.toFixed(2)}`);
    lines.push(`TOTAL:  $${grandTotal.toFixed(2)}`);
  } else {
    lines.push(`TOTAL:  $${total.toFixed(2)}`);
  }
  if (pmLabel) lines.push(`Pago: ${pmLabel}`);
  lines.push('─────────────────────────');
  lines.push('¡Gracias por tu visita! 🍺');
  lines.push('barlacabrona.com');

  return lines.join('\n');
}

function TicketShareSection({ account, items, total, tipPct = 0, paymentMethod = '', customerName }: TicketShareSectionProps) {
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);

  const ticketText = buildTicketText(account, items, total, tipPct, paymentMethod);
  const tipAmount = total * (tipPct / 100);
  const grandTotal = total + tipAmount;

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(ticketText);
    window.open(`https://wa.me/${WA_NUMBER}?text=${msg}`, '_blank', 'noopener');
  };

  const handleSelfWhatsApp = () => {
    const msg = encodeURIComponent(ticketText);
    window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ticketText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* noop */ }
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`Mi cuenta en La Cabrona — ${account.spot} — $${grandTotal.toFixed(2)}`);
    const body = encodeURIComponent(ticketText);
    const recipient = emailInput.trim();
    window.open(`mailto:${recipient}?subject=${subject}&body=${body}`, '_self');
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 3000);
  };

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-800">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 bg-amber-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
            <i className="ri-file-list-3-line text-amber-400 text-base" />
          </div>
          <div>
            <p className="text-white font-black text-sm uppercase tracking-wide">Recibir mi ticket</p>
            <p className="text-gray-500 text-xs">Guarda el resumen de tu cuenta</p>
          </div>
        </div>
      </div>

      {/* Vista previa mini del ticket */}
      <div className="mx-4 mt-3 bg-gray-800 rounded-xl px-3 py-2.5 font-mono text-xs text-gray-400 leading-relaxed max-h-28 overflow-hidden relative">
        <p className="text-amber-400 font-bold">🍗 LA CABRONA</p>
        <p className="text-gray-500">Mesa: {account.spot}</p>
        {items.slice(0, 3).map(it => (
          <p key={it.id} className="truncate">
            {it.quantity > 1 ? `${it.quantity}x ` : ''}{it.product_name}
            <span className="text-amber-400 ml-1">${(it.unit_price * it.quantity).toFixed(2)}</span>
          </p>
        ))}
        {items.length > 3 && <p className="text-gray-600">... {items.length - 3} más</p>}
        <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-gray-800 to-transparent" />
      </div>
      <div className="flex items-center justify-between px-4 py-2 mb-1">
        <span className="text-gray-500 text-xs">{items.length} producto{items.length !== 1 ? 's' : ''}</span>
        <span className="text-amber-400 text-sm font-black">${grandTotal.toFixed(2)}</span>
      </div>

      {/* Botones de envío */}
      <div className="px-4 pb-4 space-y-2">
        {/* WhatsApp — enviar al bar (confirma pedido/pago) */}
        <button
          onClick={handleWhatsApp}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-green-600 hover:bg-green-700 active:scale-95 text-white rounded-xl text-sm font-black transition-all cursor-pointer whitespace-nowrap"
        >
          <i className="ri-whatsapp-line text-lg" />
          Enviar al bar por WhatsApp
        </button>

        {/* WhatsApp a mí mismo */}
        <button
          onClick={handleSelfWhatsApp}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-green-600/15 border border-green-600/40 hover:bg-green-600/25 active:scale-95 text-green-400 rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap"
        >
          <i className="ri-whatsapp-line text-lg" />
          Guardar en mi WhatsApp
        </button>

        {/* Email */}
        {!showEmailInput ? (
          <button
            onClick={() => setShowEmailInput(true)}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-gray-800 border border-gray-700 hover:bg-gray-700 active:scale-95 text-gray-300 hover:text-white rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap"
          >
            <i className="ri-mail-line text-base" />
            Enviar por correo electrónico
          </button>
        ) : (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 space-y-2">
            <p className="text-gray-400 text-xs font-semibold">Tu correo electrónico</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="flex-1 bg-gray-700 border border-gray-600 focus:border-amber-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-colors"
              />
              <button
                onClick={handleEmail}
                disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black rounded-lg cursor-pointer transition-colors whitespace-nowrap"
              >
                {emailSent ? <i className="ri-check-line" /> : <i className="ri-send-plane-fill" />}
              </button>
              <button
                onClick={() => { setShowEmailInput(false); setEmailInput(''); }}
                className="px-3 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-400 text-sm rounded-lg cursor-pointer transition-colors"
              >
                <i className="ri-close-line" />
              </button>
            </div>
            {emailSent && (
              <p className="text-green-400 text-xs flex items-center gap-1">
                <i className="ri-checkbox-circle-fill" /> ¡Listo! Revisa tu bandeja de entrada
              </p>
            )}
          </div>
        )}

        {/* Copiar texto */}
        <button
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-gray-600 hover:text-gray-400 text-xs font-semibold cursor-pointer transition-colors active:scale-95"
        >
          <i className={copied ? 'ri-check-line text-green-400' : 'ri-file-copy-line'} />
          <span className={copied ? 'text-green-400' : ''}>
            {copied ? '¡Ticket copiado al portapapeles!' : 'Copiar ticket como texto'}
          </span>
        </button>
      </div>
    </div>
  );
}

// ── Compartir cuenta ──
function ShareAccountButton({ accountId, spot }: { accountId?: number; spot?: string }) {
  const [copied, setCopied] = useState(false);
  if (!accountId) return null;
  const shareUrl = `${window.location.origin}/cuenta?id=${accountId}`;
  const handleShare = async () => {
    const text = `Mi cuenta en La Cabrona${spot ? ` — ${spot}` : ''}:\n${shareUrl}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Mi cuenta — La Cabrona', text, url: shareUrl }); return; } catch {/* fallback */}
    }
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch {/* noop */}
  };
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 pb-2">
      <Link to="/mis-cuentas" className="flex items-center gap-1.5 text-gray-600 hover:text-amber-400 text-xs transition-colors">
        <i className="ri-history-line" />Mis cuentas
      </Link>
      <span className="text-gray-700">·</span>
      <Link to="/mi-tarjeta" className="flex items-center gap-1.5 text-xs font-semibold text-amber-500 hover:text-amber-300 transition-colors">
        <i className="ri-vip-crown-2-line" />Mi tarjeta
      </Link>
      <span className="text-gray-700">·</span>
      <button
        onClick={handleShare}
        className={`flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors ${copied ? 'text-green-400' : 'text-gray-500 hover:text-amber-400'}`}
      >
        <i className={copied ? 'ri-check-line' : 'ri-share-line'} />
        {copied ? '¡Link copiado!' : 'Compartir'}
      </button>
    </div>
  );
}

export default function CuentaPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  // Las cuentas son vistas privadas/efímeras, no deben indexarse
  useEffect(() => {
    const existing = document.querySelector('meta[name="robots"]');
    if (existing) existing.remove();
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const originalTitle = document.title;
    document.title = 'Cuenta | La Cabrona';
    return () => {
      meta.remove();
      document.title = originalTitle;
    };
  }, []);

  const { activeAccount, setActiveAccount, clearActiveAccount } = useActiveAccount();
  const { profile: persistentProfile } = usePersistentCustomer();

  const rawMesa = params.get('mesa') || params.get('spot') || params.get('Mesa') || '';
  const spotParam = rawMesa.trim();
  const areaParam = params.get('area') || params.get('Area') || '';
  const accountIdParam = params.get('id') || '';
  const nombreParam = (params.get('nombre') || '').trim();

  const [account, setAccount] = useState<Account | null>(null);
  const pushNotif = usePushNotifications(account?.id ?? null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [toasts, setToasts] = useState<ToastNotif[]>([]);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [payment, setPayment] = useState<PosPayment | null>(null);

  // Propina, forma de pago y nota
  const [selectedTip, setSelectedTip] = useState(0);
  const [selectedPayment, setSelectedPayment] = useState('efectivo');
  const [customerNote, setCustomerNote] = useState('');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const elapsed = useElapsed(account?.created_at);
  const knownItemIds = useRef<Set<number>>(new Set());
  const knownDelivered = useRef<Set<number>>(new Set());
  const prevStatus = useRef<string>('');
  const isFirstLoad = useRef(true);
  const prevAccountId = useRef<string | number>('');

  // Resetear isFirstLoad cuando cambia la cuenta activa
  useEffect(() => {
    const currentKey = accountIdParam || spotParam || nombreParam || '';
    if (prevAccountId.current !== currentKey) {
      isFirstLoad.current = true;
      knownItemIds.current = new Set();
      knownDelivered.current = new Set();
      prevStatus.current = '';
      prevAccountId.current = currentKey;
    }
  }, [accountIdParam, spotParam, nombreParam]);

  // Datos del cliente desde loyalty storage
  const loyaltyCustomer = getLoyaltyCustomerFromStorage();
  const registeredName = account?.customer_name || loyaltyCustomer?.name || persistentProfile?.name || '';
  const registeredPhone = account?.customer_phone || loyaltyCustomer?.phone || persistentProfile?.phone || '';

  // Si no hay parámetros de URL, intentar redirigir a la cuenta activa guardada
  useEffect(() => {
    if (!spotParam && !areaParam && !accountIdParam && !nombreParam) {
      const saved = getActiveAccount();
      if (saved) {
        navigate(`/cuenta?id=${saved.accountId}`, { replace: true });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const safeSetToasts = useCallback((updater: (prev: ToastNotif[]) => ToastNotif[]) => {
    if (isMounted.current) setToasts(updater);
  }, []);

  const addToast = useCallback((type: ToastNotif['type'], message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    safeSetToasts(prev => [...prev.slice(-2), { id, message, type }]);
    setTimeout(() => { safeSetToasts(prev => prev.filter(t => t.id !== id)); }, 5000);
  }, [safeSetToasts]);

  const dismissToast = useCallback((id: string) => {
    safeSetToasts(prev => prev.filter(t => t.id !== id));
  }, [safeSetToasts]);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const safeSetAccount = useCallback((value: Account | null) => {
    if (isMounted.current) setAccount(value);
  }, []);
  const safeSetLoading = useCallback((value: boolean) => {
    if (isMounted.current) setLoading(value);
  }, []);
  const safeSetNotFound = useCallback((value: boolean) => {
    if (isMounted.current) setNotFound(value);
  }, []);
  const safeSetPayment = useCallback((value: PosPayment | null) => {
    if (isMounted.current) setPayment(value);
  }, []);
  const safeSetRefreshing = useCallback((value: boolean) => {
    if (isMounted.current) setRefreshing(value);
  }, []);
  const safeSetLastUpdated = useCallback((value: Date) => {
    if (isMounted.current) setLastUpdated(value);
  }, []);

  const fetchAccount = useCallback(async (silent = false) => {
    // Si no hay parámetros y hay cuenta guardada, esperar redirección — no mostrar "not found"
    const hasNoParams = !spotParam && !areaParam && !accountIdParam && !nombreParam;
    const hasSaved = !!getActiveAccount();
    if (hasNoParams && hasSaved) {
      safeSetLoading(true);
      return;
    }

    const possibleSpots = spotParam
      ? [spotParam, `Mesa ${spotParam}`, spotParam.replace(/^Mesa\s*/i, '')]
      : [];

    const findBySpot = async (spot: string, area?: string) => {
      let q = supabasePos
        .from('pos_accounts')
        .select('*, pos_account_items(*)')
        .eq('spot', spot)
        .order('created_at', { ascending: false })
        .limit(5);
      if (area) q = q.eq('area', area);
      const { data: rows } = await q;
      if (!rows || rows.length === 0) return null;
      return rows.find((r: Account) => r.status === 'open') ?? rows[0];
    };

    let data: Account | null = null;

    if (accountIdParam) {
      const { data: d } = await supabasePos
        .from('pos_accounts')
        .select('*, pos_account_items(*)')
        .eq('id', accountIdParam)
        .maybeSingle();
      data = d as Account | null;
    } else if (spotParam || areaParam) {
      if (spotParam) {
        data = await findBySpot(spotParam, areaParam || undefined);
        if (!data) {
          for (const altSpot of possibleSpots.slice(1)) {
            data = await findBySpot(altSpot, areaParam || undefined);
            if (data) break;
          }
        }
      } else {
        const { data: rows } = await supabasePos
          .from('pos_accounts')
          .select('*, pos_account_items(*)')
          .eq('area', areaParam)
          .order('created_at', { ascending: false })
          .limit(5);
        if (rows && rows.length > 0) {
          data = (rows as Account[]).find(r => r.status === 'open') ?? (rows[0] as Account);
        }
      }
    } else if (nombreParam) {
      const { data: rows } = await supabasePos
        .from('pos_accounts')
        .select('*, pos_account_items(*)')
        .ilike('customer_name', `%${nombreParam}%`)
        .order('status', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(5);
      if (rows && rows.length > 0) {
        data = (rows as Account[]).find((r: Account) => r.status === 'open') ?? (rows[0] as Account);
      }
    } else {
      safeSetNotFound(true);
      safeSetLoading(false);
      return;
    }

    if (data) {
      const sorted = {
        ...data,
        pos_account_items: [...(data.pos_account_items ?? [])].sort(
          (a: AccountItem, b: AccountItem) => a.folio_number - b.folio_number || a.id - b.id
        ),
      };
      const typedAccount = sorted as Account;

      if (!isFirstLoad.current) {
        const newItems = typedAccount.pos_account_items.filter(
          (it: AccountItem) => !knownItemIds.current.has(it.id)
        );
        if (newItems.length > 0) {
          const names = newItems.map((it: AccountItem) => it.product_name).join(', ');
          addToast('new_item', `¡Nueva ronda agregada! ${names}`);
        }
        const newlyDelivered = typedAccount.pos_account_items.filter(
          (it: AccountItem) => it.delivered && !knownDelivered.current.has(it.id)
        );
        if (newlyDelivered.length > 0 && newItems.length === 0) {
          addToast('delivered', `Tu pedido está listo y fue entregado`);
        }
        if (prevStatus.current === 'open' && typedAccount.status === 'closed') {
          addToast('closed', '¡Cuenta cerrada! Gracias por visitarnos');
          clearActiveAccount();
        }
      }

      typedAccount.pos_account_items.forEach((it: AccountItem) => {
        knownItemIds.current.add(it.id);
        if (it.delivered) knownDelivered.current.add(it.id);
      });
      prevStatus.current = typedAccount.status;
      safeSetAccount(typedAccount);
      safeSetNotFound(false);

      // Si la cuenta está cerrada, buscar el pago asociado
      if (typedAccount.status === 'closed') {
        const { data: paymentData } = await supabasePos
          .from('pos_payments')
          .select('id, payment_method, subtotal, card_fee, total, split_count, mixed_payments, created_at')
          .eq('account_id', typedAccount.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (paymentData) {
          safeSetPayment(paymentData as PosPayment);
        } else {
          safeSetPayment(null);
        }
      } else {
        safeSetPayment(null);
      }

      // Persistir cuenta activa para que el cliente pueda volver fácilmente
      setActiveAccount({
        accountId: typedAccount.id,
        spot: typedAccount.spot,
        area: typedAccount.area,
        customerName: typedAccount.customer_name || undefined,
        customerPhone: typedAccount.customer_phone || undefined,
      });

      const currentUrl = window.location.pathname + window.location.search;
      if (isFirstLoad.current) {
        saveAccountToHistory(
          { id: typedAccount.id, spot: typedAccount.spot, area: typedAccount.area, customer_name: typedAccount.customer_name, status: typedAccount.status },
          typedAccount.pos_account_items.reduce((s: number, i: AccountItem) => s + i.unit_price * i.quantity, 0),
          currentUrl,
        );
      } else {
        updateAccountInHistory(typedAccount.id, {
          lastTotal: typedAccount.pos_account_items.reduce((s: number, i: AccountItem) => s + i.unit_price * i.quantity, 0),
          lastStatus: typedAccount.status,
          lastSeen: new Date().toISOString(),
        });
      }
    } else {
      safeSetNotFound(true);
      safeSetPayment(null);
    }

    isFirstLoad.current = false;
    safeSetLastUpdated(new Date());
    safeSetLoading(false);
    if (!silent) safeSetRefreshing(false);
  }, [spotParam, areaParam, accountIdParam, nombreParam, addToast, clearActiveAccount, setActiveAccount, safeSetAccount, safeSetLoading, safeSetNotFound, safeSetPayment, safeSetLastUpdated, safeSetRefreshing]);

  const handleRefresh = useCallback(async () => {
    safeSetRefreshing(true);
    await fetchAccount(false);
  }, [fetchAccount, safeSetRefreshing]);

  useEffect(() => {
    fetchAccount(true);
    const channel = supabasePos
      .channel('cuenta-cliente-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_account_items' }, () => fetchAccount(true))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pos_accounts' }, () => fetchAccount(true))
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          // silent: el polling fallback cubre esto
        }
      });

    // Polling fallback cada 8s por si realtime falla
    const pollInterval = setInterval(() => fetchAccount(true), 8_000);

    return () => { supabasePos.removeChannel(channel); clearInterval(pollInterval); };
  }, [fetchAccount]);

  const items = account?.pos_account_items ?? [];
  const folios = [...new Set(items.map(i => i.folio_number))].sort((a, b) => a - b);
  const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const isClosed = account?.status === 'closed';
  const pendingItems = items.filter(i => !i.delivered).length;

  const buildMenuUrl = () => {
    const base = new URLSearchParams();
    if (spotParam) base.set('mesa', spotParam);
    else if (areaParam) base.set('area', areaParam);
    if (account?.id) base.set('volver_cuenta', String(account.id));
    const qs = base.toString();
    return qs ? `/menu?${qs}` : '/menu';
  };
  const menuUrl = buildMenuUrl();

  const slideStyle = `
    @keyframes slideDown {
      from { transform: translateY(-60px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-5 px-6">
        <style>{slideStyle}</style>
        <img src={LOGO_URL} alt="La Cabrona" title="La Cabrona Alitas & Beer" className="w-24 h-24 rounded-full object-cover border-2 border-amber-500" />
        <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-base">Buscando tu cuenta...</p>
      </div>
    );
  }

  if (notFound || !account) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-8 text-center gap-7">
        <style>{slideStyle}</style>
        <img src={LOGO_URL} alt="La Cabrona" title="La Cabrona Alitas & Beer" className="w-28 h-28 rounded-full object-cover border-2 border-amber-500" />
        <div>
          <p className="text-5xl mb-3">🍗</p>
          <h1 className="text-white text-2xl font-bold mb-3">No encontramos tu cuenta</h1>
          <p className="text-gray-400 text-base leading-relaxed">
            {accountIdParam
              ? 'No se encontró ninguna cuenta con ese identificador.'
              : nombreParam
              ? `No encontramos una cuenta abierta para "${nombreParam}". Pídele al mesero que la abra.`
              : spotParam
              ? `No hay una cuenta abierta en ${spotParam} en este momento.`
              : 'Busca tu cuenta por nombre o número de mesa.'}
          </p>
          {spotParam && <p className="text-gray-600 text-sm mt-2">Pídele al mesero que abra tu cuenta.</p>}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white px-7 py-4 rounded-2xl text-base font-bold transition-colors cursor-pointer whitespace-nowrap"
        >
          {refreshing
            ? <><i className="ri-loader-4-line animate-spin" /> Buscando...</>
            : <><i className="ri-refresh-line" /> Intentar de nuevo</>}
        </button>
        <Link to="/" className="flex items-center gap-2 text-gray-500 hover:text-white text-sm transition-colors">
          <i className="ri-home-line" />Ver menú
        </Link>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-950 select-none ${panelCollapsed ? 'pb-96' : 'pb-[32rem]'}`}>
      <style>{slideStyle}</style>

      <ToastBanner toasts={toasts} onDismiss={dismissToast} />
      <PushNotificationPrompt
        supported={pushNotif.supported}
        permission={pushNotif.permission}
        subscribed={pushNotif.subscribed}
        loading={pushNotif.loading}
        error={pushNotif.error}
        onRequestPermission={pushNotif.requestPermission}
        onSubscribe={pushNotif.subscribe}
      />
      <AddToHomePrompt />

      {/* ── Header fijo ── */}
      <div className="bg-gray-900 border-b border-gray-800 px-5 pt-10 pb-5 sticky top-0 z-10">
        <div className="flex items-center gap-4 mb-5">
          <img
            src={LOGO_URL}
            alt="La Cabrona"
            title="La Cabrona Alitas & Beer"
            className="w-12 h-12 rounded-full object-cover border-2 border-amber-500 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h1
              className="text-white font-bold text-lg leading-tight"
              style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.08em' }}
            >
              LA CABRONA
            </h1>
            <p className="text-amber-500 text-xs font-bold tracking-widest">Alitas &amp; Beer</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`w-2.5 h-2.5 rounded-full ${isClosed ? 'bg-gray-500' : 'bg-green-400 animate-pulse'}`} />
            <span className={`text-sm font-bold ${isClosed ? 'text-gray-500' : 'text-green-400'}`}>
              {isClosed ? 'Cerrada' : 'En vivo'}
            </span>
          </div>
        </div>

        {/* Resumen de mesa — con nombre y teléfono */}
        <div className="bg-gray-800 rounded-2xl px-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Tu mesa</p>
              <p className="text-white text-4xl font-black leading-tight truncate">{account.spot}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Total</p>
              <p className="text-5xl font-black text-amber-400 leading-tight">${total.toFixed(2)}</p>
              <p className="text-gray-500 text-xs mt-1">{totalQty} producto{totalQty !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Datos del cliente */}
          {(registeredName || registeredPhone) && (
            <div className="flex flex-wrap gap-3 py-2.5 border-t border-gray-700">
              {registeredName && (
                <span className="flex items-center gap-1.5 text-amber-300 text-sm font-semibold">
                  <span className="w-6 h-6 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className="ri-user-line text-amber-400 text-xs" />
                  </span>
                  {registeredName}
                </span>
              )}
              {registeredPhone && (
                <span className="flex items-center gap-1.5 text-gray-300 text-sm">
                  <span className="w-6 h-6 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className="ri-smartphone-line text-gray-400 text-xs" />
                  </span>
                  {registeredPhone}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-4 mt-1 pt-2.5 border-t border-gray-700 flex-wrap">
            <span className="text-gray-400 text-xs flex items-center gap-1">
              <i className="ri-time-line" />
              Desde {formatTime(account.created_at)}
            </span>
            {elapsed && (
              <span className="text-gray-400 text-xs flex items-center gap-1">
                <i className="ri-history-line" />
                {elapsed} en el bar
              </span>
            )}
            <span className="text-amber-500 text-xs font-bold">
              {folios.length} ronda{folios.length !== 1 ? 's' : ''}
            </span>
            {pendingItems > 0 && (
              <span className="text-amber-400 text-xs font-bold flex items-center gap-1">
                <i className="ri-loader-2-line animate-spin" />
                {pendingItems} en camino
              </span>
            )}
          </div>
        </div>

        {isClosed && (
          <div className="mt-3 bg-green-900/40 border border-green-700 rounded-2xl px-4 py-3 flex items-center gap-3">
            <i className="ri-checkbox-circle-fill text-green-400 text-2xl flex-shrink-0" />
            <div>
              <p className="text-green-400 font-bold text-sm">Cuenta cerrada</p>
              <p className="text-green-500 text-xs mt-0.5">Tu pago fue procesado. ¡Gracias por visitarnos!</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Contenido ── */}
      <div className="px-4 pt-5 space-y-4">

        {items.length === 0 && (
          <div className="text-center py-20">
            <p className="text-6xl mb-5">🍗</p>
            <p className="text-gray-400 text-lg">Aún no has pedido nada</p>
            <p className="text-gray-600 text-sm mt-2">Pídele al mesero tu primera ronda</p>
          </div>
        )}

        {/* ── Rondas ── */}
        {folios.map((folio, idx) => {
          const folioItems = items.filter(i => i.folio_number === folio);
          const folioTotal = folioItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
          const allDelivered = folioItems.every(i => i.delivered);
          const isLast = idx === folios.length - 1;
          const folioTime = folioItems[0]?.created_at ? formatTime(folioItems[0].created_at) : '';

          return (
            <div key={folio} className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
              <div className={`flex items-center justify-between px-4 py-3.5 border-b border-gray-800 ${
                allDelivered ? 'bg-green-900/25' : isLast ? 'bg-amber-900/25' : ''
              }`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-black px-3 py-1.5 rounded-full ${
                    allDelivered ? 'bg-green-500 text-white' : isLast ? 'bg-amber-500 text-white' : 'bg-gray-700 text-gray-300'
                  }`}>
                    Ronda #{String(folio).padStart(2, '0')}
                  </span>
                  {allDelivered && (
                    <span className="text-green-400 text-sm font-semibold flex items-center gap-1">
                      <i className="ri-checkbox-circle-fill" /> Entregada
                    </span>
                  )}
                  {isLast && !allDelivered && (
                    <span className="text-amber-400 text-sm font-semibold flex items-center gap-1">
                      <i className="ri-loader-2-line animate-spin" /> En camino
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {folioTime && <span className="text-gray-500 text-xs">{folioTime}</span>}
                  <span className={`font-black text-base ${
                    allDelivered ? 'text-green-400' : isLast ? 'text-amber-400' : 'text-gray-300'
                  }`}>
                    ${folioTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="divide-y divide-gray-800/80">
                {folioItems.map(item => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-4">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.delivered ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {item.delivered
                        ? <i className="ri-check-line text-base" />
                        : <i className="ri-time-line text-base" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-base font-semibold leading-snug ${item.delivered ? 'text-gray-500' : 'text-white'}`}>
                        {item.quantity > 1 && (
                          <span className="text-amber-400 font-black mr-1">{item.quantity}&times;</span>
                        )}
                        {item.product_name}
                      </p>
                      {item.size && (
                        <p className="text-xs mt-1 flex items-start gap-1">
                          <i className="ri-chat-quote-line text-amber-400 flex-shrink-0 mt-0.5" />
                          <span className="text-amber-300 italic leading-snug">{item.size}</span>
                        </p>
                      )}
                    </div>
                    <p className={`text-base font-black flex-shrink-0 ${item.delivered ? 'text-gray-600' : 'text-white'}`}>
                      ${(item.unit_price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* ── Resumen total (más grande) ── */}
        {items.length > 0 && (
          <div className="bg-amber-500 rounded-2xl px-5 py-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-amber-900 text-xs font-black uppercase tracking-widest">Total de tu cuenta</p>
                <p className="text-white text-6xl font-black mt-1 leading-none">${total.toFixed(2)}</p>
                <p className="text-amber-200 text-sm mt-2">
                  {folios.length} ronda{folios.length !== 1 ? 's' : ''} · {totalQty} producto{totalQty !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 ml-4">
                <i className="ri-receipt-line text-white text-5xl" />
              </div>
            </div>
            {!isClosed && (
              <p className="text-amber-100 text-sm mt-4 pt-4 border-t border-amber-400 flex items-start gap-2">
                <i className="ri-information-line flex-shrink-0 mt-0.5" />
                <span>Este total se actualiza automáticamente cuando pides más.</span>
              </p>
            )}
          </div>
        )}

        {/* ── Botón Pedir más ── */}
        {!isClosed && (
          <BackToMenuButton isClosed={isClosed} menuUrl={menuUrl} />
        )}

        {/* ── Botón nueva cuenta (cuenta cerrada) ── */}
        {isClosed && (
          <BackToMenuButton isClosed={isClosed} menuUrl={menuUrl} />
        )}

        {/* ── Mini banner de lealtad ── */}
        {(() => {
          if (!loyaltyCustomer) return null;
          const pts = loyaltyCustomer.loyalty_points ?? 0;
          const nextTier = REWARD_TIERS.find(t => pts < t.points);
          const unlockedTier = [...REWARD_TIERS].reverse().find(t => pts >= t.points);
          return (
            <Link
              to="/mi-tarjeta"
              className={`flex items-center gap-3 rounded-2xl px-4 py-4 border cursor-pointer transition-all active:scale-95 ${
                unlockedTier
                  ? 'bg-green-900/20 border-green-500/60 hover:border-green-400'
                  : 'bg-amber-900/20 border-amber-500/40 hover:border-amber-400'
              }`}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                unlockedTier ? 'bg-green-500/20' : 'bg-amber-500/20'
              }`}>
                <i className={`ri-vip-crown-2-fill text-xl ${unlockedTier ? 'text-green-400' : 'text-amber-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-black ${unlockedTier ? 'text-green-400' : 'text-amber-400'}`}>
                  {unlockedTier ? `¡Tienes un premio para canjear! ${unlockedTier.emoji}` : `Mi tarjeta de lealtad`}
                </p>
                <p className="text-gray-500 text-xs mt-0.5">
                  {unlockedTier
                    ? `${pts} pts · Toca para ver y canjear tu premio`
                    : nextTier
                    ? `${pts} pts · Faltan ${nextTier.points - pts} pts para ${nextTier.emoji} ${nextTier.title}`
                    : `${pts} puntos acumulados`}
                </p>
              </div>
              <i className="ri-arrow-right-s-line text-gray-500 text-xl flex-shrink-0" />
            </Link>
          );
        })()}

        {/* Botón recargar */}
        <div className="flex items-center justify-center pt-1">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm cursor-pointer transition-colors disabled:opacity-40 py-2 px-4 rounded-xl active:bg-gray-800"
          >
            <i className={`ri-refresh-line ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing
              ? 'Actualizando...'
              : `Actualizado ${lastUpdated.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`}
          </button>
        </div>

        {/* ── Botón llamar al mesero ── */}
        {!isClosed && (
          <CallWaiterButton spot={account?.spot} accountId={account?.id} />
        )}

        {/* ── DIVIDIR LA CUENTA ── */}
        {!isClosed && items.length > 0 && (
          <SplitBillSection
            total={total}
            tipAmount={total * (selectedTip / 100)}
          />
        )}

        {/* ── PROPINA Y FORMA DE PAGO (solo si hay items y cuenta abierta) ── */}
        {!isClosed && items.length > 0 && (
          <TipPaymentSection
            subtotal={total}
            selectedTip={selectedTip}
            onTipChange={setSelectedTip}
            selectedPayment={selectedPayment}
            onPaymentChange={setSelectedPayment}
            receiptUrl={receiptUrl}
            onReceiptChange={setReceiptUrl}
          />
        )}

        {/* ── Nota para el mesero ── */}
        {!isClosed && items.length > 0 && (
          <CustomerNoteInput value={customerNote} onChange={setCustomerNote} />
        )}

        {/* ── Botón pedir la cuenta ── */}
        {!isClosed && items.length > 0 && (
          <RequestCheckButton
            spot={account?.spot}
            accountId={account?.id}
            total={total}
            tipPct={selectedTip}
            paymentMethod={selectedPayment}
            customerName={registeredName}
            customerPhone={registeredPhone}
            customerNote={customerNote}
            receiptUrl={receiptUrl}
          />
        )}

        {/* ── Ticket pagado (cuenta cerrada) ── */}
        {isClosed && payment && (
          <PaidTicket
            spot={account.spot}
            customerName={account.customer_name || registeredName || undefined}
            items={items}
            payment={payment}
          />
        )}

        <ShareAccountButton accountId={account?.id} spot={account?.spot} />
        <TicketShareSection
          account={account!}
          items={items}
          total={total}
          tipPct={selectedTip}
          paymentMethod={selectedPayment}
          customerName={registeredName}
        />
      </div>

      {/* ── Flotante de acciones ── */}
      {panelCollapsed ? (
        <button
          onClick={() => setPanelCollapsed(false)}
          className="fixed bottom-36 right-4 z-20 bg-gray-900 border border-gray-700/80 rounded-full px-4 py-3 flex items-center gap-2 shadow-2xl cursor-pointer active:scale-95 transition-transform"
        >
          <span className={`w-2 h-2 rounded-full ${isClosed ? 'bg-gray-500' : 'bg-green-400 animate-pulse'}`} />
          <span className="text-white font-black text-sm">${total.toFixed(2)}</span>
          <i className="ri-arrow-up-s-line text-gray-400 text-lg" />
        </button>
      ) : (
        <div className="fixed bottom-36 left-4 right-4 z-20" style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.5))' }}>
          {!isClosed ? (
            <div className="bg-gray-900 border border-gray-700/80 rounded-3xl overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Cuenta abierta</span>
                </div>
                <div className="flex items-center gap-2">
                  {pendingItems > 0 && (
                    <span className="flex items-center gap-1 text-amber-400 text-xs font-bold bg-amber-500/15 px-2.5 py-1 rounded-full">
                      <i className="ri-loader-2-line animate-spin text-xs" />
                      {pendingItems} en camino
                    </span>
                  )}
                  <span className="text-white text-xl font-black">${total.toFixed(2)}</span>
                  <button
                    onClick={() => setPanelCollapsed(true)}
                    className="ml-1 w-7 h-7 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 cursor-pointer transition-colors"
                  >
                    <i className="ri-arrow-down-s-line text-lg" />
                  </button>
                </div>
              </div>
              <div className="flex gap-2.5 px-3 py-3">
                <Link
              to={menuUrl || '/menu'}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-2xl text-sm font-black transition-colors whitespace-nowrap"
            >
              <i className="ri-add-circle-fill text-base" />
              Pedir más
            </Link>
                <a
                  href="https://wa.me/523348567795"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3.5 px-4 bg-green-600/20 border border-green-600/50 hover:bg-green-600/30 text-green-400 rounded-2xl text-sm font-bold transition-colors whitespace-nowrap"
                >
                  <i className="ri-whatsapp-line text-base" />
                  Llamar
                </a>
                <Link
                  to="/menu"
                  className="flex items-center justify-center gap-2 py-3.5 px-4 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-400 hover:text-white rounded-2xl text-sm font-bold transition-colors whitespace-nowrap"
                >
                  <i className="ri-restaurant-line text-base" />
                  Menú
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-700/80 rounded-3xl overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <i className="ri-checkbox-circle-fill text-green-400 text-base" />
                  <span className="text-green-400 text-xs font-bold uppercase tracking-wide">Cuenta cerrada</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white text-xl font-black">${total.toFixed(2)}</span>
                  <button
                    onClick={() => setPanelCollapsed(true)}
                    className="ml-1 w-7 h-7 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 cursor-pointer transition-colors"
                  >
                    <i className="ri-arrow-down-s-line text-lg" />
                  </button>
                </div>
              </div>
              <div className="flex gap-2.5 px-3 py-3">
                <a
                  href="https://wa.me/523348567795"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-2xl text-sm font-black transition-colors whitespace-nowrap"
                >
                  <i className="ri-whatsapp-line text-base" />
                  Contactar por WhatsApp
                </a>
                <Link
                  to="/menu"
                  className="flex items-center justify-center gap-2 py-3.5 px-5 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 hover:text-white rounded-2xl text-sm font-bold transition-colors whitespace-nowrap"
                >
                  <i className="ri-restaurant-line text-base" />
                  Menú
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}