import { useState } from "react";
import { hotDogsMenu } from "@/mocks/menu";
import { useCart } from "../context/CartContext";
import { useFlashPrice } from "@/hooks/useFlashPrice";
import FlashPrice from "@/components/FlashPrice";
import { usePaused } from "../context/PausedContext";
import ScrollReveal from "@/components/base/ScrollReveal";

interface HotDogNotesModalProps {
  item: (typeof hotDogsMenu)[0];
  onClose: () => void;
  onConfirm: (notes: string) => void;
}

function HotDogNotesModal({ item, onClose, onConfirm }: HotDogNotesModalProps) {
  const [notes, setNotes] = useState("");
  const { hasOffer, discountedPrice, discountPct } = useFlashPrice(item.name, "Hot Dogs Meños", item.price);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl max-w-sm w-full shadow-2xl overflow-hidden">
        <div className="bg-amber-500 px-5 py-4">
          <h3 className="text-white font-bold text-lg">{item.name}</h3>
          <p className="text-white/80 text-xs mt-0.5">
            {hasOffer ? (
              <span className="flex items-center gap-1.5">
                <span className="line-through">${item.price.toFixed(2)}</span>
                <span className="font-bold">${discountedPrice.toFixed(2)}</span>
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">-{discountPct}%</span>
              </span>
            ) : (
              <>${item.price.toFixed(2)}</>
            )}
          </p>
        </div>
        <div className="px-5 py-5">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            <i className="ri-chat-3-line mr-1 text-amber-500" />
            Observaciones
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Escribe si quieres quitar o agregar algo..."
            maxLength={200}
            rows={3}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-400">Ej. "Sin cebolla", "Extra crema"</span>
            <span className="text-xs text-gray-400">{notes.length}/200</span>
          </div>
        </div>
        <div className="border-t border-gray-100 px-5 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors whitespace-nowrap"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(notes)}
            className="flex-[2] py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold cursor-pointer transition-colors whitespace-nowrap shadow-sm"
          >
            <i className="ri-add-line mr-1" />
            Agregar al pedido
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HotDogsSection() {
  const { addItem, setIsOpen, toggleFavorite, isFavorite } = useCart();
  const { isPaused } = usePaused();
  const [modalItem, setModalItem] = useState<(typeof hotDogsMenu)[0] | null>(null);

  const handleAdd = (item: (typeof hotDogsMenu)[0], notes: string) => {
    addItem({
      id: 300 + item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.image,
      category: "Hot Dogs Meños",
      notes: notes.trim() || undefined,
    });
    setIsOpen(true);
    setModalItem(null);
  };

  return (
    <section id="hotdogs" className="py-16 md:py-24 bg-amber-50">
      <div className="w-full px-4 md:px-8 max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-12 md:mb-16">
            <span className="text-amber-600 text-sm font-semibold uppercase tracking-widest">
              La Clásica
            </span>
            <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-gray-900 mt-2 tracking-wide">
              HOT DOGS MEÑOS
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm md:text-base">
              Salchicha cocida al estilo tradicional. Simple, delicioso y bien cabrón.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {hotDogsMenu.map((item, index) => {
            const outOfStock = isPaused(`hdog-${item.id}`);
            const favId = 300 + item.id;
            const fav = isFavorite(favId);
            return (
            <ScrollReveal key={item.id} delay={index * 100}>
              <div className={`bg-white rounded-lg overflow-hidden transition-all duration-300 group ${outOfStock ? 'opacity-70' : 'hover:shadow-lg hover:-translate-y-1'}`}>
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
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="bg-red-500 text-white text-sm font-black px-4 py-1.5 rounded-full">Agotado</span>
                    </div>
                  )}
                  {/* Favorito */}
                  {!outOfStock && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(favId); }}
                      className={`absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center rounded-full transition-all cursor-pointer ${
                        fav ? 'bg-red-50 text-red-500' : 'bg-white/80 text-gray-400 hover:text-red-400'
                      }`}
                      title={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                    >
                      <i className={`${fav ? 'ri-heart-fill' : 'ri-heart-line'} text-sm`} />
                    </button>
                  )}
                </div>
                <div className="p-4">
                  <h3 className={`text-base font-bold mb-1 ${outOfStock ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {item.name}
                  </h3>
                  <p className="text-gray-500 text-xs mb-3 leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <FlashPrice
                      price={item.price}
                      productName={item.name}
                      category="Hot Dogs Meños"
                      variant="light"
                      size="xl"
                    />
                    {outOfStock ? (
                      <span className="text-xs text-gray-400 font-semibold px-3 py-1.5 rounded-md bg-gray-100">
                        No disponible
                      </span>
                    ) : (
                      <button
                        onClick={() => setModalItem(item)}
                        className="text-gray-900 hover:text-amber-600 text-sm font-semibold cursor-pointer transition-all whitespace-nowrap hover:scale-105 active:scale-95"
                      >
                        <i className="ri-add-line mr-1" />
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

      {modalItem && (
        <HotDogNotesModal
          item={modalItem}
          onClose={() => setModalItem(null)}
          onConfirm={(notes) => handleAdd(modalItem, notes)}
        />
      )}
    </section>
  );
}