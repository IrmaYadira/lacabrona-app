import { caguamasMenu } from "@/mocks/menu";
import { useCart } from "../context/CartContext";
import { usePaused } from "../context/PausedContext";
import FlashPrice from "@/components/FlashPrice";
import ScrollReveal from "@/components/base/ScrollReveal";

export default function CaguamasSection() {
  const { addItem, setIsOpen, toggleFavorite, isFavorite } = useCart();
  const { isPaused } = usePaused();

  const handleAdd = (item: (typeof caguamasMenu)[0]) => {
    addItem({
      id: 900 + item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.image,
      category: "Cerveza",
    });
    setIsOpen(true);
  };

  const imageUrl = "https://readdy.ai/api/search-image?query=two%20large%20beer%20bottles%20side%20by%20side%20on%20rustic%20wooden%20cantina%20bar%20Heineken%20green%20glass%20bottle%201200ml%20caguamon%20size%20and%20Miller%20High%20Life%20clear%20glass%20bottle%20940ml%20caguama%20size%20both%20ice%20cold%20with%20heavy%20condensation%20droplets%20frosty%20cold%20appearance%20lime%20wedge%20perched%20on%20each%20bottle%20mouth%20warm%20amber%20golden%20cantina%20lighting%20dark%20moody%20background%20professional%20drink%20photography%20editorial%20product%20shot%20shallow%20depth%20of%20field&width=800&height=600&seq=caguamas-heineken-miller-v3&orientation=landscape";

  return (
    <section id="caguamas" className="py-16 md:py-24 bg-amber-50">
      <div className="w-full px-4 md:px-8 max-w-6xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-10 md:mb-14">
            <span className="text-amber-600 text-sm font-semibold uppercase tracking-widest">
              Cervezas
            </span>
            <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-gray-900 mt-2 tracking-wide">
              CERVEZAS TECATE · CAGUAMAS &amp; CAGUAMONES
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm md:text-base">
              Las presentaciones más cabronas: caguama de 940ml y caguamón de 1,200ml. Bien frías, para los que vienen con sed de verdad.
            </p>
          </div>
        </ScrollReveal>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
          <ScrollReveal className="w-full lg:w-1/3 shrink-0">
            <div className="relative h-64 lg:h-96 rounded-xl overflow-hidden">
              <img
                src={imageUrl}
                alt="Caguamas y Caguamones"
                title="Caguamas y Caguamones en La Cabrona"
                loading="lazy"
                decoding="async"
                fetchpriority="low"
                width="600"
                height="450"
                className="w-full h-full object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <span className="bg-amber-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                  940ml &amp; 1,200ml
                </span>
              </div>
            </div>
          </ScrollReveal>

          <div className="flex-1 w-full">
            <ScrollReveal>
              <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
                {caguamasMenu.map((item) => {
                  const outOfStock = isPaused(`cag-${item.id}`);
                  const favId = 5200 + item.id;
                  const fav = isFavorite(favId);
                  return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-4 p-4 md:p-5 transition-colors group border-b border-amber-100 last:border-b-0 ${outOfStock ? 'opacity-60 bg-gray-50' : 'hover:bg-amber-50/50'}`}
                  >
                    <div className="relative w-[60px] h-[60px] md:w-20 md:h-20 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                      <img
                        src={item.image}
                        alt={item.name}
                        title={item.name}
                        loading="lazy"
                        decoding="async"
                        fetchpriority="low"
                        width="80"
                        height="80"
                        className={`w-full h-full transition-transform duration-300 object-cover object-top ${outOfStock ? 'grayscale' : 'group-hover:scale-110'}`}
                      />
                      {outOfStock && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="text-white text-[9px] font-black text-center leading-tight">AGOTADO</span>
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(favId); }}
                        className={`absolute bottom-0.5 right-0.5 w-5 h-5 flex items-center justify-center rounded-full cursor-pointer transition-all ${
                          fav ? 'bg-red-50 text-red-500' : 'bg-white/80 text-gray-400 hover:text-red-400'
                        }`}
                        title={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                      >
                        <i className={`${fav ? 'ri-heart-fill' : 'ri-heart-line'} text-[10px]`} />
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className={`font-bold text-sm md:text-base truncate ${outOfStock ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        {item.name}
                      </h3>
                      <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {item.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <FlashPrice
                        price={item.price}
                        productName={item.name}
                        category="Cerveza"
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
                          className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3 py-1.5 rounded-md cursor-pointer transition-all whitespace-nowrap hover:scale-105 active:scale-95 shrink-0"
                        >
                          Agregar
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}