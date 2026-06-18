import { useState, useEffect, useRef } from "react";

interface ProductNoteModalProps {
  productName: string;
  productPrice: number;
  catKey?: string;
  onConfirm: (note: string, extraPrice: number) => void;
  onCancel: () => void;
}

// Extrae el costo extra de un tag con formato "+$15" o "+$15.00"
function parseExtraPrice(tag: string): number {
  const match = tag.match(/\+\$([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

// Notas rápidas por nombre de producto (para casos específicos)
const PRODUCT_NOTE_OVERRIDES: Record<string, string[]> = {
  // Entradas / botanas
  "orden de papas gajo": ["Con Lemon Pepper", "Sin Lemon Pepper", "Sin catsup", "Sin mostaza"],
  "orden de papas a la francesa": ["Sin sal", "Con Lemon Pepper", "Sin Lemon Pepper", "Sin catsup", "Sin mostaza"],
  "orden de papas doradas": ["Sin sal", "Extra limón", "Extra salsa negra", "Sin catsup", "Sin mostaza"],
  "orden de botana": [
    "Extra limón", "Sin limón",
    "Extra sal", "Sin sal",
    "Más clamato", "Sin clamato",
    "Más salsas negras", "Sin chile",
    "Sin pepino", "Sin cueritos", "Sin salchicha",
    "Papas doradas aparte",
  ],
  // Hot Dogs
  "hot dog meños sencillo": [
    "Sin cebolla guisada", "Extra cebolla guisada",
    "Sin crema", "Sin mayonesa",
    "Sin jitomate",
    "Extra panela (+$10)",
    "Sin panela",
    "Catsup aparte", "Mostaza aparte",
    "Sin catsup", "Sin mostaza",
  ],
  "hot dog meños con papas doradas": [
    "Sin cebolla guisada", "Extra cebolla guisada",
    "Sin crema", "Sin mayonesa",
    "Sin jitomate",
    "Extra panela (+$10)",
    "Sin panela",
    "Catsup aparte", "Mostaza aparte",
    "Sin catsup", "Sin mostaza",
    "Papas sin sal",
  ],
  "hot dog meños con papas a la francesa": [
    "Sin cebolla guisada", "Extra cebolla guisada",
    "Sin crema", "Sin mayonesa",
    "Sin jitomate",
    "Extra panela (+$10)",
    "Sin panela",
    "Catsup aparte", "Mostaza aparte",
    "Sin catsup", "Sin mostaza",
    "Papas sin sal",
  ],
  "orden de duritos": [],
  "tostitos": [
    "Extra limón", "Sin limón",
    "Extra sal", "Sin sal",
    "Más clamato", "Sin clamato",
    "Más salsas negras", "Sin chile",
    "Sin cueritos", "Sin salchicha",
  ],
  "orden de nachos con queso amarillo": ["Sin jalapeños", "Extra jalapeños", "Extra queso"],
  "orden de dedos de queso (5 piezas)": ["Sin aderezo", "Extra aderezo (+$15)"],
  "orden de jalapeños rellenos (8 piezas)": ["Sin aderezo", "Extra aderezo ranch (+$15)"],
  "orden de aros de cebolla": ["Sin aderezo", "Extra aderezo (+$15)"],
  // Alitas
  "orden completa de alitas (10 piezas)": [
    "Extra salsa", "Sin salsa", "Salsa aparte",
    "Extra crujiente",
    "Sin aderezo", "Extra aderezo ranch (+$15)",
    "Sin apio y zanahoria",
  ],
  "media orden de alitas (5 piezas)": [
    "Extra salsa", "Sin salsa", "Salsa aparte",
    "Extra crujiente",
    "Sin aderezo", "Extra aderezo ranch (+$15)",
    "Sin apio y zanahoria",
  ],
  // Boneless
  "orden completa de boneless (10 piezas)": [
    "Extra salsa", "Sin salsa", "Salsa aparte",
    "Extra crujiente",
    "Sin aderezo", "Extra aderezo ranch (+$15)",
    "Sin apio y zanahoria",
  ],
  "media orden de boneless (5 piezas)": [
    "Extra salsa", "Sin salsa", "Salsa aparte",
    "Extra crujiente",
    "Sin aderezo", "Extra aderezo ranch (+$15)",
    "Sin apio y zanahoria",
  ],
  // Hamburguesas de res / sirloin (con término de carne)
  "hamburguesa de sirloin con tocino": [
    "Sin jitomate", "Sin cebolla", "Sin lechuga", "Sin mayonesa",
    "Sin tocino", "Extra tocino",
    "Término: 3/4", "Término: bien cocida", "Término: media",
    "Sin pepinillos", "Extra queso",
  ],
  "hamburguesa de res con tocino": [
    "Sin jitomate", "Sin cebolla", "Sin lechuga", "Sin mayonesa",
    "Sin tocino", "Extra tocino",
    "Término: 3/4", "Término: bien cocida", "Término: media",
    "Sin pepinillos", "Extra queso",
  ],
  "hamburguesa doble carne con tocino": [
    "Sin jitomate", "Sin cebolla", "Sin lechuga", "Sin mayonesa",
    "Sin tocino", "Extra tocino",
    "Término: 3/4", "Término: bien cocida", "Término: media",
    "Sin pepinillos", "Extra queso",
  ],
  // Hamburguesas de pollo
  "hamburguesa de pollo": [
    "Sin jitomate", "Sin cebolla", "Sin lechuga", "Sin mayonesa",
    "Sin pepinillos", "Extra queso", "Extra aderezo (+$15)",
  ],
  "hamburguesa boneless": [
    "Sin jitomate", "Sin cebolla", "Sin lechuga", "Sin mayonesa",
    "Sin pepinillos", "Extra queso", "Extra aderezo (+$15)",
  ],
  // Hamburguesa de camarón
  "hamburguesa de camarón": [
    "Sin jitomate", "Sin cebolla", "Sin lechuga", "Sin mayonesa",
    "Sin queso blanco", "Extra queso", "Extra aderezo (+$15)",
  ],
  // Combos alitas / boneless
  "combo la cabrona": [
    "Salsa aparte", "Extra aderezo ranch (+$15)",
    "Mitad alitas / mitad boneless",
    "Sin zanahoria", "Sin apio",
    "Extra servilletas",
  ],
  "combo familiar": [
    "Salsa aparte", "Extra aderezo ranch (+$15)",
    "Mitad alitas / mitad boneless",
    "Papas gajo en lugar de francesa",
    "Papas francesa en lugar de gajo",
    "Sin papas", "Papas sin sal",
    "Sin zanahoria", "Sin apio",
    "Sin refresco",
    "Refresco de dieta",
    "Refrescos sin hielo", "Refrescos con hielo",
    "Extra servilletas",
  ],
  // Shots — todos los que existen en el menú
  "sky 30ml": ["Con sal", "Sin sal", "Con limón", "Sin limón"],
  "centenario reposado 30ml": ["Con sal", "Sin sal", "Con limón", "Sin limón", "Con sangrita"],
  "cabrito reposado 30ml": ["Con sal", "Sin sal", "Con limón", "Sin limón", "Con sangrita"],
  "azul centenario 30ml": ["Con sal", "Sin sal", "Con limón", "Sin limón", "Con sangrita"],
  "7 leguas blanco 30ml": ["Con sal", "Sin sal", "Con limón", "Sin limón", "Con sangrita"],
  "jose cuervo tradicional reposado 30ml": ["Con sal", "Sin sal", "Con limón", "Sin limón", "Con sangrita"],
  "jose cuervo tradicional plata 30ml": ["Con sal", "Sin sal", "Con limón", "Sin limón", "Con sangrita"],
  "black & white 30ml": ["Con sal", "Sin sal", "Con limón", "Sin limón"],
  "smirnoff 30ml": ["Con sal", "Sin sal", "Con limón", "Sin limón"],
  "torres 10 30ml": ["Con sal", "Sin sal", "Con limón", "Sin limón", "Con sangrita"],
  "red label 30ml": ["Con sal", "Sin sal", "Con limón", "Sin limón"],
  "tequila don ramón reposado 30ml": ["Con sal", "Sin sal", "Con limón", "Sin limón", "Con sangrita"],
  "hacienda de tepa 30ml": ["Con sal", "Sin sal", "Con limón", "Sin limón", "Con sangrita"],
  "bacardi 30ml": ["Con limón", "Sin limón"],
  "tequila don ramón plata 30ml": ["Con sal", "Sin sal", "Con limón", "Sin limón", "Con sangrita"],
  "centenario plata 30ml": ["Con sal", "Sin sal", "Con limón", "Sin limón", "Con sangrita"],
  // Preparados (base coca)
  "bacacho": ["Sin hielo", "Poco hielo", "Más coca", "Más agua mineral", "Extra limón", "Sin limón", "Doble"],
  "cuervo loco": ["Sin hielo", "Poco hielo", "Más coca", "Más agua mineral", "Extra limón", "Sin limón", "Doble"],
  "cuervo plata": ["Sin hielo", "Poco hielo", "Más coca", "Más agua mineral", "Extra limón", "Sin limón", "Doble"],
  "torero": ["Sin hielo", "Poco hielo", "Más coca", "Más agua mineral", "Extra limón", "Sin limón", "Doble"],
  "red label": ["Sin hielo", "Poco hielo", "Más coca", "Más agua mineral", "Extra limón", "Sin limón", "Doble"],
  "black & white power": ["Sin hielo", "Poco hielo", "Más coca", "Más agua mineral", "Extra limón", "Sin limón", "Doble"],
  "leguas preparado": ["Sin hielo", "Poco hielo", "Más coca", "Más agua mineral", "Extra limón", "Sin limón", "Doble"],
  // Preparados (base squirt)
  "tequilita": ["Sin hielo", "Poco hielo", "Más squirt", "Más agua mineral", "Extra limón", "Sin limón", "Doble"],
  "tequilita plata": ["Sin hielo", "Poco hielo", "Más squirt", "Más agua mineral", "Extra limón", "Sin limón", "Doble"],
  "cabrito preparado": ["Sin hielo", "Poco hielo", "Más squirt", "Más agua mineral", "Extra limón", "Sin limón", "Doble"],
  "azulón": ["Sin hielo", "Poco hielo", "Más squirt", "Más agua mineral", "Extra limón", "Sin limón", "Doble"],
  "tepa cool": ["Sin hielo", "Poco hielo", "Más squirt", "Más agua mineral", "Extra limón", "Sin limón", "Doble"],
  "sky blue": ["Sin hielo", "Poco hielo", "Más squirt", "Más agua mineral", "Extra limón", "Sin limón", "Doble"],
  "smirnoff ice": ["Sin hielo", "Poco hielo", "Más squirt", "Más agua mineral", "Extra limón", "Sin limón", "Doble"],
  "don ramón mix": ["Sin hielo", "Poco hielo", "Más squirt", "Más agua mineral", "Extra limón", "Sin limón", "Doble"],
  "don ramón plata mix": ["Sin hielo", "Poco hielo", "Más squirt", "Más agua mineral", "Extra limón", "Sin limón", "Doble"],
  // Azulitos
  "azulito medio litro": [
    "Sin sal", "Extra sal",
    "Extra limón", "Sin limón",
    "Sin hielo", "Poco hielo",
    "Más squirt", "Más coca",
    "Menos picante", "Más picante",
  ],
  "azulito 1 litro": [
    "Sin sal", "Extra sal",
    "Extra limón", "Sin limón",
    "Sin hielo", "Poco hielo",
    "Más squirt", "Más coca",
    "Menos picante", "Más picante",
    "Para compartir (vasos aparte)",
  ],
  // Charros
  "charro güero 1 litro": [
    "Sin sal", "Extra sal",
    "Extra limón", "Sin limón",
    "Sin hielo", "Poco hielo",
    "Más squirt",
    "Menos picante", "Más picante",
  ],
  "charro negro 1 litro": [
    "Sin sal", "Extra sal",
    "Extra limón", "Sin limón",
    "Sin hielo", "Poco hielo",
    "Más coca",
    "Menos picante", "Más picante",
  ],
  // Vasos Preparados
  "vaso chelado": [
    "Sin sal", "Extra sal",
    "Extra limón", "Sin limón",
    "Sin hielo", "Poco hielo",
    "Menos picante", "Más picante",
  ],
  "vaso michelado": [
    "Sin sal", "Extra sal",
    "Extra limón", "Sin limón",
    "Sin hielo", "Poco hielo",
    "Menos picante", "Más picante",
  ],
  "1/2 vaso clamatado": [
    "Sin clamato", "Sin sal", "Extra sal",
    "Extra limón", "Sin limón",
    "Sin hielo", "Poco hielo",
    "Menos picante", "Más picante",
  ],
  "vaso clamatado": [
    "Sin clamato", "Sin sal", "Extra sal",
    "Extra limón", "Sin limón",
    "Sin hielo", "Poco hielo",
    "Menos picante", "Más picante",
  ],
  "litro de clamatado": [
    "Sin clamato", "Sin sal", "Extra sal",
    "Extra limón", "Sin limón",
    "Sin hielo", "Poco hielo",
    "Menos picante", "Más picante",
    "Para compartir (vasos aparte)",
  ],
  "rusa de squirt": [
    "Sin sal", "Extra sal",
    "Extra limón", "Sin limón",
    "Sin hielo", "Poco hielo",
    "Sin agua mineral", "Extra squirt",
  ],
  "rusa de agua mineral": [
    "Sin sal", "Extra sal",
    "Extra limón", "Sin limón",
    "Sin hielo", "Poco hielo",
    "Extra agua mineral",
  ],
  // Micheladas
  "michelada 1 litro": [
    "Extra limón", "Sin limón",
    "Extra clamato", "Sin clamato",
    "Sin sal", "Extra sal",
    "Poco hielo", "Sin hielo",
    "Sin chamoy", "Con chamoy",
    "Sin tajín", "Extra tajín",
    "Menos picante", "Más picante",
    "Más cerveza",
  ],
  "michelada 1 litro con camarón": [
    "Extra limón", "Sin limón",
    "Extra clamato", "Sin clamato",
    "Sin sal", "Extra sal",
    "Poco hielo", "Sin hielo",
    "Sin chamoy", "Con chamoy",
    "Sin tajín", "Extra tajín",
    "Menos picante", "Más picante",
    "Extra camarón (+precio)",
  ],
  // Hamburguesa mixta
  "hamburguesa cielo, mar y tierra": [
    "Sin jitomate", "Sin cebolla", "Sin lechuga", "Sin mayonesa",
    "Sin pepinillos", "Extra queso",
    "Término carne: 3/4", "Término carne: bien cocida", "Término carne: media",
  ],
};

// Notas rápidas por catKey exacto (los keys que usa el menú)
const NOTE_SETS: Record<string, string[]> = {
  // Comida con ingredientes modificables
  entradas: ["Sin sal", "Extra limón", "Sin chile"],
  hotdogs: ["Sin cebolla guisada", "Extra cebolla guisada", "Sin jitomate", "Sin mayonesa", "Sin crema", "Extra panela (+$10)", "Sin panela"],
  combos: ["Sin cebolla", "Sin jitomate", "Sin mayonesa", "Extra salsa", "Sin chile", "Bien cocida"],
  // Bebidas de barril
  barril: ["Sin espuma", "Extra limón", "Con sal", "Sin sal"],
  // Cervezas
  cervezas: ["Bien fría", "Con limón", "Con sal", "Sin sal"],
  "medio-cervezas": ["Bien fría", "Con limón", "Con sal", "Sin sal"],
  pacifico: ["Bien fría", "Con limón", "Con sal", "Sin sal"],
  ampolletas: ["Bien fría", "Con limón", "Con sal"],
  "sin-alcohol": ["Bien fría", "Con limón", "Sin limón"],
  // Bebidas preparadas / vasos
  vasos: ["Sin hielo", "Extra limón", "Extra sal", "Poco hielo", "Más agua mineral"],
  caballitos: ["Sin sal", "Sin limón", "Con sal", "Con limón"],
  preparados: ["Sin hielo", "Extra limón", "Poco hielo", "Más agua mineral", "Más refresco"],
  azulitos: ["Sin hielo", "Extra limón", "Poco hielo", "Más agua mineral", "Más Sprite"],
  "latas-alcohol": ["Sin hielo", "Con hielo", "Con limón", "Sin limón"],
  // Refrescos / aguas
  refrescos: ["Sin hielo", "Poco hielo", "Extra limón"],
  // Cigarros — sin tags, solo campo libre
  cigarros: [],
};

// Fallback genérico para categorías no mapeadas
const GENERIC_NOTES = ["Sin sal", "Extra limón", "Sin hielo", "Poco hielo"];

function getNotesForCategory(catKey?: string, productName?: string): string[] {
  // Primero buscar override por nombre de producto exacto
  if (productName) {
    const key = productName.toLowerCase().trim();
    const override = PRODUCT_NOTE_OVERRIDES[key];
    if (override !== undefined) return override;
  }
  if (!catKey) return GENERIC_NOTES;
  return NOTE_SETS[catKey] ?? GENERIC_NOTES;
}

export default function ProductNoteModal({
  productName,
  productPrice,
  catKey,
  onConfirm,
  onCancel,
}: ProductNoteModalProps) {
  const quickNotes = getNotesForCategory(catKey, productName);
  const [note, setNote] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  // Calcula el precio extra acumulado de los tags activos
  const extraPrice = activeTags.reduce((sum, tag) => sum + parseExtraPrice(tag), 0);
  const totalPrice = productPrice + extraPrice;

  const toggleQuick = (tag: string) => {
    setActiveTags((prev) => {
      const idx = prev.indexOf(tag);
      if (idx >= 0) return prev.filter((t) => t !== tag);
      return [...prev, tag];
    });
    setNote((prev) => {
      const existing = prev.trim();
      if (!existing) return tag;
      const parts = existing.split(",").map((s) => s.trim());
      const idx = parts.indexOf(tag);
      if (idx >= 0) {
        parts.splice(idx, 1);
        return parts.filter(Boolean).join(", ");
      }
      return [...parts, tag].join(", ");
    });
  };

  const isActive = (tag: string) => activeTags.includes(tag);

  const handleConfirm = () => {
    onConfirm(note.trim(), extraPrice);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-[70]" onClick={onCancel} />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-[80] bg-white rounded-t-2xl shadow-2xl max-w-lg mx-auto animate-slide-up">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="px-5 pb-6 pt-2">
          {/* Product name */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 leading-snug truncate">
                {productName}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <p className={`text-sm font-bold ${extraPrice > 0 ? 'text-gray-400 line-through' : 'text-amber-600'}`}>
                  ${productPrice.toFixed(2)}
                </p>
                {extraPrice > 0 && (
                  <>
                    <p className="text-sm font-bold text-amber-600">
                      ${totalPrice.toFixed(2)}
                    </p>
                    <span className="text-xs bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded-full">
                      +${extraPrice.toFixed(2)} extras
                    </span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={onCancel}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 cursor-pointer flex-shrink-0 transition-colors"
            >
              <i className="ri-close-line text-gray-500 text-base" />
            </button>
          </div>

          {/* Label */}
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            <i className="ri-edit-box-line mr-1 text-amber-500" />
            Notas especiales{" "}
            <span className="text-gray-400 font-normal normal-case">(opcional)</span>
          </label>

          {/* Quick tags — solo si hay opciones relevantes para esta categoría */}
          {quickNotes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {quickNotes.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleQuick(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-all whitespace-nowrap ${
                    isActive(tag)
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:border-amber-300 hover:bg-amber-50"
                  }`}
                >
                  {isActive(tag) && (
                    <i className="ri-check-line mr-0.5 text-[10px]" />
                  )}
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Free text */}
          <textarea
            ref={inputRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Escribe cualquier observación especial..."
            maxLength={120}
            rows={2}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 resize-none placeholder:text-gray-400 leading-relaxed"
          />
          {note.length > 80 && (
            <p className="text-xs text-gray-400 text-right mt-1">
              {note.length}/120
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={() => onConfirm("")}
              className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-add-line mr-1" />
              Agregar sin nota
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-shopping-basket-2-line mr-1.5" />
              {note.trim() ? `Agregar con nota — $${totalPrice.toFixed(2)}` : `Agregar — $${totalPrice.toFixed(2)}`}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slideUp 0.25s cubic-bezier(0.32, 0.72, 0, 1) forwards;
        }
      `}</style>
    </>
  );
}