import { useState } from "react";
import type { CartItem } from "../context/CartContext";
import { useCart } from "../context/CartContext";
import { wingsMenu, bonelessMenu } from "@/mocks/menu";

interface WingSauceModalProps {
  item: CartItem;
  onClose: () => void;
}

export default function WingSauceModal({ item, onClose }: WingSauceModalProps) {
  const [selectedSauce, setSelectedSauce] = useState<string>("");
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [extraCrispy, setExtraCrispy] = useState(false);
  const [lessCrispy, setLessCrispy] = useState(false);
  const [extraRanch, setExtraRanch] = useState(false);

  const { addItem, setIsOpen } = useCart();

  const isBoneless = item.name.toLowerCase().includes("boneless");
  const sauceList = isBoneless ? bonelessMenu.sauces : wingsMenu.sauces;

  // Ninguna presentación de alitas/boneless incluye limón en las verduras
  const isMediaOrden = item.name.toLowerCase().includes("5 piezas") || item.name.toLowerCase().includes("media orden");

  // Precio con extra ranch (+$15 en todas las presentaciones)
  const basePrice = item.price;
  const extraRanchPrice = extraRanch ? 15 : 0;
  const finalPrice = basePrice + extraRanchPrice;
  const totalPrice = finalPrice * qty;

  const handleAdd = () => {
    if (!selectedSauce) return;

    const extras: string[] = [`Salsa: ${selectedSauce}`];
    if (extraCrispy) extras.push("más doradas");
    if (lessCrispy) extras.push("menos doradas");
    if (extraRanch) extras.push("extra ranch (+$15)");
    if (notes.trim()) extras.push(notes.trim());

    for (let i = 0; i < qty; i++) {
      addItem({
        ...item,
        sauce: selectedSauce,
        notes: extras.join(" — "),
        price: finalPrice,
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
            Elige tu salsa favorita ({sauceList.length} opciones)
          </p>
        </div>

        {/* Body */}
        <div className="px-4 md:px-5 py-4 md:py-5 space-y-4 md:space-y-5">
          {/* Incluye */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-700 font-medium">
              <i className="ri-restaurant-line mr-1" />
              Incluye: aderezo ranch{isMediaOrden ? "" : ", zanahorias y apio"}
            </p>
          </div>

          {/* Salsas */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="ri-fire-line mr-1 text-amber-500" />
              Salsa
              <span className="text-red-500 ml-1">*</span>
            </label>
            <div className="grid grid-cols-1 gap-1.5 max-h-52 md:max-h-64 overflow-y-auto pr-1">
              {sauceList.map((sauce) => (
                <button
                  key={sauce.name}
                  onClick={() => setSelectedSauce(sauce.name)}
                  className={`px-3 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all border text-left flex items-center gap-3 ${
                    selectedSauce === sauce.name
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: sauce.color }}
                  />
                  <span className="flex-1">{sauce.name}</span>
                  {sauce.spiceLevel > 0 && (
                    <span className="text-xs">
                      {"🔥".repeat(sauce.spiceLevel)}
                    </span>
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

          {/* Opciones de preparación */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="ri-settings-3-line mr-1 text-amber-500" />
              Opciones de preparación
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer border border-gray-100 hover:border-amber-200 transition-colors">
                <input
                  type="checkbox"
                  checked={extraCrispy}
                  onChange={(e) => setExtraCrispy(e.target.checked)}
                  className="w-4 h-4 text-amber-500 accent-amber-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Más doradas (extra crujientes)</p>
                  <p className="text-xs text-gray-400">Fritas un poco más para mayor crocancia</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer border border-gray-100 hover:border-amber-200 transition-colors">
                <input
                  type="checkbox"
                  checked={lessCrispy}
                  onChange={(e) => setLessCrispy(e.target.checked)}
                  className="w-4 h-4 text-amber-500 accent-amber-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Menos doradas (más jugosas)</p>
                  <p className="text-xs text-gray-400">Menos tiempo de fritura, más suaves</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer border border-gray-100 hover:border-amber-200 transition-colors">
                <input
                  type="checkbox"
                  checked={extraRanch}
                  onChange={(e) => setExtraRanch(e.target.checked)}
                  className="w-4 h-4 text-amber-500 accent-amber-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Extra aderezo ranch</p>
                  <p className="text-xs text-gray-400">Doble porción de ranch</p>
                </div>
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">+$15</span>
              </label>
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="ri-chat-3-line mr-1 text-amber-500" />
              Observaciones
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 100))}
              placeholder="Ej: más doradas, extra ranch..."
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
            disabled={!selectedSauce}
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold cursor-pointer transition-colors shadow-sm text-center"
          >
            <span className="block leading-tight">
              <i className="ri-add-line mr-1" />
              Agregar {qty > 1 ? `${qty}` : ""} al carrito
            </span>
            <span className="block text-xs font-bold opacity-90">
              ${totalPrice.toFixed(2)}{extraRanch ? ` (incluye +$${extraRanchPrice} ranch)` : ""}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}