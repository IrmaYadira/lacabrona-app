import { useState, useCallback, useMemo } from "react";
import { useCart } from "../context/CartContext";
import { findLocalMenuItem } from "@/pages/menu/utils/localMenuMap";
import FlashPrice from "@/components/FlashPrice";
import ScrollReveal from "@/components/base/ScrollReveal";

export default function FavoritesSection() {
  const { favorites, toggleFavorite, isFavorite, addItem, setIsOpen } = useCart();
  const [addedId, setAddedId] = useState<number | null>(null);

  // Resolve favoritos a items del menú local — memoizado para evitar recalcular
  const favoriteItems = useMemo(() => {
    return favorites
      .map((id) => findLocalMenuItem(id))
      .filter(Boolean);
  }, [favorites]);

  const handleAdd = useCallback(
    (item: NonNullable<ReturnType<typeof findLocalMenuItem>>) => {
      // Para alitas y boneless, agregar salsa BBQ por default
      const needsSauce = item.category === "Alitas" || item.category === "Boneless";
      const sauce = needsSauce ? "BBQ" : undefined;

      addItem({
        id: item.id,
        name: needsSauce ? `${item.name.split(" — ")[0]} — ${sauce}` : item.name,
        description: needsSauce
          ? `Salsa: ${sauce}`
          : item.category,
        price: item.price,
        image: item.image,
        category: item.category,
        notes: needsSauce ? `Salsa: ${sauce}` : undefined,
      });

      setAddedId(item.id);
      setIsOpen(true);
      setTimeout(() => setAddedId((prev) => (prev === item.id ? null : prev)), 1500);
    },
    [addItem, setIsOpen]
  );

  if (favoriteItems.length === 0) return null;

  return (
    <section id="favoritos" className="py-12 md:py-16 bg-amber-50/50">
      <div className="w-full px-4 md:px-8 max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="flex items-center gap-3 mb-8 md:mb-10">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-red-100 rounded-full flex items-center justify-center">
              <i className="ri-heart-fill text-red-500 text-lg md:text-xl" />
            </div>
            <div>
              <h2 className="font-[Bebas_Neue] text-3xl md:text-4xl text-gray-900 tracking-wide">
                MIS FAVORITOS
              </h2>
              <p className="text-gray-500 text-sm">
                {favoriteItems.length} {favoriteItems.length === 1 ? "producto guardado" : "productos guardados"} — agregalos rápido a tu pedido
              </p>
            </div>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          {favoriteItems.map((item) => (
            <ScrollReveal key={item.id}>
              <div className="bg-white rounded-lg border border-gray-100 overflow-hidden hover:shadow-sm transition-shadow group">
                {/* Imagen */}
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.name}
                    title={item.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                  />
                  {/* Corazón quitar */}
                  <button
                    onClick={() => toggleFavorite(item.id)}
                    className="absolute top-2 right-2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center border border-gray-100 cursor-pointer hover:bg-red-50 transition-colors z-10"
                    title="Quitar de favoritos"
                  >
                    <i className="ri-heart-fill text-red-500 text-sm" />
                  </button>
                  {/* Categoría tag */}
                  <span className="absolute bottom-2 left-2 bg-gray-900/80 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    {item.category}
                  </span>
                </div>

                {/* Info */}
                <div className="p-3">
                  <h3 className="text-sm font-bold text-gray-900 leading-tight line-clamp-2 min-h-[2.5rem]">
                    {item.name}
                  </h3>

                  <div className="mt-2 flex items-end justify-between gap-2">
                    <FlashPrice
                      price={item.price}
                      productName={item.name}
                      category={item.category}
                      variant="light"
                      size="sm"
                    />

                    <button
                      onClick={() => handleAdd(item)}
                      className={`shrink-0 text-xs font-bold px-3 py-2 rounded-md cursor-pointer transition-all whitespace-nowrap active:scale-95 ${
                        addedId === item.id
                          ? "bg-green-500 text-white"
                          : "bg-gray-900 text-white hover:bg-gray-800"
                      }`}
                    >
                      {addedId === item.id ? (
                        <>
                          <i className="ri-check-line mr-0.5" />
                          Listo
                        </>
                      ) : (
                        <>
                          <i className="ri-add-line mr-0.5" />
                          Agregar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}