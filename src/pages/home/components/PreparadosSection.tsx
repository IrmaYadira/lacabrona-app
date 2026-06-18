import { useState } from "react";
import { preparadosMenu } from "@/mocks/menu";
import { useCart } from "../context/CartContext";
import { usePaused } from "../context/PausedContext";
import type { CartItem } from "../context/CartContext";
import FlashPrice from "@/components/FlashPrice";
import ScrollReveal from "@/components/base/ScrollReveal";
import PreparadoModal from "./PreparadoModal";

interface SelectedPreparado {
  cartItem: CartItem;
  baseName: string;
  basePrice: number;
  doublePrice: number;
}

export default function PreparadosSection() {
  const { addItem, setIsOpen, toggleFavorite, isFavorite } = useCart();
  const { isPaused } = usePaused();
  const [selected, setSelected] = useState<SelectedPreparado | null>(null);

  const handleOpenModal = (item: (typeof preparadosMenu)[0]) => {
    setSelected({
      cartItem: {
        id: 700 + item.id,
        name: item.name,
        description: item.description,
        price: item.basePrice,
        image: item.image,
        category: "Preparados",
      },
      baseName: item.baseName,
      basePrice: item.basePrice,
      doublePrice: item.doublePrice,
    });
  };

  const handleAddDirect = (item: (typeof preparadosMenu)[0]) => {
    addItem({
      id: 700 + item.id,
      name: item.name,
      description: item.description,
      price: item.basePrice,
      image: item.image,
      category: "Preparados",
      notes: `30ml de ${item.baseName}`,
    });
    setIsOpen(true);
  };

  return (
    <section id="preparados" className="py-16 md:py-24 bg-gray-900">
      <div className="w-full px-4 md:px-8 max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-12 md:mb-16">
            <span className="text-amber-500 text-sm font-semibold uppercase tracking-widest">
              Bebidas Preparadas
            </span>
            <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-white mt-2 tracking-wide">
              PREPARADOS
            </h2>
            <p className="text-gray-400 mt-3 max-w-xl mx-auto text-sm md:text-base">
              Tu destilado favorito con refresco, agua mineral y hielo. Elige simple (30ml) o doble (60ml).
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
          {preparadosMenu.map((item, index) => {
            const outOfStock = isPaused(`prep-${item.id}`);
            const favId = 700 + item.id;
            const fav = isFavorite(favId);
            return (
            <ScrollReveal key={item.id} delay={index * 100}>
              <div className={`bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-750 hover:-translate-y-1 transition-all duration-300 group ${outOfStock ? 'opacity-60' : ''}`}>
                <div className="relative h-52 overflow-hidden">
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

                <div className="p-5">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className={`text-lg font-bold mb-0 ${outOfStock ? 'text-gray-500 line-through' : 'text-white'}`}>
                      {item.name}
                    </h3>
                    {outOfStock && (
                      <span className="text-xs font-bold text-red-400 bg-red-900/30 border border-red-700/40 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                        Agotado
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-xs mb-1">
                    Base: {item.baseName}
                  </p>
                  <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                    {item.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">Simple</span>
                        <FlashPrice
                          price={item.basePrice}
                          productName={item.name}
                          category="Preparados"
                          variant="dark"
                          size="sm"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">Doble</span>
                        <FlashPrice
                          price={item.doublePrice}
                          productName={item.name}
                          category="Preparados"
                          variant="dark"
                          size="sm"
                        />
                      </div>
                    </div>
                    {outOfStock ? (
                      <span className="text-xs text-gray-500 font-semibold px-3 py-1.5 rounded-md bg-gray-700 whitespace-nowrap">
                        No disponible
                      </span>
                    ) : (
                      <button
                        onClick={() => handleOpenModal(item)}
                        className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-md cursor-pointer transition-all whitespace-nowrap hover:scale-105 active:scale-95"
                      >
                        Agregar
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

      {selected && (
        <PreparadoModal
          item={selected.cartItem}
          baseName={selected.baseName}
          basePrice={selected.basePrice}
          doublePrice={selected.doublePrice}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}