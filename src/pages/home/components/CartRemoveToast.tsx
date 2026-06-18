import { useEffect, useState } from "react";
import { useCart } from "../context/CartContext";

export default function CartRemoveToast() {
  const { lastCartRemoveAction } = useCart();
  const [visible, setVisible] = useState(false);
  const [action, setAction] = useState<typeof lastCartRemoveAction>(null);

  useEffect(() => {
    if (lastCartRemoveAction) {
      setAction(lastCartRemoveAction);
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 1800);
      return () => clearTimeout(timer);
    }
  }, [lastCartRemoveAction]);

  if (!visible || !action) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
      <div
        className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg transition-all duration-500 ${
          visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-4 scale-95"
        } bg-white text-gray-800 border border-gray-200`}
      >
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-gray-100 text-gray-400">
          <i className="ri-delete-bin-6-line text-sm" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold leading-tight">Quitado del carrito</span>
          <span className="text-[11px] leading-tight max-w-[200px] truncate text-gray-500">
            {action.name}
          </span>
        </div>
      </div>
    </div>
  );
}