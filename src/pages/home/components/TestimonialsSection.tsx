import { useState } from "react";
import ScrollReveal from "@/components/base/ScrollReveal";

const GOOGLE_REVIEW_URL = "https://share.google/j7R7jkuZJhhlF0ldB";

interface Review {
  id: number;
  name: string;
  initials: string;
  color: string;
  stars: number;
  date: string;
  text: string;
  tag: string;
}

const reviews: Review[] = [
  {
    id: 1,
    name: "Karen Lizeth R.",
    initials: "KL",
    color: "bg-rose-500",
    stars: 5,
    date: "Hace 2 semanas",
    text: "Las alitas están increíbles, el sabor buffalo es adictivo. Fuimos en jueves de futbol y el ambiente estuvo a todo dar. Definitivamente regresamos, el precio es muy accesible para lo que te dan.",
    tag: "Alitas & Ambiente",
  },
  {
    id: 2,
    name: "Rodrigo M.",
    initials: "RM",
    color: "bg-amber-500",
    stars: 5,
    date: "Hace 3 semanas",
    text: "Mejor lugar para ver el partido. La chela bien fría, las alitas en su punto y la atención rapidísima. Ya tengo mi mesa favorita jajaja. Los boneless de mango habanero son otro nivel.",
    tag: "Boneless & Cerveza",
  },
  {
    id: 3,
    name: "Pamela G.",
    initials: "PG",
    color: "bg-purple-500",
    stars: 5,
    date: "Hace 1 mes",
    text: "Fui por primera vez con mi novio y nos encantó. El lugar está súper bien decorado, la música perfecta y las micheladas están buenísimas. El personal muy atento, nos explicaron bien todas las salsas.",
    tag: "Micheladas",
  },
  {
    id: 4,
    name: "Héctor F.",
    initials: "HF",
    color: "bg-green-600",
    stars: 5,
    date: "Hace 1 mes",
    text: "Vengo seguido con mis amigos a ver la Champions y siempre la pasamos increíble. El combo de alitas + nachos + cervezas es de los mejores deals que he visto en Guadalajara. 100% recomendado.",
    tag: "Combos",
  },
  {
    id: 5,
    name: "Sofía V. T.",
    initials: "SV",
    color: "bg-teal-500",
    stars: 5,
    date: "Hace 6 semanas",
    text: "Celebramos el cumpleaños de mi hermano aquí y fue perfecta la experiencia. Nos acomodaron bien, el mesero muy amable y la comida llegó rápido para todo el grupo. Los hot dogs también están muy buenos.",
    tag: "Celebraciones",
  },
  {
    id: 6,
    name: "Óscar J.",
    initials: "OJ",
    color: "bg-orange-500",
    stars: 5,
    date: "Hace 2 meses",
    text: "Las alitas teriyaki son mis favoritas de toda la ciudad, y eso que he probado muchos lugares. El billar está chido para pasar el rato mientras esperas mesa. Excelente lugar, sigan así.",
    tag: "Alitas Teriyaki",
  },
  {
    id: 7,
    name: "Daniela P.",
    initials: "DP",
    color: "bg-pink-500",
    stars: 5,
    date: "Hace 2 meses",
    text: "Me encanta la tarjeta de lealtad, ya acumulé puntos para canjearlos. La app del menú está muy fácil de usar y puedes pedir desde la mesa. Super moderno todo. Súper recomendado.",
    tag: "Servicio & App",
  },
  {
    id: 8,
    name: "Andrés L.",
    initials: "AL",
    color: "bg-blue-600",
    stars: 4,
    date: "Hace 3 meses",
    text: "Muy buenas alitas y excelente servicio. El lugar a veces se llena mucho los fines de semana pero vale la pena esperar. Los preparados están bien cargados jaja. Ya somos clientes fijos.",
    tag: "Fin de semana",
  },
];

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <i
          key={n}
          className={`text-sm ${n <= count ? "ri-star-fill text-amber-400" : "ri-star-line text-gray-300"}`}
        />
      ))}
    </div>
  );
}

export default function TestimonialsSection() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [sectionOpen, setSectionOpen] = useState(true);
  const avgRating = (reviews.reduce((a, r) => a + r.stars, 0) / reviews.length).toFixed(1);

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="w-full px-4 md:px-8 max-w-7xl mx-auto">

        {/* Header */}
        <ScrollReveal>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
            <div>
              <span className="text-amber-600 text-sm font-semibold uppercase tracking-widest">
                Reseñas de Google
              </span>
              <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-gray-900 mt-2 tracking-wide leading-tight">
                LO QUE DICEN<br />
                <span className="text-amber-500">NUESTROS CLIENTES</span>
              </h2>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Rating badge */}
              <a
                href={GOOGLE_REVIEW_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 bg-gray-950 text-white px-6 py-4 rounded-2xl cursor-pointer hover:bg-gray-800 transition-colors group"
              >
                <div className="w-10 h-10 flex items-center justify-center bg-white rounded-xl flex-shrink-0">
                  <i className="ri-google-fill text-amber-500 text-xl" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-black leading-none">{avgRating}</span>
                    <div className="flex flex-col gap-0.5">
                      <StarRating count={5} />
                      <span className="text-gray-400 text-xs">{reviews.length} reseñas</span>
                    </div>
                  </div>
                  <p className="text-gray-400 text-xs mt-0.5 group-hover:text-amber-400 transition-colors">
                    Ver en Google Maps →
                  </p>
                </div>
              </a>

              {/* Botón ocultar/mostrar */}
              <button
                onClick={() => setSectionOpen(v => !v)}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50 text-gray-500 hover:text-amber-600 font-semibold text-sm cursor-pointer transition-all whitespace-nowrap"
                title={sectionOpen ? 'Ocultar reseñas' : 'Mostrar reseñas'}
              >
                <i className={`text-base transition-transform duration-300 ${sectionOpen ? 'ri-eye-off-line' : 'ri-eye-line'}`} />
                <span className="hidden sm:inline">{sectionOpen ? 'Ocultar' : 'Mostrar'}</span>
              </button>
            </div>
          </div>
        </ScrollReveal>

        {/* Grid de reseñas — colapsable */}
        <div
          className="overflow-hidden transition-all duration-500 ease-in-out"
          style={{ maxHeight: sectionOpen ? '2000px' : '0px', opacity: sectionOpen ? 1 : 0 }}
        >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {reviews.map((review, i) => {
            const isExpanded = expanded === review.id;
            const isLong = review.text.length > 120;
            return (
              <ScrollReveal key={review.id} delay={i * 60}>
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 h-full flex flex-col gap-3 hover:border-amber-200 transition-colors">
                  {/* Header */}
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 flex items-center justify-center rounded-full flex-shrink-0 ${review.color}`}>
                      <span className="text-white font-black text-sm">{review.initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 font-bold text-sm leading-tight truncate">{review.name}</p>
                      <p className="text-gray-400 text-xs">{review.date}</p>
                    </div>
                    <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                      <i className="ri-google-fill text-gray-300 text-base" />
                    </div>
                  </div>

                  {/* Estrellas */}
                  <StarRating count={review.stars} />

                  {/* Texto */}
                  <div className="flex-1">
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {isLong && !isExpanded
                        ? review.text.slice(0, 120) + "..."
                        : review.text}
                    </p>
                    {isLong && (
                      <button
                        onClick={() => setExpanded(isExpanded ? null : review.id)}
                        className="text-amber-600 text-xs font-semibold mt-1 cursor-pointer hover:text-amber-700 transition-colors whitespace-nowrap"
                      >
                        {isExpanded ? "Ver menos" : "Ver más"}
                      </button>
                    )}
                  </div>

                  {/* Tag */}
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-100">
                      <i className="ri-price-tag-3-line text-[10px]" />
                      {review.tag}
                    </span>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        {/* CTA final */}
        <ScrollReveal>
          <div className="mt-10 text-center">
            <p className="text-gray-500 text-sm mb-4">
              ¿Ya fuiste a La Cabrona? Tu opinión ayuda a que más gente nos encuentre
            </p>
            <a
              href={GOOGLE_REVIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 bg-gray-950 hover:bg-gray-800 text-white font-black px-7 py-3.5 rounded-2xl text-sm cursor-pointer transition-all active:scale-95 whitespace-nowrap"
            >
              <i className="ri-google-fill text-amber-400 text-base" />
              Dejar reseña en Google
              <i className="ri-star-fill text-amber-400 text-sm" />
            </a>
          </div>
        </ScrollReveal>
        </div>
        {/* fin colapsable */}

        {/* Mensaje cuando están ocultas */}
        {!sectionOpen && (
          <div className="flex items-center justify-center gap-3 py-6 border-2 border-dashed border-gray-200 rounded-2xl">
            <i className="ri-star-fill text-amber-400 text-lg" />
            <p className="text-gray-400 text-sm">
              <span className="font-bold text-gray-600">{avgRating} ★</span> · {reviews.length} reseñas ocultas
            </p>
            <button
              onClick={() => setSectionOpen(true)}
              className="text-amber-600 hover:text-amber-700 text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
            >
              Mostrar
            </button>
          </div>
        )}

      </div>
    </section>
  );
}