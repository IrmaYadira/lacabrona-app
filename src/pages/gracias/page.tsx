import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import LazyIframe from "@/components/base/LazyIframe";

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

// TODO: Reemplaza este ID con tu video de YouTube (ej: tu demo de QRestPOS)
const DEMO_VIDEO_ID = "ScMzIvxBSi4";
const WHATSAPP_CTA = "https://wa.me/5213348567795?text=Hola!%20Ya%20vi%20el%20video%20demo%20y%20quiero%20agendar%20una%20llamada%20para%20empezar%20con%20QRestPOS.";

export default function GraciasPage() {

  return (
    <div className="min-h-screen bg-white text-gray-900 font-['Inter']">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="w-full px-4 md:px-8 lg:px-12">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link to="/landing" className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
                <i className="ri-restaurant-line text-white text-lg" />
              </div>
              <span className="text-lg md:text-xl font-bold tracking-tight">QRest<span className="text-amber-500">POS</span></span>
            </Link>
            <a
              href={WHATSAPP_CTA}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-5 py-2.5 rounded-md transition-colors whitespace-nowrap"
            >
              <i className="ri-whatsapp-line" />
              Agendar llamada
            </a>
          </div>
        </div>
      </nav>

      {/* Hero de gracias */}
      <section className="relative pt-24 md:pt-32 pb-12 md:pb-20 bg-gradient-to-b from-amber-50 to-white">
        <div className="w-full px-4 md:px-8 lg:px-12">
          <div className="max-w-4xl mx-auto text-center">
            <Reveal>
              <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
                <i className="ri-check-double-line text-emerald-500 text-4xl" />
              </div>
            </Reveal>
            <Reveal delay={100}>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4">
                ¡Gracias por tu interés!
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed mb-2">
                Te escribimos en menos de 2 horas. Mientras tanto, mirá cómo funciona QRestPOS en tu restaurante.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 text-sm font-medium px-4 py-2 rounded-full mt-6">
                <i className="ri-time-line" />
                Demo express de 90 segundos
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Video embebido */}
      <section className="w-full px-4 md:px-8 lg:px-12 pb-16 md:pb-24">
        <div className="max-w-4xl mx-auto">
          <Reveal delay={100}>
            <LazyIframe
              src={`https://www.youtube.com/embed/${DEMO_VIDEO_ID}?rel=0&modestbranding=1&playsinline=1`}
              title="Demo QRestPOS"
              className="relative rounded-2xl overflow-hidden bg-gray-900 shadow-2xl shadow-amber-500/10 aspect-video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              placeholder={
                <div className="w-full h-full flex items-center justify-center bg-gray-800">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
                      <i className="ri-loader-4-line text-white text-3xl animate-spin" />
                    </div>
                    <p className="text-white/60 text-sm">Cargando video demo...</p>
                  </div>
                </div>
              }
            />
          </Reveal>

          {/* Info debajo del video */}
          <Reveal delay={200}>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50 rounded-xl p-4 md:p-6 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <i className="ri-information-line text-amber-600 text-lg" />
                </div>
                <p className="text-sm text-gray-600">
                  <strong className="text-gray-900">¿Te gustó lo que viste?</strong>
                  <br className="hidden sm:block" />
                  Agendá una llamada gratuita de 15 minutos y te mostramos tu menú en vivo.
                </p>
              </div>
              <a
                href={WHATSAPP_CTA}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm whitespace-nowrap shrink-0"
              >
                <i className="ri-whatsapp-line text-lg" />
                Quiero mi demo en vivo
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ¿Qué sigue? */}
      <section className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-24 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
              ¿Qué sigue ahora?
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                icon: "ri-message-3-line",
                title: "Te contactamos",
                desc: "En menos de 2 horas te escribimos por WhatsApp o correo para confirmar tu interés.",
              },
              {
                step: "2",
                icon: "ri-video-chat-line",
                title: "Demo personalizada",
                desc: "Agendamos una videollamada de 15 minutos. Mostramos el sistema con TU tipo de restaurante.",
              },
              {
                step: "3",
                icon: "ri-rocket-line",
                title: "Empezás gratis",
                desc: "Si te late, configuramos tu menú en 30 minutos y empezás tu semana de prueba sin costo.",
              },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 120}>
                <div className="bg-white rounded-xl p-6 md:p-8 border border-gray-100 text-center h-full">
                  <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
                    <i className={`${item.icon} text-amber-600 text-2xl`} />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center mx-auto mb-4 text-sm font-bold">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-24 bg-gray-900">
        <div className="max-w-3xl mx-auto text-center">
          <Reveal>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              ¿No querés esperar?
            </h2>
            <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
              Escribinos por WhatsApp ahora y empezamos hoy mismo. Configuramos todo en 30 minutos.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={WHATSAPP_CTA}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-8 py-4 rounded-md transition-colors text-lg whitespace-nowrap"
              >
                <i className="ri-whatsapp-line text-xl" />
                Escribir por WhatsApp
              </a>
              <Link
                to="/landing"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-md transition-colors border border-white/20 whitespace-nowrap"
              >
                <i className="ri-arrow-left-line" />
                Volver a la landing
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100">
        <div className="w-full px-4 md:px-8 lg:px-12 py-8">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-amber-500 flex items-center justify-center">
                <i className="ri-restaurant-line text-white text-xs" />
              </div>
              <span className="font-bold text-gray-900">QRest<span className="text-amber-500">POS</span></span>
            </div>
            <p>© 2026 QRestPOS. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}