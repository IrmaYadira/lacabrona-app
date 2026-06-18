import { useState, useRef, useCallback, useEffect } from 'react';
import { supabasePos } from '@/pages/pos/supabasePos';
import { getLoyaltyCustomerFromStorage } from '@/hooks/useLoyaltyCustomer';

// ── Filtros ──────────────────────────────────────────────────────────────────
interface PhotoFilter {
  id: string;
  label: string;
  emoji: string;
  css: string;
  apply: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

const FILTERS: PhotoFilter[] = [
  { id: 'normal', label: 'Normal', emoji: '📷', css: 'none', apply: () => {} },
  {
    id: 'beauty', label: 'Belleza', emoji: '✨',
    css: 'brightness(1.12) contrast(0.88) saturate(1.15)',
    apply: (ctx, w, h) => {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'warm', label: 'Cálido', emoji: '🌅',
    css: 'brightness(1.08) saturate(1.3) sepia(0.2)',
    apply: (ctx, w, h) => {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#ff9933';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'glow', label: 'Glow', emoji: '🌟',
    css: 'brightness(1.18) contrast(0.82) saturate(1.25)',
    apply: (ctx, w, h) => {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#ffe0a0';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'fresh', label: 'Fresco', emoji: '❄️',
    css: 'brightness(1.05) saturate(0.85) hue-rotate(10deg)',
    apply: (ctx, w, h) => {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#a0d0ff';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'bw', label: 'B&N', emoji: '🎞️',
    css: 'grayscale(1) contrast(1.1)',
    apply: (ctx, w, h) => {
      const d = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < d.data.length; i += 4) {
        const g = d.data[i] * 0.299 + d.data[i + 1] * 0.587 + d.data[i + 2] * 0.114;
        d.data[i] = g; d.data[i + 1] = g; d.data[i + 2] = g;
      }
      ctx.putImageData(d, 0, 0);
    },
  },
  {
    id: 'vintage', label: 'Vintage', emoji: '🕰️',
    css: 'sepia(0.55) contrast(1.05) brightness(0.95)',
    apply: (ctx, w, h) => {
      const d = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < d.data.length; i += 4) {
        const r = d.data[i], g = d.data[i + 1], b = d.data[i + 2];
        d.data[i]     = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
        d.data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
        d.data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
      }
      ctx.putImageData(d, 0, 0);
    },
  },
  {
    id: 'vivid', label: 'Vívido', emoji: '🎨',
    css: 'saturate(1.8) contrast(1.1) brightness(1.05)',
    apply: (ctx, w, h) => {
      const d = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < d.data.length; i += 4) {
        d.data[i]     = Math.min(255, (d.data[i] - 128) * 1.3 + 128);
        d.data[i + 1] = Math.min(255, (d.data[i + 1] - 128) * 1.3 + 128);
        d.data[i + 2] = Math.min(255, (d.data[i + 2] - 128) * 1.3 + 128);
      }
      ctx.putImageData(d, 0, 0);
    },
  },
];

function applyFilter(srcUrl: string, filter: PhotoFilter): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      filter.apply(ctx, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => resolve(srcUrl);
    img.src = srcUrl;
  });
}

function compress(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 480;
      let { width: w, height: h } = img;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
        else { w = Math.round((w * MAX) / h); h = MAX; }
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ── Props ────────────────────────────────────────────────────────────────────
interface PhotoEditorSheetProps {
  customerId: number;
  currentPhotoUrl?: string | null;
  onClose: () => void;
  onSuccess: (newUrl: string) => void;
}

type Phase = 'source' | 'camera' | 'captured' | 'uploading' | 'done' | 'error';

export default function PhotoEditorSheet({
  customerId,
  currentPhotoUrl,
  onClose,
  onSuccess,
}: PhotoEditorSheetProps) {
  const [phase, setPhase] = useState<Phase>('source');
  const [rawUrl, setRawUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState('beauty');
  const [applyingFilter, setApplyingFilter] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [visible, setVisible] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Entrada animada
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    stopCamera();
    setTimeout(onClose, 280);
  };

  // ── Cámara ──
  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError('No se pudo acceder a la cámara.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (phase === 'camera') startCamera();
    return () => { if (phase === 'camera') stopCamera(); };
  }, [phase, startCamera, stopCamera]);

  // Re-aplicar filtro al cambiar selección
  useEffect(() => {
    if (!rawUrl || phase !== 'captured') return;
    const f = FILTERS.find(f => f.id === selectedFilter) ?? FILTERS[0];
    if (f.id === 'normal') { setPreviewUrl(rawUrl); return; }
    setApplyingFilter(true);
    applyFilter(rawUrl, f).then(url => { setPreviewUrl(url); setApplyingFilter(false); });
  }, [selectedFilter, rawUrl, phase]);

  const doCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    const url = canvas.toDataURL('image/jpeg', 0.9);
    setRawUrl(url);
    setPreviewUrl(url);
    setPhase('captured');
    stopCamera();
    setFlash(true);
    setTimeout(() => setFlash(false), 250);
  }, [stopCamera]);

  const handleTimer = useCallback(() => {
    let c = 3;
    setCountdown(c);
    const iv = setInterval(() => {
      c -= 1;
      setCountdown(c);
      if (c === 0) { clearInterval(iv); setCountdown(null); doCapture(); }
    }, 1000);
  }, [doCapture]);

  const handleGallery = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      if (url) {
        setRawUrl(url);
        setPreviewUrl(url);
        setPhase('captured');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  // ── Upload ──
  const handleUpload = async () => {
    if (!previewUrl) return;
    setPhase('uploading');
    setUploadError('');
    try {
      const compressed = await compress(previewUrl);
      const { data, error: fnError } = await supabasePos.functions.invoke('upload-loyalty-selfie', {
        body: { dataUrl: compressed, customerId },
      });
      if (fnError || !data?.url) {
        setUploadError(fnError?.message ?? 'Error al subir la foto. Intenta de nuevo.');
        setPhase('error');
        return;
      }
      // Actualizar localStorage
      const stored = getLoyaltyCustomerFromStorage();
      if (stored) {
        localStorage.setItem('lc_loyalty_customer', JSON.stringify({ ...stored, selfie_url: data.url }));
      }
      // Guardar URL final de Supabase Storage
      setUploadedUrl(data.url);
      // Notificar al parent con la nueva URL para que el cuadrito se actualice inmediatamente
      onSuccess(data.url);
      setPhase('done');
    } catch (err) {
      setUploadError((err as Error).message ?? 'Error inesperado.');
      setPhase('error');
    }
  };

  const currentFilterCss = FILTERS.find(f => f.id === selectedFilter)?.css ?? 'none';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[90] bg-gray-950 rounded-t-3xl transition-transform duration-300 ${visible ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <h3 className="text-white font-black text-base">
            {phase === 'done' ? '¡Foto actualizada!' : 'Cambiar foto de perfil'}
          </h3>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:text-white cursor-pointer transition-colors"
          >
            <i className="ri-close-line text-base" />
          </button>
        </div>

        <div className="px-5 py-5 pb-8">

          {/* ── Elegir fuente ── */}
          {phase === 'source' && (
            <div className="space-y-3">
              {/* Foto actual */}
              {currentPhotoUrl && (
                <div className="flex items-center gap-4 bg-gray-900 rounded-2xl p-4 mb-4">
                  <img
                    src={currentPhotoUrl}
                    alt="Foto actual"
                    className="w-16 h-16 rounded-xl object-cover border-2 border-amber-500/50 flex-shrink-0"
                  />
                  <div>
                    <p className="text-white text-sm font-bold">Foto actual</p>
                    <p className="text-gray-500 text-xs mt-0.5">Elige cómo quieres actualizarla</p>
                  </div>
                </div>
              )}

              <button
                onClick={() => setPhase('camera')}
                className="w-full flex items-center gap-4 bg-gray-900 hover:bg-gray-800 rounded-2xl px-5 py-4 cursor-pointer transition-colors group"
              >
                <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500/20 transition-colors">
                  <i className="ri-camera-fill text-amber-400 text-xl" />
                </div>
                <div className="text-left">
                  <p className="text-white font-bold text-sm">Tomar selfie</p>
                  <p className="text-gray-500 text-xs mt-0.5">Usa la cámara frontal con filtros</p>
                </div>
                <i className="ri-arrow-right-s-line text-gray-600 text-xl ml-auto" />
              </button>

              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center gap-4 bg-gray-900 hover:bg-gray-800 rounded-2xl px-5 py-4 cursor-pointer transition-colors group"
              >
                <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500/20 transition-colors">
                  <i className="ri-image-line text-amber-400 text-xl" />
                </div>
                <div className="text-left">
                  <p className="text-white font-bold text-sm">Subir desde galería</p>
                  <p className="text-gray-500 text-xs mt-0.5">Elige una foto guardada en tu dispositivo</p>
                </div>
                <i className="ri-arrow-right-s-line text-gray-600 text-xl ml-auto" />
              </button>

              <input ref={fileRef} type="file" accept="image/*" onChange={handleGallery} className="hidden" />
            </div>
          )}

          {/* ── Cámara ── */}
          {phase === 'camera' && (
            <div className="space-y-4">
              {/* Visor */}
              <div
                className="relative bg-black rounded-2xl overflow-hidden mx-auto"
                style={{ width: 240, height: 240 }}
              >
                {flash && <div className="absolute inset-0 bg-white z-20 rounded-2xl pointer-events-none" />}
                {cameraError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
                    <i className="ri-camera-off-line text-red-400 text-3xl" />
                    <p className="text-red-400 text-xs">{cameraError}</p>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      style={{ transform: 'scaleX(-1)', filter: currentFilterCss !== 'none' ? currentFilterCss : undefined }}
                      muted
                      playsInline
                    />
                    {countdown !== null && (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <span className="text-white font-black text-6xl drop-shadow-lg">{countdown}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-28 h-28 rounded-full border-2 border-white/30 border-dashed" />
                    </div>
                  </>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>

              {/* Filtros */}
              <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {FILTERS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFilter(f.id)}
                    className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap border ${
                      selectedFilter === f.id
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-sm leading-none">{f.emoji}</span>
                    <span className="text-[10px] mt-0.5">{f.label}</span>
                  </button>
                ))}
              </div>

              {/* Botones */}
              {!cameraError ? (
                <div className="flex gap-3">
                  <button
                    onClick={doCapture}
                    disabled={countdown !== null}
                    className="flex-1 flex items-center justify-center gap-2 bg-white text-gray-900 rounded-2xl py-3 font-black text-sm cursor-pointer disabled:opacity-40 transition-colors whitespace-nowrap active:scale-95"
                  >
                    <i className="ri-camera-fill" /> Tomar foto
                  </button>
                  <button
                    onClick={handleTimer}
                    disabled={countdown !== null}
                    className="px-4 flex items-center justify-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-2xl py-3 font-bold text-sm cursor-pointer disabled:opacity-40 transition-colors whitespace-nowrap"
                  >
                    <i className="ri-timer-line" /> 3s
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl py-3 font-black text-sm cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-image-line" /> Subir desde galería
                </button>
              )}

              <button
                onClick={() => { stopCamera(); setPhase('source'); }}
                className="w-full text-gray-600 hover:text-gray-400 text-sm cursor-pointer py-1 text-center transition-colors"
              >
                ← Volver
              </button>
            </div>
          )}

          {/* ── Foto capturada — elegir filtro y confirmar ── */}
          {phase === 'captured' && (
            <div className="space-y-4">
              {/* Preview con filtro aplicado */}
              <div className="relative mx-auto rounded-2xl overflow-hidden" style={{ width: 240, height: 240 }}>
                {applyingFilter && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 rounded-2xl">
                    <i className="ri-loader-4-line animate-spin text-amber-400 text-2xl" />
                  </div>
                )}
                {previewUrl && (
                  <img src={previewUrl} alt="Vista previa" title="Vista previa de tu foto" className="w-full h-full object-cover" />
                )}
                {/* Overlay circular guía */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-32 h-32 rounded-full border-2 border-white/30 border-dashed" />
                </div>
              </div>

              {/* Filtros */}
              <div>
                <p className="text-gray-500 text-xs mb-2 text-center">Elige un filtro</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {FILTERS.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setSelectedFilter(f.id)}
                      className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap border ${
                        selectedFilter === f.id
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      <span className="text-sm leading-none">{f.emoji}</span>
                      <span className="text-[10px] mt-0.5">{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Acciones */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setRawUrl(null); setPreviewUrl(null); setPhase('source'); }}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-2xl py-3 font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
                >
                  <i className="ri-refresh-line" /> Repetir
                </button>
                <button
                  onClick={handleUpload}
                  disabled={applyingFilter}
                  className="flex-[2] flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-2xl py-3 font-black text-sm cursor-pointer transition-colors whitespace-nowrap"
                >
                  <i className="ri-upload-cloud-line" /> Guardar esta foto
                </button>
              </div>
            </div>
          )}

          {/* ── Subiendo ── */}
          {phase === 'uploading' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center">
                <i className="ri-loader-4-line animate-spin text-amber-400 text-3xl" />
              </div>
              <div className="text-center">
                <p className="text-white font-black text-base">Guardando tu foto...</p>
                <p className="text-gray-500 text-xs mt-1">Comprimiendo y subiendo a tu tarjeta</p>
              </div>
            </div>
          )}

          {/* ── Éxito ── */}
          {phase === 'done' && (
            <div className="flex flex-col items-center justify-center py-8 gap-5">
              <div className="relative">
                <img
                  src={uploadedUrl ?? previewUrl ?? ''}
                  alt="Tu nueva foto"
                  className="w-28 h-28 rounded-2xl object-cover border-4 border-amber-400"
                  onError={(e) => {
                    if (previewUrl) (e.target as HTMLImageElement).src = previewUrl;
                  }}
                />
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center border-2 border-gray-950">
                  <i className="ri-check-line text-white text-sm" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-white font-black text-lg">¡Foto guardada!</p>
                <p className="text-gray-400 text-sm mt-1">Ya aparece en tu tarjeta de lealtad</p>
                <p className="text-gray-600 text-xs mt-0.5">El cuadrito de tu tarjeta ya se actualizó</p>
              </div>
              <button
                onClick={handleClose}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl py-3.5 font-black text-sm cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className="ri-check-line" /> Perfecto, cerrar
              </button>
            </div>
          )}

          {/* ── Error ── */}
          {phase === 'error' && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                <i className="ri-error-warning-line text-red-400 text-3xl" />
              </div>
              <div className="text-center">
                <p className="text-white font-black text-base">No se pudo guardar</p>
                <p className="text-red-400 text-sm mt-1">{uploadError}</p>
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setPhase('source')}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-2xl py-3 font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
                >
                  Intentar de nuevo
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl py-3 font-bold text-sm cursor-pointer whitespace-nowrap"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}