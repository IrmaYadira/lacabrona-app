import { useState } from "react";
import type { CartItem } from "../context/CartContext";
import { useCart } from "../context/CartContext";
import { micheladaMenu } from "@/mocks/menu";

const MICHELADA_QUICK_NOTES = [
  "Menos chamoy",
  "Más chamoy",
  "Menos chile",
  "Más chile",
  "Sin Tajín",
  "Extra Tajín",
  "Sin Tabasco",
  "Más Tabasco",
  "Sin clamato",
  "Extra limón",
  "Menos sal",
  "Sin pimienta",
  "Poco hielo",
  "Sin hielo",
];

interface MicheladaFlavorModalProps {
  item: CartItem;
  onClose: () => void;
}

const MICHELADA_INGREDIENTS = [
  "Sal de grano",
  "Limón fresco",
  "Clamato",
  "Salsas negras",
  "Tabasco",
  "Tajín",
  "Chamoy",
  "Pimienta negra",
  "Hielo",
  "Cerveza fría",
  "Sabor elegido",
];

export default function MicheladaFlavorModal({ item, onClose }: MicheladaFlavorModalProps) {
  const [selectedFlavor, setSelectedFlavor] = useState<string>("");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  const { addItem, setIsOpen } = useCart();

  const toggleNote = (tag: string) => {
    setNote((prev) => {
      const existing = prev.trim();
      if (!existing) return tag;
      const parts = existing.split(",").map((s) => s.trim());
      const idx = parts.indexOf(tag);
      if (idx >= 0) {
        parts.splice(idx, 1);
        return parts.join(", ");
      }
      return [...parts, tag].join(", ");
    });
  };

  const isNoteActive = (tag: string) =>
    note.split(",").map((s) => s.trim()).includes(tag);

  const handleAdd = () => {
    if (!selectedFlavor) return;
    const noteStr = note.trim();
    addItem({
      ...item,
      sauce: selectedFlavor,
      notes: noteStr
        ? `Sabor: ${selectedFlavor} — ${noteStr}`
        : `Sabor: ${selectedFlavor}`,
    });
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
            Elige tu sabor favorito ({micheladaMenu.flavors.length} opciones)
          </p>
        </div>

        {/* Body */}
        <div className="px-4 md:px-5 py-4 md:py-5 space-y-4 md:space-y-5">
          {/* Ingredientes */}
          <div>
            <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
              <i className="ri-restaurant-line mr-1" />
              Ingredientes
            </label>
            <div className="flex flex-wrap gap-1.5">
              {MICHELADA_INGREDIENTS.map((ing) => (
                <span
                  key={ing}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200"
                >
                  {ing}
                </span>
              ))}
            </div>
          </div>

          {/* Sabores */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="ri-cup-line mr-1 text-amber-500" />
              Sabor
              <span className="text-red-500 ml-1">*</span>
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {micheladaMenu.flavors.map((flavor) => (
                <button
                  key={flavor.name}
                  onClick={() => setSelectedFlavor(flavor.name)}
                  className={`px-3 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all border text-left flex items-center gap-3 ${
                    selectedFlavor === flavor.name
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: flavor.color }}
                  />
                  <span className="flex-1">{flavor.name}</span>
                </button>
              ))}
            </div>
            {!selectedFlavor && (
              <p className="text-xs text-red-500 mt-1.5">
                <i className="ri-error-warning-line mr-1" />
                Selecciona un sabor para continuar
              </p>
            )}
          </div>

          {/* Notas especiales */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              <i className="ri-edit-box-line mr-1 text-amber-500" />
              Observaciones
              <span className="text-gray-400 font-normal normal-case ml-1">(opcional)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {MICHELADA_QUICK_NOTES.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleNote(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-all whitespace-nowrap ${
                    isNoteActive(tag)
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:border-amber-300 hover:bg-amber-50"
                  }`}
                >
                  {isNoteActive(tag) && (
                    <i className="ri-check-line mr-0.5 text-[10px]" />
                  )}
                  {tag}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Otra observación especial..."
              maxLength={120}
              rows={2}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 resize-none placeholder:text-gray-400 leading-relaxed"
            />
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
            disabled={!selectedFlavor}
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold cursor-pointer transition-colors shadow-sm text-center"
          >
            <span className="block leading-tight">
              <i className="ri-add-line mr-1" />
              Agregar {qty > 1 ? `${qty}` : ""} al carrito
            </span>
            <span className="block text-xs font-bold opacity-90">
              ${(item.price * qty).toFixed(2)}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}