import { sidesMenu } from "@/mocks/menu";
import { useCart } from "../context/CartContext";
import { usePaused } from "../context/PausedContext";
import FlashPrice from "@/components/FlashPrice";
import ScrollReveal from "@/components/base/ScrollReveal";

export default function SidesSection() {
  const { addItem, setIsOpen, toggleFavorite, isFavorite } = useCart();
  const { isPaused } = usePaused();

  const handleAdd = (item: (typeof sidesMenu)[0]) => {
    addItem({
      id: 200 + item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.image,
      category: "Acompañamiento",
    });
    setIsOpen(true);
  };

  return (
    <section id="entradas" className="py-16 md:py-24 bg-white overflow-x-hidden">
      <div className="w-full px-4 md:px-8 max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-12 md:mb-16">
            <span className="text-amber-600 text-sm font-semibold uppercase tracking-widest">
              Para Comenzar
            </span>
            <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-gray-900 mt-2 tracking-wide">
              ENTRADAS
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm md:text-base">
              Los mejores botana que no pueden faltar. Empieza por lo bueno.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 min-w-0">
          {sidesMenu.map((item, index) => {
            const outOfStock = isPaused(`side-${item.id}`);
            const favId = 200 + item.id;
            const fav = isFavorite(favId);
            return (
            <ScrollReveal key={item.id} delay={index * 100}>
              <div className={`bg-gray-50 rounded-lg overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group ${outOfStock ? 'opacity-60' : ''}`}>
                <div className="relative h-44 overflow-hidden bg-gray-100 flex items-center justify-center">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      title={item.name}
                      loading="lazy"
                      decoding="async"
                      fetchpriority="low"
                      width="400"
                      height="400"
                      className={`w-full h-full transition-transform duration-500 ${item.image.includes('readdy.ai') ? 'object-cover object-top' : 'object-contain bg-[#1a1a1a]'} ${outOfStock ? 'grayscale' : 'group-hover:scale-105'}`}
                    />
                  ) : (
                    <div className="text-center px-4">
                      <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-amber-100 flex items-center justify-center">
                        <i className="ri-image-line text-amber-600 text-2xl" />
                      </div>
                      <p className="text-amber-700 text-xs font-semibold uppercase tracking-wider">
                        Foto próximamente
                      </p>
                    </div>
                  )}
                  {outOfStock && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                      <span className="text-white text-[9px] font-black text-center leading-tight">AGOTADO</span>
                    </div>
                  )}
                  {/* Favorito */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(favId); }}
                    className={`absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center rounded-full transition-all cursor-pointer ${
                      fav ? 'bg-red-50 text-red-500' : 'bg-white/80 text-gray-400 hover:text-red-400'
                    }`}
                    title={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                  >
                    <i className={`${fav ? 'ri-heart-fill' : 'ri-heart-line'} text-sm`} />
                  </button>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className={`text-base font-bold mb-0 ${outOfStock ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {item.name}
                    </h3>
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
                      category="Acompañamiento"
                      variant="light"
                      size="xl"
                    />
                    {outOfStock ? (
                      <span className="text-xs text-gray-400 font-semibold px-3 py-1.5 rounded-md bg-gray-100 whitespace-nowrap">
                        No disponible
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAdd(item)}
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
      </div>
    </section>
  );
}