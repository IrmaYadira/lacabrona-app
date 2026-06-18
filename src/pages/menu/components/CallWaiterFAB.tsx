import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabasePos } from '@/pages/pos/supabasePos';
import { useLoyaltyCustomer } from '@/hooks/useLoyaltyCustomer';
import SelfieCameraModal from './SelfieCameraModal';

type RequestType = 'call' | 'check';
type Status = 'idle' | 'calling' | 'sent';

export default function CallWaiterFAB() {
  const [params] = useSearchParams();
  const mesa = params.get('mesa') || params.get('spot') || '';
  const area = params.get('area') || '';
  const volverCuentaId = params.get('volver_cuenta');

  const { customer: loyaltyCustomer } = useLoyaltyCustomer();

  const [status, setStatus] = useState<Status>('idle');
  const [showActions, setShowActions] = useState(false);
  const [sentType, setSentType] = useState<RequestType>('call');
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [pendingType, setPendingType] = useState<RequestType>('call');
  const [showMesaInput, setShowMesaInput] = useState(false);
  const [mesaInput, setMesaInput] = useState('');
  const [pendingTypeForMesa, setPendingTypeForMesa] = useState<RequestType>('call');

  const handleCall = (type: RequestType) => {
    // Si no hay mesa en URL, pedir al cliente que ingrese su número
    if (!mesa && !area && !volverCuentaId) {
      setPendingTypeForMesa(type);
      setShowMesaInput(true);
      setShowActions(false);
      return;
    }
    const selfieUrl = loyaltyCustomer?.selfie_url ?? null;
    if (selfieUrl) {
      sendWaiterRequest(type, selfieUrl);
      setShowActions(false);
    } else {
      setPendingType(type);
      setShowSelfieModal(true);
      setShowActions(false);
    }
  };

  const handleMesaSubmit = () => {
    const mesaFinal = mesaInput.trim();
    if (!mesaFinal) return;
    setShowMesaInput(false);
    const selfieUrl = loyaltyCustomer?.selfie_url ?? null;
    if (selfieUrl) {
      sendWaiterRequestWithMesa(pendingTypeForMesa, mesaFinal, selfieUrl);
    } else {
      setPendingType(pendingTypeForMesa);
      setShowSelfieModal(true);
    }
  };

  const sendWaiterRequestWithMesa = async (type: RequestType, mesaManual: string, photoUrl?: string | null) => {
    if (status !== 'idle') return;
    setSentType(type);
    setStatus('calling');
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    const dbRequestType = type === 'call' ? 'call_waiter' : 'request_bill';
    try {
      await supabasePos.from('waiter_requests').insert({
        account_id: null,
        spot: mesaManual,
        area: 'principal',
        request_type: dbRequestType,
        status: 'pending',
        notes: type === 'check'
          ? 'El cliente solicita la cuenta desde el menú digital'
          : 'El cliente necesita atención en su mesa',
        selfie_url: photoUrl ?? null,
      });
    } catch (_) {
      // silencioso
    }
    setTimeout(() => setStatus('sent'), 1200);
    setTimeout(() => {
      setStatus('idle');
      setShowActions(false);
      setMesaInput('');
    }, 6000);
  };

  const sendWaiterRequest = async (type: RequestType, photoUrl?: string | null) => {
    if (status !== 'idle') return;
    setSentType(type);
    setStatus('calling');
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    const dbRequestType = type === 'call' ? 'call_waiter' : 'request_bill';
    try {
      await supabasePos.from('waiter_requests').insert({
        account_id: volverCuentaId ? Number(volverCuentaId) : null,
        spot: mesa || null,
        area: area || 'principal',
        request_type: dbRequestType,
        status: 'pending',
        notes: type === 'check'
          ? 'El cliente solicita la cuenta desde el menú digital'
          : 'El cliente necesita atención en su mesa',
        selfie_url: photoUrl ?? null,
      });
    } catch (_) {
      // silencioso
    }

    setTimeout(() => setStatus('sent'), 1200);
    setTimeout(() => {
      setStatus('idle');
      setShowActions(false);
    }, 6000);
  };



  const compressImage = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 480;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
          else { width = Math.round((width * MAX) / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handleSelfieCapture = async (photoDataUrl: string) => {
    setShowSelfieModal(false);
    let uploadedUrl: string | null = null;
    try {
      const compressed = await compressImage(photoDataUrl);
      const { data } = await supabasePos.functions.invoke('upload-selfie', {
        body: { dataUrl: compressed },
      });
      uploadedUrl = data?.url ?? null;
      if (uploadedUrl && loyaltyCustomer) {
        const updated = { ...loyaltyCustomer, selfie_url: uploadedUrl };
        localStorage.setItem('lc_loyalty_customer', JSON.stringify(updated));
      }
      if (uploadedUrl && loyaltyCustomer?.id) {
        await supabasePos.functions.invoke('upload-loyalty-selfie', {
          body: { dataUrl: compressed, customerId: loyaltyCustomer.id },
        });
      }
    } catch (_) {
      // silencioso
    }
    // Si hay mesa manual pendiente, usar esa función
    if (!mesa && !area && !volverCuentaId && mesaInput.trim()) {
      sendWaiterRequestWithMesa(pendingType, mesaInput.trim(), uploadedUrl ?? photoDataUrl);
    } else {
      sendWaiterRequest(pendingType, uploadedUrl ?? photoDataUrl);
    }
  };

  const handleSelfieCancel = () => {
    setShowSelfieModal(false);
    if (!mesa && !area && !volverCuentaId && mesaInput.trim()) {
      sendWaiterRequestWithMesa(pendingType, mesaInput.trim(), null);
    } else {
      sendWaiterRequest(pendingType, null);
    }
  };

  const noContext = !mesa && !area && !volverCuentaId;
  const spotLabel = mesa ? `Mesa ${mesa}` : area ? area : 'tu mesa';
  const loyaltySelfie = loyaltyCustomer?.selfie_url ?? null;

  return (
    <>
      {/* ── Overlay para cerrar acciones ── */}
      {(showActions || showMesaInput) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setShowActions(false); setShowMesaInput(false); }}
        />
      )}

      {/* ── Modal ingreso de mesa ── */}
      {showMesaInput && (
        <div className="fixed bottom-28 right-4 z-50 bg-gray-900 border border-gray-700 rounded-2xl px-4 py-4 w-[260px] shadow-2xl">
          <p className="text-white text-sm font-black mb-1">¿En qué mesa estás?</p>
          <p className="text-gray-400 text-xs mb-3 leading-snug">
            Ingresa tu número de mesa para que el mesero sepa dónde atenderte.
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
              Llamar mesero
            </button>
          </div>
        </div>
      )}

      {/* ── Panel de confirmación de éxito ── */}
      {status === 'sent' && (
        <div className="fixed bottom-28 right-4 z-50 bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3.5 max-w-[280px] shadow-2xl">
          <div className="flex items-start gap-3">
            {loyaltySelfie ? (
              <img
                src={loyaltySelfie}
                alt={loyaltyCustomer.name}
                title={`Selfie de ${loyaltyCustomer.name}`}
                className="w-11 h-11 rounded-full object-cover border-2 border-green-400 flex-shrink-0"
              />
            ) : (
              <div className={`w-11 h-11 flex items-center justify-center rounded-full flex-shrink-0 ${
                sentType === 'check' ? 'bg-green-500/20' : 'bg-amber-500/20'
              }`}>
                <i className={`text-xl ${
                  sentType === 'check' ? 'ri-money-dollar-circle-line text-green-400' : 'ri-service-line text-amber-400'
                }`} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-black ${sentType === 'check' ? 'text-green-400' : 'text-amber-400'}`}>
                {sentType === 'check' ? '¡Cuenta en camino!' : '¡Mesero avisado!'}
              </p>
              <p className="text-gray-400 text-xs mt-0.5 leading-snug">
                {sentType === 'check'
                  ? 'Se acercarán a cobrarte en un momento.'
                  : 'Atenderán tu mesa pronto.'}
              </p>
              {loyaltyCustomer && (
                <p className="text-gray-600 text-[10px] mt-1">
                  <i className="ri-vip-crown-line text-amber-500 mr-0.5" />
                  Identificado como {loyaltyCustomer.name}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Panel de acciones ── */}
      <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2">
        {showActions && status === 'idle' && (
          <div className="flex flex-col items-end gap-2 mb-1">

            {/* Info del cliente si está registrado */}
            {loyaltyCustomer && (
              <div className="flex items-center gap-2.5 bg-gray-900 border border-amber-500/40 rounded-2xl px-3.5 py-2.5 max-w-[260px] shadow-xl">
                {loyaltySelfie ? (
                  <img
                    src={loyaltySelfie}
                    alt={loyaltyCustomer.name}
                    title={`Selfie de ${loyaltyCustomer.name}`}
                    className="w-9 h-9 rounded-full object-cover border-2 border-amber-400 flex-shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-black text-sm">
                      {loyaltyCustomer.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-white text-xs font-bold truncate">{loyaltyCustomer.name}</p>
                  <p className="text-amber-400 text-[10px] flex items-center gap-0.5">
                    <i className="ri-vip-crown-line text-xs" />
                    {loyaltySelfie ? 'Tu foto se enviará al staff' : 'Cliente frecuente'}
                  </p>
                </div>
              </div>
            )}

            {/* Botón pedir la cuenta */}
            <button
              onClick={() => handleCall('check')}
              className="flex items-center gap-3 bg-black border border-green-500/60 hover:border-green-400 hover:bg-green-950 text-white px-4 py-3.5 rounded-2xl text-sm font-black cursor-pointer transition-all whitespace-nowrap active:scale-95 shadow-xl"
            >
              <div className="w-9 h-9 flex items-center justify-center bg-green-500/20 rounded-xl flex-shrink-0">
                <i className="ri-money-dollar-circle-line text-green-400 text-lg" />
              </div>
              <div className="text-left">
                <p className="text-white text-sm font-black leading-tight">Pedir la cuenta</p>
                <p className="text-gray-500 text-[10px]">{spotLabel}</p>
              </div>
            </button>

            {/* Botón llamar al mesero */}
            <button
              onClick={() => handleCall('call')}
              className="flex items-center gap-3 bg-black border border-amber-500/60 hover:border-amber-400 hover:bg-amber-950 text-white px-4 py-3.5 rounded-2xl text-sm font-black cursor-pointer transition-all whitespace-nowrap active:scale-95 shadow-xl"
            >
              <div className="w-9 h-9 flex items-center justify-center bg-amber-500/20 rounded-xl flex-shrink-0">
                <i className="ri-service-line text-amber-400 text-lg" />
              </div>
              <div className="text-left">
                <p className="text-white text-sm font-black leading-tight">Llamar al mesero</p>
                <p className="text-gray-500 text-[10px]">{spotLabel}</p>
              </div>
            </button>
          </div>
        )}

        {/* ── FAB principal ── */}
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={() => {
              if (status === 'sent') {
                setStatus('idle');
                setShowActions(false);
              } else if (status === 'idle') {
                setShowActions(v => !v);
              }
            }}
            className={`relative w-14 h-14 rounded-full overflow-hidden flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-2xl ${
              status === 'sent'
                ? 'bg-green-600 border-2 border-green-400'
                : status === 'calling'
                ? 'bg-amber-500 border-2 border-amber-300 animate-pulse'
                : showActions
                ? 'bg-gray-800 border-2 border-gray-600'
                : loyaltySelfie
                ? 'border-2 border-amber-400 p-0'
                : 'bg-amber-500 border-2 border-amber-300 hover:bg-amber-600'
            }`}
          >
            {status === 'sent' ? (
              <i className="ri-check-line text-white text-2xl" />
            ) : status === 'calling' ? (
              <i className="ri-loader-4-line text-white text-xl animate-spin" />
            ) : showActions ? (
              <i className="ri-close-line text-white text-xl" />
            ) : loyaltySelfie ? (
              <img
                src={loyaltySelfie}
                alt="yo"
                title="Tu selfie"
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            ) : (
              <i className="ri-service-line text-white text-xl" />
            )}

            {/* Dot de estado */}
            {status === 'idle' && !showActions && (
              <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-gray-950" />
            )}
          </button>

          {/* Label debajo del FAB */}
          {!showActions && status === 'idle' && (
            <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">
              {noContext ? 'Llamar' : 'Mesero'}
            </span>
          )}
          {status === 'calling' && (
            <span className="text-amber-400 text-[10px] font-bold animate-pulse">
              Avisando...
            </span>
          )}
        </div>
      </div>

      {/* ── Modal de selfie ── */}
      {showSelfieModal && (
        <SelfieCameraModal
          onCapture={handleSelfieCapture}
          onCancel={handleSelfieCancel}
        />
      )}
    </>
  );
}