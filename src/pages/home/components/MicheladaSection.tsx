import { useState } from "react";
import { micheladaMenu, micheladaConCamaronMenu } from "@/mocks/menu";
import { useCart } from "../context/CartContext";
import { usePaused } from "../context/PausedContext";
import FlashPrice from "@/components/FlashPrice";
import ScrollReveal from "@/components/base/ScrollReveal";

interface MicheladaCardProps {
  menu: typeof micheladaMenu;
}

function MicheladaCard({ menu }: MicheladaCardProps) {
  const { addItem, setIsOpen, toggleFavorite, isFavorite } = useCart();
  const { isPaused } = usePaused();
  const [selectedFlavor, setSelectedFlavor] = useState<string>(
    menu.flavors[0].name
  );
  const [notes, setNotes] = useState("");
  const [added, setAdded] = useState(false);

  const outOfStock = isPaused(`michelada-${menu.id}`);
  const favId = menu.id === 100 ? 1000 : 1001;

  const handleAdd = () => {
    if (outOfStock) return;
    addItem({
      id: menu.id,
      name: `${menu.name} - ${selectedFlavor}`,
      description: `${menu.description} Sabor: ${selectedFlavor}`,
      price: menu.price,
      image: menu.image,
      category: "Michelada",
      notes: notes.trim() || undefined,
    });
    setAdded(true);
    setIsOpen(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className={`bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden ${outOfStock ? 'opacity-60' : ''}`}>
      {/* Imagen */}
      <div className="relative h-48 md:h-56 overflow-hidden group">
        <img
          src={menu.image}
          alt={menu.name}
          title={menu.name}
          loading="lazy"
          decoding="async"
          fetchpriority="low"
          width="600"
          height="450"
          className={`w-full h-full object-cover object-top transition-transform duration-700 ${outOfStock ? 'grayscale' : 'group-hover:scale-105'}`}
        />
        {outOfStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white text-sm font-black text-center leading-tight">AGOTADO</span>
          </div>
        )}
        <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
          {menu.tags.map((tag) => (
            <span
              key={tag}
              className="bg-amber-500 text-white text-xs font-semibold px-3 py-1 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
        {/* Favorito */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(favId); }}
          className={`absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full transition-all cursor-pointer ${
            isFavorite(favId) ? 'bg-red-50 text-red-500' : 'bg-white/80 text-gray-400 hover:text-red-400'
          }`}
          title={isFavorite(favId) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
        >
          <i className={`${isFavorite(favId) ? 'ri-heart-fill' : 'ri-heart-line'} text-sm`} />
        </button>
      </div>

      {/* Contenido */}
      <div className="p-5 md:p-6">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <h3 className={`text-xl md:text-2xl font-bold mb-0 ${outOfStock ? 'text-gray-500 line-through' : 'text-white'}`}>
            {menu.name}
          </h3>
          {outOfStock && (
            <span className="text-xs font-bold text-red-400 bg-red-900/30 border border-red-700/40 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
              Agotado
            </span>
          )}
        </div>
        <p className="text-gray-400 mb-3 text-sm leading-relaxed">
          {menu.description}
        </p>

        <div className="flex flex-wrap gap-1.5 mb-5">
          {[
            "Sal de grano",
            "Limón fresco",
            "Tajín",
            "Tabasco",
            "Salsas negras",
            "Pimienta negra",
            "Chamoy",
            "Hielo",
            "Cerveza fría",
          ].map((ing) => (
            <span
              key={ing}
              className="bg-amber-500/15 text-amber-400 text-xs font-medium px-2.5 py-0.5 rounded-full border border-amber-500/20"
            >
              {ing}
            </span>
          ))}
        </div>

        {/* Selector de sabor */}
        <div className="mb-5">
          <span className="text-sm font-semibold text-gray-300 uppercase tracking-wide block mb-3">
            Elige tu sabor ({menu.flavors.length} opciones)
          </span>
          <div className="grid grid-cols-2 gap-2">
            {menu.flavors.map((flavor) => (
              <button
                key={flavor.name}
                onClick={() => setSelectedFlavor(flavor.name)}
                className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all border-2 text-left ${
                  selectedFlavor === flavor.name
                    ? "border-amber-500 bg-gray-800"
                    : "border-gray-700 hover:border-gray-500 bg-gray-800/30"
                }`}
              >
                <div
                  className="w-6 h-6 rounded-full border border-gray-600 flex-shrink-0"
                  style={{ backgroundColor: flavor.color }}
                />
                <div>
                  <span className="text-sm font-semibold text-white block">
                    {flavor.name}
                  </span>
                  <span className="text-xs text-gray-400 hidden sm:block">
                    {flavor.description}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Observaciones */}
        <div className="mb-5">
          <label className="text-sm font-semibold text-gray-300 uppercase tracking-wide block mb-2">
            Observaciones
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Escribe si no lleva algún ingrediente..."
            maxLength={200}
            rows={2}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-500">
              Ej. "Sin chamoy", "Sin tajín", "Sin tabasco"
            </span>
            <span className="text-xs text-gray-500">
              {notes.length}/200
            </span>
          </div>
        </div>

        {/* Precio y botón */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-700">
          <div>
            <span className="text-sm text-gray-500">Precio</span>
            <FlashPrice
              price={menu.price}
              productName={menu.name}
              category="Michelada"
              variant="dark"
              size="xl"
              className="block"
            />
          </div>
          {outOfStock ? (
            <span className="text-xs text-gray-500 font-semibold px-3 py-1.5 rounded-md bg-gray-700 whitespace-nowrap">
              No disponible
            </span>
          ) : (
            <button
              onClick={handleAdd}
              className={`text-sm font-semibold px-5 py-2.5 rounded-md cursor-pointer transition-all whitespace-nowrap hover:scale-105 active:scale-95 ${
                added
                  ? "bg-green-500 text-white"
                  : "bg-amber-500 hover:bg-amber-600 text-white"
              }`}
            >
              {added ? (
                <>
                  <i className="ri-check-line mr-1" />
                  Agregado
                </>
              ) : (
                <>Agregar</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MicheladaSection() {
  return (
    <section id="micheladas" className="py-16 md:py-24 bg-gray-900">
      <div className="w-full px-4 md:px-8 max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-12 md:mb-16">
            <span className="text-amber-500 text-sm font-semibold uppercase tracking-widest">
              Especialidad
            </span>
            <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-white mt-2 tracking-wide">
              MICHELADAS
            </h2>
            <p className="text-gray-400 mt-3 max-w-xl mx-auto text-sm md:text-base">
              La bebida perfecta para acompañar tus alitas y boneless. Elige tu
              sabor favorito.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          <ScrollReveal direction="left">
            <MicheladaCard menu={micheladaMenu} />
          </ScrollReveal>
          <ScrollReveal direction="right">
            <MicheladaCard menu={micheladaConCamaronMenu} />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}