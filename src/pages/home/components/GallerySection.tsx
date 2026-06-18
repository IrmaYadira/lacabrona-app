import { useState, useCallback } from "react";
import ScrollReveal from "@/components/base/ScrollReveal";

const galleryImages = [
  {
    id: 1,
    src: "https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1039ce54-3617-408b-8340-a6368a45a2b7_RECO-23.png?v=97a2e831fdea2d63999402abc87c4877",
    alt: "La Cabrona",
    span: "col-span-1 md:col-span-2 row-span-1",
  },
  {
    id: 7,
    src: "https://static.readdy.ai/image/9559dab24a07659558f8d95c0e5c303b/107476e165763d518a1e4bfc5e1536be.jpeg",
    alt: "La Cabrona Bar",
    span: "col-span-1 md:col-span-2 row-span-1",
  },
];

export default function GallerySection() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const openModal = useCallback((index: number) => {
    setActiveIndex(index);
    document.body.style.overflow = 'hidden';
  }, []);

  const closeModal = useCallback(() => {
    setActiveIndex(null);
    document.body.style.overflow = '';
  }, []);

  const prevImage = useCallback(() => {
    setActiveIndex((prev) => (prev === null ? null : prev === 0 ? galleryImages.length - 1 : prev - 1));
  }, []);

  const nextImage = useCallback(() => {
    setActiveIndex((prev) => (prev === null ? null : prev === galleryImages.length - 1 ? 0 : prev + 1));
  }, []);

  return (
    <section id="galeria" className="py-16 md:py-24 bg-white">
      <div className="w-full px-4 md:px-8 max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-12 md:mb-16">
            <span className="text-amber-600 text-sm font-semibold uppercase tracking-widest">
              Momentos
            </span>
            <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-gray-900 mt-2 tracking-wide">
              GALERÍA
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm md:text-base">
              Fotos reales de La Cabrona. El ambiente, la comida y la gente que la hace especial.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 auto-rows-[160px] md:auto-rows-[200px]">
          {galleryImages.map((img, index) => (
            <ScrollReveal key={img.id} delay={index * 100}>
              <button
                onClick={() => openModal(index)}
                className={`relative overflow-hidden rounded-xl cursor-pointer group ${img.span} w-full h-full`}
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  title={img.alt}
                  loading="lazy"
                  decoding="async"
                  fetchpriority="low"
                  width="800"
                  height="600"
                  className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                />
              </button>
            </ScrollReveal>
          ))}
        </div>
      </div>

      {/* Modal de lightbox */}
      {activeIndex !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
          onClick={closeModal}
        >
          <button
            onClick={(e) => { e.stopPropagation(); closeModal(); }}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-white/70 hover:text-white cursor-pointer transition-colors z-10"
          >
            <i className="ri-close-line text-2xl" />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); prevImage(); }}
            className="absolute left-3 md:left-6 w-10 h-10 flex items-center justify-center text-white/70 hover:text-white cursor-pointer transition-colors z-10"
          >
            <i className="ri-arrow-left-s-line text-2xl" />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); nextImage(); }}
            className="absolute right-3 md:right-6 w-10 h-10 flex items-center justify-center text-white/70 hover:text-white cursor-pointer transition-colors z-10"
          >
            <i className="ri-arrow-right-s-line text-2xl" />
          </button>

          <div
            className="max-w-4xl max-h-[80vh] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={galleryImages[activeIndex].src}
              alt={galleryImages[activeIndex].alt}
              title={galleryImages[activeIndex].alt}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            <p className="text-center text-white/70 text-sm mt-3">
              {galleryImages[activeIndex].alt}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}