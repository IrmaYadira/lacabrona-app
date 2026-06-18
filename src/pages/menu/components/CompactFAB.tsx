import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCart } from '@/pages/home/context/CartContext';
import { supabasePos } from '@/pages/pos/supabasePos';
import { useLoyaltyCustomer } from '@/hooks/useLoyaltyCustomer';
import SelfieCameraModal from './SelfieCameraModal';
import CheckRequestModal from './CheckRequestModal';
import QuickOrderModal from './QuickOrderModal';

type WaiterStatus = 'idle' | 'uploading' | 'sending' | 'sent' | 'error';
type RequestType = 'call' | 'check';

interface PromoSemana {
  id: number;
  dia_semana: number;
  titulo: string;
  descripcion: string;
  detalle: string;
  horario: string;
  badge: string;
  badge_color: string;
  icon: string;
  imagen_url: string;
  activo: boolean;
}

const COLOR_MAP: Record<string, { bgFrom: string; bgTo: string; textColor: string; borderColor: string; badgeBg: string }> = {
  'bg-amber-500':  { bgFrom: 'from-amber-900/95',  bgTo: 'to-gray-900/95',  textColor: 'text-amber-300',  borderColor: 'border-amber-700/60', badgeBg: 'bg-amber-500' },
  'bg-red-500':    { bgFrom: 'from-red-900/95',    bgTo: 'to-gray-900/95',  textColor: 'text-red-300',    borderColor: 'border-red-700/60', badgeBg: 'bg-red-500' },
  'bg-orange-500': { bgFrom: 'from-orange-900/95', bgTo: 'to-gray-900/95',  textColor: 'text-orange-300', borderColor: 'border-orange-700/60', badgeBg: 'bg-orange-500' },
  'bg-yellow-600': { bgFrom: 'from-yellow-900/95', bgTo: 'to-gray-900/95',  textColor: 'text-yellow-300', borderColor: 'border-yellow-700/60', badgeBg: 'bg-yellow-600' },
  'bg-green-600':  { bgFrom: 'from-green-900/95',  bgTo: 'to-gray-900/95',  textColor: 'text-green-300',  borderColor: 'border-green-700/60', badgeBg: 'bg-green-600' },
  'bg-pink-500':   { bgFrom: 'from-pink-900/95',   bgTo: 'to-gray-900/95',  textColor: 'text-pink-300',   borderColor: 'border-pink-700/60', badgeBg: 'bg-pink-500' },
};
const DEFAULT_STYLE = { bgFrom: 'from-amber-900/95', bgTo: 'to-gray-900/95', textColor: 'text-amber-300', borderColor: 'border-amber-700/60', badgeBg: 'bg-amber-500' };

const DIAS_NOMBRE = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DISMISS_KEY = 'lc_promo_dia_dismissed_v2';

function getDismissedDate(): string {
  try { return localStorage.getItem(DISMISS_KEY) ?? ''; } catch { return ''; }
}
function setDismissedToday(): void {
  try { localStorage.setItem(DISMISS_KEY, new Date().toDateString()); } catch { /* noop */ }
}

const LAST_SELFIE_KEY = 'lastWaiterSelfieCompact';
const SELFIE_EXPIRY_MS = 30 * 60 * 1000;

function getStoredSelfie(): string | null {
  try {
    const raw = localStorage.getItem(LAST_SELFIE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.url !== 'string' || typeof parsed.timestamp !== 'number') return null;
    if (Date.now() - parsed.timestamp > SELFIE_EXPIRY_MS) {
      localStorage.removeItem(LAST_SELFIE_KEY);
      return null;
    }
    return parsed.url;
  } catch { return null; }
}

function storeSelfie(url: string) {
  try { localStorage.setItem(LAST_SELFIE_KEY, JSON.stringify({ url, timestamp: Date.now() })); } catch { /* noop */ }
}

export default function CompactFAB() {
  const { itemCount, total, setIsOpen, customerName, orderMode, tableNumber } = useCart();
  const [params] = useSearchParams();
  const mesa = params.get('mesa') || params.get('spot') || '';
  const area = params.get('area') || '';
  const volverCuentaId = params.get('volver_cuenta');

  const { customer: loyaltyCustomer } = useLoyaltyCustomer();

  // ── Panel states ──
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [wiggle, setWiggle] = useState(false);
  const prevItemCount = useRef(0);
  const ref = useRef<HTMLDivElement>(null);

  // ── Modals ──
  const [showSelfie, setShowSelfie] = useState(false);
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [showQuickOrder, setShowQuickOrder] = useState(false);
  const [showMesaInput, setShowMesaInput] = useState(false);
  const [mesaInput, setMesaInput] = useState('');

  // ── Waiter request state ──
  const [waiterStatus, setWaiterStatus] = useState<WaiterStatus>('idle');
  const pendingRequestType = useRef<RequestType>('call');
  const lastRequestType = useRef<RequestType>('call');
  const lastErrorMessage = useRef('');

  // ── Promo del día ──
  const [promo, setPromo] = useState<PromoSemana | null>(null);
  const [promoVisible, setPromoVisible] = useState(false);
  const [promoDismissed, setPromoDismissed] = useState(false);

  const noContext = !mesa && !area && !volverCuentaId;
  const spot = String(tableNumber || '').trim() || mesa || area || String(customerName || '').trim() || 'Menú Digital';
  const loyaltySelfie = loyaltyCustomer?.selfie_url ?? null;

  // ── Mount animation ──
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 800);
    return () => clearTimeout(t);
  }, []);

  // ── Wiggle on item add ──
  useEffect(() => {
    if (itemCount > prevItemCount.current && prevItemCount.current >= 0) {
      setWiggle(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setWiggle(true));
      });
      const t = setTimeout(() => setWiggle(false), 600);
      prevItemCount.current = itemCount;
      return () => clearTimeout(t);
    }
    prevItemCount.current = itemCount;
    return undefined;
  }, [itemCount]);

  const handleWiggleDone = useCallback(() => setWiggle(false), []);

  // ── Close on outside click ──
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── Reset waiter status on close ──
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        if (waiterStatus !== 'sending' && waiterStatus !== 'sent') {
          setWaiterStatus('idle');
        }
      }, 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open, waiterStatus]);

  // ── Promo del día ──
  useEffect(() => {
    if (getDismissedDate() === new Date().toDateString()) {
      setPromoDismissed(true);
      return;
    }
    const todayDia = new Date().getDay();
    const fetchPromo = async () => {
      const { data } = await supabase
        .from('promos_semana')
        .select('*')
        .eq('dia_semana', todayDia)
        .eq('activo', true)
        .is('deleted_at', null)
        .maybeSingle();
      if (!data) return;
      setPromo(data as PromoSemana);
      const t = setTimeout(() => setPromoVisible(true), 1800);
      return () => clearTimeout(t);
    };
    fetchPromo();
  }, []);

  const handlePromoDismiss = () => {
    setPromoVisible(false);
    setDismissedToday();
    setTimeout(() => setPromoDismissed(true), 400);
  };

  // ── Waiter request logic ──
  const sendWaiterRequest = useCallback(async (requestType: RequestType, photoUrl?: string | null) => {
    if (waiterStatus === 'sent' || waiterStatus === 'sending' || waiterStatus === 'uploading') return;
    lastRequestType.current = requestType;
    setWaiterStatus('sending');
    if (navigator.vibrate) navigator.vibrate([100, 60, 100]);

    const dbRequestType = requestType === 'call' ? 'call_waiter' : 'request_bill';
    const name = String(customerName || '').trim() || null;

    try {
      const { error } = await supabasePos.from('waiter_requests').insert({
        account_id: volverCuentaId ? Number(volverCuentaId) : null,
        spot,
        area: area || 'menu-digital',
        request_type: dbRequestType,
        status: 'pending',
        notes: requestType === 'check'
          ? 'El cliente solicita la cuenta desde el menú digital'
          : 'El cliente necesita atención desde el menú digital',
        photo_url: photoUrl ?? null,
        customer_name: name,
      });
      if (error) {
        console.error('[CompactFAB] Supabase insert error:', error);
        lastErrorMessage.current = error.message || 'Error de base de datos';
        throw error;
      }
      setWaiterStatus('sent');
      setTimeout(() => setWaiterStatus('idle'), 6000);
    } catch (err) {
      console.error('[CompactFAB] sendWaiterRequest exception:', err);
      if (!lastErrorMessage.current) {
        lastErrorMessage.current = err instanceof Error ? err.message : 'Error de conexión';
      }
      setWaiterStatus('error');
      setTimeout(() => {
        setWaiterStatus('idle');
        lastErrorMessage.current = '';
      }, 5000);
    }
  }, [waiterStatus, volverCuentaId, spot, area, customerName]);

  // ── Handle actions from panel ──
  const handleCallWaiter = () => {
    setOpen(false);
    // Si tiene selfie guardada del loyalty, usarla directamente
    if (loyaltySelfie) {
      sendWaiterRequest('call', loyaltySelfie);
      return;
    }
    const stored = getStoredSelfie();
    if (stored) {
      sendWaiterRequest('call', stored);
      return;
    }
    // Si no hay mesa en URL, pedir número
    if (noContext) {
      pendingRequestType.current = 'call';
      setShowMesaInput(true);
      return;
    }
    pendingRequestType.current = 'call';
    setShowSelfie(true);
  };

  const handleCheckRequest = () => {
    setOpen(false);
    if (noContext) {
      pendingRequestType.current = 'check';
      setShowMesaInput(true);
      return;
    }
    setShowCheckModal(true);
  };

  const handleCheckWithSelfie = () => {
    setShowCheckModal(false);
    pendingRequestType.current = 'check';
    setShowSelfie(true);
  };

  const handleCheckWithoutSelfie = async () => {
    setShowCheckModal(false);
    await sendWaiterRequest('check', undefined);
  };

  const handleMesaSubmit = () => {
    const mesaFinal = mesaInput.trim();
    if (!mesaFinal) return;
    setShowMesaInput(false);
    pendingRequestType.current = 'call';
    setShowSelfie(true);
  };

  const handleSelfieCapture = async (photoDataUrl: string) => {
    setShowSelfie(false);
    setWaiterStatus('uploading');

    try {
      const { data, error } = await supabasePos.functions.invoke('upload-selfie', {
        body: { dataUrl: photoDataUrl },
      });
      if (error || !data?.url) {
        console.error('[CompactFAB] upload-selfie error:', error);
        lastErrorMessage.current = error?.message || 'Error al subir la foto';
        await sendWaiterRequest(pendingRequestType.current, undefined);
        return;
      }
      storeSelfie(data.url as string);
      await sendWaiterRequest(pendingRequestType.current, data.url as string);
    } catch (err) {
      console.error('[CompactFAB] handleSelfieCapture exception:', err);
      lastErrorMessage.current = err instanceof Error ? err.message : 'Error al procesar la foto';
      await sendWaiterRequest(pendingRequestType.current, undefined);
    }
  };

  const handleSelfieCancel = () => {
    setShowSelfie(false);
    sendWaiterRequest(pendingRequestType.current, null);
  };

  // ── Computed styles ──
  const modeLabel = orderMode === 'dine-in' ? 'Comer aquí' : 'Para llevar';
  const modeIcon = orderMode === 'dine-in' ? 'ri-restaurant-line' : 'ri-shopping-bag-3-line';
  const fabBg = open ? '#374151' : itemCount > 0 ? '#f59e0b' : '#111827';
  const promoStyle = promo ? (COLOR_MAP[promo.badge_color] ?? DEFAULT_STYLE) : DEFAULT_STYLE;
  const showPromo = promo && promoVisible && !promoDismissed;

  return (
    <>
      <style>{`
        @keyframes cFabUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cFabBounceIn {
          0%   { opacity: 0; transform: scale(0.3) translateY(40px); }
          50%  { opacity: 1; transform: scale(1.15) translateY(-6px); }
          70%  { transform: scale(0.92) translateY(2px); }
          85%  { transform: scale(1.05) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes cFabPulseRing {
          0%   { transform: scale(1); opacity: 0.6; }
          70%  { transform: scale(1.7); opacity: 0; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        @keyframes cFabWiggle {
          0%,100% { transform: rotate(0deg); }
          20%     { transform: rotate(-12deg); }
          40%     { transform: rotate(12deg); }
          60%     { transform: rotate(-8deg); }
          80%     { transform: rotate(6deg); }
        }
        @keyframes cBadgePop {
          0%   { transform: scale(0); }
          60%  { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        .cfab-bounce-in  { animation: cFabBounceIn 0.65s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .cfab-panel-anim { animation: cFabUp 0.2s ease-out forwards; }
        .cfab-scale:active { transform: scale(0.95); }
        .cfab-btn-hover:hover { filter: brightness(1.1); }
        .cfab-pulse-ring {
          position: absolute; inset: 0; border-radius: 50%;
          background: #f59e0b;
          animation: cFabPulseRing 2s ease-out infinite;
          pointer-events: none;
        }
        .cfab-wiggle { animation: cFabWiggle 0.5s ease-in-out; }
        .cbadge-pop { animation: cBadgePop 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      `}</style>

      {/* ── Main container ── */}
      <div
        ref={ref}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '16px',
          zIndex: 2147483647,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '8px',
        }}
      >
        {/* ── Promo del día chip (fuera del panel, arriba del FAB) ── */}
        {showPromo && !open && (
          <button
            onClick={() => {
              handlePromoDismiss();
              setOpen(true);
            }}
            className="cfab-panel-anim"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px 8px 8px',
              borderRadius: '16px',
              border: `1px solid ${promoStyle.borderColor.replace('border-', '')}`,
              background: `linear-gradient(135deg, var(--tw-gradient-from), var(--tw-gradient-to))`,
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: 32, height: 32,
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <i className={`${promo.icon} text-white text-base`} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '1px' }}>
                <span style={{
                  fontSize: 9, fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  background: promoStyle.badgeBg,
                  color: '#fff',
                  padding: '1px 6px',
                  borderRadius: '999px',
                }}>
                  {promo.badge}
                </span>
                <span style={{ fontSize: 9, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>
                  {DIAS_NOMBRE[promo.dia_semana]}
                </span>
              </div>
              <p style={{ fontSize: 12, fontWeight: 900, color: '#f3f4f6', margin: 0, whiteSpace: 'nowrap' }}>
                {promo.titulo}
              </p>
            </div>
            <i className="ri-arrow-up-s-line text-gray-500 text-sm" />
          </button>
        )}

        {/* ── Panel desplegable ── */}
        {open && (
          <div
            className="cfab-panel-anim"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              alignItems: 'flex-end',
              marginBottom: '4px',
              maxWidth: '280px',
            }}
          >
            {/* Promo chip compacto dentro del panel expandido */}
            {showPromo && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #1f2937, #111827)',
                  border: `1px solid ${promoStyle.borderColor.replace('border-', '')}`,
                  width: '100%',
                }}
              >
                <i className={`${promo.icon} ${promoStyle.textColor} text-base`} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 9, fontWeight: 900, background: promoStyle.badgeBg, color: '#fff', padding: '1px 6px', borderRadius: '999px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {promo.badge} · {DIAS_NOMBRE[promo.dia_semana]}
                  </span>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#d1d5db', marginTop: '2px' }}>
                    {promo.titulo}
                  </p>
                </div>
                <button
                  onClick={handlePromoDismiss}
                  style={{ color: '#6b7280', fontSize: 14, cursor: 'pointer' }}
                >
                  <i className="ri-close-line" />
                </button>
              </div>
            )}

            {/* Session info chip */}
            {customerName.trim() && (
              <div style={{
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '14px',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#4ade80', flexShrink: 0,
                }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {customerName}
                  </p>
                  <p style={{ fontSize: 10, color: '#9ca3af', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <i className={modeIcon} style={{ fontSize: 10 }} />
                    {modeLabel}{spot !== customerName ? ` · ${spot}` : ''}
                  </p>
                </div>
              </div>
            )}

            {/* ── Quick order button ── */}
            <button
              onClick={() => { setShowQuickOrder(true); setOpen(false); }}
              className="cfab-btn-hover cfab-scale"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: '#111827',
                color: '#fff',
                padding: '12px 18px 12px 14px',
                borderRadius: '14px',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                width: '100%',
                boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
              }}
            >
              <div style={{ width: 30, height: 30, background: '#f59e0b', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="ri-send-plane-fill" style={{ color: '#fff', fontSize: 14 }} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: 13, fontWeight: 900, margin: 0 }}>Ya sé qué pedir</p>
                {itemCount > 0 ? (
                  <p style={{ fontSize: 10, color: '#fbbf24', fontWeight: 600, margin: 0 }}>
                    {itemCount} prod · ${Number(total).toFixed(2)}
                  </p>
                ) : (
                  <p style={{ fontSize: 10, color: '#6b7280', margin: 0 }}>Buscar y agregar rápido</p>
                )}
              </div>
              {itemCount > 0 && (
                <span style={{ marginLeft: 'auto', background: '#f59e0b', color: '#fff', fontSize: 10, fontWeight: 900, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </button>

            {/* ── Continue ordering ── */}
            <button
              onClick={() => setOpen(false)}
              className="cfab-btn-hover cfab-scale"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: '#f9fafb',
                border: '2px solid #e5e7eb',
                color: '#374151',
                padding: '11px 18px 11px 14px',
                borderRadius: '14px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                width: '100%',
              }}
            >
              <div style={{ width: 30, height: 30, background: '#f3f4f6', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="ri-add-circle-line" style={{ color: '#4b5563', fontSize: 14 }} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>Seguir ordenando</p>
                <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>Explorar el menú completo</p>
              </div>
            </button>

            {/* ── Divider ── */}
            <div style={{ height: 1, width: '80%', background: '#e5e7eb' }} />

            {/* ── Call waiter ── */}
            <button
              onClick={handleCallWaiter}
              disabled={waiterStatus === 'uploading' || waiterStatus === 'sending' || waiterStatus === 'sent'}
              className="cfab-btn-hover cfab-scale"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: '#f9fafb',
                border: '2px solid #fed7aa',
                color: '#374151',
                padding: '11px 18px 11px 14px',
                borderRadius: '14px',
                cursor: waiterStatus === 'uploading' || waiterStatus === 'sending' || waiterStatus === 'sent' ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                opacity: waiterStatus === 'uploading' || waiterStatus === 'sending' || waiterStatus === 'sent' ? 0.5 : 1,
                width: '100%',
              }}
            >
              <div style={{ width: 30, height: 30, background: '#fff7ed', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="ri-user-voice-line" style={{ color: '#f97316', fontSize: 14 }} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>Llamar al mesero</p>
                <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>
                  {loyaltySelfie ? 'Con tu foto de perfil' : getStoredSelfie() ? 'Con tu última selfie' : 'Selfie para ubicarte'}
                </p>
              </div>
            </button>

            {/* ── Request check ── */}
            <button
              onClick={handleCheckRequest}
              disabled={waiterStatus === 'uploading' || waiterStatus === 'sending' || waiterStatus === 'sent'}
              className="cfab-btn-hover cfab-scale"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: '#f9fafb',
                border: '2px solid #bbf7d0',
                color: '#374151',
                padding: '11px 18px 11px 14px',
                borderRadius: '14px',
                cursor: waiterStatus === 'uploading' || waiterStatus === 'sending' || waiterStatus === 'sent' ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                opacity: waiterStatus === 'uploading' || waiterStatus === 'sending' || waiterStatus === 'sent' ? 0.5 : 1,
                width: '100%',
              }}
            >
              <div style={{ width: 30, height: 30, background: '#ecfdf5', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="ri-receipt-line" style={{ color: '#22c55e', fontSize: 14 }} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>Pedir la cuenta</p>
                <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>Con o sin selfie</p>
              </div>
            </button>
          </div>
        )}

        {/* ── Main FAB button ── */}
        <button
          onClick={() => setOpen(v => !v)}
          onAnimationEnd={wiggle ? handleWiggleDone : undefined}
          className={[
            'cfab-scale',
            !mounted ? 'cfab-bounce-in' : '',
            wiggle ? 'cfab-wiggle' : '',
          ].join(' ')}
          style={{
            position: 'relative',
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: fabBg,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
            transition: 'background 0.25s ease, box-shadow 0.25s ease',
            opacity: mounted ? 1 : 0,
          }}
          title="Acciones rápidas"
        >
          {/* Pulse ring when items */}
          {itemCount > 0 && !open && (
            <span className="cfab-pulse-ring" />
          )}
          {/* Item count badge */}
          {itemCount > 0 && !open && (
            <span
              key={itemCount}
              className="cbadge-pop"
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                background: '#ef4444',
                color: '#fff',
                fontSize: 10,
                fontWeight: 900,
                width: 20,
                height: 20,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #fff',
                zIndex: 1,
              }}
            >
              {itemCount > 9 ? '9+' : itemCount}
            </span>
          )}
          {/* Icon */}
          <i
            className={open ? 'ri-close-line' : 'ri-menu-add-line'}
            style={{
              color: '#fff',
              fontSize: 22,
              transition: 'transform 0.25s ease',
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          />
        </button>
      </div>

      {/* ── Toast de estado ── */}
      {(waiterStatus === 'uploading' || waiterStatus === 'sending' || waiterStatus === 'sent' || waiterStatus === 'error') && (
        <div
          style={{
            position: 'fixed',
            bottom: 92,
            right: 16,
            zIndex: 2147483647,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            borderRadius: '14px',
            maxWidth: 300,
            animation: 'cFabUp 0.25s ease-out',
            background: waiterStatus === 'sent' ? (lastRequestType.current === 'check' ? '#064e3b' : '#052e16') : waiterStatus === 'error' ? '#450a0a' : '#111827',
            border: `1px solid ${waiterStatus === 'sent' ? (lastRequestType.current === 'check' ? '#10b981' : '#15803d') : waiterStatus === 'error' ? '#b91c1c' : '#374151'}`,
            color: waiterStatus === 'sent' ? '#86efac' : waiterStatus === 'error' ? '#fca5a5' : '#d1d5db',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          }}
        >
          {(waiterStatus === 'uploading' || waiterStatus === 'sending') && <i className="ri-loader-4-line" style={{ fontSize: 16, color: '#fb923c', flexShrink: 0, animation: 'spin 1s linear infinite' }} />}
          {waiterStatus === 'sent' && <i className="ri-checkbox-circle-fill" style={{ fontSize: 16, color: '#4ade80', flexShrink: 0 }} />}
          {waiterStatus === 'error' && <i className="ri-error-warning-fill" style={{ fontSize: 16, color: '#f87171', flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 900, margin: 0 }}>
              {waiterStatus === 'uploading' && 'Subiendo selfie...'}
              {waiterStatus === 'sent' && (lastRequestType.current === 'check' ? '¡Cuenta pedida!' : '¡Mesero en camino!')}
              {waiterStatus === 'error' && 'Error al enviar'}
              {waiterStatus === 'sending' && (lastRequestType.current === 'check' ? 'Pidiendo cuenta...' : 'Avisando al mesero...')}
            </p>
            <p style={{ fontSize: 10, opacity: 0.7, margin: 0 }}>
              {waiterStatus === 'uploading' && 'Subiendo a la nube un momento'}
              {waiterStatus === 'sent' && (lastRequestType.current === 'check' ? 'El mesero viene a cobrarte' : 'Ya te ubicaron, un momento')}
              {waiterStatus === 'error' && (lastErrorMessage.current || 'Intenta de nuevo')}
              {waiterStatus === 'sending' && 'Un segundo...'}
            </p>
          </div>
        </div>
      )}

      {/* ── Mesa input modal ── */}
      {showMesaInput && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setShowMesaInput(false)} />
          <div className="fixed bottom-28 right-4 z-50 bg-gray-900 border border-gray-700 rounded-2xl px-4 py-4 w-[260px] shadow-2xl">
            <p className="text-white text-sm font-black mb-1">¿En qué mesa estás?</p>
            <p className="text-gray-400 text-xs mb-3 leading-snug">
              Para que el mesero sepa dónde atenderte.
            </p>
            <input
              type="text"
              value={mesaInput}
              onChange={(e) => setMesaInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleMesaSubmit()}
              placeholder="Ej: 5, 12, Terraza..."
              autoFocus
              className="w-full bg-gray-800 text-white text-sm rounded-xl px-3 py-2.5 border border-gray-600 focus:border-amber-400 focus:outline-none placeholder-gray-600 mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowMesaInput(false)}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-gray-400 bg-gray-800 hover:bg-gray-700 cursor-pointer transition-all whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                onClick={handleMesaSubmit}
                disabled={!mesaInput.trim()}
                className={`flex-1 py-2 rounded-xl text-xs font-bold text-white cursor-pointer transition-all whitespace-nowrap ${
                  mesaInput.trim()
                    ? 'bg-amber-500 hover:bg-amber-600 active:scale-95'
                    : 'bg-gray-700 opacity-50 cursor-not-allowed'
                }`}
              >
                Continuar
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Modals ── */}
      {showQuickOrder && (
        <QuickOrderModal onClose={() => setShowQuickOrder(false)} />
      )}
      {showSelfie && (
        <SelfieCameraModal
          onCapture={handleSelfieCapture}
          onCancel={handleSelfieCancel}
        />
      )}
      {showCheckModal && (
        <CheckRequestModal
          onWithSelfie={handleCheckWithSelfie}
          onWithoutSelfie={handleCheckWithoutSelfie}
          onCancel={() => setShowCheckModal(false)}
        />
      )}
    </>
  );
}