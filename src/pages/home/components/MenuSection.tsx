import { useState, useEffect } from "react";
import { wingsMenu } from "@/mocks/menu";
import { useCart } from "../context/CartContext";
import { usePaused } from "../context/PausedContext";
import { useFlashPrice } from "@/hooks/useFlashPrice";
import FlashPrice from "@/components/FlashPrice";
import ScrollReveal from "@/components/base/ScrollReveal";

function SpiceLevel({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <i
          key={i}
          className={`ri-fire-line text-xs ${
            i < level ? "text-red-500" : "text-gray-300"
          }`}
        />
      ))}
    </div>
  );
}

export default function MenuSection() {
  const { addItem, setIsOpen, toggleFavorite, isFavorite } = useCart();
  const { isPaused } = usePaused();
  const [activeSize, setActiveSize] = useState<string>("Media Orden (5 pzas)");
  const [selectedSauce, setSelectedSauce] = useState<string>("BBQ");
  const [added, setAdded] = useState(false);

  const price = wingsMenu.prices[activeSize as keyof typeof wingsMenu.prices];

  // Verificar si el tamaño seleccionado está agotado
  const sizeIdMap: Record<string, string> = {
    'Media Orden (5 pzas)': 'wing-media',
    'Orden Completa (10 pzas)': 'wing-completa',
  };
  const currentSizeId = sizeIdMap[activeSize] ?? '';
  const outOfStock = isPaused(currentSizeId);
  const mediaAgotada = isPaused('wing-media');
  const completaAgotada = isPaused('wing-completa');

  // IDs para favoritos de alitas
  const favId = activeSize === "Orden Completa (10 pzas)" ? 1 : 2;

  // Si el tamaño activo se agota, cambiar al otro disponible automáticamente
  useEffect(() => {
    if (activeSize === 'Media Orden (5 pzas)' && mediaAgotada && !completaAgotada) {
      setActiveSize('Orden Completa (10 pzas)');
    } else if (activeSize === 'Orden Completa (10 pzas)' && completaAgotada && !mediaAgotada) {
      setActiveSize('Media Orden (5 pzas)');
    }
  }, [mediaAgotada, completaAgotada, activeSize]);

  const handleAdd = () => {
    addItem({
      id: wingsMenu.id,
      name: `Alitas - ${selectedSauce}`,
      description: `${wingsMenu.description} Salsa: ${selectedSauce}`,
      price,
      image: wingsMenu.image,
      size: activeSize,
      category: "Alitas",
    });
    setAdded(true);
    setIsOpen(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <section id="alitas" className="py-16 md:py-24 bg-gray-50">
      <div className="w-full px-4 md:px-8 max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-12 md:mb-16">
            <span className="text-amber-600 text-sm font-semibold uppercase tracking-widest">
              Especialidad de la Casa
            </span>
            <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-gray-900 mt-2 tracking-wide">
              LAS ALITAS
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm md:text-base">
              Crujientes, jugosas y bañadas en la salsa de tu elección. Elige entre 12 sabores irresistibles.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
          {/* Controles - izquierda en desktop */}
          <ScrollReveal direction="left">
            <div className="flex flex-col justify-center order-2 lg:order-1">
              <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
                {wingsMenu.name}
              </h3>
              <p className="text-gray-500 mb-6 leading-relaxed">
                {wingsMenu.description}
              </p>

              {/* Selector de tamaño */}
              <div className="mb-6">
                <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Tamaño
                </span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.keys(wingsMenu.prices).map((size) => {
                    const sid = sizeIdMap[size];
                    const sizeOOS = sid ? isPaused(sid) : false;
                    return (
                    <button
                      key={size}
                      onClick={() => setActiveSize(size)}
                      disabled={sizeOOS}
                      className={`text-xs sm:text-sm font-semibold px-3 sm:px-5 py-2 sm:py-2.5 rounded-full cursor-pointer transition-all whitespace-nowrap flex items-center gap-1.5 ${
                        sizeOOS
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed line-through'
                          : activeSize === size
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {size}
                      {sizeOOS && <span className="text-[10px] font-bold text-red-400 no-underline" style={{textDecoration:'none'}}>Agotado</span>}
                    </button>
                    );
                  })}
                </div>
              </div>

              {/* Selector de salsa */}
              <div className="mb-8">
                <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Elige tu salsa ({wingsMenu.sauces.length} opciones)
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mt-3">
                  {wingsMenu.sauces.map((sauce) => (
                    <button
                      key={sauce.name}
                      onClick={() => setSelectedSauce(sauce.name)}
                      className={`flex flex-col items-center gap-1 p-2 sm:p-3 rounded-lg cursor-pointer transition-all border-2 ${
                        selectedSauce === sauce.name
                          ? "border-amber-500 bg-amber-50"
                          : "border-gray-100 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <div
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-gray-200"
                        style={{ backgroundColor: sauce.color }}
                      />
                      <span className="text-[10px] sm:text-xs font-semibold text-gray-800 text-center leading-tight">
                        {sauce.name}
                      </span>
                      <SpiceLevel level={sauce.spiceLevel} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Precio y botón */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200 gap-3">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-sm text-gray-400">Precio</span>
                    <FlashPrice
                      price={price}
                      productName={wingsMenu.name}
                      category="Alitas"
                      variant="light"
                      size="xl"
                      className="ml-2 inline-block"
                    />
                  </div>
                  {/* Favorito */}
                  <button
                    onClick={() => toggleFavorite(favId)}
                    className={`w-9 h-9 flex items-center justify-center rounded-full border-2 transition-all cursor-pointer ${
                      isFavorite(favId)
                        ? 'border-red-400 bg-red-50 text-red-500'
                        : 'border-gray-200 bg-white text-gray-400 hover:border-red-300 hover:text-red-400'
                    }`}
                    title={isFavorite(favId) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                  >
                    <i className={`${isFavorite(favId) ? 'ri-heart-fill' : 'ri-heart-line'} text-base`} />
                  </button>
                </div>
                {outOfStock ? (
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-black text-red-500 bg-red-50 border border-red-200 px-3 py-1.5 rounded-md">
                      <i className="ri-error-warning-line mr-1" />Agotado
                    </span>
                    <span className="text-xs text-gray-400">No disponible por ahora</span>
                  </div>
                ) : (
                  <button
                    onClick={handleAdd}
                    className={`text-xs sm:text-sm font-semibold px-4 sm:px-6 py-3 rounded-md cursor-pointer transition-all whitespace-nowrap hover:scale-105 active:scale-95 ${
                      added
                        ? "bg-green-500 text-white"
                        : "bg-gray-900 hover:bg-gray-800 text-white"
                    }`}
                  >
                    {added ? (
                      <>
                        <i className="ri-check-line mr-1" />
                        Agregado
                      </>
                    ) : (
                      <>Agregar al pedido</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </ScrollReveal>

          {/* Imagen - derecha en desktop */}
          <ScrollReveal direction="right">
            <div className="relative h-64 md:h-96 rounded-lg overflow-hidden group order-1 lg:order-2">
              <img
                src={wingsMenu.image}
                alt="Alitas"
                title="Alitas de pollo La Cabrona — 12 salsas"
                loading="lazy"
                decoding="async"
                fetchpriority="low"
                className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute top-4 left-4 flex gap-2">
                {wingsMenu.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}