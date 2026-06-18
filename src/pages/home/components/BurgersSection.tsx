import { useState } from "react";
import { burgersMenu, bonelessMenu } from "@/mocks/menu";
import { usePaused } from "../context/PausedContext";
import { useCart } from "../context/CartContext";
import { useFlashPrice } from "@/hooks/useFlashPrice";
import FlashPrice from "@/components/FlashPrice";
import ScrollReveal from "@/components/base/ScrollReveal";

type SidesOption = "papas gajo" | "papas a la francesa" | "aros de cebolla";

const SIDES: { value: SidesOption; label: string; emoji: string }[] = [
  { value: "papas gajo", label: "Gajo", emoji: "🥔" },
  { value: "papas a la francesa", label: "Francesa", emoji: "🍟" },
  { value: "aros de cebolla", label: "Aros", emoji: "🧅" },
];

interface BurgerCardProps {
  item: (typeof burgersMenu)[0];
  isOpen: boolean;
  onToggle: () => void;
}

function BurgerCard({ item, isOpen, onToggle }: BurgerCardProps) {
  const { isPaused } = usePaused();
  const { addItem, setIsOpen: openCart, toggleFavorite, isFavorite } = useCart();

  const [sides, setSides] = useState<SidesOption>("papas gajo");
  const [noVeggies, setNoVeggies] = useState(false);
  const [noMayo, setNoMayo] = useState(false);
  const [noLemonPepper, setNoLemonPepper] = useState(false);
  const [selectedSauce, setSelectedSauce] = useState<string>("");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const outOfStock = isPaused(`burg-${item.id}`);
  const isBoneless = item.name.toLowerCase().includes("boneless");
  const favId = 400 + item.id;

  const handleAdd = () => {
    if (isBoneless && !selectedSauce) return;

    const extras: string[] = [];
    if (sides !== "papas gajo") extras.push(sides);
    if (noVeggies) extras.push("sin verdura");
    if (noMayo) extras.push("sin mayonesa");
    if (noLemonPepper) extras.push("papas sin Lemon & Pepper");
    if (isBoneless && selectedSauce) extras.push(`salsa: ${selectedSauce}`);

    const description = extras.length > 0
      ? `${item.description} — ${extras.join(", ")}`
      : item.description;

    for (let i = 0; i < qty; i++) {
      addItem({
        id: 400 + item.id,
        name: item.name,
        description,
        price: item.price,
        image: item.image,
        category: "Hamburguesas",
        sides,
        noVeggies,
        noMayo,
        sauce: isBoneless ? selectedSauce : undefined,
      });
    }

    setAdded(true);
    openCart(true);
    setTimeout(() => {
      setAdded(false);
      onToggle(); // cerrar el panel
    }, 1000);
  };

  return (
    <div
      className={`bg-white rounded-xl overflow-hidden transition-all duration-300 border ${
        isOpen ? "border-amber-300" : "border-transparent"
      } ${outOfStock ? "opacity-70" : ""}`}
    >
      {/* ── Imagen + info básica ── */}
      <div className={`relative h-44 overflow-hidden ${item.image.includes('readdy.ai') ? '' : 'bg-[#1a1a1a]'}`}>
        <img
          src={item.image}
          alt={item.name}
          title={item.name}
          loading="lazy"
          decoding="async"
          fetchpriority="low"
          width="400"
          height="400"
          className={`w-full h-full transition-transform duration-500 ${item.image.includes('readdy.ai') ? 'object-cover object-top' : 'object-contain'} ${
            outOfStock ? "grayscale" : isOpen ? "scale-105" : "group-hover:scale-105"
          }`}
        />
        {/* Favorito */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(favId); }}
          className={`absolute top-2 left-2 z-10 w-8 h-8 flex items-center justify-center rounded-full transition-all cursor-pointer ${
            isFavorite(favId) ? 'bg-red-50 text-red-500' : 'bg-white/80 text-gray-400 hover:text-red-400'
          }`}
          title={isFavorite(favId) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
        >
          <i className={`${isFavorite(favId) ? 'ri-heart-fill' : 'ri-heart-line'} text-sm`} />
        </button>
        {outOfStock ? (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-red-500 text-white text-sm font-black px-4 py-1.5 rounded-full">
              Agotado
            </span>
          </div>
        ) : item.price >= 115 && (
          <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
            {item.price === 120 ? "La Más Cabrona" : "Especial"}
          </span>
        )}
      </div>

      {/* ── Nombre, precio y botón de abrir ── */}
      <div className="px-4 pt-3.5 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-bold leading-tight ${outOfStock ? "text-gray-400 line-through" : "text-gray-900"}`}>
              {item.name}
            </h3>
            <p className="text-gray-400 text-xs mt-1 leading-snug line-clamp-2">{item.description}</p>
          </div>
          <FlashPrice
            price={item.price}
            productName={item.name}
            category="Hamburguesas"
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

      {/* ── Panel expandible de opciones ── */}
      {isOpen && !outOfStock && (
        <div className="border-t border-amber-100 px-4 pb-4 pt-3 space-y-3.5 bg-gray-50">

          {/* Papas */}
          <div>
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
              <i className="ri-restaurant-line mr-1 text-amber-500" />
              Acompañamiento
            </p>
            <div className="flex gap-2">
              {SIDES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSides(s.value)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all border-2 ${
                    sides === s.value
                      ? "border-amber-500 bg-white text-amber-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-amber-300"
                  }`}
                >
                  <span className="text-base">{s.emoji}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Salsas — solo Hamburguesa Boneless */}
          {isBoneless && (
            <div>
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                <i className="ri-fire-line mr-1 text-amber-500" />
                Salsa <span className="text-red-500">*</span>
              </p>
              <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
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
                    {sauce.spiceLevel > 2 && (
                      <i className="ri-fire-line text-red-400 text-[10px] flex-shrink-0" />
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
          )}

          {/* Ajustes */}
          <div>
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
              <i className="ri-settings-3-line mr-1 text-amber-500" />
              Ajustes
            </p>
            <div className="space-y-1.5">
              {[
                {
                  checked: noVeggies,
                  onChange: setNoVeggies,
                  label: "Sin verdura",
                  sub: "Sin lechuga, jitomate, cebolla",
                },
                {
                  checked: noMayo,
                  onChange: setNoMayo,
                  label: "Sin mayonesa",
                  sub: "Sin aderezos cremosos",
                },
                {
                  checked: noLemonPepper,
                  onChange: setNoLemonPepper,
                  label: "Papas sin Lemon & Pepper",
                  sub: "Solo sal",
                },
              ].map((opt) => (
                <label
                  key={opt.label}
                  className="flex items-center gap-2.5 px-3 py-2 bg-white rounded-lg cursor-pointer border border-gray-100 hover:border-amber-200 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={opt.checked}
                    onChange={(e) => opt.onChange(e.target.checked)}
                    className="w-3.5 h-3.5 accent-amber-500 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 leading-none">{opt.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{opt.sub}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Cantidad + Agregar */}
          <div className="flex items-center gap-3 pt-1">
            {/* Cantidad */}
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

            {/* Botón agregar */}
            <button
              onClick={handleAdd}
              disabled={isBoneless && !selectedSauce}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
                added
                  ? "bg-green-500 text-white"
                  : isBoneless && !selectedSauce
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-gray-900 hover:bg-gray-800 text-white"
              }`}
            >
              {added ? (
                <><i className="ri-check-line" /> ¡Agregado!</>
              ) : (
                <>
                  <i className="ri-shopping-basket-2-line" />
                  <BurgerAddButtonText item={item} qty={qty} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BurgerAddButtonText({ item, qty }: { item: (typeof burgersMenu)[0]; qty: number }) {
  const { discountedPrice } = useFlashPrice(item.name, "Hamburguesas", item.price);
  return (
    <>Agregar {qty > 1 ? `${qty}` : ""} — ${(discountedPrice * qty).toFixed(0)}</>
  );
}

export default function BurgersSection() {
  const [openId, setOpenId] = useState<number | null>(null);

  const handleToggle = (id: number) => {
    setOpenId(prev => (prev === id ? null : id));
  };

  return (
    <section id="hamburguesas" className="py-16 md:py-24 bg-gray-50">
      <div className="w-full px-4 md:px-8 max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-12 md:mb-16">
            <span className="text-amber-600 text-sm font-semibold uppercase tracking-widest">
              Sabor Único
            </span>
            <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-gray-900 mt-2 tracking-wide">
              HAMBURGUESAS
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm md:text-base">
              Jugosas hamburguesas en pan Super Bimbollos. Todas incluyen papas gajo, francesa o aros de cebolla.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {burgersMenu.map((item, index) => (
            <ScrollReveal key={item.id} delay={index * 80}>
              <BurgerCard
                item={item}
                isOpen={openId === item.id}
                onToggle={() => handleToggle(item.id)}
              />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}