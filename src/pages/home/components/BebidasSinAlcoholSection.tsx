import { useState } from "react";
import { vasosPreparadosMenu, sodasMenu } from "@/mocks/menu";
import { useCart } from "../context/CartContext";
import { useFlashPrice } from "@/hooks/useFlashPrice";
import FlashPrice from "@/components/FlashPrice";
import ScrollReveal from "@/components/base/ScrollReveal";
import VariantPickerModal, { type VariantPickerItem } from "./VariantPickerModal";

// ─── Constantes ──────────────────────────────────────────────────────────────

// IDs de las Rusas dentro de vasosPreparadosMenu
const RUSA_IDS = [7, 8];

// Aguas del menú de sodas (ids que son aguas / sin gas)
const AGUA_IDS = [12]; // Agua Mineral Tapa Rosca

// Sodas que son refrescos (excluir aguas)
const REFRESCO_IDS = [1, 2, 10, 11, 13, 14, 15];

const SODA_VARIANTS: Record<number, { label: string; options: string[] }> = {
  1: {
    label: "¿Qué sabor quieres?",
    options: ["Fanta", "Sprite", "Mirinda Naranja", "Mirinda Uva", "Manzanita", "Seven Up", "Fresca", "Ginger Ale", "Agua Tónica"],
  },
  2: {
    label: "¿Qué refresco quieres?",
    options: ["Coca-Cola", "Coca-Cola Zero", "Coca-Cola Light", "Squirt", "Seven Up", "Ginger Ale", "Sidral"],
  },
  10: {
    label: "¿Qué sabor de Arizona?",
    options: ["Kiwi-Fresa", "Mango", "Sandía", "Té Verde"],
  },
  11: {
    label: "¿Qué sabor de Jugo?",
    options: ["Mango", "Durazno", "Manzana", "Guayaba"],
  },
};

const TABS = [
  { id: "rusas", label: "Rusas", icon: "ri-cup-line" },
  { id: "refrescos", label: "Refrescos", icon: "ri-bubble-chart-line" },
  { id: "aguas", label: "Aguas", icon: "ri-drop-line" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── Modal para Rusas (ingredientes omitibles + notas) ───────────────────────

interface RusaItem {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
  tags: string[];
  ingredients?: string[];
}

interface RusaModalProps {
  item: RusaItem;
  onClose: () => void;
  onConfirm: (notes: string) => void;
}

function RusaModal({ item, onClose, onConfirm }: RusaModalProps) {
  const [omitted, setOmitted] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const { hasOffer, discountedPrice, discountPct } = useFlashPrice(item.name, "Vasos Preparados", item.price);

  const toggleOmit = (ing: string) => {
    setOmitted((prev) => {
      const next = new Set(prev);
      if (next.has(ing)) next.delete(ing);
      else next.add(ing);
      return next;
    });
  };

  const handleConfirm = () => {
    const parts: string[] = [];
    if (omitted.size > 0) parts.push(`Sin: ${[...omitted].join(", ")}`);
    if (notes.trim()) parts.push(notes.trim());
    onConfirm(parts.join(" · "));
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl max-w-sm w-full shadow-2xl overflow-hidden">
        <div className="bg-amber-500 px-5 py-4">
          <h3 className="text-white font-bold text-lg">{item.name}</h3>
          <p className="text-white/80 text-xs mt-0.5">
            {hasOffer ? (
              <span className="flex items-center gap-1.5">
                <span className="line-through">${item.price.toFixed(2)}</span>
                <span className="font-bold">${discountedPrice.toFixed(2)}</span>
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                  -{discountPct}%
                </span>
              </span>
            ) : (
              <>${item.price.toFixed(2)}</>
            )}
          </p>
        </div>

        <div className="px-5 py-5 space-y-4">
          {item.ingredients && item.ingredients.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                <i className="ri-list-check mr-1 text-amber-500" />
                Quitar ingredientes (opcional)
              </span>
              <div className="flex flex-wrap gap-2">
                {item.ingredients.map((ing) => {
                  const isOmitted = omitted.has(ing);
                  return (
                    <button
                      key={ing}
                      onClick={() => toggleOmit(ing)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-all select-none whitespace-nowrap ${
                        isOmitted
                          ? "bg-red-50 border-red-300 text-red-600 line-through"
                          : "bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-400"
                      }`}
                    >
                      {isOmitted ? (
                        <i className="ri-close-circle-fill text-red-400 text-xs" />
                      ) : (
                        <i className="ri-checkbox-blank-circle-line text-amber-400 text-xs" />
                      )}
                      {ing}
                    </button>
                  );
                })}
              </div>
              {omitted.size > 0 && (
                <p className="text-xs text-red-500 mt-2 font-medium">
                  <i className="ri-information-line mr-1" />
                  Sin: {[...omitted].join(", ")}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              <i className="ri-chat-3-line mr-1 text-amber-500" />
              Observaciones adicionales
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. extra limón, menos sal, bien frío..."
              maxLength={200}
              rows={2}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
            />
            <div className="flex justify-end mt-1">
              <span className="text-xs text-gray-400">{notes.length}/200</span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 px-5 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors whitespace-nowrap"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="flex-[2] py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold cursor-pointer transition-colors whitespace-nowrap shadow-sm"
          >
            <i className="ri-add-line mr-1" />
            Agregar al pedido
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sección principal ───────────────────────────────────────────────────────

export default function BebidasSinAlcoholSection() {
  const { addItem, setIsOpen, toggleFavorite, isFavorite } = useCart();
  const [activeTab, setActiveTab] = useState<TabId>("rusas");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [rusaModal, setRusaModal] = useState<RusaItem | null>(null);
  const [pickerItem, setPickerItem] = useState<VariantPickerItem | null>(null);

  const markAdded = (key: string) => {
    setAddedIds((prev) => new Set(prev).add(key));
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 1500);
  };

  // ── Rusas ──
  const rusas = vasosPreparadosMenu.filter((v) => RUSA_IDS.includes(v.id));

  const handleAddRusa = (item: RusaItem, notes: string) => {
    addItem({
      id: 500 + item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.image,
      category: "Vasos Preparados",
      notes: notes.trim() || undefined,
    });
    markAdded(`rusa-${item.id}`);
    setIsOpen(true);
    setRusaModal(null);
  };

  // ── Refrescos ──
  const refrescos = sodasMenu.filter((s) => REFRESCO_IDS.includes(s.id));

  const handleAddRefresco = (item: (typeof sodasMenu)[0]) => {
    const variants = SODA_VARIANTS[item.id];
    if (variants) {
      setPickerItem({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image,
        category: "Refresco",
        cartIdBase: 400,
        variantLabel: variants.label,
        options: variants.options.map((o) => ({ label: o, value: o })),
      });
    } else {
      addItem({
        id: 400 + item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image,
        category: "Refresco",
      });
      markAdded(`ref-${item.id}`);
      setIsOpen(true);
    }
  };

  const handlePickerClose = () => {
    if (pickerItem) markAdded(`ref-${pickerItem.id}`);
    setPickerItem(null);
  };

  // ── Aguas ──
  const aguas = sodasMenu.filter((s) => AGUA_IDS.includes(s.id));

  const handleAddAgua = (item: (typeof sodasMenu)[0]) => {
    addItem({
      id: 400 + item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.image,
      category: "Bebidas",
    });
    markAdded(`agua-${item.id}`);
    setIsOpen(true);
  };

  // ── Tab counts ──
  const tabCounts: Record<TabId, number> = {
    rusas: rusas.length,
    refrescos: refrescos.length,
    aguas: aguas.length,
  };

  return (
    <>
      <section id="bebidas-sin-alcohol" className="py-16 md:py-24 bg-gray-800">
        <div className="w-full px-4 md:px-8 max-w-7xl mx-auto">
          {/* Header */}
          <ScrollReveal>
            <div className="text-center mb-10 md:mb-14">
              <span className="text-amber-500 text-sm font-semibold uppercase tracking-widest">
                Sin Alcohol
              </span>
              <h2 className="font-[Bebas_Neue] text-4xl md:text-6xl text-white mt-2 tracking-wide">
                BEBIDAS SIN ALCOHOL
              </h2>
              <p className="text-gray-400 mt-3 max-w-xl mx-auto text-sm md:text-base">
                Rusas, refrescos y aguas para todos los que quieren algo fresco sin pistear.
              </p>
            </div>
          </ScrollReveal>

          {/* Tabs */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex bg-gray-900/60 border border-gray-700 rounded-xl p-1 gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold tracking-wide cursor-pointer transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-amber-500 text-white shadow-sm"
                      : "text-gray-400 hover:text-white hover:bg-gray-700/60"
                  }`}
                >
                  <i className={`${tab.icon} text-base`} />
                  {tab.label}
                  <span
                    className={`text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center ${
                      activeTab === tab.id ? "bg-white/25 text-white" : "bg-gray-700 text-gray-400"
                    }`}
                  >
                    {tabCounts[tab.id]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Tab: Rusas ── */}
          {activeTab === "rusas" && (
            <div className="max-w-3xl mx-auto">
              {/* Descripción de Rusas */}
              <ScrollReveal>
                <div className="bg-gray-900/50 border border-amber-500/20 rounded-xl p-5 mb-8 flex items-start gap-4">
                  <div className="w-10 h-10 flex items-center justify-center bg-amber-500/10 rounded-lg flex-shrink-0">
                    <i className="ri-cup-line text-amber-400 text-xl" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base mb-1">¿Qué es una Rusa?</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      Una bebida refrescante sin alcohol preparada con refresco o agua mineral, hielo,
                      sal y limón. Puedes quitar cualquier ingrediente que no quieras — sólo toca para
                      deseleccionar antes de agregar al pedido.
                    </p>
                  </div>
                </div>
              </ScrollReveal>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {rusas.map((item, index) => {
                  const key = `rusa-${item.id}`;
                  const isAdded = addedIds.has(key);
                  const favId = 500 + item.id;
                  const fav = isFavorite(favId);
                  return (
                    <ScrollReveal key={item.id} delay={index * 100}>
                      <div className="bg-gray-700 rounded-xl overflow-hidden hover:bg-gray-650 hover:-translate-y-1 transition-all duration-300 group h-full flex flex-col">
                        <div className="relative h-52 overflow-hidden">
                          <img
                            src={item.image}
                            alt={item.name}
                            title={item.name}
                            loading="lazy"
                            decoding="async"
                            fetchpriority="low"
                            width="400"
                            height="400"
                            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
                            {item.tags.map((tag) => (
                              <span
                                key={tag}
                                className="bg-amber-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(favId); }}
                            className={`absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full transition-all cursor-pointer ${
                              fav ? "bg-red-50 text-red-500" : "bg-white/80 text-gray-400 hover:text-red-400"
                            }`}
                          >
                            <i className={`${fav ? "ri-heart-fill" : "ri-heart-line"} text-sm`} />
                          </button>
                        </div>

                        <div className="p-5 flex flex-col flex-1">
                          <h3 className="text-base font-bold text-white mb-2">{item.name}</h3>

                          {/* Ingredientes como chips */}
                          {item.ingredients && item.ingredients.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {item.ingredients.map((ing) => (
                                <span
                                  key={ing}
                                  className="bg-gray-600 text-amber-400 text-xs px-2 py-0.5 rounded-full"
                                >
                                  {ing}
                                </span>
                              ))}
                            </div>
                          )}

                          <p className="text-gray-400 text-sm mb-4 leading-relaxed flex-1">
                            {item.description}
                          </p>

                          <div className="flex items-center justify-between pt-2 mt-auto">
                            <FlashPrice
                              price={item.price}
                              productName={item.name}
                              category="Vasos Preparados"
                              variant="dark"
                              size="xl"
                            />
                            <button
                              onClick={() => setRusaModal(item)}
                              className={`text-sm font-semibold px-4 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap hover:scale-105 active:scale-95 ${
                                isAdded
                                  ? "bg-green-500 text-white"
                                  : "bg-amber-500 hover:bg-amber-600 text-white"
                              }`}
                            >
                              {isAdded ? (
                                <><i className="ri-check-line mr-1" />Agregada</>
                              ) : (
                                <><i className="ri-add-line mr-1" />Agregar</>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </ScrollReveal>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Tab: Refrescos ── */}
          {activeTab === "refrescos" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6">
              {refrescos.map((item, index) => {
                const hasVariants = !!SODA_VARIANTS[item.id];
                const key = `ref-${item.id}`;
                const isAdded = addedIds.has(key);
                const favId = 5700 + item.id;
                return (
                  <ScrollReveal key={item.id} delay={index * 80}>
                    <div className="bg-gray-700 rounded-xl overflow-hidden hover:bg-gray-600 hover:-translate-y-1 transition-all duration-300 group h-full flex flex-col">
                      <div className="relative h-44 overflow-hidden">
                        <img
                          src={item.image}
                          alt={item.name}
                          loading="lazy"
                          decoding="async"
                          fetchpriority="low"
                          width="400"
                          height="400"
                          className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
                          {item.tags.map((tag) => (
                            <span
                              key={tag}
                              className="bg-amber-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                          {hasVariants && (
                            <span className="bg-gray-900/80 text-amber-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-500/40">
                              Varios sabores
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(favId); }}
                          className={`absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full transition-all cursor-pointer ${
                            isFavorite(favId) ? "bg-red-50 text-red-500" : "bg-white/80 text-gray-400 hover:text-red-400"
                          }`}
                        >
                          <i className={`${isFavorite(favId) ? "ri-heart-fill" : "ri-heart-line"} text-sm`} />
                        </button>
                      </div>

                      <div className="p-4 flex flex-col flex-1">
                        <h3 className="text-base font-bold text-white mb-1.5">{item.name}</h3>
                        <p className="text-gray-400 text-sm mb-3 leading-relaxed flex-1">
                          {item.description}
                        </p>
                        <div className="flex items-center justify-between pt-2 mt-auto">
                          <FlashPrice
                            price={item.price}
                            productName={item.name}
                            category="Refresco"
                            variant="dark"
                            size="xl"
                          />
                          <button
                            onClick={() => handleAddRefresco(item)}
                            className={`text-sm font-semibold px-4 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap hover:scale-105 active:scale-95 ${
                              isAdded
                                ? "bg-green-500 text-white"
                                : hasVariants
                                ? "bg-gray-900 hover:bg-amber-500 text-amber-400 hover:text-white border border-amber-500/50"
                                : "bg-amber-500 hover:bg-amber-600 text-white"
                            }`}
                          >
                            {isAdded ? (
                              <><i className="ri-check-line mr-1" />Agregado</>
                            ) : hasVariants ? (
                              <><i className="ri-arrow-right-line mr-1" />Elegir sabor</>
                            ) : (
                              "Agregar"
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>
          )}

          {/* ── Tab: Aguas ── */}
          {activeTab === "aguas" && (
            <div className="max-w-2xl mx-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {aguas.map((item, index) => {
                  const key = `agua-${item.id}`;
                  const isAdded = addedIds.has(key);
                  const favId = 5700 + item.id;
                  return (
                    <ScrollReveal key={item.id} delay={index * 100}>
                      <div className="bg-gray-700 rounded-xl overflow-hidden hover:bg-gray-600 hover:-translate-y-1 transition-all duration-300 group h-full flex flex-col">
                        <div className="relative h-48 overflow-hidden">
                          <img
                            src={item.image}
                            alt={item.name}
                            title={item.name}
                            loading="lazy"
                            decoding="async"
                            fetchpriority="low"
                            width="400"
                            height="400"
                            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
                            {item.tags.map((tag) => (
                              <span
                                key={tag}
                                className="bg-amber-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(favId); }}
                            className={`absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full transition-all cursor-pointer ${
                              isFavorite(favId) ? "bg-red-50 text-red-500" : "bg-white/80 text-gray-400 hover:text-red-400"
                            }`}
                          >
                            <i className={`${isFavorite(favId) ? "ri-heart-fill" : "ri-heart-line"} text-sm`} />
                          </button>
                        </div>

                        <div className="p-5 flex flex-col flex-1">
                          <h3 className="text-base font-bold text-white mb-1.5">{item.name}</h3>
                          <p className="text-gray-400 text-sm mb-4 leading-relaxed flex-1">
                            {item.description}
                          </p>
                          <div className="flex items-center justify-between pt-2 mt-auto">
                            <FlashPrice
                              price={item.price}
                              productName={item.name}
                              category="Bebidas"
                              variant="dark"
                              size="xl"
                            />
                            <button
                              onClick={() => handleAddAgua(item)}
                              className={`text-sm font-semibold px-4 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap hover:scale-105 active:scale-95 ${
                                isAdded
                                  ? "bg-green-500 text-white"
                                  : "bg-amber-500 hover:bg-amber-600 text-white"
                              }`}
                            >
                              {isAdded ? (
                                <><i className="ri-check-line mr-1" />Agregada</>
                              ) : (
                                "Agregar"
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </ScrollReveal>
                  );
                })}

                {/* Card extra — Rusas sin alcohol */}
                <ScrollReveal delay={200}>
                  <div className="bg-gray-700/50 border border-dashed border-gray-600 rounded-xl p-5 flex flex-col items-center justify-center text-center gap-3 min-h-[220px]">
                    <div className="w-10 h-10 flex items-center justify-center bg-amber-500/10 rounded-full">
                      <i className="ri-cup-line text-amber-400 text-xl" />
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      ¿Quieres agua mineral con sal y limón?
                    </p>
                    <button
                      onClick={() => setActiveTab("rusas")}
                      className="text-xs font-bold text-amber-400 hover:text-amber-300 cursor-pointer flex items-center gap-1 transition-colors whitespace-nowrap"
                    >
                      Ver Rusas <i className="ri-arrow-right-s-line" />
                    </button>
                  </div>
                </ScrollReveal>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Modales */}
      {rusaModal && (
        <RusaModal
          item={rusaModal}
          onClose={() => setRusaModal(null)}
          onConfirm={(notes) => handleAddRusa(rusaModal, notes)}
        />
      )}

      <VariantPickerModal item={pickerItem} onClose={handlePickerClose} />
    </>
  );
}