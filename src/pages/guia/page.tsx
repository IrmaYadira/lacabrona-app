import { useState, useEffect, useRef } from 'react';
import JsonLd from '@/components/JsonLd';

const LOGO_URL = 'https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285';

const GUIDA_JSONLD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Inicio', 'item': 'https://barlacabrona.com/' },
        { '@type': 'ListItem', 'position': 2, 'name': 'Guía para clientes', 'item': 'https://barlacabrona.com/guia' },
      ],
    },
    {
      '@type': 'HowTo',
      'name': 'Guía para clientes — Cómo disfrutar La Cabrona al máximo',
      'description': 'Descubre cómo ordenar, reservar, pagar y aprovechar todas las experiencias de La Cabrona Alitas & Beer en Zapopan. Una guía visual paso a paso desde tu celular.',
      'step': [
        { '@type': 'HowToStep', 'position': 1, 'name': 'Explora el menú digital', 'text': 'Abre barlacabrona.com en tu celular y toca Ver Menú. Navega por categorías: alitas, boneless, hamburguesas, cervezas, micheladas y más.' },
        { '@type': 'HowToStep', 'position': 2, 'name': 'Ordena desde tu mesa', 'text': 'Elige tu producto, selecciona salsa y toca el botón + para agregar al carrito. Tu pedido va directo a cocina.' },
        { '@type': 'HowToStep', 'position': 3, 'name': 'Pide por WhatsApp', 'text': 'Manda tu pedido al 33-4856-7795 por WhatsApp para recoger en el local.' },
        { '@type': 'HowToStep', 'position': 4, 'name': 'Reserva tu mesa', 'text': 'Desde tu celular elige fecha, hora y número de personas. Recibes confirmación por WhatsApp al instante.' },
        { '@type': 'HowToStep', 'position': 5, 'name': 'Revisa tu cuenta y paga', 'text': 'Ve tu consumo en tiempo real desde el celular. Elige propina y toca Pedir Cuenta. El mesero llega con todo listo.' },
        { '@type': 'HowToStep', 'position': 6, 'name': 'Gana puntos y disfruta', 'text': 'Acumula puntos por cada compra, canjea recompensas, juega billar y entérate de eventos especiales.' },
        { '@type': 'HowToStep', 'position': 7, 'name': 'Conoce nuestros horarios', 'text': 'Consulta los horarios de La Cabrona desde tu celular. Abrimos de lunes a jueves 13:00-00:00, viernes y sábado 14:00-02:00, domingo 14:00-23:00.' },
      ],
    },
  ],
};

interface StepType {
  num: number;
  titulo: string;
  subtitulo: string;
  icono: string;
  accion: string;
  pasos: string[];
  tip: string;
  imgSrc: string;
  imgAlt: string;
  touchPosition: { top: string; left: string };
  touchLabel: string;
}

const STEPS: StepType[] = [
  {
    num: 1,
    titulo: 'Explora el menú',
    subtitulo: 'Todas las categorías en tu celular',
    icono: 'ri-restaurant-line',
    imgSrc: 'https://readdy.ai/api/search-image?query=smartphone%20screen%20mockup%20showing%20sports%20bar%20digital%20menu%20browsing%20interface%20with%20food%20categories%20like%20chicken%20wings%20boneless%20burgers%20beer%20micheladas%20each%20category%20section%20with%20appetizing%20photos%20and%20prices%20listed%20amber%20dark%20charcoal%20color%20scheme%20green%20accent%20buttons%20clean%20mobile%20web%20interface%20no%20visible%20brand%20logo&width=600&height=960&seq=guia-cel-new-03&orientation=portrait',
    imgAlt: 'Celular mostrando el menú digital de La Cabrona — alitas, cheves, micheladas',
    pasos: [
      'Toca "Ver Menú" en la página principal',
      'Desliza entre categorías: alitas, burgers, cheve...',
      'Cada producto tiene foto y precio',
    ],
    tip: 'Toca el corazón ❤️ para guardar tus favoritos.',
    touchPosition: { top: '45%', left: '35%' },
    touchLabel: 'Toca Ver Menú para empezar',
    accion: 'Navega y descubre',
  },
  {
    num: 2,
    titulo: 'Ordena desde tu mesa',
    subtitulo: 'Elige y agrega al carrito',
    icono: 'ri-shopping-basket-line',
    imgSrc: 'https://readdy.ai/api/search-image?query=smartphone%20screen%20mockup%20showing%20sports%20bar%20digital%20food%20menu%20with%20categories%20like%20chicken%20wings%20boneless%20burgers%20micheladas%20beer%20each%20section%20with%20appetizing%20food%20photos%20and%20prices%20amber%20dark%20charcoal%20color%20scheme%20green%20accent%20buttons%20realistic%20mobile%20web%20menu%20interface%20with%20food%20photography%20no%20visible%20brand%20logo&width=600&height=960&seq=guia-cel-new-02&orientation=portrait',
    imgAlt: 'Celular mostrando el carrito de compras — agrega alitas y cheve al pedido',
    pasos: [
      'Elige tu producto y la salsa que quieras',
      'Toca el botón + para agregar al carrito',
      'Tu orden va directo a cocina. Sin esperar al mesero',
    ],
    tip: 'Pide por rondas. Si se te antoja más después, vuelve a pedir.',
    touchPosition: { top: '55%', left: '75%' },
    touchLabel: 'Toca el + para agregar al carrito',
    accion: 'Agrega y confirma',
  },
  {
    num: 3,
    titulo: 'Pide por WhatsApp',
    subtitulo: 'Para llevar cuando quieras',
    icono: 'ri-whatsapp-line',
    imgSrc: 'https://readdy.ai/api/search-image?query=smartphone%20screen%20mockup%20showing%20WhatsApp%20chat%20conversation%20for%20restaurant%20food%20ordering%20green%20message%20bubbles%20with%20food%20order%20details%20pickup%20time%20confirmation%20realistic%20mobile%20phone%20chat%20interface%20with%20ordering%20context%20no%20visible%20brand%20logo&width=600&height=960&seq=guia-cel-new-04&orientation=portrait',
    imgAlt: 'Celular mostrando WhatsApp — manda tu pedido para llevar al 33-4856-7795',
    pasos: [
      'Abre WhatsApp y manda mensaje al 33-4856-7795',
      'Dile qué quieres y para cuándo lo recoges',
      'Aceptamos efectivo, tarjeta y transferencia',
    ],
    tip: 'Los combos salen más baratos para llevar. Revisa la sección de Combos.',
    touchPosition: { top: '70%', left: '50%' },
    touchLabel: 'Toca aquí para enviar mensaje',
    accion: 'Manda tu pedido',
  },
  {
    num: 4,
    titulo: 'Reserva tu mesa',
    subtitulo: 'Aparta lugar en 1 minuto',
    icono: 'ri-calendar-check-line',
    imgSrc: 'https://readdy.ai/api/search-image?query=smartphone%20screen%20mockup%20showing%20sports%20bar%20table%20reservation%20booking%20form%20with%20date%20picker%20calendar%20time%20selector%20and%20number%20of%20people%20dropdown%20fields%20amber%20dark%20charcoal%20color%20scheme%20green%20confirm%20reservation%20button%20clean%20mobile%20web%20form%20interface%20no%20visible%20brand%20logo&width=600&height=960&seq=guia-cel-new-05&orientation=portrait',
    imgAlt: 'Celular mostrando formulario de reservación — elige fecha, hora y personas',
    pasos: [
      'Toca "Reservar" desde el menú principal',
      'Elige fecha, hora y número de personas',
      'Recibes confirmación al instante por WhatsApp',
    ],
    tip: '¿Cumpleaños? Avísanos al reservar y te preparamos algo especial.',
    touchPosition: { top: '72%', left: '50%' },
    touchLabel: 'Toca Reservar para confirmar',
    accion: 'Elige y confirma',
  },
  {
    num: 5,
    titulo: 'Revisa tu cuenta y paga',
    subtitulo: 'Ve tu consumo en tiempo real',
    icono: 'ri-bill-line',
    imgSrc: 'https://readdy.ai/api/search-image?query=smartphone%20screen%20mockup%20showing%20restaurant%20bill%20checkout%20with%20itemized%20list%20of%20chicken%20wings%20beers%20micheladas%20quantities%20and%20prices%20tip%20selector%20showing%2010%2015%2020%20percent%20options%20total%20amount%20displayed%20green%20pay%20button%20amber%20dark%20charcoal%20color%20scheme%20clean%20mobile%20web%20bill%20screen%20no%20visible%20brand%20logo&width=600&height=960&seq=guia-cel-new-06&orientation=portrait',
    imgAlt: 'Celular mostrando la cuenta — revisa tu consumo, elige propina y pide la cuenta',
    pasos: [
      'Ve tu cuenta en vivo: productos, cantidades y precios',
      'Elige tu propina: 10%, 15%, 20% u otra cantidad',
      'Toca "Pedir Cuenta" y el mesero llega con todo listo',
    ],
    tip: 'Revisa tu cuenta antes de cerrar. Si algo no cuadra, se ajusta al momento.',
    touchPosition: { top: '75%', left: '50%' },
    touchLabel: 'Toca Pedir Cuenta cuando estés listo',
    accion: 'Revisa y paga',
  },
  {
    num: 6,
    titulo: 'Gana puntos y disfruta',
    subtitulo: 'Lealtad, billar y eventos',
    icono: 'ri-vip-crown-line',
    imgSrc: 'https://readdy.ai/api/search-image?query=smartphone%20screen%20mockup%20showing%20sports%20bar%20loyalty%20rewards%20dashboard%20with%20points%20balance%20displayed%20reward%20tiers%20showing%20free%20items%20discounts%20and%20upcoming%20special%20events%20banner%20amber%20dark%20charcoal%20color%20scheme%20with%20gold%20green%20accents%20clean%20mobile%20web%20loyalty%20screen%20no%20visible%20brand%20logo&width=600&height=960&seq=guia-cel-new-07&orientation=portrait',
    imgAlt: 'Celular mostrando puntos de lealtad — acumula, canjea y juega billar',
    pasos: [
      'Cada compra suma puntos automáticamente',
      'Canjea por alitas gratis, descuentos y más',
      'Billar profesional, renta por hora desde el menú',
    ],
    tip: 'Entre más vienes, más ganas. Pregunta por tu saldo de puntos.',
    touchPosition: { top: '50%', left: '50%' },
    touchLabel: 'Toca aquí para ver tus puntos',
    accion: 'Acumula y canjea',
  },
  {
    num: 7,
    titulo: 'Conoce nuestros horarios',
    subtitulo: 'Consulta cuándo abrimos desde tu celular',
    icono: 'ri-time-line',
    imgSrc: 'https://readdy.ai/api/search-image?query=smartphone%20screen%20mockup%20showing%20restaurant%20hours%20schedule%20display%20with%20warm%20amber%20and%20dark%20charcoal%20color%20scheme%20sports%20bar%20aesthetic%20opening%20hours%20Monday%20to%20Thursday%201PM%20to%2012AM%20Friday%20Saturday%202PM%20to%202AM%20Sunday%202PM%20to%2011PM%20clean%20mobile%20web%20interface%20realistic%20phone%20screenshot%20with%20dark%20warm%20background%20no%20visible%20brand%20logo&width=600&height=960&seq=guia-cel-new-01&orientation=portrait',
    imgAlt: 'Celular mostrando horarios de La Cabrona — consulta cuándo abrimos',
    pasos: [
      'Abre barlacabrona.com en tu celular',
      'Desliza hasta la sección de horarios',
      'Checa qué día te conviene más venir',
    ],
    tip: 'Los fines de semana se llena. Reserva con anticipación.',
    touchPosition: { top: '65%', left: '50%' },
    touchLabel: 'Toca aquí para ver horarios',
    accion: 'Desliza y consulta',
  },
];

function PhoneMockup({ step, invertido }: { step: StepType; invertido: boolean }) {
  const seccionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [mostrarTip, setMostrarTip] = useState(false);
  const [imgCargada, setImgCargada] = useState(false);

  useEffect(() => {
    const el = seccionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={seccionRef}
      className={`flex flex-col ${invertido ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-6 md:gap-10 lg:gap-14 transition-all duration-700 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
    >
      {/* Celular mockup */}
      <div className="w-full lg:w-[340px] xl:w-[380px] flex-shrink-0 flex justify-center">
        <div className="relative">
          {/* Marco del celular */}
          <div className="relative w-[260px] md:w-[300px] bg-gray-900 rounded-[40px] p-2 shadow-2xl shadow-black/20">
            {/* Notch */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-6 bg-gray-900 rounded-b-2xl z-20 flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-700" />
              <div className="w-10 h-1.5 rounded-full bg-gray-800" />
            </div>
            {/* Pantalla */}
            <div className="relative w-full aspect-[9/19] bg-white rounded-[32px] overflow-hidden">
              {!imgCargada && (
                <div className="absolute inset-0 bg-background-200 animate-pulse" />
              )}
              <img
                src={step.imgSrc}
                alt={step.imgAlt}
                title={`Paso ${step.num}: ${step.titulo} — La Cabrona Alitas & Beer`}
                className={`w-full h-full object-cover object-top transition-opacity duration-500 ${imgCargada ? 'opacity-100' : 'opacity-0'}`}
                loading={step.num <= 2 ? 'eager' : 'lazy'}
                onLoad={() => setImgCargada(true)}
              />

              {/* Header de app con logo real — barra negra sólida que tapa TODO lo de la IA */}
              <div className="absolute top-0 left-0 right-0 z-10 bg-black flex items-center gap-2.5 px-3.5 py-3">
                <img
                  src={LOGO_URL}
                  alt="La Cabrona"
                  className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                />
                <span className="text-white text-xs font-bold tracking-wider whitespace-nowrap">
                  LA CABRONA
                </span>
              </div>

              {/* Overlay sutil para legibilidad del indicador */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />

              {/* Indicador de toque pulsante */}
              <div
                className="absolute z-10 animate-phoneTap"
                style={{ top: step.touchPosition.top, left: step.touchPosition.left, transform: 'translate(-50%, -50%)' }}
              >
                <div className="relative">
                  {/* Ondas pulsantes */}
                  <div className="absolute inset-0 w-12 h-12 rounded-full bg-green-400/30 animate-ripple1" />
                  <div className="absolute inset-0 w-12 h-12 rounded-full bg-green-400/20 animate-ripple2" />
                  {/* Círculo principal */}
                  <div className="w-12 h-12 rounded-full bg-green-500/80 backdrop-blur-sm flex items-center justify-center border-2 border-white/40 shadow-lg shadow-green-500/30">
                    <i className="ri-fingerprint-line text-white text-xl" />
                  </div>
                </div>
              </div>

              {/* Etiqueta flotante de acción */}
              <div
                className="absolute z-10 bg-black/70 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20 whitespace-nowrap animate-phoneFloat"
                style={{
                  top: `calc(${step.touchPosition.top} + 40px)`,
                  left: step.touchPosition.left,
                  transform: 'translateX(-50%)',
                }}
              >
                {step.touchLabel}
              </div>
            </div>
            {/* Botón home */}
            <div className="flex justify-center py-2">
              <div className="w-24 h-1 rounded-full bg-gray-700" />
            </div>
          </div>

          {/* Sombra decorativa */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[200px] h-4 bg-black/10 rounded-full blur-xl" />
        </div>
      </div>

      {/* Contenido del paso */}
      <div className="flex-1 min-w-0 text-center lg:text-left">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-600 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-3 border border-green-500/20">
          <i className={step.icono} />
          Paso {step.num} de 7
        </div>

        <h3 className="font-[Bebas_Neue] text-2xl md:text-3xl text-foreground-950 tracking-wide mb-1">
          {step.titulo}
        </h3>
        <p className="text-foreground-500 text-sm md:text-base mb-5">{step.subtitulo}</p>

        {/* Pasos numerados */}
        <div className="space-y-3 mb-5">
          {step.pasos.map((p, i) => (
            <div key={i} className="flex items-start gap-3 text-sm text-foreground-700">
              <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">
                {i + 1}
              </div>
              <span className="leading-relaxed">{p}</span>
            </div>
          ))}
        </div>

        {/* Acción destacada */}
        <div className="inline-flex items-center gap-2 bg-primary-500/10 text-primary-600 px-3 py-1.5 rounded-lg text-xs font-bold mb-3 border border-primary-500/20">
          <i className="ri-cursor-line" />
          {step.accion}
        </div>

        {/* Tip cabrón desplegable */}
        <div className="mt-2">
          <button
            onClick={() => setMostrarTip(!mostrarTip)}
            className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-800 cursor-pointer hover:bg-amber-100 transition-colors"
          >
            <i className={`${mostrarTip ? 'ri-lightbulb-flash-fill' : 'ri-lightbulb-flash-line'} text-amber-500`} />
            <span className="font-bold">Tip cabrón</span>
            {mostrarTip ? (
              <i className="ri-arrow-up-s-line text-amber-400" />
            ) : (
              <i className="ri-arrow-down-s-line text-amber-400" />
            )}
          </button>

          {mostrarTip && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 animate-[guideFadeIn_0.3s_ease-out]">
              <p className="text-sm text-amber-800 leading-relaxed">{step.tip}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GuiaPage() {
  const heroImageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const img = heroImageRef.current;
    if (!img) return;

    let rafId: number;
    const handleScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const section = img.parentElement?.parentElement;
        if (!section) return;
        const rect = section.getBoundingClientRect();
        const scrollOffset = -rect.top * 0.35;
        if (rect.bottom > 0 && rect.top < window.innerHeight) {
          img.style.transform = `translateY(${scrollOffset}px)`;
        }
        rafId = 0;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background-50">
      <JsonLd data={GUIDA_JSONLD} />

      {/* Navbar pública */}
      <nav className="sticky top-0 z-50 bg-background-50/95 backdrop-blur-sm border-b border-background-200/70">
        <div className="w-full px-4 md:px-8 max-w-7xl mx-auto flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-3 cursor-pointer min-w-0">
            <img
              src={LOGO_URL}
              alt="La Cabrona"
              title="La Cabrona Alitas & Beer"
              className="h-10 md:h-12 w-auto object-contain flex-shrink-0"
            />
            <div className="hidden sm:block text-left min-w-0">
              <span className="font-[Bebas_Neue] text-lg md:text-xl tracking-wider text-foreground-950">
                LA CABRONA
              </span>
            </div>
          </a>
          <div className="flex items-center gap-2 md:gap-4">
            <a
              href="/menu"
              className="text-sm font-medium text-foreground-700 hover:text-foreground-950 transition-colors cursor-pointer whitespace-nowrap hidden sm:inline-flex items-center gap-1"
            >
              <i className="ri-restaurant-line" />
              Menú
            </a>
            <a
              href="/reservas"
              className="text-sm font-medium text-foreground-700 hover:text-foreground-950 transition-colors cursor-pointer whitespace-nowrap hidden sm:inline-flex items-center gap-1"
            >
              <i className="ri-calendar-line" />
              Reservas
            </a>
            <a
              href="/menu"
              className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 px-4 py-2 rounded-full text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-shopping-cart-2-line" />
              Ver Menú
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative w-full bg-gray-900 overflow-hidden">
        <div className="absolute inset-0 h-[130%] -top-[15%]" ref={heroImageRef}>
          <img
            src="https://static.readdy.ai/image/9559dab24a07659558f8d95c0e5c303b/eb63ba85345a5cf5174984d39fd2e27a.png"
            alt="Interior de La Cabrona Alitas & Beer en Zapopan — mesas rojas, mural decorativo y ambiente cálido"
            title="La Cabrona Alitas & Beer — Interior del restaurante"
            className="w-full h-full object-cover object-center"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
        </div>
        <div className="relative w-full px-4 md:px-8 max-w-7xl mx-auto py-14 md:py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-300 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6 border border-green-500/30">
            <i className="ri-smartphone-line" />
            Guía paso a paso desde tu celular
          </div>
          <h1 className="font-[Bebas_Neue] text-4xl md:text-6xl text-white tracking-wide mb-4">
            Así se usa La Cabrona
          </h1>
          <p className="text-gray-300 max-w-lg mx-auto text-sm md:text-lg leading-relaxed">
            Siete pasos bien ilustrados. Mira la pantalla de tu celular y sigue el circulito verde.
            La clientela de bar no lee — la clientela de bar ve y pica.
          </p>
          <div className="flex items-center justify-center gap-3 mt-8">
            <a
              href="#pasos"
              className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-arrow-down-line" />
              Ver los 7 pasos
            </a>
            <a
              href="/menu"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-6 py-3 rounded-xl font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-restaurant-line" />
              Ir al menú
            </a>
          </div>
        </div>
      </section>

      {/* Pasos */}
      <main id="pasos" className="w-full px-4 md:px-8 max-w-5xl mx-auto py-12 md:py-20">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-foreground-500 uppercase tracking-wide mb-2">Guía visual</p>
          <h2 className="font-[Bebas_Neue] text-3xl md:text-4xl text-foreground-950 tracking-wide">
            Sigue el celular paso a paso
          </h2>
          <p className="text-foreground-500 text-sm mt-2 max-w-md mx-auto">
            Cada paso te muestra exactamente qué pantalla ver y dónde tocar.
          </p>
        </div>

        <div className="space-y-20 md:space-y-28">
          {STEPS.map((step, idx) => (
            <PhoneMockup key={step.num} step={step} invertido={idx % 2 === 1} />
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-20 text-center bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-8 md:p-10 border border-green-100">
          <div className="w-16 h-16 rounded-2xl bg-green-500 flex items-center justify-center mx-auto mb-5 rotate-3">
            <i className="ri-emotion-happy-line text-white text-3xl" />
          </div>
          <h3 className="font-[Bebas_Neue] text-2xl md:text-3xl text-foreground-950 tracking-wide mb-2">
            ¿Listo para tu primera visita?
          </h3>
          <p className="text-foreground-500 text-sm max-w-md mx-auto mb-5">
            Ya sabes cómo está el pedo. Ven con hambre, ganas de pistear y
            prepárate para una experiencia cabrona.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/menu"
              className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-restaurant-line" />
              Ver el menú
            </a>
            <a
              href="/reservas"
              className="inline-flex items-center gap-2 bg-background-100 hover:bg-background-200 text-foreground-700 border border-background-300/60 px-6 py-3 rounded-xl font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-calendar-check-line" />
              Reservar mesa
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 md:py-10">
        <div className="w-full px-4 md:px-8 max-w-7xl mx-auto text-center">
          <p className="font-[Bebas_Neue] text-lg md:text-xl tracking-wider mb-2">
            LA CABRONA — ALITAS & BEER
          </p>
          <p className="text-xs md:text-sm text-gray-400 mb-4">
            Calle Sinaloa 690, Colonia El Mante, Zapopan, Jalisco
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-400 flex-wrap">
            <a href="https://wa.me/523348567795" target="_blank" rel="noopener noreferrer" className="hover:text-green-400 transition-colors">
              <i className="ri-whatsapp-line mr-1" />
              WhatsApp
            </a>
            <span className="text-gray-600">|</span>
            <span>
              <i className="ri-phone-line mr-1" />
              33-4856-7795
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-4 md:mt-6">
            © 2026 La Cabrona. Todos los derechos reservados.
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes guideFadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes phoneTap {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.1); }
        }

        @keyframes ripple1 {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.5); opacity: 0; }
        }

        @keyframes ripple2 {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(2); opacity: 0; }
        }

        @keyframes phoneFloat {
          0%, 100% { transform: translate(-50%, 0); }
          50% { transform: translate(-50%, -4px); }
        }

        .animate-phoneTap {
          animation: phoneTap 2s ease-in-out infinite;
        }

        .animate-ripple1 {
          animation: ripple1 2s ease-out infinite;
        }

        .animate-ripple2 {
          animation: ripple2 2s ease-out infinite 0.5s;
        }

        .animate-phoneFloat {
          animation: phoneFloat 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}