import { useState } from "react";
import { azulitosMenu } from "@/mocks/menu";
import { useCart } from "../context/CartContext";
import { usePaused } from "../context/PausedContext";
import { useFlashPrice } from "@/hooks/useFlashPrice";
import FlashPrice from "@/components/FlashPrice";
import ScrollReveal from "@/components/base/ScrollReveal";

interface AzulitoNotesModalProps {
  item: (typeof azulitosMenu)[0];
  onClose: () => void;
  onConfirm: (notes: string) => void;
}

function AzulitoNotesModal({ item, onClose, onConfirm }: AzulitoNotesModalProps) {
  const [notes, setNotes] = useState("");
  const { hasOffer, discountedPrice, discountPct } = useFlashPrice(item.name, "Azulitos", item.price);

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
          {item.ingredients && item.ingredients.length > 0 && (
            <div className="mb-4">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contiene:</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {item.ingredients.map((ing) => (
                  <span key={ing} className="bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded-full border border-amber-100">
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}
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
            <span className="text-xs text-gray-400">Ej. "Sin sal", "Extra limón"</span>
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

export default function AzulitosSection() {
  const { addItem, setIsOpen, toggleFavorite, isFavorite } = useCart();
  const { isPaused } = usePaused();
  const [modalItem, setModalItem] = useState<(typeof azulitosMenu)[0] | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  const handleAdd = (item: (typeof azulitosMenu)[0], notes: string) => {
    addItem({
      id: 700 + item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.image,
      category: "Azulitos",
      notes: notes.trim() || undefined,
    });
    setAddedIds((prev) => new Set(prev).add(item.id));
    setIsOpen(true);
    setModalItem(null);
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }, 1500);
  };

  return (
    <section id="azulitos" className="py-16 md:py-24 bg-gray-800">
      <div className="w-full px-4 md:px-8 max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-12 md:mb-16">
            <span className="text-amber-500 text-sm font-semibold uppercase tracking-widest">
              Preparados con Tequila
            </span>
            <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-white mt-2 tracking-wide">
              AZULITOS Y CHARROS
            </h2>
            <p className="text-gray-400 mt-3 max-w-xl mx-auto text-sm md:text-base">
              Los clásicos preparados azules con tequila, limón y sal. Para empezar la fiesta como un cabrón.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {azulitosMenu.map((item, index) => {
            const outOfStock = isPaused(`azul-${item.id}`);
            const favId = 5300 + item.id;
            const fav = isFavorite(favId);
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

                  {/* Tags de ingredientes */}
                  {item.ingredients && item.ingredients.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {item.ingredients.map((ing) => (
                        <span key={ing} className="bg-gray-600 text-amber-400 text-xs px-2 py-0.5 rounded-full">
                          {ing}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-gray-400 text-sm mb-3 leading-relaxed flex-1">
                    {item.description}
                  </p>

                  <div className="flex items-center justify-between pt-2 mt-auto">
                    <FlashPrice
                      price={item.price}
                      productName={item.name}
                      category="Azulitos"
                      variant="dark"
                      size="xl"
                    />
                    {outOfStock ? (
                      <span className="text-xs text-gray-500 font-semibold px-3 py-1.5 rounded-md bg-gray-700 whitespace-nowrap">
                        No disponible
                      </span>
                    ) : (
                      <button
                        onClick={() => setModalItem(item)}
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

      {modalItem && (
        <AzulitoNotesModal
          item={modalItem}
          onClose={() => setModalItem(null)}
          onConfirm={(notes) => handleAdd(modalItem, notes)}
        />
      )}
    </section>
  );
}