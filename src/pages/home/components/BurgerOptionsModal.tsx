import { useState } from "react";
import type { CartItem } from "../context/CartContext";
import { useCart } from "../context/CartContext";
import { bonelessMenu } from "@/mocks/menu";

interface BurgerOptionsModalProps {
  item: CartItem;
  onClose: () => void;
  onAdd: (item: CartItem) => void;
}

// Ingredientes de la burger que se pueden omitir individualmente
const BURGER_INGREDIENTS = ["Lechuga", "Jitomate", "Cebolla", "Mayonesa", "Mostaza", "Catsup"];

// Términos de cocción (solo aplica para burgers con carne de res/sirloin)
const COOKING_TERMS = ["Término medio", "Bien cocida", "Poco cocida"];

// Extras con precio
interface BurgerExtra {
  label: string;
  price: number;
}
const BURGER_EXTRAS: BurgerExtra[] = [
  { label: "Extra queso", price: 10 },
  { label: "Extra crema", price: 0 },
  { label: "Extra salsa BBQ", price: 10 },
  { label: "Extra aderezo ranch", price: 15 },
  { label: "Pan bien tostado", price: 0 },
  { label: "Sin pan tostado", price: 0 },
];

// Ajustes para las papas
const SIDES_ADJUSTMENTS = ["Sin Lemon Pepper", "Extra sal", "Con catsup", "Sin sal"];

// Burgers que tienen carne de res (término de cocción aplica)
const HAS_COOKING_TERM = ["sirloin", "res", "doble"];

export default function BurgerOptionsModal({ item, onClose, onAdd }: BurgerOptionsModalProps) {
  const [sides, setSides] = useState<string>("papas gajo");
  const [omitted, setOmitted] = useState<Set<string>>(new Set());
  const [cookingTerm, setCookingTerm] = useState<string>("");
  const [extras, setExtras] = useState<Set<string>>(new Set());
  const [sidesAdj, setSidesAdj] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState(1);
  const [selectedSauce, setSelectedSauce] = useState<string>("");

  const { addItem, setIsOpen } = useCart();

  const isBonelessBurger = item.name.toLowerCase().includes("boneless");
  const hasCookingTerm = HAS_COOKING_TERM.some((k) => item.name.toLowerCase().includes(k));

  // Calcular precio extra
  const extrasTotal = [...extras].reduce((sum, label) => {
    const extra = BURGER_EXTRAS.find((e) => e.label === label);
    return sum + (extra?.price ?? 0);
  }, 0);
  const finalUnitPrice = item.price + extrasTotal;
  const totalPrice = finalUnitPrice * qty;

  const toggleOmit = (ing: string) => {
    setOmitted((prev) => {
      const next = new Set(prev);
      if (next.has(ing)) next.delete(ing); else next.add(ing);
      return next;
    });
  };

  const toggleExtra = (label: string) => {
    setExtras((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  const toggleSideAdj = (tag: string) => {
    setSidesAdj((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  };

  const handleAdd = () => {
    const parts: string[] = [];
    // Papa elegida
    parts.push(`Con: ${sides}`);
    // Ingredientes omitidos
    if (omitted.size > 0) parts.push(`Sin: ${[...omitted].join(", ")}`);
    // Término de cocción
    if (cookingTerm) parts.push(cookingTerm);
    // Extras con precio
    [...extras].forEach((label) => {
      const extra = BURGER_EXTRAS.find((e) => e.label === label);
      if (extra && extra.price > 0) {
        parts.push(`${label} (+$${extra.price})`);
      } else {
        parts.push(label);
      }
    });
    // Ajustes de papas
    if (sidesAdj.size > 0) parts.push(`Papas: ${[...sidesAdj].join(", ")}`);
    // Salsa boneless
    if (isBonelessBurger && selectedSauce) parts.push(`Salsa: ${selectedSauce}`);
    // Nota libre
    if (notes.trim()) parts.push(notes.trim());

    const allNotes = parts.join(" · ");

    for (let i = 0; i < qty; i++) {
      addItem({
        ...item,
        sides,
        noVeggies: omitted.size === BURGER_INGREDIENTS.length,
        noMayo: omitted.has("Mayonesa"),
        sauce: isBonelessBurger ? selectedSauce : undefined,
        notes: allNotes || undefined,
        price: finalUnitPrice,
      });
    }

    setIsOpen(true);
    onClose();
  };

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="bg-amber-500 px-4 py-3 md:px-5 md:py-4">
          <h3 className="text-white font-bold text-base md:text-lg leading-snug">
            Personalizar — {item.name}
          </h3>
          <p className="text-white/80 text-xs mt-0.5">Elige cómo quieres tu orden</p>
        </div>

        {/* Body */}
        <div className="px-4 md:px-5 py-4 md:py-5 space-y-5">

          {/* Salsas — solo Hamburguesa Boneless */}
          {isBonelessBurger && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <i className="ri-fire-line mr-1 text-amber-500" />
                Salsa para el boneless
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {bonelessMenu.sauces.map((sauce) => (
                  <button
                    key={sauce.name}
                    onClick={() => setSelectedSauce(sauce.name)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all border text-left flex items-center gap-2 ${
                      selectedSauce === sauce.name
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: sauce.color }}
                    />
                    <span className="flex-1">{sauce.name}</span>
                    {sauce.spiceLevel > 0 && (
                      <span className="text-[10px]">{"🔥".repeat(sauce.spiceLevel)}</span>
                    )}
                  </button>
                ))}
              </div>
              {!selectedSauce && (
                <p className="text-xs text-red-500 mt-1.5">
                  <i className="ri-error-warning-line mr-1" />
                  Selecciona una salsa para continuar
                </p>
              )}
            </div>
          )}

          {/* Tipo de papas */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="ri-restaurant-line mr-1 text-amber-500" />
              ¿Qué papas prefieres?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "papas gajo", label: "Papas Gajo" },
                { value: "papas a la francesa", label: "Papas Francesa" },
                { value: "aros de cebolla", label: "Aros de Cebolla" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSides(opt.value)}
                  className={`px-2 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-all border text-center ${
                    sides === opt.value
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Término de cocción — solo burgers con carne de res */}
          {hasCookingTerm && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <i className="ri-temp-hot-line mr-1 text-amber-500" />
                Término de cocción
                <span className="text-gray-400 font-normal text-xs ml-1">(opcional)</span>
              </label>
              <div className="flex gap-2 flex-wrap">
                {COOKING_TERMS.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setCookingTerm((prev) => prev === term ? "" : term)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all border whitespace-nowrap ${
                      cookingTerm === term
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {cookingTerm === term && <i className="ri-check-line mr-1 text-[10px]" />}
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quitar ingredientes individuales */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="ri-close-circle-line mr-1 text-amber-500" />
              Quitar ingredientes
              <span className="text-gray-400 font-normal text-xs ml-1">(toca para quitar)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {BURGER_INGREDIENTS.map((ing) => {
                const isOut = omitted.has(ing);
                return (
                  <button
                    key={ing}
                    type="button"
                    onClick={() => toggleOmit(ing)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-all select-none whitespace-nowrap ${
                      isOut
                        ? "bg-red-50 border-red-300 text-red-600 line-through"
                        : "bg-gray-50 border-gray-200 text-gray-600 hover:border-red-200 hover:bg-red-50"
                    }`}
                  >
                    {isOut
                      ? <i className="ri-close-circle-fill text-red-400 text-xs" />
                      : <i className="ri-checkbox-blank-circle-line text-gray-300 text-xs" />
                    }
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

          {/* Extras / ajustes rápidos de la burger */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="ri-add-circle-line mr-1 text-amber-500" />
              Extras y ajustes
              <span className="text-gray-400 font-normal text-xs ml-1">(opcional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {BURGER_EXTRAS.map((extra) => {
                const active = extras.has(extra.label);
                return (
                  <button
                    key={extra.label}
                    type="button"
                    onClick={() => toggleExtra(extra.label)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-all select-none whitespace-nowrap ${
                      active
                        ? "bg-amber-500 border-amber-500 text-white"
                        : "bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-400"
                    }`}
                  >
                    {active
                      ? <i className="ri-check-line text-xs" />
                      : <i className="ri-add-line text-xs" />
                    }
                    {extra.label}
                    {extra.price > 0 && (
                      <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"}`}>
                        +${extra.price}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {extrasTotal > 0 && (
              <p className="text-xs text-amber-700 mt-2 font-medium">
                <i className="ri-price-tag-3-line mr-1" />
                Extras: +${extrasTotal}
              </p>
            )}
          </div>

          {/* Ajustes de las papas */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="ri-settings-3-line mr-1 text-amber-500" />
              Ajustes de las papas
              <span className="text-gray-400 font-normal text-xs ml-1">(opcional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {SIDES_ADJUSTMENTS.map((tag) => {
                const active = sidesAdj.has(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleSideAdj(tag)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-all select-none whitespace-nowrap ${
                      active
                        ? "bg-amber-500 border-amber-500 text-white"
                        : "bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-400"
                    }`}
                  >
                    {active
                      ? <i className="ri-check-line text-xs" />
                      : <i className="ri-add-line text-xs" />
                    }
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nota libre */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="ri-chat-3-line mr-1 text-amber-500" />
              Otra observación
              <span className="text-gray-400 font-normal text-xs ml-1">(opcional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 120))}
              placeholder="Ej: doble queso, sin pepinillos, muy bien dorada..."
              rows={2}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500 resize-none placeholder:text-gray-400"
            />
            {notes.length > 80 && (
              <p className="text-xs text-gray-400 mt-1 text-right">{notes.length}/120</p>
            )}
          </div>

          {/* Cantidad */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-700">Cantidad</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 hover:border-amber-500 text-gray-600 hover:text-amber-600 transition-colors cursor-pointer"
              >
                <i className="ri-subtract-line" />
              </button>
              <span className="w-6 text-center font-bold text-gray-900">{qty}</span>
              <button
                onClick={() => setQty(qty + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 hover:border-amber-500 text-gray-600 hover:text-amber-600 transition-colors cursor-pointer"
              >
                <i className="ri-add-line" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-4 md:px-5 py-3 md:py-4 flex gap-2 md:gap-3">
          <button
            onClick={onClose}
            className="flex-shrink-0 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors whitespace-nowrap"
          >
            Cancelar
          </button>
          <button
            onClick={handleAdd}
            disabled={isBonelessBurger && !selectedSauce}
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold cursor-pointer transition-colors shadow-sm text-center"
          >
            <span className="block leading-tight">
              <i className="ri-add-line mr-1" />
              Agregar {qty > 1 ? `${qty}` : ""} al carrito
            </span>
            <span className="block text-xs font-bold opacity-90">
              ${totalPrice.toFixed(2)}{extrasTotal > 0 ? ` (incluye +$${extrasTotal} extras)` : ""}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}