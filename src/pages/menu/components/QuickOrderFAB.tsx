import { useState, useEffect, useRef, useCallback } from "react";
import { useCart } from "@/pages/home/context/CartContext";
import { supabasePos } from "@/pages/pos/supabasePos";
import SelfieCameraModal from "./SelfieCameraModal";
import CheckRequestModal from "./CheckRequestModal";
import QuickOrderModal from "./QuickOrderModal";

type WaiterStatus = 'idle' | 'uploading' | 'sending' | 'sent' | 'error';
type RequestType = 'call' | 'check';

export default function QuickOrderFAB() {
  const { itemCount, total, setIsOpen, customerName, orderMode, tableNumber } = useCart();
  const [open, setOpen] = useState(false);
  const [waiterStatus, setWaiterStatus] = useState<WaiterStatus>('idle');
  const [showSelfie, setShowSelfie] = useState(false);
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [showQuickOrder, setShowQuickOrder] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [wiggle, setWiggle] = useState(false);
  const prevItemCount = useRef(0);
  const pendingRequestType = useRef<RequestType>('call');
  const ref = useRef<HTMLDivElement>(null);

  // Último tipo de request enviado para personalizar el toast
  const lastRequestType = useRef<RequestType>('call');

  // Último mensaje de error para mostrar al usuario
  const lastErrorMessage = useRef<string>('');

  // Animación de entrada al montar — mounted=false dispara bounce, true lo estabiliza
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 800);
    return () => clearTimeout(t);
  }, []);

  // Wiggle + badge pop cuando se agrega un producto
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

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

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

  const sendWaiterCall = async (requestType: RequestType, photoUrl?: string) => {
    if (waiterStatus === 'sent' || waiterStatus === 'sending' || waiterStatus === 'uploading') return;
    lastRequestType.current = requestType;
    setWaiterStatus('sending');
    if (navigator.vibrate) navigator.vibrate([100, 60, 100]);

    // Asegurar que spot sea un string válido
    const spot = String(tableNumber || '').trim() || String(customerName || '').trim() || 'Menú Digital';
    const name = String(customerName || '').trim() || null;

    // Mapear tipos locales a los valores permitidos por la base de datos
    const dbRequestType = requestType === 'call' ? 'call_waiter' : 'request_bill';

    try {
      const { error } = await supabasePos.from('waiter_requests').insert({
        account_id: null,
        spot,
        area: 'menu-digital',
        request_type: dbRequestType,
        status: 'pending',
        notes: requestType === 'check'
          ? 'El cliente solicita la cuenta desde el menú digital'
          : 'El cliente necesita atención desde el menú digital',
        photo_url: photoUrl ?? null,
        customer_name: name,
      });
      if (error) {
        console.error('[QuickOrderFAB] Supabase insert error:', error);
        lastErrorMessage.current = error.message || 'Error de base de datos';
        throw error;
      }
      setWaiterStatus('sent');
      setTimeout(() => setWaiterStatus('idle'), 6000);
    } catch (err) {
      console.error('[QuickOrderFAB] sendWaiterCall exception:', err);
      if (!lastErrorMessage.current) {
        lastErrorMessage.current = err instanceof Error ? err.message : 'Error de conexión';
      }
      setWaiterStatus('error');
      setTimeout(() => {
        setWaiterStatus('idle');
        lastErrorMessage.current = '';
      }, 5000);
    }
  };

  const handleCallWaiter = () => {
    setOpen(false);
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
        console.error('[QuickOrderFAB] upload-selfie error:', error);
        lastErrorMessage.current = error?.message || 'Error al subir la foto';
        await sendWaiterCall(pendingRequestType.current, undefined);
        return;
      }

      await sendWaiterCall(pendingRequestType.current, data.url as string);
    } catch (err) {
      console.error('[QuickOrderFAB] handleSelfieCapture exception:', err);
      lastErrorMessage.current = err instanceof Error ? err.message : 'Error al procesar la foto';
      await sendWaiterCall(pendingRequestType.current, undefined);
    }
  };

  const handleCheckRequest = () => {
    setOpen(false);
    setShowCheckModal(true);
  };

  const handleCheckWithSelfie = () => {
    setShowCheckModal(false);
    pendingRequestType.current = 'check';
    setShowSelfie(true);
  };

  const handleCheckWithoutSelfie = async () => {
    setShowCheckModal(false);
    await sendWaiterCall('check', undefined);
  };

  const modeLabel = orderMode === "dine-in" ? "Comer aquí" : "Para llevar";
  const modeIcon = orderMode === "dine-in" ? "ri-restaurant-line" : "ri-shopping-bag-3-line";

  const fabBg = open ? '#374151' : itemCount > 0 ? '#f59e0b' : '#111827';

  return (
    <>
      <style>{`
        @keyframes fabUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fabBounceIn {
          0%   { opacity: 0; transform: scale(0.3) translateY(40px); }
          50%  { opacity: 1; transform: scale(1.15) translateY(-6px); }
          70%  { transform: scale(0.92) translateY(2px); }
          85%  { transform: scale(1.05) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fabPulseRing {
          0%   { transform: scale(1); opacity: 0.6; }
          70%  { transform: scale(1.7); opacity: 0; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        @keyframes fabWiggle {
          0%,100% { transform: rotate(0deg); }
          20%     { transform: rotate(-12deg); }
          40%     { transform: rotate(12deg); }
          60%     { transform: rotate(-8deg); }
          80%     { transform: rotate(6deg); }
        }
        @keyframes badgePop {
          0%   { transform: scale(0); }
          60%  { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        .fab-bounce-in  { animation: fabBounceIn 0.65s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .fab-panel-anim { animation: fabUp 0.2s ease-out forwards; }
        .fab-btn-hover:hover { filter: brightness(1.12); }
        .fab-scale:active { transform: scale(0.95); }
        .fab-pulse-ring {
          position: absolute; inset: 0; border-radius: 50%;
          background: #f59e0b;
          animation: fabPulseRing 2s ease-out infinite;
          pointer-events: none;
        }
        .fab-wiggle { animation: fabWiggle 0.5s ease-in-out; }
        .badge-pop { animation: badgePop 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      `}</style>

      {/* Contenedor principal — inline styles para máxima prioridad */}
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
        {/* Panel desplegable */}
        {open && (
          <div
            className="fab-panel-anim"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              alignItems: 'flex-end',
              marginBottom: '4px',
            }}
          >
            {/* Info de sesión */}
            {customerName.trim() && (
              <div style={{
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '16px',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                maxWidth: '240px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customerName}</p>
                  <p style={{ fontSize: 10, color: '#9ca3af', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <i className={`${modeIcon}`} style={{ fontSize: 10 }} />
                    {modeLabel}
                  </p>
                </div>
              </div>
            )}

            {/* Ya sé qué pedir */}
            <button
              onClick={() => { setShowQuickOrder(true); setOpen(false); }}
              className="fab-btn-hover fab-scale"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: '#111827',
                color: '#fff',
                padding: '14px 20px 14px 16px',
                borderRadius: '16px',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              }}
            >
              <div style={{ width: 32, height: 32, background: '#f59e0b', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="ri-send-plane-fill" style={{ color: '#fff', fontSize: 16 }} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: 14, fontWeight: 900, margin: 0, lineHeight: 1.2 }}>Ya sé qué pedir</p>
                {itemCount > 0 ? (
                  <p style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600, margin: 0 }}>
                    {itemCount} producto{itemCount !== 1 ? "s" : ""} · ${Number(total).toFixed(2)}
                  </p>
                ) : (
                  <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>Buscar rápido y agregar</p>
                )}
              </div>
              {itemCount > 0 && (
                <span style={{ marginLeft: 'auto', background: '#f59e0b', color: '#fff', fontSize: 11, fontWeight: 900, width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {itemCount}
                </span>
              )}
            </button>

            {/* Seguir ordenando */}
            <button
              onClick={() => setOpen(false)}
              className="fab-btn-hover fab-scale"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: '#f9fafb',
                border: '2px solid #e5e7eb',
                color: '#374151',
                padding: '12px 20px 12px 16px',
                borderRadius: '16px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
              }}
            >
              <div style={{ width: 32, height: 32, background: '#f3f4f6', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="ri-add-circle-line" style={{ color: '#4b5563', fontSize: 16 }} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.2 }}>Seguir ordenando</p>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>Agregar más productos</p>
              </div>
            </button>

            {/* Llamar al mesero */}
            <button
              onClick={handleCallWaiter}
              disabled={waiterStatus === 'uploading' || waiterStatus === 'sending' || waiterStatus === 'sent'}
              className="fab-btn-hover fab-scale"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: '#f9fafb',
                border: '2px solid #fed7aa',
                color: '#374151',
                padding: '12px 20px 12px 16px',
                borderRadius: '16px',
                cursor: waiterStatus === 'uploading' || waiterStatus === 'sending' || waiterStatus === 'sent' ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                opacity: waiterStatus === 'uploading' || waiterStatus === 'sending' || waiterStatus === 'sent' ? 0.6 : 1,
                boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
              }}
            >
              <div style={{ width: 32, height: 32, background: '#fff7ed', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="ri-camera-line" style={{ color: '#f97316', fontSize: 16 }} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.2 }}>Llamar al mesero</p>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>Selfie para que te encuentren</p>
              </div>
            </button>

            {/* Cuenta por favor */}
            <button
              onClick={handleCheckRequest}
              disabled={waiterStatus === 'uploading' || waiterStatus === 'sending' || waiterStatus === 'sent'}
              className="fab-btn-hover fab-scale"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: '#f9fafb',
                border: '2px solid #bbf7d0',
                color: '#374151',
                padding: '12px 20px 12px 16px',
                borderRadius: '16px',
                cursor: waiterStatus === 'uploading' || waiterStatus === 'sending' || waiterStatus === 'sent' ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                opacity: waiterStatus === 'uploading' || waiterStatus === 'sending' || waiterStatus === 'sent' ? 0.6 : 1,
                boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
              }}
            >
              <div style={{ width: 32, height: 32, background: '#ecfdf5', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="ri-receipt-line" style={{ color: '#22c55e', fontSize: 16 }} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.2 }}>Cuenta por favor</p>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>Con o sin selfie</p>
              </div>
            </button>
          </div>
        )}

        {/* FAB principal */}
        <button
          onClick={() => setOpen((v) => !v)}
          onAnimationEnd={wiggle ? handleWiggleDone : undefined}
          className={[
            'fab-scale',
            !mounted ? 'fab-bounce-in' : '',
            wiggle ? 'fab-wiggle' : '',
          ].join(' ')}
          style={{
            position: 'relative',
            width: 60,
            height: 60,
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
          title="Acceso rápido al pedido"
        >
          {/* Ring de pulso cuando hay items */}
          {itemCount > 0 && !open && (
            <span className="fab-pulse-ring" />
          )}
          {itemCount > 0 && !open && (
            <span
              key={itemCount}
              className="badge-pop"
              style={{
                position: 'absolute',
                top: -5,
                right: -5,
                background: '#ef4444',
                color: '#fff',
                fontSize: 10,
                fontWeight: 900,
                width: 22,
                height: 22,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #fff',
                zIndex: 1,
              }}>
              {itemCount > 9 ? '9+' : itemCount}
            </span>
          )}
          <i
            className={open ? 'ri-close-line' : 'ri-shopping-cart-2-line'}
            style={{
              color: '#fff',
              fontSize: 24,
              transition: 'transform 0.25s ease',
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          />
        </button>
      </div>

      {/* Toast de estado */}
      {(waiterStatus === 'uploading' || waiterStatus === 'sending' || waiterStatus === 'sent' || waiterStatus === 'error') && (
        <div
          style={{
            position: 'fixed',
            bottom: 96,
            right: 16,
            zIndex: 2147483647,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            borderRadius: '16px',
            maxWidth: 320,
            animation: 'fabUp 0.25s ease-out',
            background: waiterStatus === 'sent' ? (lastRequestType.current === 'check' ? '#064e3b' : '#052e16') : waiterStatus === 'error' ? '#450a0a' : '#111827',
            border: `1px solid ${waiterStatus === 'sent' ? (lastRequestType.current === 'check' ? '#10b981' : '#15803d') : waiterStatus === 'error' ? '#b91c1c' : '#374151'}`,
            color: waiterStatus === 'sent' ? '#86efac' : waiterStatus === 'error' ? '#fca5a5' : '#d1d5db',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          }}
        >
          {(waiterStatus === 'uploading' || waiterStatus === 'sending') && <i className="ri-loader-4-line" style={{ fontSize: 18, color: '#fb923c', flexShrink: 0, animation: 'spin 1s linear infinite' }} />}
          {waiterStatus === 'sent' && <i className="ri-checkbox-circle-fill" style={{ fontSize: 18, color: '#4ade80', flexShrink: 0 }} />}
          {waiterStatus === 'error' && <i className="ri-error-warning-fill" style={{ fontSize: 18, color: '#f87171', flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 900, margin: 0, lineHeight: 1.2 }}>
              {waiterStatus === 'uploading' && 'Subiendo selfie...'}
              {waiterStatus === 'sent' && (lastRequestType.current === 'check' ? '¡Cuenta pedida!' : '¡Mesero en camino!')}
              {waiterStatus === 'error' && 'Error al enviar'}
              {waiterStatus === 'sending' && (lastRequestType.current === 'check' ? 'Pidiendo cuenta...' : 'Avisando al mesero...')}
            </p>
            <p style={{ fontSize: 11, opacity: 0.7, margin: 0, wordBreak: 'break-word' }}>
              {waiterStatus === 'uploading' && 'Un segundo, subiendo a la nube'}
              {waiterStatus === 'sent' && (lastRequestType.current === 'check' ? 'El mesero viene a cobrarte' : 'Ya vio tu selfie, un momento')}
              {waiterStatus === 'error' && (lastErrorMessage.current || 'Intenta de nuevo')}
              {waiterStatus === 'sending' && 'Un segundo por favor'}
            </p>
          </div>
        </div>
      )}

      {showQuickOrder && (
        <QuickOrderModal
          onClose={() => setShowQuickOrder(false)}
        />
      )}

      {showSelfie && (
        <SelfieCameraModal
          onCapture={handleSelfieCapture}
          onCancel={() => setShowSelfie(false)}
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