import { useState } from "react";
import type { CartItem } from "../context/CartContext";
import { useCart } from "../context/CartContext";
import { useFlashPrice } from "@/hooks/useFlashPrice";
import FlashPrice from "@/components/FlashPrice";

interface ShotShowModalProps {
  item: CartItem;
  onClose: () => void;
}

export default function ShotShowModal({ item, onClose }: ShotShowModalProps) {
  const [isDouble, setIsDouble] = useState(false);
  const [withVaso, setWithVaso] = useState(false);
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState(1);

  const { addItem, setIsOpen } = useCart();

  const currentPrice = isDouble ? item.price * 2 : item.price;
  const { discountedPrice: currentDiscountedPrice } = useFlashPrice(item.name, "Shots", currentPrice);
  const ml = isDouble ? "60ml" : "30ml";
  const doubleLabel = isDouble ? `60ml de ${item.name.replace("30ml", "").trim()} (doble)` : `30ml`;

  const handleAdd = () => {
    let finalNotes = "";
    const parts: string[] = [];
    if (isDouble) {
      parts.push("Doble (60ml)");
    }
    if (withVaso) {
      parts.push("Con vaso de hielo, sal y limón (sin costo adicional)");
    }
    if (notes.trim()) {
      parts.push(notes.trim());
    }
    finalNotes = parts.join(" — ");

    for (let i = 0; i < qty; i++) {
      addItem({
        ...item,
        price: currentPrice,
        notes: finalNotes || undefined,
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
          <h3 className="text-white font-bold text-base md:text-lg leading-snug">{item.name}</h3>
          <p className="text-white/80 text-xs mt-0.5">
            {isDouble ? "Shot de 60ml del destilado puro (doble)" : "Shot de 30ml del destilado puro"}
          </p>
        </div>

        {/* Body */}
        <div className="px-4 md:px-5 py-4 md:py-5 space-y-4 md:space-y-5">
          {/* Info del shot */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200">
                <img src={item.image} alt={item.name} title={item.name} loading="lazy" decoding="async" className="w-full h-full object-cover object-top" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isDouble ? item.description.replace("30ml", "60ml (doble)") : item.description}
                </p>
                <FlashPrice
                  price={currentPrice}
                  productName={item.name}
                  category="Shots"
                  variant="light"
                  size="lg"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Selector Simple / Doble */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              <i className="ri-restaurant-line mr-1 text-amber-500" />
              Tamaño
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setIsDouble(false)}
                className={`p-4 rounded-lg border-2 text-center transition-all cursor-pointer ${
                  !isDouble
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-gray-200 bg-gray-50 hover:border-gray-300 text-gray-600"
                }`}
              >
                <div className="text-lg font-bold">Simple</div>
                <div className="text-xs mt-1">30ml</div>
                <div className="text-sm font-bold mt-1 text-amber-600">
                  <FlashPrice
                    price={item.price}
                    productName={item.name}
                    category="Shots"
                    variant="light"
                    size="sm"
                  />
                </div>
              </button>
              <button
                onClick={() => setIsDouble(true)}
                className={`p-4 rounded-lg border-2 text-center transition-all cursor-pointer ${
                  isDouble
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-gray-200 bg-gray-50 hover:border-gray-300 text-gray-600"
                }`}
              >
                <div className="text-lg font-bold">Doble</div>
                <div className="text-xs mt-1">60ml</div>
                <div className="text-sm font-bold mt-1 text-amber-600">
                  ${item.price * 2}
                </div>
              </button>
            </div>
          </div>

          {/* Opción de vaso gratis */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={withVaso}
                onChange={(e) => setWithVaso(e.target.checked)}
                className="w-5 h-5 mt-0.5 accent-amber-500 cursor-pointer"
              />
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  Agregar vaso con hielo, sal y limón
                </p>
                <p className="text-xs text-green-600 font-medium mt-0.5">
                  <i className="ri-check-line mr-1" />
                  Sin costo adicional
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Se entrega un vaso chico aparte con hielo, sal de gusano y limón.
                </p>
              </div>
            </label>
          </div>

          {/* Notas adicionales */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="ri-chat-3-line mr-1 text-amber-500" />
              ¿Alguna observación?
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 100))}
              placeholder="Ej: sin sal, más limón..."
              rows={2}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{notes.length}/100</p>
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
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold cursor-pointer transition-colors shadow-sm text-center"
          >
            <span className="block leading-tight">
              <i className="ri-add-line mr-1" />
              Agregar {qty > 1 ? `${qty}` : ""} al carrito
            </span>
            <span className="block text-xs font-bold opacity-90">
              ${(currentDiscountedPrice * qty).toFixed(2)}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}