import { useState, useRef, useCallback, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import html2canvas from 'html2canvas';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285';

const MENU_URL = 'https://www.barlacabrona.com';

// ── Precargar el logo como data URL para evitar CORS "tainted canvas" ──
function useLogoDataUrl(): string {
  const [dataUrl, setDataUrl] = useState(LOGO_URL);

  useEffect(() => {
    let cancelled = false;

    const loadAsDataUrl = async () => {
      // Método 1: fetch + FileReader (el más confiable)
      try {
        const res = await fetch(LOGO_URL, { mode: 'cors' });
        if (!res.ok) throw new Error('fetch failed');
        const blob = await res.blob();
        const result = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        if (!cancelled) setDataUrl(result);
        return;
      } catch {
        // Método 2: canvas + crossOrigin
        try {
          const result = await new Promise<string>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              const c = document.createElement('canvas');
              c.width = img.naturalWidth || img.width;
              c.height = img.naturalHeight || img.height;
              const ctx = c.getContext('2d');
              if (!ctx) { reject(new Error('no context')); return; }
              ctx.drawImage(img, 0, 0);
              try {
                resolve(c.toDataURL('image/png'));
              } catch {
                reject(new Error('tainted canvas'));
              }
            };
            img.onerror = () => reject(new Error('image load failed'));
            img.src = LOGO_URL;
          });
          if (!cancelled) setDataUrl(result);
        } catch {
          // Ambos métodos fallaron, dejamos la URL original (la descarga fallará pero al menos se ve en pantalla)
        }
      }
    };

    loadAsDataUrl();
    return () => { cancelled = true; };
  }, []);

  return dataUrl;
}

type CardStyle = 'dark' | 'light' | 'amber';

interface StyleConfig {
  id: CardStyle;
  label: string;
  bg: string;
  bgHex: string;
  text: string;
  sub: string;
  border: string;
  qrFg: string;
  qrBg: string;
  desc: string;
}

const STYLES: StyleConfig[] = [
  {
    id: 'dark',
    label: 'Oscuro',
    bg: 'bg-gray-950',
    bgHex: '#030712',
    text: 'text-white',
    sub: 'text-amber-400',
    border: 'border-amber-500',
    qrFg: '#F59E0B',
    qrBg: '#030712',
    desc: 'Fondo negro, código dorado',
  },
  {
    id: 'light',
    label: 'Claro',
    bg: 'bg-white',
    bgHex: '#ffffff',
    text: 'text-gray-900',
    sub: 'text-amber-600',
    border: 'border-amber-400',
    qrFg: '#92400E',
    qrBg: '#FFFFFF',
    desc: 'Fondo blanco, código café',
  },
  {
    id: 'amber',
    label: 'Dorado',
    bg: 'bg-amber-900',
    bgHex: '#78350F',
    text: 'text-white',
    sub: 'text-amber-200',
    border: 'border-amber-300',
    qrFg: '#FEF3C7',
    qrBg: '#78350F',
    desc: 'Fondo café dorado',
  },
];

type QrSize = 'small' | 'medium' | 'large';

interface SizeConfig {
  id: QrSize;
  label: string;
  px: number;
  cardWidth: string;
  desc: string;
}

const SIZES: SizeConfig[] = [
  { id: 'small', label: 'Chico', px: 140, cardWidth: 'w-52', desc: 'Para mesa o mesa alta' },
  { id: 'medium', label: 'Mediano', px: 180, cardWidth: 'w-64', desc: 'Recomendado · tamaño estándar' },
  { id: 'large', label: 'Grande', px: 220, cardWidth: 'w-80', desc: 'Para pared o entrada' },
];

interface QrCardProps {
  style: StyleConfig;
  size: SizeConfig;
  cardRef?: React.RefObject<HTMLDivElement | null>;
  logoDataUrl: string;
}

function QrCard({ style, size, cardRef, logoDataUrl }: QrCardProps) {
  return (
    <div
      ref={cardRef}
      className={`${style.bg} ${style.border} border-2 rounded-2xl p-6 flex flex-col items-center gap-4 ${size.cardWidth}`}
      style={{ fontFamily: "'Bebas Neue', sans-serif" }}
    >
      {/* Logo */}
      <img
        src={logoDataUrl}
        alt="La Cabrona"
        title="La Cabrona Alitas & Beer"
        className="w-20 h-20 rounded-full object-cover border-2 border-amber-500"
      />
      {/* Nombre */}
      <div className="text-center">
        <h2 className={`text-2xl tracking-widest ${style.text}`}>LA CABRONA</h2>
        <p className={`text-xs tracking-widest font-sans font-semibold uppercase ${style.sub}`}>
          Alitas &amp; Beer
        </p>
      </div>
      {/* QR */}
      <div className="p-3 rounded-xl" style={{ background: style.qrBg }}>
        <QRCodeCanvas
          value={MENU_URL}
          size={size.px}
          fgColor={style.qrFg}
          bgColor={style.qrBg}
          level="M"
          imageSettings={{
            src: logoDataUrl,
            x: undefined,
            y: undefined,
            height: size.px * 0.18,
            width: size.px * 0.18,
            excavate: true,
          }}
        />
      </div>
      {/* Instrucción */}
      <div className="text-center space-y-0.5">
        <p className={`text-xs font-sans font-bold uppercase tracking-widest ${style.sub}`}>
          Escanea y ve el
        </p>
        <p className={`text-2xl tracking-widest ${style.text}`}>MENÚ COMPLETO</p>
        <p className={`text-xs font-sans ${style.sub} opacity-60 mt-1`}>
          Regístrate y gana puntos de lealtad
        </p>
      </div>
      {/* Divider + URL */}
      <div className={`w-full border-t ${style.border} pt-3 text-center`}>
        <p className={`text-xs font-sans tracking-wider font-semibold ${style.sub} opacity-70`}>
          barlacabrona.com
        </p>
      </div>
    </div>
  );
}

async function downloadCardAsImage(element: HTMLElement, filename: string) {
  const canvas = await html2canvas(element, {
    backgroundColor: null,
    scale: 3,
    useCORS: true,
  });
  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export default function QrPage() {
  // Página utilitaria para generar QR, no es contenido de búsqueda

  const [selectedStyle, setSelectedStyle] = useState<CardStyle>('dark');
  const [selectedSize, setSelectedSize] = useState<QrSize>('medium');
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const logoDataUrl = useLogoDataUrl();

  const style = STYLES.find(s => s.id === selectedStyle)!;
  const size = SIZES.find(s => s.id === selectedSize)!;

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    await downloadCardAsImage(cardRef.current, 'QR-LaCabrona-Menu');
    setDownloading(false);
  }, []);

  const handlePrint = () => window.print();

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(MENU_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        @media print {
          body * { visibility: hidden; }
          #qr-print-area, #qr-print-area * { visibility: visible; }
          #qr-print-area {
            position: fixed;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>

      {/* Header */}
      <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <img
            src={LOGO_URL}
            alt="La Cabrona"
            title="La Cabrona Alitas & Beer"
            className="w-10 h-10 rounded-full object-cover"
          />
          <div>
            <h1 className="font-bold text-sm">QR del Menú — La Cabrona</h1>
            <p className="text-gray-400 text-xs">
              Un solo código QR para todo el bar · Los clientes se identifican al entrar
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className={copied ? 'ri-check-line text-green-400' : 'ri-link-m'} />
            {copied ? '¡Copiado!' : 'Copiar enlace'}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-printer-line" /> Imprimir
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
          >
            {downloading ? (
              <><i className="ri-loader-4-line animate-spin" /> Descargando...</>
            ) : (
              <><i className="ri-download-2-line" /> Descargar PNG</>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8">

        {/* ── Controles ── */}
        <div className="w-full lg:w-72 flex-shrink-0 space-y-5">

          {/* Cómo funciona */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <i className="ri-lightbulb-flash-line text-amber-600 text-lg" />
              <p className="text-sm font-bold text-amber-800">Cómo funciona</p>
            </div>
            <ul className="text-xs text-amber-700 space-y-1.5">
              <li className="flex items-start gap-1.5">
                <i className="ri-qr-code-line mt-0.5 flex-shrink-0" />
                <span>Imprimes <strong>un solo QR</strong> y lo pones en todas las mesas</span>
              </li>
              <li className="flex items-start gap-1.5">
                <i className="ri-smartphone-line mt-0.5 flex-shrink-0" />
                <span>El cliente escanea y ve el <strong>menú completo</strong></span>
              </li>
              <li className="flex items-start gap-1.5">
                <i className="ri-user-line mt-0.5 flex-shrink-0" />
                <span>Se le pide <strong>nombre y celular</strong> para registrarse o hacer check-in</span>
              </li>
              <li className="flex items-start gap-1.5">
                <i className="ri-vip-crown-2-fill mt-0.5 flex-shrink-0 text-amber-600" />
                <span>Acumula puntos automáticamente en cada visita</span>
              </li>
            </ul>
          </div>

          {/* Estilo */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-bold text-gray-900 text-sm mb-3">Estilo de la tarjeta</h3>
            <div className="space-y-2">
              {STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStyle(s.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all text-left ${
                    selectedStyle === s.id
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex-shrink-0 border border-gray-300`}
                    style={{ background: s.bgHex }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${selectedStyle === s.id ? 'text-amber-700' : 'text-gray-700'}`}>
                      {s.label}
                    </p>
                    <p className="text-xs text-gray-400">{s.desc}</p>
                  </div>
                  {selectedStyle === s.id && <i className="ri-check-line text-amber-500 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Tamaño */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-bold text-gray-900 text-sm mb-3">Tamaño del QR</h3>
            <div className="space-y-2">
              {SIZES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSize(s.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all text-left ${
                    selectedSize === s.id
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`flex items-center justify-center flex-shrink-0 ${
                    s.id === 'small' ? 'w-6 h-6' : s.id === 'medium' ? 'w-8 h-8' : 'w-10 h-10'
                  } rounded bg-gray-100`}>
                    <i className="ri-qr-code-line text-gray-500 text-xs" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${selectedSize === s.id ? 'text-amber-700' : 'text-gray-700'}`}>
                      {s.label}
                    </p>
                    <p className="text-xs text-gray-400">{s.desc}</p>
                  </div>
                  {selectedSize === s.id && <i className="ri-check-line text-amber-500 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Tips de impresión */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-bold text-gray-900 text-sm mb-3">Tips de impresión</h3>
            <ul className="text-xs text-gray-500 space-y-2">
              <li className="flex items-start gap-2">
                <i className="ri-shield-line text-green-500 mt-0.5 flex-shrink-0" />
                <span>Plastifica o usa porta-tarjetas acrílicos para mayor durabilidad</span>
              </li>
              <li className="flex items-start gap-2">
                <i className="ri-layout-masonry-line text-amber-500 mt-0.5 flex-shrink-0" />
                <span>Puedes imprimir varios por hoja y cortarlos</span>
              </li>
              <li className="flex items-start gap-2">
                <i className="ri-global-line text-gray-400 mt-0.5 flex-shrink-0" />
                <span>El QR siempre apunta a <strong>barlacabrona.com</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <i className="ri-recycle-line text-gray-400 mt-0.5 flex-shrink-0" />
                <span>Si cambias el menú, no necesitas reimprimir el QR</span>
              </li>
            </ul>
          </div>
        </div>

        {/* ── Vista previa ── */}
        <div className="flex-1">
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Vista previa</h3>
                <p className="text-gray-400 text-xs mt-0.5">Así se verá tu QR impreso</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
                >
                  <i className="ri-printer-line" /> Imprimir
                </button>
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
                >
                  {downloading ? (
                    <><i className="ri-loader-4-line animate-spin" /> Descargando...</>
                  ) : (
                    <><i className="ri-download-2-line" /> Descargar PNG</>
                  )}
                </button>
              </div>
            </div>

            {/* Preview centrado */}
            <div className="flex justify-center py-4" id="qr-print-area">
              <QrCard style={style} size={size} cardRef={cardRef} logoDataUrl={logoDataUrl} />
            </div>
          </div>

          {/* Flujo de cliente */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 text-sm mb-4">Flujo del cliente paso a paso</h3>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {[
                { icon: 'ri-qr-scan-2-line', color: 'bg-amber-100 text-amber-600', label: '1. Escanea el QR', desc: 'Con la cámara del cel' },
                { icon: 'ri-arrow-right-line', color: 'text-gray-300', label: '', desc: '', arrow: true },
                { icon: 'ri-user-add-line', color: 'bg-green-100 text-green-600', label: '2. Se identifica', desc: 'Nombre y celular' },
                { icon: 'ri-arrow-right-line', color: 'text-gray-300', label: '', desc: '', arrow: true },
                { icon: 'ri-restaurant-line', color: 'bg-orange-100 text-orange-600', label: '3. Ve el menú', desc: 'Menú completo con precios' },
                { icon: 'ri-arrow-right-line', color: 'text-gray-300', label: '', desc: '', arrow: true },
                { icon: 'ri-vip-crown-2-fill', color: 'bg-amber-100 text-amber-600', label: '4. Gana puntos', desc: 'Al cerrar su cuenta' },
              ].map((step, i) =>
                step.arrow ? (
                  <div key={i} className="hidden sm:flex w-6 h-6 items-center justify-center flex-shrink-0">
                    <i className={`${step.icon} ${step.color} text-xl`} />
                  </div>
                ) : (
                  <div key={i} className="flex-1 flex flex-col items-center text-center min-w-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2 ${step.color}`}>
                      <i className={`${step.icon} text-xl`} />
                    </div>
                    <p className="text-xs font-bold text-gray-800">{step.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{step.desc}</p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}