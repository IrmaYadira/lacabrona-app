import { useState } from "react";
import { vasosPreparadosMenu } from "@/mocks/menu";
import { useCart } from "../context/CartContext";
import { useFlashPrice } from "@/hooks/useFlashPrice";
import { usePaused } from "../context/PausedContext";
import FlashPrice from "@/components/FlashPrice";
import ScrollReveal from "@/components/base/ScrollReveal";

// Notas de ajuste rápido por tipo de vaso (basadas en sus ingredientes reales)
const QUICK_ADJUSTMENTS: Record<string, string[]> = {
  // Chelado (sal, limón, hielo)
  "Vaso Chelado": ["Extra limón", "Poco hielo", "Sin hielo", "Más sal", "Menos sal"],
  // Michelado (limón, sal, salsas negras, tabasco, pimienta, hielo)
  "Vaso Michelado": ["Extra limón", "Más tabasco", "Sin tabasco", "Menos pimienta", "Poco hielo", "Sin hielo", "Más salsas negras"],
  // 1/2 Vaso Clamatado (limón, clamato, salsas negras, sal, hielo)
  "1/2 Vaso Clamatado": ["Extra limón", "Más clamato", "Más salsas negras", "Poco hielo", "Sin hielo", "Menos sal"],
  // Vaso Clamatado completo
  "Vaso Clamatado": ["Extra limón", "Más clamato", "Más salsas negras", "Poco hielo", "Sin hielo", "Menos sal"],
  // Litro de Clamatado
  "Litro de Clamatado": ["Extra limón", "Más clamato", "Más salsas negras", "Poco hielo", "Sin hielo", "Menos sal"],
  // Orden de Sal y Limones — sin ajustes
  "Orden de Sal y Limones": [],
};

function getAdjustmentsForVaso(name: string): string[] {
  return QUICK_ADJUSTMENTS[name] ?? ["Extra limón", "Poco hielo", "Sin hielo", "Menos sal"];
}

interface VasoNotesModalProps {
  item: (typeof vasosPreparadosMenu)[0];
  onClose: () => void;
  onConfirm: (notes: string) => void;
}

function VasoNotesModal({ item, onClose, onConfirm }: VasoNotesModalProps) {
  const [omitted, setOmitted] = useState<Set<string>>(new Set());
  const [adjustments, setAdjustments] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const { hasOffer, discountedPrice, discountPct } = useFlashPrice(item.name, "Vasos Preparados", item.price);

  const quickAdjustments = getAdjustmentsForVaso(item.name);

  const toggleOmit = (ing: string) => {
    setOmitted((prev) => {
      const next = new Set(prev);
      if (next.has(ing)) next.delete(ing);
      else next.add(ing);
      return next;
    });
  };

  const toggleAdjust = (tag: string) => {
    setAdjustments((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const handleConfirm = () => {
    const parts: string[] = [];
    if (omitted.size > 0) parts.push(`Sin: ${[...omitted].join(", ")}`);
    if (adjustments.size > 0) parts.push([...adjustments].join(", "));
    if (notes.trim()) parts.push(notes.trim());
    onConfirm(parts.join(" · "));
  };

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

        <div className="px-5 py-5 space-y-4">
          {/* Ingredientes con opción de omitir */}
          {item.ingredients && item.ingredients.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                <i className="ri-list-check mr-1 text-amber-500" />
                Quitar ingredientes (opcional)
              </span>
              <div className="flex flex-wrap gap-2">
                {item.ingredients.map((ing) => {
                  const isOmitted = omitted.has(ing);
                  return (
                    <button
                      key={ing}
                      onClick={() => toggleOmit(ing)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-all select-none whitespace-nowrap ${
                        isOmitted
                          ? "bg-red-50 border-red-300 text-red-600 line-through"
                          : "bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-400"
                      }`}
                    >
                      {isOmitted ? (
                        <i className="ri-close-circle-fill text-red-400 text-xs" />
                      ) : (
                        <i className="ri-checkbox-blank-circle-line text-amber-400 text-xs" />
                      )}
                      {ing}
                    </button>
                  );
                })}
              </div>
              {omitted.size > 0 && (
                <p className="text-xs text-red-500 mt-2 font-medium">
                  <i className="ri-information-line mr-1" />
                  Sin: {[...omitted].join(", ")}
                </p>
              )}
            </div>
          )}

          {/* Ajustes rápidos — solo si hay opciones para este vaso */}
          {quickAdjustments.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                <i className="ri-add-circle-line mr-1 text-amber-500" />
                Ajustes rápidos
              </span>
              <div className="flex flex-wrap gap-2">
                {quickAdjustments.map((tag) => {
                  const active = adjustments.has(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleAdjust(tag)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-all select-none whitespace-nowrap ${
                        active
                          ? "bg-amber-500 border-amber-500 text-white"
                          : "bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-400"
                      }`}
                    >
                      {active ? (
                        <i className="ri-check-line text-xs" />
                      ) : (
                        <i className="ri-add-line text-xs" />
                      )}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Observaciones libres */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              <i className="ri-chat-3-line mr-1 text-amber-500" />
              Otra observación
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cualquier otra indicación especial..."
              maxLength={120}
              rows={2}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none placeholder:text-gray-400"
            />
            {notes.length > 80 && (
              <div className="flex justify-end mt-1">
                <span className="text-xs text-gray-400">{notes.length}/120</span>
              </div>
            )}
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
            onClick={handleConfirm}
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

// IDs que ya aparecen en BebidasSinAlcoholSection (Rusas)
const RUSA_IDS = [7, 8];

export default function VasosPreparadosSection() {
  const { addItem, setIsOpen, toggleFavorite, isFavorite } = useCart();
  const { isPaused } = usePaused();
  const [modalItem, setModalItem] = useState<(typeof vasosPreparadosMenu)[0] | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  // Filtrar las Rusas — ya aparecen en la sección de Bebidas Sin Alcohol
  const vasoItems = vasosPreparadosMenu.filter((v) => !RUSA_IDS.includes(v.id));

  const handleAdd = (item: (typeof vasosPreparadosMenu)[0], notes: string) => {
    addItem({
      id: 500 + item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.image,
      category: "Vasos Preparados",
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
    <section id="vasos" className="py-16 md:py-24 bg-gray-900">
      <div className="w-full px-4 md:px-8 max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-12 md:mb-16">
            <span className="text-amber-500 text-sm font-semibold uppercase tracking-widest">
              Preparados al Momento
            </span>
            <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-white mt-2 tracking-wide">
              VASOS PREPARADOS
            </h2>
            <p className="text-gray-400 mt-3 max-w-xl mx-auto text-sm md:text-base">
              Tu vaso bien preparado con sal, limón y todo lo que necesitas para disfrutar como un cabrón.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {vasoItems.map((item, index) => {
            const outOfStock = isPaused(`vaso-${item.id}`);
            const favId = 500 + item.id;
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

                  {/* Tags de ingredientes */}
                  {item.ingredients && item.ingredients.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {item.ingredients.map((ing) => (
                        <span key={ing} className="bg-gray-700 text-amber-400 text-xs px-2 py-0.5 rounded-full">
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
                      category="Vasos Preparados"
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
        <VasoNotesModal
          item={modalItem}
          onClose={() => setModalItem(null)}
          onConfirm={(notes) => handleAdd(modalItem, notes)}
        />
      )}
    </section>
  );
}