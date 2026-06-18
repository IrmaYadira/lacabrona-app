import { ampolletasMenu } from "@/mocks/menu";
import { useCart } from "../context/CartContext";
import { usePaused } from "../context/PausedContext";
import FlashPrice from "@/components/FlashPrice";
import ScrollReveal from "@/components/base/ScrollReveal";

export default function AmpolletasSection() {
  const { addItem, setIsOpen, toggleFavorite, isFavorite } = useCart();
  const { isPaused } = usePaused();

  const handleAdd = (item: (typeof ampolletasMenu)[0]) => {
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

  // Agrupar por precio
  const groupedByPrice = ampolletasMenu.reduce<Record<number, typeof ampolletasMenu>>((acc, item) => {
    if (!acc[item.price]) acc[item.price] = [];
    acc[item.price].push(item);
    return acc;
  }, {});

  const priceGroups = Object.entries(groupedByPrice)
    .map(([price, items]) => ({ price: Number(price), items }))
    .sort((a, b) => a.price - b.price);

  return (
    <section id="ampolletas" className="py-16 md:py-24 bg-gray-900">
      <div className="w-full px-4 md:px-8 max-w-6xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-10 md:mb-14">
            <span className="text-amber-500 text-sm font-semibold uppercase tracking-widest">
              Cervezas
            </span>
            <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-white mt-2 tracking-wide">
              AMPOLLETAS
            </h2>
            <p className="text-gray-400 mt-3 max-w-xl mx-auto text-sm md:text-base">
              La clásica presentación ampolleta, bien fría y al precio justo.
            </p>
          </div>
        </ScrollReveal>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
          <ScrollReveal className="w-full lg:w-1/3 shrink-0">
            <div className="relative h-64 lg:h-96 rounded-xl overflow-hidden">
              <img
                src="https://public.readdy.ai/ai/img_res/904f450c-4096-43ce-a203-42bd0e5a3aaf.png"
                alt="Ampolletas"
                title="Ampolletas de cerveza La Cabrona"
                loading="lazy"
                decoding="async"
                fetchpriority="low"
                width="600"
                height="450"
                className="w-full h-full object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Mini
                </span>
              </div>
            </div>
          </ScrollReveal>

          <div className="flex-1 w-full">
            {priceGroups.map((group, groupIndex) => (
              <ScrollReveal key={group.price} delay={groupIndex * 150}>
                <div className="mb-6 last:mb-0">
                  {/* Precio como encabezado */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-amber-400 font-bold text-xl md:text-2xl whitespace-nowrap">
                      ${group.price.toFixed(2)}
                    </span>
                    <div className="h-px flex-1 bg-gray-700/50" />
                    <span className="text-gray-500 text-xs uppercase tracking-wider">
                      {group.items.length} {group.items.length === 1 ? "opción" : "opciones"}
                    </span>
                  </div>

                  <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
                    {group.items.map((item) => {
                      const outOfStock = isPaused(`amp-${item.id}`);
                      const favId = 5200 + item.id;
                      const fav = isFavorite(favId);
                      return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-4 p-4 md:p-5 transition-colors group border-b border-gray-700/50 last:border-b-0 ${outOfStock ? 'opacity-60' : 'hover:bg-gray-800'}`}
                      >
                        <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-lg overflow-hidden shrink-0">
                          <img
                            src={item.image}
                            alt={item.name}
                            title={item.name}
                            loading="lazy"
                            decoding="async"
                            fetchpriority="low"
                            width="64"
                            height="64"
                            className={`w-full h-full transition-transform duration-300 ${item.image.includes('readdy.ai/api/search-image') ? 'object-cover object-top' : 'object-contain bg-[#1a1a1a]'} ${outOfStock ? 'grayscale' : 'group-hover:scale-110'}`}
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={`font-bold text-sm md:text-base truncate ${outOfStock ? 'text-gray-500 line-through' : 'text-white'}`}>
                              {item.name}
                            </h3>
                            {outOfStock && (
                              <span className="text-xs font-bold text-red-400 bg-red-900/30 border border-red-700/40 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                                Agotado
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">
                            {item.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <FlashPrice
                            price={item.price}
                            productName={item.name}
                            category="Cerveza"
                            variant="dark"
                            size="xl"
                          />
                          {outOfStock ? (
                            <span className="text-xs text-gray-500 font-semibold px-3 py-1.5 rounded-md bg-gray-700 whitespace-nowrap">
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
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}