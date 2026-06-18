import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageSEO } from "@/hooks/usePageSEO";
import { SITE_URL } from "@/lib/site-url";

const LOGO_URL = "https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285";

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("opacity-100", "translate-y-0");
            entry.target.classList.remove("opacity-0", "translate-y-6");
          }
        });
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`opacity-0 translate-y-6 transition-all duration-700 ease-out ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

const WHATSAPP_DEMO = "https://wa.me/5213348567795?text=Hola!%20Vengo%20de%20la%20landing%20y%20quiero%20una%20demo%20gratis%20del%20sistema%20POS%20para%20mi%20restaurante.";
const WHATSAPP_TIKTOK = "https://wa.me/5213348567795?text=Hola!%20Vengo%20de%20TikTok%20y%20quiero%20una%20demo%20gratis%20del%20sistema%20POS%20para%20mi%20restaurante.";

function TikTokPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isTikTokSource = urlParams.get("utm_source") === "tiktok" || urlParams.get("tiktok") === "1" || urlParams.get("ref") === "tiktok";
    const hasClosed = localStorage.getItem("tiktok-popup-closed");

    // Si viene de TikTok o no ha cerrado el popup antes, mostrarlo
    if ((isTikTokSource || !hasClosed)) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        // small delay for animation
        setTimeout(() => setIsVisible(true), 50);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  const closePopup = () => {
    setIsVisible(false);
    setTimeout(() => setIsOpen(false), 300);
    localStorage.setItem("tiktok-popup-closed", "true");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isVisible ? "opacity-100" : "opacity-0"}`}
        onClick={closePopup}
      />

      {/* Modal */}
      <div
        className={`relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transition-all duration-300 ${isVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}
      >
        {/* TikTok header bar */}
        <div className="bg-gray-900 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" fill="#000"/>
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm">@barlacabronawings</p>
            <p className="text-gray-400 text-xs">TikTok</p>
          </div>
          <button
            onClick={closePopup}
            className="ml-auto w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <i className="ri-close-line" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            <i className="ri-flashlight-line" />
            Oferta exclusiva
          </div>

          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            ¿Nos viste en TikTok?
          </h3>
          <p className="text-gray-600 text-sm leading-relaxed mb-6">
            Si llegaste desde <span className="font-semibold text-gray-900">@barlacabronawings</span>, tenemos una demo completa <strong>sin costo</strong> y te armamos tu menú digital en menos de 30 minutos.
          </p>

          <div className="space-y-3">
            <a
              href={WHATSAPP_TIKTOK}
              target="_blank"
              rel="noopener noreferrer"
              onClick={closePopup}
              className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 px-6 rounded-lg transition-colors text-sm whitespace-nowrap"
            >
              <i className="ri-whatsapp-line text-lg" />
              Solicitar demo por WhatsApp
            </a>
            <button
              onClick={closePopup}
              className="text-gray-500 text-sm hover:text-gray-700 transition-colors"
            >
              Ahora no, gracias
            </button>
          </div>
        </div>

        {/* Bottom trust bar */}
        <div className="bg-gray-50 px-6 py-3 flex items-center justify-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <i className="ri-check-line text-emerald-500" />
            Sin contrato
          </span>
          <span className="flex items-center gap-1">
            <i className="ri-check-line text-emerald-500" />
            Configuración gratis
          </span>
          <span className="flex items-center gap-1">
            <i className="ri-check-line text-emerald-500" />
            Cancela cuando quieras
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  usePageSEO({
    title: "QRestPOS — Sistema POS y Menú Digital para Restaurantes y Bares en México",
    description: "Sistema POS móvil + menú digital con QR para restaurantes, bares y food trucks en México. Comandas en tiempo real, programa de lealtad, reservaciones y reportes automáticos. Demo gratis por WhatsApp.",
    canonicalUrl: `${SITE_URL}/landing`,
    ogImage: LOGO_URL,
    keywords: "sistema POS restaurantes, menú digital QR, POS México, QRestPOS, punto de venta restaurantes",
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "La Cabrona Alitas & Beer", "item": `${SITE_URL}/` },
          { "@type": "ListItem", "position": 2, "name": "QRestPOS — Sistema POS para Restaurantes", "item": `${SITE_URL}/landing` }
        ]
      },
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "QRestPOS",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web, iOS, Android",
        "description": "Sistema POS y menú digital con QR para restaurantes y bares en México. Comandas en tiempo real, lealtad, reservaciones y reportes automatizados. Sin instalaciones, sin contratos.",
        "url": `${SITE_URL}/landing`,
        "inLanguage": "es",
        "offers": [{
          "@type": "Offer",
          "name": "Demo Gratis QRestPOS",
          "price": "0",
          "priceCurrency": "MXN",
          "description": "Demo gratis sin compromiso durante 1 semana"
        }],
        "featureList": [
          "Menú digital con QR",
          "POS móvil sin instalaciones",
          "Comandas en tiempo real a cocina",
          "Programa de lealtad",
          "Reservaciones de mesa",
          "Reportes y estadísticas de ventas"
        ],
        "provider": {
          "@type": "Organization",
          "name": "QRestPOS",
          "url": `${SITE_URL}/landing`,
          "contactPoint": {
            "@type": "ContactPoint",
            "name": "Ventas QRestPOS",
            "telephone": "+52-33-4856-7795",
            "contactType": "sales",
            "availableLanguage": "Spanish",
            "contactOption": "TollFree"
          }
        }
      }
    ],
  });

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-['Inter']">
      {/* TikTok Popup */}
      <TikTokPopup />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="w-full px-4 md:px-8 lg:px-12">
          <div className="flex items-center justify-between h-16 md:h-20">
            <button onClick={() => scrollTo("hero")} className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
                <i className="ri-restaurant-line text-white text-lg" />
              </div>
              <span className="text-lg md:text-xl font-bold tracking-tight">QRest<span className="text-amber-500">POS</span></span>
            </button>

            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
              <button onClick={() => scrollTo("features")} className="hover:text-amber-600 transition-colors cursor-pointer">Funciones</button>
              <button onClick={() => scrollTo("como-funciona")} className="hover:text-amber-600 transition-colors cursor-pointer">Cómo funciona</button>
              <button onClick={() => scrollTo("precios")} className="hover:text-amber-600 transition-colors cursor-pointer">Planes</button>
              <button onClick={() => scrollTo("testimonios")} className="hover:text-amber-600 transition-colors cursor-pointer">Testimonios</button>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={WHATSAPP_DEMO}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-5 py-2.5 rounded-md transition-colors whitespace-nowrap"
              >
                <i className="ri-whatsapp-line" />
                Demo gratis
              </a>
              <button
                className="md:hidden w-10 h-10 flex items-center justify-center text-gray-700 cursor-pointer"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <i className={`ri-${mobileMenuOpen ? "close" : "menu"}-line text-xl`} />
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3">
            <button onClick={() => scrollTo("features")} className="block w-full text-left text-gray-700 font-medium py-2 cursor-pointer">Funciones</button>
            <button onClick={() => scrollTo("como-funciona")} className="block w-full text-left text-gray-700 font-medium py-2 cursor-pointer">Cómo funciona</button>
            <button onClick={() => scrollTo("precios")} className="block w-full text-left text-gray-700 font-medium py-2 cursor-pointer">Planes</button>
            <button onClick={() => scrollTo("testimonios")} className="block w-full text-left text-gray-700 font-medium py-2 cursor-pointer">Testimonios</button>
            <a href={WHATSAPP_DEMO} target="_blank" rel="noopener noreferrer" className="block w-full bg-amber-500 text-white text-center font-semibold py-2.5 rounded-md">
              Solicitar demo
            </a>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section id="hero" className="relative pt-20 md:pt-24 overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://readdy.ai/api/search-image?query=A%20warm%20and%20inviting%20modern%20restaurant%20interior%20scene%20at%20evening%20with%20soft%20golden%20ambient%20lighting%20wooden%20tables%20and%20chairs%20a%20small%20QR%20code%20card%20standing%20on%20a%20table%20blurred%20background%20showing%20happy%20diners%20professional%20photography%20style%20with%20shallow%20depth%20of%20field%20amber%20and%20orange%20color%20tones%20cozy%20atmosphere%20no%20text%20or%20logos%20high%20quality%20realistic%20image&width=1000&height=560&seq=landing-hero-1&orientation=landscape"
            alt="Restaurante moderno con QR"
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />
        </div>

        <div className="relative w-full px-4 md:px-8 lg:px-12 py-24 md:py-32 lg:py-40">
          <div className="max-w-3xl">
            <Reveal>
              <span className="inline-block bg-amber-500/20 text-amber-300 text-xs md:text-sm font-semibold px-4 py-1.5 rounded-full mb-6 border border-amber-500/30">
                Sistema POS + Menú Digital en uno
              </span>
            </Reveal>
            <Reveal delay={100}>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
                Tu restaurante,<br />
                <span className="text-amber-400">digitalizado en minutos</span>
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="text-lg md:text-xl text-gray-200 mb-8 max-w-2xl leading-relaxed">
                Menú con QR, comandas en tiempo real, punto de venta móvil y reportes automáticos. 
                Todo desde el celular. Sin instalaciones, sin clavos.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href={WHATSAPP_DEMO}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold px-8 py-3.5 rounded-md transition-colors text-base whitespace-nowrap"
                >
                  <i className="ri-whatsapp-line text-lg" />
                  Quiero la demo gratis
                </a>
                <button
                  onClick={() => scrollTo("como-funciona")}
                  className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-3.5 rounded-md transition-colors text-base border border-white/20 whitespace-nowrap"
                >
                  Ver cómo funciona
                  <i className="ri-arrow-down-line" />
                </button>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="w-full px-4 md:px-8 lg:px-12 py-20 md:py-28 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <p className="text-amber-600 font-semibold text-sm tracking-wide uppercase text-center mb-3">¿Te suena familiar?</p>
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
              Los problemas de los restaurantes de hoy
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: "ri-time-line", title: "Clientes impacientes", desc: "Esperan al mesero para pedir, pagar o pedir la cuenta. Pierden ventas por demoras." },
              { icon: "ri-file-paper-line", title: "Errores en comandas", desc: "Papelitos que se pierden entre la mesa y la cocina. Pedidos equivocados y clientes molestos." },
              { icon: "ri-bar-chart-box-line", title: "No saben sus números", desc: "Al final del día no saben qué vendieron, qué producto rinde o cuánto dejaron de ganar." },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="bg-white rounded-xl p-6 md:p-8 border border-gray-100 hover:border-amber-200 transition-colors h-full">
                  <div className="w-12 h-12 rounded-lg bg-red-50 flex items-center justify-center mb-5">
                    <i className={`${item.icon} text-red-500 text-2xl`} />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="w-full px-4 md:px-8 lg:px-12 py-20 md:py-28 bg-white">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <p className="text-amber-600 font-semibold text-sm tracking-wide uppercase text-center mb-3">Todo en un solo sistema</p>
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              Lo que tu restaurante necesita
            </h2>
            <p className="text-gray-600 text-center max-w-2xl mx-auto mb-16">
              Desde que el cliente llega hasta que cierra la cuenta. Todo conectado, todo en tiempo real.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: "ri-qr-code-line", color: "bg-amber-50 text-amber-600", title: "Menú Digital QR", desc: "Tus clientes escanean, ven fotos, precios y ordenan desde su celular. Sin descargar apps." },
              { icon: "ri-smartphone-line", color: "bg-emerald-50 text-emerald-600", title: "POS Móvil", desc: "Los meseros abren cuentas, envían comandas a cocina y cobran desde su celular o tablet." },
              { icon: "ri-bell-line", color: "bg-orange-50 text-orange-600", title: "Comandas en vivo", desc: "Cada pedido llega instantáneamente a cocina y barra. Sin papelitos, sin errores." },
              { icon: "ri-vip-crown-line", color: "bg-purple-50 text-purple-600", title: "Programa de Lealtad", desc: "Acumulan puntos por consumo y canjean premios. Fideliza a tus clientes automáticamente." },
              { icon: "ri-calendar-check-line", color: "bg-blue-50 text-blue-600", title: "Reservaciones", desc: "Tus clientes reservan mesa desde la web. Tú las administras desde el panel." },
              { icon: "ri-line-chart-line", color: "bg-rose-50 text-rose-600", title: "Reportes y Estadísticas", desc: "Ventas por día, productos estrella, horarios pico y más. Toma decisiones con datos." },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="group bg-white rounded-xl p-6 border border-gray-100 hover:border-amber-200 hover:shadow-lg hover:shadow-amber-500/5 transition-all h-full">
                  <div className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center mb-4`}>
                    <i className={`${f.icon} text-2xl`} />
                  </div>
                  <h3 className="text-lg font-bold mb-2 group-hover:text-amber-600 transition-colors">{f.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="w-full px-4 md:px-8 lg:px-12 py-20 md:py-28 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <p className="text-amber-600 font-semibold text-sm tracking-wide uppercase text-center mb-3">Simple y rápido</p>
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
              ¿Cómo funciona?
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connecting line desktop */}
            <div className="hidden md:block absolute top-12 left-[16.66%] right-[16.66%] h-0.5 bg-amber-200" />

            {[
              { step: "1", icon: "ri-smartphone-line", title: "El cliente escanea", desc: "Llega a su mesa, escanea el QR con su celular y ve tu menú completo con fotos y precios." },
              { step: "2", icon: "ri-send-plane-line", title: "Pide desde la mesa", desc: "Selecciona productos, personaliza y envía el pedido. La comanda llega instantáneamente a cocina." },
              { step: "3", icon: "ri-bank-card-line", title: "Paga y se va feliz", desc: "Ve su cuenta en vivo, divide con amigos, deja propina y paga como prefiera. Tú cierras desde el POS." },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 120}>
                <div className="relative text-center">
                  <div className="w-16 h-16 rounded-full bg-amber-500 text-white flex items-center justify-center mx-auto mb-6 text-2xl font-bold shadow-lg shadow-amber-500/20">
                    {item.step}
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center mx-auto mb-4">
                    <i className={`${item.icon} text-amber-600 text-xl`} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed max-w-xs mx-auto">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="precios" className="w-full px-4 md:px-8 lg:px-12 py-20 md:py-28 bg-white">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <p className="text-amber-600 font-semibold text-sm tracking-wide uppercase text-center mb-3">Planes disponibles</p>
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              Elige el plan que más te convenga
            </h2>
            <p className="text-gray-600 text-center max-w-xl mx-auto mb-16">
              Sin costos de instalación, sin contratos forzosos. Empieza hoy y cancela cuando quieras.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {[
              {
                name: "Básico",
                desc: "Perfecto para food trucks y pequeños negocios",
                features: ["Menú digital con QR", "1 usuario POS", "Reportes básicos", "Soporte por WhatsApp"],
                cta: "Empezar ahora",
                popular: false,
              },
              {
                name: "Profesional",
                desc: "Para restaurantes y bares con meseros",
                features: ["Todo lo del plan Básico", "POS móvil ilimitado", "Comandas a cocina", "Programa de lealtad", "Reservaciones", "Reportes avanzados"],
                cta: "Demo gratis",
                popular: true,
              },
              {
                name: "Premium",
                desc: "Multi-sucursal y funciones exclusivas",
                features: ["Todo lo del plan Profesional", "Múltiples sucursales", "Panel admin centralizado", "API y integraciones", "Soporte prioritario 24/7"],
                cta: "Contactar ventas",
                popular: false,
              },
            ].map((plan, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className={`relative rounded-2xl p-6 md:p-8 h-full flex flex-col ${plan.popular ? "bg-gray-900 text-white border-2 border-amber-500" : "bg-white border border-gray-200"}`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                      Más popular
                    </div>
                  )}
                  <h3 className={`text-lg font-bold mb-1 ${plan.popular ? "text-white" : "text-gray-900"}`}>{plan.name}</h3>
                  <p className={`text-sm mb-6 ${plan.popular ? "text-gray-400" : "text-gray-500"}`}>{plan.desc}</p>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-start gap-3 text-sm">
                        <i className={`ri-check-line mt-0.5 ${plan.popular ? "text-amber-400" : "text-emerald-500"}`} />
                        <span className={plan.popular ? "text-gray-300" : "text-gray-600"}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={WHATSAPP_DEMO}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block text-center font-semibold py-3 rounded-md transition-colors whitespace-nowrap ${
                      plan.popular
                        ? "bg-amber-500 hover:bg-amber-600 text-white"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-900"
                    }`}
                  >
                    {plan.cta}
                  </a>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section id="testimonios" className="w-full px-4 md:px-8 lg:px-12 py-20 md:py-28 bg-amber-500">
        <div className="max-w-4xl mx-auto text-center">
          <Reveal>
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-6">
              <i className="ri-double-quotes-l text-white text-3xl" />
            </div>
            <blockquote className="text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-tight mb-8">
              "Antes perdíamos comandas entre la mesa y la cocina. Ahora todo llega en segundos y mis ventas subieron un 20%."
            </blockquote>
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
                LC
              </div>
              <div className="text-left">
                <p className="text-white font-bold">Dueño de La Cabrona Alitas & Beer</p>
                <p className="text-white/80 text-sm">Zapopan, Jalisco — Usando QRestPOS desde 2025</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="w-full px-4 md:px-8 lg:px-12 py-20 md:py-28 bg-gray-900">
        <div className="max-w-3xl mx-auto text-center">
          <Reveal>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
              Digitaliza tu restaurante hoy
            </h2>
            <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
              Configuramos tu menú en 30 minutos. Probá el sistema 1 semana gratis. Sin compromiso.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={WHATSAPP_DEMO}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-8 py-4 rounded-md transition-colors text-lg whitespace-nowrap"
              >
                <i className="ri-whatsapp-line text-xl" />
                Pedir demo por WhatsApp
              </a>
              <button
                onClick={() => navigate("/menu")}
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-md transition-colors border border-white/20 whitespace-nowrap"
              >
                <i className="ri-external-link-line" />
                Ver demo en vivo
              </button>
            </div>
            <p className="text-gray-500 text-sm mt-6">
              Respuesta en menos de 2 horas. Atendemos restaurantes en todo México.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100">
        <div className="w-full px-4 md:px-8 lg:px-12 py-12">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
                  <i className="ri-restaurant-line text-white text-lg" />
                </div>
                <span className="text-xl font-bold">QRest<span className="text-amber-500">POS</span></span>
              </div>
              <p className="text-gray-600 text-sm max-w-sm leading-relaxed mb-4">
                Sistema POS y menú digital para restaurantes, bares, cervecerías y food trucks en México. Simple, rápido y sin instalaciones.
              </p>
              <div className="flex items-center gap-4">
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-100 hover:bg-amber-100 flex items-center justify-center text-gray-600 hover:text-amber-600 transition-colors">
                  <i className="ri-instagram-line text-lg" />
                </a>
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-100 hover:bg-amber-100 flex items-center justify-center text-gray-600 hover:text-amber-600 transition-colors">
                  <i className="ri-facebook-circle-line text-lg" />
                </a>
                <a href={WHATSAPP_DEMO} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-100 hover:bg-amber-100 flex items-center justify-center text-gray-600 hover:text-amber-600 transition-colors">
                  <i className="ri-whatsapp-line text-lg" />
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-4">Producto</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><button onClick={() => scrollTo("features")} className="hover:text-amber-600 cursor-pointer">Funciones</button></li>
                <li><button onClick={() => scrollTo("precios")} className="hover:text-amber-600 cursor-pointer">Planes</button></li>
                <li><button onClick={() => scrollTo("como-funciona")} className="hover:text-amber-600 cursor-pointer">Cómo funciona</button></li>
                <li><a href="#" className="hover:text-amber-600">Demo en vivo</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Contacto</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <i className="ri-whatsapp-line text-amber-500" />
                  <a href={WHATSAPP_DEMO} target="_blank" rel="noopener noreferrer" className="hover:text-amber-600">WhatsApp</a>
                </li>
                <li className="flex items-center gap-2">
                  <i className="ri-mail-line text-amber-500" />
                  <span>hoyescribeme@hotmail.com</span>
                </li>
                <li className="flex items-center gap-2">
                  <i className="ri-map-pin-line text-amber-500" />
                  <span>Zapopan, Jalisco, MX</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <p>© 2026 QRestPOS. Todos los derechos reservados.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-gray-800">Privacidad</a>
              <a href="#" className="hover:text-gray-800">Términos</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}