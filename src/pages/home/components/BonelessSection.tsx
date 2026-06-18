import { useState } from "react";
import { bonelessMenu } from "@/mocks/menu";
import { usePaused } from "../context/PausedContext";
import { useCart } from "../context/CartContext";
import { useFlashPrice } from "@/hooks/useFlashPrice";
import FlashPrice from "@/components/FlashPrice";
import ScrollReveal from "@/components/base/ScrollReveal";

type SizeKey = "Media Orden (5 pzas)" | "Orden Completa (10 pzas)";

const SIZES: { value: SizeKey; label: string; sub: string }[] = [
  { value: "Media Orden (5 pzas)", label: "Media", sub: "5 piezas" },
  { value: "Orden Completa (10 pzas)", label: "Completa", sub: "10 piezas" },
];

function SpiceDots({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5 items-center">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i < level ? "bg-red-500" : "bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

interface BonelessCardProps {
  isOpen: boolean;
  onToggle: () => void;
}

function BonelessCard({ isOpen, onToggle }: BonelessCardProps) {
  const { isPaused } = usePaused();
  const { addItem, setIsOpen: openCart, toggleFavorite, isFavorite } = useCart();

  const [size, setSize] = useState<SizeKey>("Media Orden (5 pzas)");
  const [selectedSauce, setSelectedSauce] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const outOfStock = isPaused("boneless-main");
  const price = bonelessMenu.prices[size];
  const totalPrice = price * qty;
  const favId = size === "Orden Completa (10 pzas)" ? 101 : 102;

  const handleAdd = () => {
    if (!selectedSauce) return;

    const description = `${bonelessMenu.description} Salsa: ${selectedSauce}${notes.trim() ? ` — ${notes.trim()}` : ""}`;

    for (let i = 0; i < qty; i++) {
      addItem({
        id: 100,
        name: `Boneless - ${selectedSauce}`,
        description,
        price,
        image: bonelessMenu.image,
        size,
        category: "Boneless",
      });
    }

    setAdded(true);
    openCart(true);
    setTimeout(() => {
      setAdded(false);
      onToggle();
    }, 1000);
  };

  return (
    <div
      className={`bg-white rounded-xl overflow-hidden transition-all duration-300 border ${
        isOpen ? "border-amber-300" : "border-transparent"
      } ${outOfStock ? "opacity-70" : ""}`}
    >
      {/* Imagen */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={bonelessMenu.image}
          alt="Boneless"
          title="Boneless La Cabrona — Sin hueso, 13 salsas"
          loading="lazy"
          decoding="async"
          fetchpriority="low"
          width="400"
          height="400"
          className={`w-full h-full object-cover object-top transition-transform duration-500 ${
            outOfStock ? "grayscale" : isOpen ? "scale-105" : ""
          }`}
        />
        <div className="absolute top-3 left-3 flex gap-1.5">
          {bonelessMenu.tags.map((tag) => (
            <span
              key={tag}
              className="bg-amber-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
        {/* Favorito */}
        {!outOfStock && (
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(favId); }}
            className={`absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full transition-all cursor-pointer ${
              isFavorite(favId) ? 'bg-red-50 text-red-500' : 'bg-white/80 text-gray-400 hover:text-red-400'
            }`}
            title={isFavorite(favId) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          >
            <i className={`${isFavorite(favId) ? 'ri-heart-fill' : 'ri-heart-line'} text-sm`} />
          </button>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-red-500 text-white text-sm font-black px-4 py-1.5 rounded-full">
              Agotado
            </span>
          </div>
        )}
      </div>

      {/* Nombre, descripción y botón */}
      <div className="px-4 pt-3.5 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-bold leading-tight ${outOfStock ? "text-gray-400 line-through" : "text-gray-900"}`}>
              {bonelessMenu.name}
            </h3>
            <p className="text-gray-400 text-xs mt-1 leading-snug line-clamp-2">
              {bonelessMenu.description}
            </p>
          </div>
          <FlashPrice
            price={price}
            productName={bonelessMenu.name}
            category="Boneless"
            variant="light"
            size="lg"
            className="flex-shrink-0"
          />
        </div>

        {outOfStock ? (
          <div className="mt-3 text-center text-xs text-gray-400 font-semibold py-1.5 bg-gray-100 rounded-lg">
            No disponible
          </div>
        ) : (
          <button
            onClick={onToggle}
            className={`mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              isOpen
                ? "bg-gray-100 text-gray-700"
                : "bg-amber-500 hover:bg-amber-600 text-white"
            }`}
          >
            {isOpen ? (
              <><i className="ri-arrow-up-s-line text-sm" /> Cerrar</>
            ) : (
              <><i className="ri-add-line text-sm" /> Personalizar y agregar</>
            )}
          </button>
        )}
      </div>

      {/* Panel expandible */}
      {isOpen && !outOfStock && (
        <div className="border-t border-amber-100 px-4 pb-4 pt-3 space-y-3.5 bg-gray-50">

          {/* Tamaño */}
          <div>
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
              <i className="ri-stack-line mr-1 text-amber-500" />
              Tamaño
            </p>
            <div className="flex gap-2">
              {SIZES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSize(s.value)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all border-2 ${
                    size === s.value
                      ? "border-amber-500 bg-white text-amber-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-amber-300"
                  }`}
                >
                  <span className="font-bold">{s.label}</span>
                  <span className="text-[10px] text-gray-400">{s.sub}</span>
                  <span className="text-[11px] font-bold text-amber-600">
                    <FlashPrice
                      price={bonelessMenu.prices[s.value]}
                      productName={bonelessMenu.name}
                      category="Boneless"
                      variant="light"
                      size="sm"
                    />
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Selector de salsa */}
          <div>
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
              <i className="ri-fire-line mr-1 text-amber-500" />
              Salsa <span className="text-red-500">*</span>
            </p>
            <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
              {bonelessMenu.sauces.map((sauce) => (
                <button
                  key={sauce.name}
                  onClick={() => setSelectedSauce(sauce.name)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${
                    selectedSauce === sauce.name
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-gray-300"
                    style={{ backgroundColor: sauce.color }}
                  />
                  <span className="flex-1 truncate">{sauce.name}</span>
                  {sauce.spiceLevel > 0 && (
                    <SpiceDots level={sauce.spiceLevel} />
                  )}
                </button>
              ))}
            </div>
            {!selectedSauce && (
              <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                <i className="ri-error-warning-line" /> Selecciona una salsa
              </p>
            )}
          </div>

          {/* Observaciones */}
          <div>
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
              <i className="ri-chat-3-line mr-1 text-amber-500" />
              Observaciones
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder='Ej. "Sin cebolla", "Extra salsa"'
              maxLength={200}
              rows={2}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 resize-none"
            />
            <div className="text-right mt-0.5">
              <span className="text-[10px] text-gray-400">{notes.length}/200</span>
            </div>
          </div>

          {/* Cantidad + Agregar */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1.5">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-amber-600 cursor-pointer transition-colors"
              >
                <i className="ri-subtract-line text-sm" />
              </button>
              <span className="w-5 text-center text-sm font-bold text-gray-900">{qty}</span>
              <button
                onClick={() => setQty(qty + 1)}
                className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-amber-600 cursor-pointer transition-colors"
              >
                <i className="ri-add-line text-sm" />
              </button>
            </div>

            <button
              onClick={handleAdd}
              disabled={!selectedSauce}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
                added
                  ? "bg-green-500 text-white"
                  : !selectedSauce
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-gray-900 hover:bg-gray-800 text-white"
              }`}
            >
              {added ? (
                <><i className="ri-check-line" /> ¡Agregado!</>
              ) : (
                <>
                  <i className="ri-shopping-basket-2-line" />
                  <BonelessAddButtonText price={price} qty={qty} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BonelessAddButtonText({ price, qty }: { price: number; qty: number }) {
  const { discountedPrice } = useFlashPrice(bonelessMenu.name, "Boneless", price);
  return (
    <>Agregar {qty > 1 ? `${qty}` : ""} — ${(discountedPrice * qty).toFixed(0)}</>
  );
}

export default function BonelessSection() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section id="boneless" className="py-16 md:py-24 bg-white">
      <div className="w-full px-4 md:px-8 max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-12 md:mb-16">
            <span className="text-amber-600 text-sm font-semibold uppercase tracking-widest">
              Sin Hueso
            </span>
            <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-gray-900 mt-2 tracking-wide">
              BONELESS
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm md:text-base">
              Crujientes por fuera, jugosos por dentro. Elige entre {bonelessMenu.sauces.length} salsas irresistibles.
            </p>
          </div>
        </ScrollReveal>

        {/* Layout: imagen grande a la izquierda + tarjeta a la derecha */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-start">
          {/* Imagen informativa */}
          <ScrollReveal direction="left">
            <div className="relative h-64 md:h-96 rounded-xl overflow-hidden">
              <img
                src={bonelessMenu.image}
                alt="Boneless La Cabrona"
                title="Boneless La Cabrona — Sin hueso, 13 salsas"
                loading="lazy"
                decoding="async"
                fetchpriority="low"
                width="600"
                height="450"
                className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-white text-xs font-semibold opacity-90 leading-relaxed">
                  Pechuga empanizada y frita · Aderezo ranch · Zanahorias y apio
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {bonelessMenu.sauces.slice(0, 6).map((s) => (
                    <span
                      key={s.name}
                      className="flex items-center gap-1 bg-white/20 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full border border-white/30"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      {s.name}
                    </span>
                  ))}
                  <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full border border-white/30">
                    +{bonelessMenu.sauces.length - 6} más
                  </span>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Tarjeta expandible */}
          <ScrollReveal direction="right">
            <BonelessCard isOpen={isOpen} onToggle={() => setIsOpen((v) => !v)} />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}