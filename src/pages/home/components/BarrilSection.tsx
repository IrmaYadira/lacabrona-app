import { barrilMenu } from "@/mocks/menu";
import { useCart } from "../context/CartContext";
import { usePaused } from "../context/PausedContext";
import FlashPrice from "@/components/FlashPrice";
import ScrollReveal from "@/components/base/ScrollReveal";

export default function BarrilSection() {
  const { addItem, setIsOpen, toggleFavorite, isFavorite } = useCart();
  const { isPaused } = usePaused();

  const handleAdd = (item: (typeof barrilMenu)[0]) => {
    addItem({
      id: 850 + item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.image,
      category: "Cerveza de Barril",
    });
    setIsOpen(true);
  };

  return (
    <section id="barril" className="py-16 md:py-24 bg-gray-50">
      <div className="w-full px-4 md:px-8 max-w-6xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-12 md:mb-16">
            <span className="text-amber-600 text-sm font-semibold uppercase tracking-widest">
              Directo del Barril
            </span>
            <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-gray-900 mt-2 tracking-wide">
              CERVEZA DE BARRIL
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm md:text-base">
              Bien tirada, bien fría y bien cabrona. El litro directo del barril.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {barrilMenu.map((item, index) => {
            const outOfStock = isPaused(`barril-${item.id}`);
            const favId = 5400 + item.id;
            const fav = isFavorite(favId);
            return (
            <ScrollReveal key={item.id} delay={index * 150}>
              <div className={`bg-white rounded-xl overflow-hidden hover:-translate-y-1 transition-all duration-300 group ${outOfStock ? 'opacity-60' : 'hover:shadow-lg'}`}>
                <div className="relative h-56 overflow-hidden bg-gray-100">
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
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  {outOfStock && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-white text-xl font-black bg-red-600/80 px-4 py-2 rounded-xl tracking-wide">AGOTADO</span>
                    </div>
                  )}
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                      {item.tipo}
                    </span>
                    <span className="bg-white/90 text-gray-800 text-xs font-bold px-2.5 py-1 rounded-full">
                      {item.marca}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3">
                    <span className="text-white text-xs font-semibold uppercase tracking-widest opacity-80">
                      1 Litro
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(favId); }}
                    className={`absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full transition-all cursor-pointer ${
                      fav ? 'bg-red-50 text-red-500' : 'bg-white/80 text-gray-400 hover:text-red-400'
                    }`}
                    title={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                  >
                    <i className={`${fav ? 'ri-heart-fill' : 'ri-heart-line'} text-sm`} />
                  </button>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className={`text-lg font-bold leading-tight ${outOfStock ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{item.name}</h3>
                    {outOfStock && (
                      <span className="text-xs font-bold text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                        Agotado
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs mb-4 leading-relaxed">
                    {item.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <FlashPrice
                        price={item.price}
                        productName={item.name}
                        category="Cerveza de Barril"
                        variant="light"
                        size="xl"
                        className="text-2xl"
                      />
                      <span className="text-gray-400 text-xs ml-1">/ litro</span>
                    </div>
                    {outOfStock ? (
                      <span className="text-xs text-gray-400 font-semibold px-4 py-2 rounded-lg bg-gray-100 whitespace-nowrap">
                        No disponible
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAdd(item)}
                        className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-5 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap hover:scale-105 active:scale-95"
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