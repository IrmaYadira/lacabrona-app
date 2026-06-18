import { useEffect, useRef, useState, useCallback } from 'react';

interface SelfieCameraModalProps {
  onCapture: (photoDataUrl: string) => void;
  onCancel: () => void;
}

const LAST_SELFIE_KEY = 'lastWaiterSelfie';
const SELFIE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutos

function getStoredSelfie(): { url: string; timestamp: number } | null {
  try {
    const raw = localStorage.getItem(LAST_SELFIE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.url !== 'string' || typeof parsed.timestamp !== 'number') return null;
    if (Date.now() - parsed.timestamp > SELFIE_EXPIRY_MS) {
      localStorage.removeItem(LAST_SELFIE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function storeSelfie(url: string) {
  try {
    localStorage.setItem(LAST_SELFIE_KEY, JSON.stringify({ url, timestamp: Date.now() }));
  } catch {
    // storage full o bloqueado — no pasa nada
  }
}

export default function SelfieCameraModal({ onCapture, onCancel }: SelfieCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const stored = useRef(getStoredSelfie());
  const [phase, setPhase] = useState<'reuse' | 'preview' | 'captured' | 'error'>(
    stored.current ? 'reuse' : 'preview'
  );
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError('No se pudo acceder a la cámara. Asegúrate de dar permiso.');
      setPhase('error');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  // Si no hay selfie guardada, inicia cámara al montar
  useEffect(() => {
    if (!stored.current) {
      startCamera();
    }
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const doCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Espejo para selfie
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
    setCapturedUrl(dataUrl);
    setPhase('captured');
    stopCamera();

    // Flash visual
    setFlash(true);
    setTimeout(() => setFlash(false), 300);
  }, [stopCamera]);

  const handleTimer = useCallback(() => {
    setCountdown(3);
    let c = 3;
    const interval = setInterval(() => {
      c -= 1;
      setCountdown(c);
      if (c === 0) {
        clearInterval(interval);
        setCountdown(null);
        doCapture();
      }
    }, 1000);
  }, [doCapture]);

  const handleRetake = useCallback(() => {
    setCapturedUrl(null);
    setPhase('preview');
    startCamera();
  }, [startCamera]);

  const handleConfirm = useCallback(() => {
    if (capturedUrl) {
      storeSelfie(capturedUrl);
      onCapture(capturedUrl);
    }
  }, [capturedUrl, onCapture]);

  const handleReuseConfirm = useCallback(() => {
    if (stored.current) {
      onCapture(stored.current.url);
    }
  }, [onCapture]);

  const handleGalleryPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      if (url) {
        stopCamera();
        setCapturedUrl(url);
        setPhase('captured');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [stopCamera]);

  const handleReuseRetake = useCallback(() => {
    stored.current = null;
    setPhase('preview');
    startCamera();
  }, [startCamera]);

  const handleCancel = useCallback(() => {
    stopCamera();
    onCancel();
  }, [stopCamera, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-sm bg-gray-950 rounded-3xl overflow-hidden flex flex-col">

        {/* Input oculto para galería */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleGalleryPick}
          className="hidden"
        />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <p className="text-white font-black text-base leading-tight">📸 Selfie para el mesero</p>
            <p className="text-gray-400 text-xs mt-0.5">
              {phase === 'captured' ? 'Así te ve el mesero' : phase === 'reuse' ? '¿Reutilizar tu foto anterior?' : 'Para que sepan dónde estás sentado'}
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:text-white cursor-pointer transition-colors"
          >
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        {/* Reuse phase */}
        {phase === 'reuse' && stored.current && (
          <div className="relative bg-black" style={{ aspectRatio: '4/3' }}>
            <img
              src={stored.current.url}
              alt="Tu última selfie"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/30 flex items-end justify-center pb-4">
              <span className="px-3 py-1 rounded-full bg-black/60 text-white text-xs font-semibold backdrop-blur-sm">
                Foto anterior · {Math.round((Date.now() - stored.current.timestamp) / 60000)} min
              </span>
            </div>
          </div>
        )}

        {/* Cámara / Preview / Captured */}
        {phase !== 'reuse' && (
          <div className="relative bg-black" style={{ aspectRatio: '4/3' }}>

            {/* Flash */}
            {flash && <div className="absolute inset-0 bg-white z-20 pointer-events-none" />}

            {phase === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
                <div className="w-14 h-14 flex items-center justify-center bg-red-900/40 rounded-full">
                  <i className="ri-camera-off-line text-red-400 text-2xl" />
                </div>
                <p className="text-red-400 text-sm font-semibold">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
                >
                  Reintentar
                </button>
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
                >
                  <i className="ri-image-2-line" />
                  Galería
                </button>
              </div>
            )}

            {phase === 'preview' && (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                  muted
                  playsInline
                />
                {/* Countdown overlay */}
                {countdown !== null && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <span
                      className="text-white font-black drop-shadow-lg"
                      style={{ fontSize: 96, lineHeight: 1, textShadow: '0 2px 24px rgba(0,0,0,0.8)' }}
                    >
                      {countdown}
                    </span>
                  </div>
                )}
                {/* Guía de encuadre */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-32 h-32 rounded-full border-2 border-white/30 border-dashed" />
                </div>
              </>
            )}

            {phase === 'captured' && capturedUrl && (
              <img
                src={capturedUrl}
                alt="Selfie capturada"
                className="w-full h-full object-cover"
              />
            )}

            {/* Canvas oculto para captura */}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {/* Controles */}
        <div className="px-5 py-4 flex flex-col gap-3">

          {/* Reuse buttons */}
          {phase === 'reuse' && (
            <div className="flex gap-3">
              <button
                onClick={handleReuseRetake}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-2xl py-3.5 font-bold text-sm cursor-pointer transition-all active:scale-95 whitespace-nowrap"
              >
                <i className="ri-refresh-line text-base" />
                Tomar otra
              </button>
              <button
                onClick={handleReuseConfirm}
                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl py-3.5 font-black text-sm cursor-pointer transition-all active:scale-95 whitespace-nowrap"
              >
                <i className="ri-check-line text-base" />
                Usar esta foto
              </button>
            </div>
          )}

          {phase === 'preview' && (
            <div className="space-y-2.5">
              <div className="flex gap-3">
                <button
                  onClick={doCapture}
                  disabled={countdown !== null}
                  className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-gray-900 rounded-2xl py-3.5 font-black text-sm cursor-pointer transition-all active:scale-95 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="ri-camera-fill text-lg" />
                  Tomar foto
                </button>
                <button
                  onClick={handleTimer}
                  disabled={countdown !== null}
                  className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-2xl px-4 py-3.5 font-bold text-sm cursor-pointer transition-all active:scale-95 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Foto con temporizador"
                >
                  <i className="ri-timer-line text-base" />
                  3s
                </button>
              </div>
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/30 rounded-2xl py-3 font-bold text-sm cursor-pointer transition-all active:scale-95 whitespace-nowrap"
              >
                <i className="ri-image-2-line text-base" />
                Elegir foto de galería
              </button>
            </div>
          )}

          {phase === 'captured' && (
            <div className="flex gap-3">
              <button
                onClick={handleRetake}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-2xl py-3.5 font-bold text-sm cursor-pointer transition-all active:scale-95 whitespace-nowrap"
              >
                <i className="ri-refresh-line text-base" />
                Repetir
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl py-3.5 font-black text-sm cursor-pointer transition-all active:scale-95 whitespace-nowrap"
              >
                <i className="ri-send-plane-fill text-base" />
                Llamar al mesero
              </button>
            </div>
          )}

          <p className="text-center text-gray-600 text-[11px]">
            La foto solo la ve el mesero para ubicarte
          </p>
        </div>
      </div>
    </div>
  );
}