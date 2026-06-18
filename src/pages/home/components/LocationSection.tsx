import { useState, useRef, useEffect } from "react";
import { barInfo } from "@/mocks/menu";
import ScrollReveal from "@/components/base/ScrollReveal";

function LazyMapEmbed() {
  const [shouldLoad, setShouldLoad] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="rounded-xl overflow-hidden border border-gray-200 h-[350px] sm:h-[450px] md:h-[680px]"
    >
      {shouldLoad ? (
        <iframe
          src={barInfo.mapEmbed}
          title="Ubicación La Cabrona"
          className="w-full h-full border-0"
          loading="lazy"
          allowFullScreen
        />
      ) : (
        <div className="w-full h-full bg-amber-50/50 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center">
            <i className="ri-map-pin-line text-3xl text-amber-300 animate-bounce" />
          </div>
          <span className="text-amber-400 text-sm font-medium">Cargando mapa...</span>
        </div>
      )}
    </div>
  );
}

export default function LocationSection() {
  const getWhatsAppLink = () => {
    const text = encodeURIComponent("Hola La Cabrona! Quiero hacer un pedido 🍗🍺");
    return `https://wa.me/${barInfo.whatsapp}?text=${text}`;
  };

  const getDirectionsLink = () => {
    const address = encodeURIComponent(barInfo.address);
    return `https://www.google.com/maps/dir/?api=1&destination=${address}`;
  };

  return (
    <section id="como-llegar" className="py-16 md:py-24 bg-white">
      <div className="w-full px-4 md:px-8 max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-12 md:mb-16">
            <span className="text-amber-600 text-sm font-semibold uppercase tracking-widest">
              Encuéntranos fácil
            </span>
            <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-gray-900 mt-2 tracking-wide">
              CÓMO LLEGAR
            </h2>
            <p className="text-gray-500 mt-3 text-sm md:text-base max-w-xl mx-auto">
              Estamos en el corazón de la ciudad. Ven a pistear con nosotros, no te vamos a dejar perdido.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 md:gap-10">
          <ScrollReveal direction="left" className="lg:col-span-2">
            <div className="space-y-6">
              <div className="bg-amber-50 rounded-xl p-6 border border-amber-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 flex items-center justify-center bg-amber-500 text-white rounded-full flex-shrink-0">
                    <i className="ri-map-pin-line text-lg" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base mb-1">Dirección</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{barInfo.address}</p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-6 border border-amber-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 flex items-center justify-center bg-amber-500 text-white rounded-full flex-shrink-0">
                    <i className="ri-phone-line text-lg" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base mb-1">Teléfono</h3>
                    <p className="text-gray-600 text-sm">{barInfo.phone}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={getDirectionsLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-md font-semibold transition-all cursor-pointer whitespace-nowrap hover:scale-105 active:scale-95"
                >
                  <i className="ri-direction-line" />
                  Abrir en Google Maps
                </a>
                <a
                  href={getWhatsAppLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-5 py-3 rounded-md font-semibold transition-all cursor-pointer whitespace-nowrap hover:scale-105 active:scale-95"
                >
                  <i className="ri-whatsapp-line" />
                  Pedir por WhatsApp
                </a>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal direction="right" className="lg:col-span-3">
            <LazyMapEmbed />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}