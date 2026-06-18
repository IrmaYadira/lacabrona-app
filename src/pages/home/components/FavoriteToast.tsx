import { useEffect, useState } from "react";
import { useCart } from "../context/CartContext";
import { findLocalMenuItem } from "@/pages/menu/utils/localMenuMap";

export default function FavoriteToast() {
  const { lastFavoriteAction } = useCart();
  const [visible, setVisible] = useState(false);
  const [action, setAction] = useState<typeof lastFavoriteAction>(null);

  useEffect(() => {
    if (lastFavoriteAction) {
      setAction(lastFavoriteAction);
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 2200);
      return () => clearTimeout(timer);
    }
  }, [lastFavoriteAction]);

  if (!visible || !action) return null;

  const item = findLocalMenuItem(action.id);
  const name = item?.name ?? "Producto";

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
      <div
        className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg transition-all duration-500 ${
          visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-4 scale-95"
        } ${
          action.added
            ? "bg-gray-900 text-white border border-gray-700"
            : "bg-white text-gray-800 border border-gray-200"
        }`}
      >
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
            action.added
              ? "bg-red-500 text-white scale-110"
              : "bg-gray-100 text-gray-400"
          }`}
        >
          <i
            className={`${action.added ? "ri-heart-fill" : "ri-heart-line"} text-sm transition-all duration-300 ${
              action.added ? "animate-pulse" : ""
            }`}
          />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold leading-tight">
            {action.added ? "Guardado en favoritos" : "Quitado de favoritos"}
          </span>
          <span className={`text-[11px] leading-tight max-w-[200px] truncate ${action.added ? "text-gray-300" : "text-gray-500"}`}>
            {name}
          </span>
        </div>
        {action.added && (
          <div className="ml-1 flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <i
                key={i}
                className="ri-heart-fill text-[10px] text-red-400 opacity-0"
                style={{
                  animation: `floatUp 0.8s ease-out ${i * 0.15}s forwards`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translateY(0) scale(0.5); }
          100% { opacity: 0; transform: translateY(-16px) scale(1); }
        }
      `}</style>
    </div>
  );
}