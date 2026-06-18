import { comboMenu } from "@/mocks/menu";
import { useCart } from "../context/CartContext";
import { usePaused } from "../context/PausedContext";
import { useFlashPrice } from "@/hooks/useFlashPrice";
import FlashPrice from "@/components/FlashPrice";
import ScrollReveal from "@/components/base/ScrollReveal";

export default function CombosSection() {
  const { addItem, setIsOpen, toggleFavorite, isFavorite } = useCart();
  const { isPaused } = usePaused();

  const handleAdd = (item: (typeof comboMenu)[0]) => {
    addItem({
      id: 300 + item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.image,
      category: "Combo",
    });
    setIsOpen(true);
  };

  return (
    <section id="combos" className="py-16 md:py-24 bg-amber-50">
      <div className="w-full px-4 md:px-8 max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-12 md:mb-16">
            <span className="text-amber-600 text-sm font-semibold uppercase tracking-widest">
              Promociones
            </span>
            <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-gray-900 mt-2 tracking-wide">
              COMBOS
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm md:text-base">
              Arma tu combo y ahorra. La mejor manera de disfrutar La Cabrona.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
          {comboMenu.map((item, index) => {
            const outOfStock = isPaused(`combo-${item.id}`);
            const favId = 3000 + item.id;
            const fav = isFavorite(favId);
            return (
            <ScrollReveal key={item.id} delay={index * 150} direction="left">
              <div
                className={`bg-white rounded-xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative ${
                  item.popular ? "ring-2 ring-amber-500" : ""
                } ${outOfStock ? 'opacity-60' : ''}`}
              >
                {item.popular && (
                  <div className="absolute top-4 right-4 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full z-10 animate-pulse">
                    MÁS POPULAR
                  </div>
                )}

                <div className="relative h-56 overflow-hidden">
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
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(favId); }}
                    className={`absolute top-2 left-2 z-10 w-8 h-8 flex items-center justify-center rounded-full transition-all cursor-pointer ${
                      fav ? 'bg-red-50 text-red-500' : 'bg-white/80 text-gray-400 hover:text-red-400'
                    }`}
                    title={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                  >
                    <i className={`${fav ? 'ri-heart-fill' : 'ri-heart-line'} text-sm`} />
                  </button>
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h3 className={`text-xl font-bold mb-0 ${outOfStock ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {item.name}
                    </h3>
                    {outOfStock && (
                      <span className="text-xs font-bold text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                        Agotado
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm mb-4 leading-relaxed">
                    {item.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FlashPrice
                        price={item.price}
                        productName={item.name}
                        category="Combo"
                        variant="light"
                        size="xl"
                      />
                      <ComboFakeStrikethrough item={item} />
                    </div>
                    {outOfStock ? (
                      <span className="text-xs text-gray-400 font-semibold px-3 py-1.5 rounded-md bg-gray-100 whitespace-nowrap">
                        No disponible
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAdd(item)}
                        className="bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-5 py-2.5 rounded-md cursor-pointer transition-all whitespace-nowrap hover:scale-105 active:scale-95"
                      >
                        Ordenar Combo
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

function ComboFakeStrikethrough({ item }: { item: (typeof comboMenu)[0] }) {
  const { hasOffer } = useFlashPrice(item.name, "Combo", item.price);
  if (hasOffer) return null;
  return (
    <span className="text-gray-400 text-sm line-through">
      ${Math.round(item.price * 1.2)}
    </span>
  );
}