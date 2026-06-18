import { beerMenu } from "@/mocks/menu";
import { useCart } from "../context/CartContext";
import FlashPrice from "@/components/FlashPrice";
import ScrollReveal from "@/components/base/ScrollReveal";

export default function LatasSection() {
  const { addItem, setIsOpen } = useCart();

  const latasItems = beerMenu.filter((item) =>
    item.tags.some((tag) => tag.toLowerCase() === "lata")
  );

  const handleAdd = (item: (typeof beerMenu)[0]) => {
    addItem({
      id: 100 + item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.image,
      category: "Cerveza",
    });
    setIsOpen(true);
  };

  // Agrupar por precio
  const groupedByPrice = latasItems.reduce<Record<number, typeof latasItems>>((acc, item) => {
    if (!acc[item.price]) acc[item.price] = [];
    acc[item.price].push(item);
    return acc;
  }, {});

  const priceGroups = Object.entries(groupedByPrice)
    .map(([price, items]) => ({ price: Number(price), items }))
    .sort((a, b) => a.price - b.price);

  return (
    <section id="latas" className="py-16 md:py-24 bg-gray-900">
      <div className="w-full px-4 md:px-8 max-w-6xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-10 md:mb-14">
            <span className="text-amber-500 text-sm font-semibold uppercase tracking-widest">
              Cervezas
            </span>
            <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-white mt-2 tracking-wide">
              LATAS
            </h2>
            <p className="text-gray-400 mt-3 max-w-xl mx-auto text-sm md:text-base">
              Cervezas en lata, frías y listas para disfrutar.
            </p>
          </div>
        </ScrollReveal>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
          <ScrollReveal className="w-full lg:w-1/3 shrink-0">
            <div className="relative h-64 lg:h-96 rounded-xl overflow-hidden">
              <img
                src="https://readdy.ai/api/search-image?query=cold%20mexican%20beer%20cans%20pacifico%20corona%20modelo%20arranged%20on%20dark%20bar%20counter%20condensation%20warm%20lighting%20restaurant%20photography%20aluminum%20cans%20group%20dark%20moody&width=300&height=400&seq=latas-beers-group-v2&orientation=portrait"
                alt="Cervezas en Lata La Cabrona"
                title="Cervezas en Lata en La Cabrona Alitas & Beer Zapopan"
                loading="lazy"
                decoding="async"
                fetchpriority="low"
                width="400"
                height="500"
                className="w-full h-full object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  355ml
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
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 p-4 md:p-5 hover:bg-gray-800 transition-colors group border-b border-gray-700/50 last:border-b-0"
                      >
                        <div className="w-14 h-14 md:w-16 md:h-16 rounded-lg overflow-hidden shrink-0">
                          <img
                            src={item.image}
                            alt={item.name}
                            title={item.name}
                            loading="lazy"
                            decoding="async"
                            fetchpriority="low"
                            width="64"
                            height="64"
                            className="w-full h-full object-cover object-top group-hover:scale-110 transition-transform duration-300"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-bold text-sm md:text-base truncate">
                            {item.name}
                          </h3>
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
                          <button
                            onClick={() => handleAdd(item)}
                            className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3 py-1.5 rounded-md cursor-pointer transition-all whitespace-nowrap hover:scale-105 active:scale-95 shrink-0"
                          >
                            Agregar
                          </button>
                        </div>
                      </div>
                    ))}
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