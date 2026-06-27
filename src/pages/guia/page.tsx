import { useState, useRef, useEffect } from 'react';
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
      'description': 'Descubre cómo ordenar, reservar, pagar y aprovechar todas las experiencias de La Cabrona Alitas & Beer en Zapopan. Una guía rápida para nuevos clientes.',
      'step': [
        { '@type': 'HowToStep', 'position': 1, 'name': 'Encuéntranos y conoce nuestros horarios', 'text': 'Estamos en Calle Sinaloa 690, Colonia El Mante, Zapopan. Abrimos de lunes a jueves 13:00-00:00, viernes y sábado 14:00-02:00, domingo 14:00-23:00.' },
        { '@type': 'HowToStep', 'position': 2, 'name': 'Explora el menú digital', 'text': 'Navega por nuestro menú completo: alitas, boneless, hamburguesas, cervezas, micheladas y más. Todo con fotos, descripciones y precios.' },
        { '@type': 'HowToStep', 'position': 3, 'name': 'Ordena desde tu mesa', 'text': 'Agrega productos al carrito desde el menú digital. Tu pedido llega directo a cocina y barra, sin esperar al mesero.' },
        { '@type': 'HowToStep', 'position': 4, 'name': 'Pide por WhatsApp o para llevar', 'text': 'También puedes hacer tu pedido por WhatsApp al 33-4856-7795 para recoger o entrega a domicilio.' },
        { '@type': 'HowToStep', 'position': 5, 'name': 'Haz tu reservación', 'text': 'Reserva mesa para el fin de semana o eventos especiales desde nuestra página de reservas.' },
        { '@type': 'HowToStep', 'position': 6, 'name': 'Revisa tu cuenta y paga fácil', 'text': 'Ve tu cuenta desde el celular, revisa cada producto y pide la cuenta cuando estés listo.' },
        { '@type': 'HowToStep', 'position': 7, 'name': 'Lealtad, billar y eventos', 'text': 'Acumula puntos por cada compra, juega billar profesional y entérate de eventos especiales y promos del día.' },
      ],
    },
  ],
};

const STEPS = [
  {
    num: 1,
    title: 'Encuéntranos y conoce nuestros horarios',
    icon: 'ri-map-pin-line',
    image: 'https://static.readdy.ai/image/9559dab24a07659558f8d95c0e5c303b/107476e165763d518a1e4bfc5e1536be.jpeg',
    what: 'Estamos en Calle Sinaloa 690, Colonia El Mante, Zapopan, Jalisco.',
    how: [
      'Fácil acceso desde Avenida Patria, con estacionamiento amplio y seguro.',
      'Abrimos de lunes a jueves: 1 PM a 12 AM.',
      'Viernes y sábado: 2 PM a 2 AM — los días más prendidos.',
      'Domingo: 2 PM a 11 PM — ideal para tarde familiar.',
      'Somos pet friendly. Trae a tu mascota, solo pórtense bien los dos.',
    ],
    tip: 'Los fines de semana se llena rápido. Haz tu reservación con anticipación para asegurar mesa.',
  },
  {
    num: 2,
    title: 'Explora el menú digital',
    icon: 'ri-smartphone-line',
    image: 'https://readdy.ai/api/search-image?query=friends%20gathered%20around%20a%20wooden%20table%20at%20a%20lively%20mexican%20bar%20looking%20at%20a%20smartphone%20screen%20showing%20a%20colorful%20food%20menu%20with%20wings%20and%20beer%20warm%20ambiance%20amber%20pendant%20lights%20overhead%20casual%20joyful%20atmosphere%20illustration%20style%20soft%20warm%20tones&width=800&height=500&seq=guia-cliente-02&orientation=landscape',
    what: 'Navega por nuestro menú completo desde tu celular. Sin descargar nada.',
    how: [
      'Entra a barlacabrona.com desde tu celular y da click en "Ver Menú".',
      'Explora por categorías: alitas, boneless, hamburguesas, cervezas, micheladas y más.',
      'Cada producto tiene foto, descripción, precio y salsas disponibles.',
      'Usa el buscador para encontrar rápido lo que se te antoje.',
      'Marca tus favoritos con el corazón para pedirlos después.',
    ],
    tip: 'Tenemos 12 sabores de alitas. Si no sabes cuál elegir, pregúntale al mesero por los más populares: BBQ, Mango Habanero y Buffalo.',
  },
  {
    num: 3,
    title: 'Ordena desde tu mesa',
    icon: 'ri-shopping-basket-line',
    image: 'https://readdy.ai/api/search-image?query=young%20mexican%20couple%20at%20a%20wooden%20bar%20table%20smiling%20while%20tapping%20on%20their%20phone%20to%20order%20food%20and%20drinks%20warm%20amber%20lighting%20cozy%20bar%20interior%20with%20beer%20bottles%20on%20the%20table%20joyful%20casual%20dining%20experience%20illustration%20style%20soft%20warm%20tones&width=800&height=500&seq=guia-cliente-03&orientation=landscape',
    what: 'Agrega productos al carrito y tu pedido llega directo a la cocina y barra.',
    how: [
      'Elige tu producto, selecciona la salsa si son alitas o boneless.',
      'Click en el botón "+" para agregar al carrito.',
      'Puedes agregar notas especiales como "sin cebolla" o "bien cocida".',
      'Revisa tu pedido en el carrito y confirma.',
      'Tu orden se envía automáticamente. Solo espera a que llegue a tu mesa.',
    ],
    tip: 'Pide por rondas. Si después se te antoja algo más, solo vuelve a agregar. Cada ronda llega fresca.',
  },
  {
    num: 4,
    title: 'Pide por WhatsApp o para llevar',
    icon: 'ri-whatsapp-line',
    image: 'https://readdy.ai/api/search-image?query=mexican%20bar%20staff%20member%20smiling%20while%20packing%20a%20to%20go%20order%20of%20chicken%20wings%20and%20beer%20into%20a%20branded%20paper%20bag%20warm%20amber%20interior%20lighting%20friendly%20professional%20service%20counter%20with%20menu%20visible%20illustration%20style%20soft%20warm%20tones&width=800&height=500&seq=guia-cliente-04&orientation=landscape',
    what: '¿Prefieres comer en casa? Pide por WhatsApp y recoge o te llevamos.',
    how: [
      'Envía un mensaje al 33-4856-7795 con tu pedido.',
      'Coordinamos: puede ser para recoger en el local o entrega a domicilio.',
      'También puedes armar tu pedido en el menú digital y enviarlo por WhatsApp.',
      'Aceptamos efectivo, tarjeta y transferencia.',
      'El servicio a domicilio cubre Zapopan y zonas aledañas.',
    ],
    tip: 'Los combos son la mejor opción para llevar. Incluyen alitas, acompañamiento y bebida a mejor precio.',
  },
  {
    num: 5,
    title: 'Haz tu reservación',
    icon: 'ri-calendar-check-line',
    image: 'https://readdy.ai/api/search-image?query=group%20of%20friends%20joyfully%20arriving%20at%20a%20warmly%20lit%20mexican%20bar%20being%20greeted%20and%20shown%20to%20a%20reserved%20table%20with%20a%20reserved%20sign%20on%20it%20festive%20atmosphere%20amber%20lighting%20comfortable%20booth%20seating%20celebration%20vibe%20illustration%20style%20soft%20warm%20tones&width=800&height=500&seq=guia-cliente-05&orientation=landscape',
    what: 'Reserva mesa para cualquier día, especialmente recomendado en fines de semana.',
    how: [
      'Ve a la sección "Reservar" desde el menú principal.',
      'Elige fecha, hora y número de personas.',
      'Déjanos tu nombre y teléfono para confirmar.',
      'Recibirás confirmación por WhatsApp.',
      'Si necesitas cancelar o cambiar, solo avísanos.',
    ],
    tip: '¿Cumpleaños o evento especial? Avísanos al reservar. Te preparamos algo especial sin costo extra.',
  },
  {
    num: 6,
    title: 'Revisa tu cuenta y paga fácil',
    icon: 'ri-bill-line',
    image: 'https://readdy.ai/api/search-image?query=two%20mexican%20friends%20at%20a%20bar%20table%20reviewing%20their%20bill%20on%20a%20smartphone%20screen%20with%20satisfied%20expressions%20warm%20amber%20lighting%20empty%20plates%20and%20beer%20bottles%20on%20the%20table%20casual%20relaxed%20end%20of%20meal%20moment%20illustration%20style%20soft%20warm%20tones&width=800&height=500&seq=guia-cliente-06&orientation=landscape',
    what: 'Desde tu celular puedes ver tu cuenta en tiempo real y pedir la cuenta cuando quieras.',
    how: [
      'Entra a "Ver mi cuenta" desde el menú principal.',
      'Ahí ves todos los productos que has pedido, cantidades y precios.',
      'El total se actualiza en tiempo real conforme agregas cosas.',
      'Cuando estés listo para pagar, toca "Pedir cuenta".',
      'El mesero llega a tu mesa con la cuenta lista. Pagas y listo.',
    ],
    tip: 'Revisa tu cuenta antes de pedir el cierre. Si algo no cuadra, el mesero lo ajusta al momento.',
  },
  {
    num: 7,
    title: 'Lealtad, billar y eventos',
    icon: 'ri-vip-crown-line',
    image: 'https://readdy.ai/api/search-image?query=group%20of%20friends%20celebrating%20and%20cheering%20at%20a%20mexican%20bar%20while%20one%20holds%20up%20a%20loyalty%20card%20or%20phone%20showing%20points%20earned%20warm%20amber%20lighting%20pool%20table%20in%20the%20background%20festive%20joyful%20atmosphere%20balloons%20decoration%20illustration%20style%20soft%20warm%20tones&width=800&height=500&seq=guia-cliente-07&orientation=landscape',
    what: 'Cada visita suma puntos. Además tenemos billar profesional y eventos especiales.',
    how: [
      'Por cada compra acumulas puntos de lealtad automáticamente.',
      'Canjea tus puntos por productos gratis, descuentos y promos exclusivas.',
      'Tenemos mesas de billar profesionales. Rentas por hora desde el menú.',
      'Eventos especiales: música en vivo, torneos, noches temáticas.',
      'Revisa las promos del día en la página de inicio — cambian cada día.',
    ],
    tip: 'Los clientes frecuentes reciben recompensas especiales. Entre más vienes, más ganas. Pregunta por tu saldo de puntos.',
  },
];

export default function GuiaPage() {
  const [expanded, setExpanded] = useState<number | null>(null);
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

  const toggleStep = (num: number) => {
    setExpanded(prev => prev === num ? null : num);
  };

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
        <div className="relative w-full px-4 md:px-8 max-w-7xl mx-auto py-16 md:py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-300 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6 border border-green-500/30">
            <i className="ri-user-smile-line" />
            Guía rápida para clientes
          </div>
          <h1 className="font-[Bebas_Neue] text-4xl md:text-6xl text-white tracking-wide mb-4">
            Bienvenido a La Cabrona
          </h1>
          <p className="text-gray-300 max-w-xl mx-auto text-base md:text-lg leading-relaxed">
            Todo lo que necesitas saber para disfrutar al máximo: cómo ordenar,
            reservar, pagar y aprovechar cada visita. En 5 minutos eres todo un cabrón.
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
      <main id="pasos" className="w-full px-4 md:px-8 max-w-4xl mx-auto py-12 md:py-16">
        <div className="text-center mb-10">
          <p className="text-sm font-semibold text-foreground-500 uppercase tracking-wide mb-2">7 pasos</p>
          <h2 className="font-[Bebas_Neue] text-3xl md:text-4xl text-foreground-950 tracking-wide">
            Cómo disfrutar La Cabrona al máximo
          </h2>
        </div>

        <div className="space-y-4">
          {STEPS.map((step) => {
            const isOpen = expanded === step.num;
            return (
              <div
                key={step.num}
                className="bg-background-50 rounded-2xl border border-background-200/70 overflow-hidden transition-all duration-300 hover:border-green-300/50"
              >
                <button
                  onClick={() => toggleStep(step.num)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left cursor-pointer group"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                    isOpen ? 'bg-green-500 text-white' : 'bg-green-100 text-green-600 group-hover:bg-green-200'
                  }`}>
                    <span className="font-black text-sm">{step.num}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <i className={`${step.icon} ${isOpen ? 'text-green-500' : 'text-foreground-400'} text-lg`} />
                      <h3 className={`font-bold text-base ${isOpen ? 'text-green-600' : 'text-foreground-950'}`}>
                        {step.title}
                      </h3>
                    </div>
                    <p className="text-sm text-foreground-500 mt-0.5 line-clamp-1">{step.what}</p>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    isOpen ? 'bg-green-100 text-green-600 rotate-180' : 'bg-background-100 text-foreground-400 group-hover:bg-background-200'
                  }`}>
                    <i className="ri-arrow-down-s-line" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-0 animate-[guideFadeIn_0.3s_ease-out]">
                    <div className="rounded-xl overflow-hidden mb-4 bg-background-100">
                      <img
                        src={step.image}
                        alt={`La Cabrona — ${step.title}`}
                        title={`Paso ${step.num}: ${step.title}`}
                        className="w-full h-52 md:h-64 object-cover object-top"
                        loading="lazy"
                      />
                    </div>

                    <div className="mb-4">
                      <p className="text-sm font-semibold text-foreground-400 uppercase tracking-wide mb-1">
                        <i className="ri-information-line mr-1 text-green-400" />
                        ¿De qué se trata?
                      </p>
                      <p className="text-foreground-700 text-sm leading-relaxed">{step.what}</p>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm font-semibold text-foreground-400 uppercase tracking-wide mb-2">
                        <i className="ri-list-check mr-1 text-green-400" />
                        ¿Cómo se hace?
                      </p>
                      <ol className="space-y-1.5">
                        {step.how.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-foreground-700">
                            <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            {item}
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start gap-2">
                      <i className="ri-lightbulb-flash-line text-green-500 text-lg flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-green-800 leading-relaxed">
                        <span className="font-bold">Tip cabrón: </span>
                        {step.tip}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer CTA */}
        <div className="mt-12 text-center bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-100">
          <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4">
            <i className="ri-emotion-happy-line text-white text-2xl" />
          </div>
          <h3 className="text-xl font-black text-foreground-950 mb-2">¿Listo para tu primera visita?</h3>
          <p className="text-foreground-500 text-sm max-w-md mx-auto mb-4">
            Ya sabes todo lo necesario. Ven con hambre, ganas de pistear y
            prepárate para una experiencia cabrona. Te esperamos con las alitas listas.
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
      `}</style>
    </div>
  );
}