import { useState } from "react";
import { cannedAlcoholicMenu } from "@/mocks/menu";
import { useCart } from "../context/CartContext";
import { usePaused } from "../context/PausedContext";
import FlashPrice from "@/components/FlashPrice";
import ScrollReveal from "@/components/base/ScrollReveal";

export default function CannedAlcoholicSection() {
  const { addItem, setIsOpen, toggleFavorite, isFavorite } = useCart();
  const { isPaused } = usePaused();
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  const handleAdd = (item: (typeof cannedAlcoholicMenu)[0]) => {
    addItem({
      id: 420 + item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.image,
      category: "Bebida Alcohólica en Lata",
    });
    setAddedIds((prev) => new Set(prev).add(item.id));
    setIsOpen(true);
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }, 1500);
  };

  return (
    <section id="latas-alcohol" className="py-16 md:py-24 bg-gray-900">
      <div className="w-full px-4 md:px-8 max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-12 md:mb-16">
            <span className="text-amber-500 text-sm font-semibold uppercase tracking-widest">
              Preparados Listos
            </span>
            <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-white mt-2 tracking-wide">
              BEBIDAS ALCOHÓLICAS EN LATA
            </h2>
            <p className="text-gray-400 mt-3 max-w-xl mx-auto text-sm md:text-base">
              Los clásicos preparados en lata, listos para pistear sin complicaciones.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {cannedAlcoholicMenu.map((item, index) => {
            const outOfStock = isPaused(`canned-${item.id}`);
            const favId = 420 + item.id;
            const fav = isFavorite(favId);
            return (
            <ScrollReveal key={item.id} delay={index * 80}>
              <div className={`bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 hover:-translate-y-1 transition-all duration-300 group h-full flex flex-col ${outOfStock ? 'opacity-60' : ''}`}>
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.name}
                    title={item.name}
                    loading="lazy"
                    decoding="async"
                    fetchpriority="low"
                    width="400"
                    height="400"
                    className={`w-full h-full object-cover object-top transition-transform duration-500 ${outOfStock ? 'grayscale' : 'group-hover:scale-105'}`}
                  />
                  {outOfStock && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-white text-[9px] font-black text-center leading-tight">AGOTADO</span>
                    </div>
                  )}
                  <div className="absolute top-3 left-3 flex gap-2">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-amber-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  {/* Favorito */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(favId); }}
                    className={`absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full transition-all cursor-pointer ${
                      fav ? 'bg-red-50 text-red-500' : 'bg-white/80 text-gray-400 hover:text-red-400'
                    }`}
                    title={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                  >
                    <i className={`${fav ? 'ri-heart-fill' : 'ri-heart-line'} text-sm`} />
                  </button>
                </div>

                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <h3 className={`text-base font-bold mb-0 ${outOfStock ? 'text-gray-500 line-through' : 'text-white'}`}>
                      {item.name}
                    </h3>
                    {outOfStock && (
                      <span className="text-xs font-bold text-red-400 bg-red-900/30 border border-red-700/40 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                        Agotado
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm mb-3 leading-relaxed flex-1">
                    {item.description}
                  </p>

                  <div className="flex items-center justify-between pt-2 mt-auto">
                    <FlashPrice
                      price={item.price}
                      productName={item.name}
                      category="Bebida Alcohólica en Lata"
                      variant="dark"
                      size="xl"
                    />
                    {outOfStock ? (
                      <span className="text-xs text-gray-500 font-semibold px-3 py-1.5 rounded-md bg-gray-700 whitespace-nowrap">
                        No disponible
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAdd(item)}
                        className={`text-sm font-semibold px-4 py-2 rounded-md cursor-pointer transition-all whitespace-nowrap hover:scale-105 active:scale-95 ${
                          addedIds.has(item.id)
                            ? "bg-green-500 text-white"
                            : "bg-amber-500 hover:bg-amber-600 text-white"
                        }`}
                      >
                        {addedIds.has(item.id) ? (
                          <>
                            <i className="ri-check-line mr-1" />
                            Agregado
                          </>
                        ) : (
                          "Agregar"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}