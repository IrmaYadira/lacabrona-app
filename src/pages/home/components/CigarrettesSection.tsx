import { useState } from "react";
import { cigarettesMenu } from "@/mocks/menu";
import { useCart } from "../context/CartContext";
import { usePaused } from "../context/PausedContext";
import { useFlashPrice } from "@/hooks/useFlashPrice";
import FlashPrice from "@/components/FlashPrice";
import ScrollReveal from "@/components/base/ScrollReveal";

const MARCAS = ["Marlboro", "Benson & Hedges", "Pall Mall"];

export default function CigarrettesSection() {
  const { addItem, setIsOpen, toggleFavorite, isFavorite } = useCart();
  const { isPaused } = usePaused();
  const [selectedMarca, setSelectedMarca] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const sueltos = cigarettesMenu.filter((c) => [1, 2, 3].includes(c.id));
  const cajetillas = cigarettesMenu.filter((c) => [4, 5, 6].includes(c.id));

  const cajetillaOut = isPaused('cig-cajetilla');

  const handleAddSuelto = (item: (typeof cigarettesMenu)[0]) => {
    addItem({
      id: 900 + item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.image,
      category: "Cigarros",
    });
    setIsOpen(true);
  };

  const handleOpenCajetilla = () => {
    setSelectedMarca(null);
    setShowPicker(true);
  };

  const handleConfirmCajetilla = () => {
    if (!selectedMarca) return;
    addItem({
      id: 9100 + MARCAS.indexOf(selectedMarca),
      name: `Cajetilla ${selectedMarca}`,
      description: `Cajetilla completa de ${selectedMarca} con 20 cigarros.`,
      price: 115,
      image: cigarettesMenu.find((c) => c.name.includes(selectedMarca))?.image ?? "",
      category: "Cigarros",
    });
    setShowPicker(false);
    setIsOpen(true);
  };

  return (
    <section id="cigarros" className="py-16 md:py-24 bg-white">
      <div className="w-full px-4 md:px-8 max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-12 md:mb-16">
            <span className="text-amber-600 text-sm font-semibold uppercase tracking-widest">
              Para el Vicio
            </span>
            <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-gray-900 mt-2 tracking-wide">
              CIGARROS
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm md:text-base">
              Sueltos o cajetilla completa, pa acompañar el pistón.
            </p>
          </div>
        </ScrollReveal>

        {/* Sueltos */}
        <ScrollReveal>
          <div className="mb-6">
            <span className="inline-block bg-amber-100 text-amber-700 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full">
              Sueltos — $8 c/u
            </span>
          </div>
        </ScrollReveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {sueltos.map((item, index) => {
            const outOfStock = isPaused(`cig-${item.id}`);
            return (
            <ScrollReveal key={item.id} delay={index * 100}>
              <div className={`bg-gray-50 rounded-lg overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group ${outOfStock ? 'opacity-60' : ''}`}>
                <div className="relative h-44 overflow-hidden bg-gray-100">
                  <img
                    src={item.image}
                    alt={item.name}
                    title={item.name}
                    loading="lazy"
                    decoding="async"
                    fetchpriority="low"
                    width="400"
                    height="400"
                    className={`w-full h-full object-cover object-top transition-transform duration-500 ${outOfStock ? 'grayscale' : 'group-hover:scale-105'}`}
                  />
                  {outOfStock && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-white text-[9px] font-black text-center leading-tight">AGOTADO</span>
                    </div>
                  )}
                  {/* Favorito */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(5500 + item.id); }}
                    className={`absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center rounded-full transition-all cursor-pointer ${
                      isFavorite(5500 + item.id) ? 'bg-red-50 text-red-500' : 'bg-white/80 text-gray-400 hover:text-red-400'
                    }`}
                    title={isFavorite(5500 + item.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                  >
                    <i className={`${isFavorite(5500 + item.id) ? 'ri-heart-fill' : 'ri-heart-line'} text-sm`} />
                  </button>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className={`text-base font-bold mb-0 ${outOfStock ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{item.name}</h3>
                    {outOfStock && (
                      <span className="text-xs font-bold text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                        Agotado
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs mb-3 leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <FlashPrice
                      price={item.price}
                      productName={item.name}
                      category="Cigarros"
                      variant="light"
                      size="xl"
                    />
                    {outOfStock ? (
                      <span className="text-xs text-gray-400 font-semibold px-3 py-1.5 rounded-md bg-gray-100 whitespace-nowrap">
                        No disponible
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAddSuelto(item)}
                        className="text-gray-900 hover:text-amber-600 text-sm font-semibold cursor-pointer transition-all whitespace-nowrap hover:scale-105 active:scale-95"
                      >
                        <i className="ri-add-line mr-1" />
                        Agregar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </ScrollReveal>
            );
          })}
        </div>

        {/* Cajetilla — una sola tarjeta */}
        <ScrollReveal>
          <div className="mb-6">
            <span className="inline-block bg-gray-900 text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full">
              Cajetilla Completa — $115
            </span>
          </div>
        </ScrollReveal>
        <ScrollReveal>
          <div className="max-w-sm">
            <div className={`bg-gray-50 rounded-lg overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group ${cajetillaOut ? 'opacity-60' : ''}`}>
              <div className="relative h-44 overflow-hidden bg-gray-100">
                <img
                  src="https://readdy.ai/api/search-image?query=pack%20of%20marlboro%20cigarettes%20red%20box%20on%20dark%20wooden%20bar%20counter%20warm%20amber%20lighting%20mexican%20cantina%20atmosphere%20professional%20product%20photography%20smoke%20haze&width=400&height=400&seq=cajetilla-cigarros&orientation=squarish"
                  alt="Cajetilla completa de cigarros"
                  title="Cajetilla de Cigarros — Marlboro, Benson & Hedges, Pall Mall"
                  loading="lazy"
                  decoding="async"
                  fetchpriority="low"
                  width="400"
                  height="400"
                  className={`w-full h-full object-cover object-top transition-transform duration-500 ${cajetillaOut ? 'grayscale' : 'group-hover:scale-105'}`}
                />
                {cajetillaOut && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="text-white text-[9px] font-black text-center leading-tight">AGOTADO</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className={`text-base font-bold mb-0 ${cajetillaOut ? 'text-gray-400 line-through' : 'text-gray-900'}`}>Cajetilla Completa</h3>
                  {cajetillaOut && (
                    <span className="text-xs font-bold text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                      Agotado
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-xs mb-3 leading-relaxed">
                  20 cigarros. Elige tu marca: Marlboro, Benson &amp; Hedges o Pall Mall.
                </p>
                <div className="flex items-center justify-between">
                  <FlashPrice
                    price={115}
                    productName="Cajetilla Completa"
                    category="Cigarros"
                    variant="light"
                    size="xl"
                  />
                  {cajetillaOut ? (
                    <span className="text-xs text-gray-400 font-semibold px-3 py-1.5 rounded-md bg-gray-100 whitespace-nowrap">
                      No disponible
                    </span>
                  ) : (
                    <button
                      onClick={handleOpenCajetilla}
                      className="text-gray-900 hover:text-amber-600 text-sm font-semibold cursor-pointer transition-all whitespace-nowrap hover:scale-105 active:scale-95"
                    >
                      <i className="ri-add-line mr-1" />
                      Agregar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>

      {/* Modal selector de marca */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 font-[Bebas_Neue] tracking-wide text-xl">
                ELIGE TU MARCA
              </h3>
              <button
                onClick={() => setShowPicker(false)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>
            <p className="text-gray-500 text-sm mb-5">
              <CajetillaModalPrice />
            </p>
            <div className="space-y-2 mb-6">
              {MARCAS.map((marca) => (
                <button
                  key={marca}
                  onClick={() => setSelectedMarca(marca)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 text-sm font-semibold cursor-pointer transition-all whitespace-nowrap ${
                    selectedMarca === marca
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {selectedMarca === marca && (
                    <i className="ri-checkbox-circle-fill mr-2 text-amber-500" />
                  )}
                  {selectedMarca !== marca && (
                    <i className="ri-checkbox-blank-circle-line mr-2 text-gray-300" />
                  )}
                  {marca}
                </button>
              ))}
            </div>
            <button
              onClick={handleConfirmCajetilla}
              disabled={!selectedMarca}
              className={`w-full py-3 rounded-lg text-sm font-bold uppercase tracking-wide cursor-pointer transition-all whitespace-nowrap ${
                selectedMarca
                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              Agregar a mi cuenta
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function CajetillaModalPrice() {
  const { hasOffer, discountedPrice, discountPct } = useFlashPrice("Cajetilla Completa", "Cigarros", 115);
  if (hasOffer) {
    return (
      <span className="flex items-center gap-1.5">
        <span className="line-through">$115.00</span>
        <span className="font-bold text-gray-900">${discountedPrice.toFixed(2)}</span>
        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">-{discountPct}%</span>
      </span>
    );
  }
  return <>Cajetilla completa — $115.00</>;
}