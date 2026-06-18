import { beerMenu } from "@/mocks/menu";
import { useCart } from "../context/CartContext";
import { usePaused } from "../context/PausedContext";
import FlashPrice from "@/components/FlashPrice";
import ScrollReveal from "@/components/base/ScrollReveal";

interface BeerItem {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
  tags?: string[];
  source: string;
}

export default function BeerSection() {
  const { addItem, setIsOpen, toggleFavorite, isFavorite } = useCart();
  const { isPaused } = usePaused();

  const handleAdd = (item: BeerItem) => {
    addItem({
      id: 800 + item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.image,
      category: "Cerveza",
    });
    setIsOpen(true);
  };

  const allBeers: BeerItem[] = beerMenu
    .filter((b) => b.name.toLowerCase().startsWith("mega"))
    .map((b) => ({ ...b, source: "main" }));

  return (
    <section id="cervezas" className="py-16 md:py-24 bg-white">
      <div className="w-full px-4 md:px-8 max-w-6xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-10 md:mb-14">
            <span className="text-amber-600 text-sm font-semibold uppercase tracking-widest">
              1.2 LITROS
            </span>
            <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-gray-900 mt-2 tracking-wide">
              MEGAS
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm md:text-base">
              Las mejores cervezas en presentación mega de 1.2 litros. Corona, Victoria, Modelo y más. ¡Para compartir en la mesa!
            </p>
          </div>
        </ScrollReveal>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
          <ScrollReveal className="w-full lg:w-1/3 shrink-0">
            <div className="relative h-64 lg:h-96 rounded-xl overflow-hidden">
              <img
                src="https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/e54e5038-8403-4eec-9225-b344c65ae3ea_v2_watermarked-dfe2f42e-4273-4821-a549-f272a0d76729.jpg?v=4183819913e4eaa45b1478ddc163d07f"
                alt="Cervezas Mega"
                title="Cervezas Mega de 1.2 litros en La Cabrona"
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
                  1.2 Litros
                </span>
              </div>
            </div>
          </ScrollReveal>

          <div className="flex-1 w-full">
            <ScrollReveal>
              <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                {allBeers.map((item) => {
                  const outOfStock = isPaused(String(item.id));
                  const favId = 5000 + item.id;
                  const fav = isFavorite(favId);
                  return (
                  <div
                    key={`${item.source}-${item.id}`}
                    className={`flex items-center gap-4 p-4 md:p-5 transition-colors group border-b border-gray-200 last:border-b-0 ${outOfStock ? 'opacity-60 bg-gray-50' : 'hover:bg-white'}`}
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
                        className={`w-full h-full transition-transform duration-300 ${item.image.includes('readdy.ai') ? 'object-cover object-top' : 'object-contain bg-[#1a1a1a]'} ${outOfStock ? 'grayscale' : 'group-hover:scale-110'}`}
                      />
                      {outOfStock && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="text-white text-[9px] font-black text-center leading-tight">AGOTADO</span>
                        </div>
                      )}
                      {/* Favorito */}
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
                        <h3 className={`font-bold text-sm md:text-base truncate ${outOfStock ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                          {item.name}
                        </h3>
                        {outOfStock && (
                          <span className="text-xs font-bold text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                            Agotado
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">
                        {item.description}
                      </p>
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {item.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
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