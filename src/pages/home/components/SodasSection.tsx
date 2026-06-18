import { useState } from "react";
import { sodasMenu } from "@/mocks/menu";
import { useCart } from "../context/CartContext";
import { usePaused } from "../context/PausedContext";
import FlashPrice from "@/components/FlashPrice";
import ScrollReveal from "@/components/base/ScrollReveal";
import VariantPickerModal, { type VariantPickerItem } from "./VariantPickerModal";

// Sabores / variantes por producto (id del sodasMenu)
const SODA_VARIANTS: Record<number, { label: string; options: string[] }> = {
  1: {
    label: "¿Qué sabor quieres?",
    options: ["Fanta", "Sprite", "Mirinda Naranja", "Mirinda Uva", "Manzanita", "Seven Up", "Fresca", "Ginger Ale", "Agua Tónica"],
  },
  2: {
    label: "¿Qué refresco quieres?",
    options: ["Coca-Cola", "Coca-Cola Zero", "Coca-Cola Light", "Squirt", "Seven Up", "Ginger Ale", "Sidral"],
  },
  10: {
    label: "¿Qué sabor de Arizona?",
    options: ["Kiwi-Fresa", "Mango", "Sandía", "Té Verde"],
  },
  11: {
    label: "¿Qué sabor de Jugo?",
    options: ["Mango", "Durazno", "Manzana", "Guayaba"],
  },
};

export default function SodasSection() {
  const { addItem, setIsOpen, toggleFavorite, isFavorite } = useCart();
  const { isPaused } = usePaused();
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [pickerItem, setPickerItem] = useState<VariantPickerItem | null>(null);

  const markAdded = (id: number) => {
    setAddedIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 1500);
  };

  const handleAdd = (item: (typeof sodasMenu)[0]) => {
    const variants = SODA_VARIANTS[item.id];

    if (variants) {
      // Tiene variantes → abrir modal
      setPickerItem({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image,
        category: "Refresco",
        cartIdBase: 400,
        variantLabel: variants.label,
        options: variants.options.map((o) => ({ label: o, value: o })),
      });
    } else {
      // Sin variantes → agregar directo
      addItem({
        id: 400 + item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image,
        category: "Refresco",
      });
      markAdded(item.id);
      setIsOpen(true);
    }
  };

  const handlePickerClose = () => {
    if (pickerItem) markAdded(pickerItem.id);
    setPickerItem(null);
  };

  return (
    <>
      <section id="refrescos" className="py-16 md:py-24 bg-gray-800">
        <div className="w-full px-4 md:px-8 max-w-7xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-12 md:mb-16">
              <span className="text-amber-500 text-sm font-semibold uppercase tracking-widest">
                Bebidas Sin Alcohol
              </span>
              <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-white mt-2 tracking-wide">
                REFRESCOS Y BEBIDAS
              </h2>
              <p className="text-gray-400 mt-3 max-w-xl mx-auto text-sm md:text-base">
                Refrescantes bebidas para acompañar tus alitas y boneless.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6">
            {sodasMenu.map((item, index) => {
              const outOfStock = isPaused(`soda-${item.id}`);
              const hasVariants = !!SODA_VARIANTS[item.id];
              const isAdded = addedIds.has(item.id);
              return (
                <ScrollReveal key={item.id} delay={index * 80}>
                  <div className={`bg-gray-700 rounded-lg overflow-hidden hover:bg-gray-600 hover:-translate-y-1 transition-all duration-300 group h-full flex flex-col ${outOfStock ? 'opacity-60' : ''}`}>
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
                      <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="bg-amber-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                        {hasVariants && (
                          <span className="bg-gray-900/80 text-amber-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-500/40">
                            Varios sabores
                          </span>
                        )}
                      </div>
                      {/* Favorito */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(5700 + item.id); }}
                        className={`absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full transition-all cursor-pointer ${
                          isFavorite(5700 + item.id) ? 'bg-red-50 text-red-500' : 'bg-white/80 text-gray-400 hover:text-red-400'
                        }`}
                        title={isFavorite(5700 + item.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                      >
                        <i className={`${isFavorite(5700 + item.id) ? 'ri-heart-fill' : 'ri-heart-line'} text-sm`} />
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
                          category="Refresco"
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
                              isAdded
                                ? "bg-green-500 text-white"
                                : hasVariants
                                ? "bg-gray-900 hover:bg-amber-500 text-amber-400 hover:text-white border border-amber-500/50"
                                : "bg-amber-500 hover:bg-amber-600 text-white"
                            }`}
                          >
                            {isAdded ? (
                              <>
                                <i className="ri-check-line mr-1" />
                                Agregado
                              </>
                            ) : hasVariants ? (
                              <>
                                <i className="ri-arrow-right-line mr-1" />
                                Elegir sabor
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

      <VariantPickerModal
        item={pickerItem}
        onClose={handlePickerClose}
      />
    </>
  );
}