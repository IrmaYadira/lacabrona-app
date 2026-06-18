import { useState, useEffect, useRef } from "react";
import { useCart } from "../context/CartContext";
import FlashPrice from "@/components/FlashPrice";

export interface VariantOption {
  label: string;
  value: string;
}

export interface VariantPickerItem {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  cartIdBase: number;
  /** Label que aparece encima de las opciones, e.g. "Elige tu sabor" */
  variantLabel: string;
  options: VariantOption[];
}

interface Props {
  item: VariantPickerItem | null;
  onClose: () => void;
}

export default function VariantPickerModal({ item, onClose }: Props) {
  const { addItem, setIsOpen: openCart } = useCart();
  const [selected, setSelected] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState(false);
  const noteRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (item) {
      setSelected("");
      setNote("");
      setError(false);
    }
  }, [item]);

  if (!item) return null;

  const handleConfirm = () => {
    if (!selected) {
      setError(true);
      return;
    }
    // Nombre con sabor — la nota va separada en el campo notes del CartItem
    const displayName = `${item.name} — ${selected}`;
    addItem({
      id: item.cartIdBase + item.id,
      name: displayName,
      description: item.description,
      price: item.price,
      image: item.image,
      category: item.category,
      notes: note.trim() || undefined,
    });
    openCart(true);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div
        className="relative bg-gray-900 rounded-xl border border-gray-700 w-full max-w-sm shadow-2xl animate-[fadeInUp_0.2s_ease]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-gray-700">
          <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
            <img
              src={item.image}
              alt={item.name}
              title={item.name}
              className="w-full h-full object-cover object-top"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-base leading-snug">{item.name}</h3>
            <FlashPrice
              price={item.price}
              productName={item.name}
              category={item.category}
              variant="dark"
              size="lg"
              className="mt-0.5"
            />
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer transition-colors shrink-0"
          >
            <i className="ri-close-line text-xl" />
          </button>
        </div>

        {/* Variant selector */}
        <div className="p-5 pb-3">
          <p className="text-sm font-semibold text-gray-300 mb-3">
            {item.variantLabel}
            <span className="text-red-400 ml-1">*</span>
          </p>

          <div className="grid grid-cols-2 gap-2">
            {item.options.map((opt) => {
              const isSelected = selected === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    setSelected(opt.value);
                    setError(false);
                    // Foco a la nota después de elegir
                    setTimeout(() => noteRef.current?.focus(), 50);
                  }}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-all cursor-pointer border ${
                    isSelected
                      ? "bg-amber-500 border-amber-500 text-white"
                      : "bg-gray-800 border-gray-600 text-gray-300 hover:border-amber-500 hover:text-amber-400"
                  }`}
                >
                  {isSelected && <i className="ri-check-line mr-1 text-white" />}
                  {opt.label}
                </button>
              );
            })}
          </div>

          {error && (
            <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
              <i className="ri-error-warning-line" /> Elige una opción para continuar
            </p>
          )}
        </div>

        {/* Nota libre */}
        <div className="px-5 pb-4">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">
            Nota adicional <span className="font-normal normal-case text-gray-500">(opcional)</span>
          </label>
          <div className="flex items-center gap-2 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 focus-within:border-amber-500 transition-colors">
            <i className="ri-chat-1-line text-gray-500 text-sm shrink-0" />
            <input
              ref={noteRef}
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              placeholder="Ej: con bastante hielo, sin azúcar..."
              maxLength={80}
              className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none"
            />
            {note && (
              <button
                onClick={() => setNote("")}
                className="text-gray-500 hover:text-gray-300 cursor-pointer transition-colors"
              >
                <i className="ri-close-line text-sm" />
              </button>
            )}
          </div>
          {note && (
            <p className="text-xs text-gray-500 mt-1 text-right">{note.length}/80</p>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-gray-400 bg-gray-800 hover:bg-gray-700 cursor-pointer transition-colors whitespace-nowrap"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold text-white cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 ${
              selected
                ? "bg-amber-500 hover:bg-amber-600"
                : "bg-amber-500/50 cursor-not-allowed"
            }`}
          >
            <i className="ri-shopping-cart-line" />
            {selected ? `Agregar — ${selected}` : "Elige un sabor primero"}
          </button>
        </div>
      </div>
    </div>
  );
}