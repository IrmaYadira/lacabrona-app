import { useState } from "react";
import { useCart } from "@/pages/home/context/CartContext";

export default function SessionChip() {
  const { customerName, setCustomerName, orderMode, setOrderMode, itemCount } = useCart();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [quickName, setQuickName] = useState("");
  const [showQuickEntry, setShowQuickEntry] = useState(false);

  // Si no hay nombre: mostrar banner de identificación rápida
  if (!customerName.trim()) {
    return (
      <div className="w-full bg-gray-900 border-b border-gray-700">
        <div className="w-full px-4 md:px-8 max-w-3xl mx-auto py-2 flex items-center gap-2 flex-wrap">
          <i className="ri-user-line text-amber-400 text-sm flex-shrink-0" />
          {showQuickEntry ? (
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <input
                type="text"
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && quickName.trim()) {
                    setCustomerName(quickName.trim());
                    setShowQuickEntry(false);
                  }
                  if (e.key === "Escape") setShowQuickEntry(false);
                }}
                autoFocus
                placeholder="Tu nombre para el pedido..."
                className="flex-1 min-w-0 text-sm bg-gray-800 text-white border border-gray-600 rounded-md px-2 py-0.5 focus:outline-none focus:border-amber-500 placeholder-gray-500"
              />
              <button
                onClick={() => { if (quickName.trim()) { setCustomerName(quickName.trim()); setShowQuickEntry(false); } }}
                className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 text-white px-3 py-0.5 rounded-md text-xs font-bold cursor-pointer whitespace-nowrap transition-colors"
              >
                Listo
              </button>
              <button onClick={() => setShowQuickEntry(false)} className="text-gray-500 hover:text-gray-300 cursor-pointer flex-shrink-0">
                <i className="ri-close-line text-sm" />
              </button>
            </div>
          ) : (
            <>
              <span className="text-xs text-gray-400 flex-1 min-w-0">
                ¿A nombre de quién es el pedido?
              </span>
              <button
                onClick={() => setShowQuickEntry(true)}
                className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-md text-xs font-bold cursor-pointer whitespace-nowrap transition-colors"
              >
                <i className="ri-user-add-line mr-1" />
                Identificarme
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const modeLabel = orderMode === "dine-in" ? "Comer aquí" : "Para llevar";
  const modeIcon = orderMode === "dine-in" ? "ri-restaurant-line" : "ri-shopping-bag-3-line";
  const modeColor = orderMode === "dine-in" ? "text-amber-600" : "text-teal-600";
  const modeBg = orderMode === "dine-in" ? "bg-amber-50 border-amber-200" : "bg-teal-50 border-teal-200";

  const handleSaveName = () => {
    if (draftName.trim()) setCustomerName(draftName.trim());
    setEditing(false);
  };

  const toggleMode = () => {
    setOrderMode(orderMode === "dine-in" ? "pickup" : "dine-in");
  };

  return (
    <div className={`w-full border-b ${modeBg} transition-colors duration-300`}>
      <div className="w-full px-4 md:px-8 max-w-3xl mx-auto py-2 flex items-center gap-2 flex-wrap">

        {/* Ícono de modo */}
        <div className={`w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 ${
          orderMode === "dine-in" ? "bg-amber-100" : "bg-teal-100"
        }`}>
          <i className={`${modeIcon} text-sm ${modeColor}`} />
        </div>

        {/* Nombre */}
        {editing ? (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditing(false); }}
              autoFocus
              className="flex-1 min-w-0 text-sm font-semibold bg-white border border-gray-300 rounded-md px-2 py-0.5 focus:outline-none focus:border-amber-500"
              placeholder="Tu nombre"
            />
            <button
              onClick={handleSaveName}
              className="w-6 h-6 flex items-center justify-center bg-amber-500 text-white rounded-full cursor-pointer hover:bg-amber-600 flex-shrink-0"
            >
              <i className="ri-check-line text-xs" />
            </button>
            <button
              onClick={() => setEditing(false)}
              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full cursor-pointer flex-shrink-0"
            >
              <i className="ri-close-line text-xs" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <span className="text-sm font-bold text-gray-800 truncate">
              {customerName}
            </span>
            <button
              onClick={() => { setDraftName(customerName); setEditing(true); }}
              className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-gray-500 cursor-pointer flex-shrink-0 transition-colors"
              title="Editar nombre"
            >
              <i className="ri-pencil-line text-xs" />
            </button>
          </div>
        )}

        {/* Separador */}
        <div className="w-px h-4 bg-gray-300 flex-shrink-0" />

        {/* Modo actual + toggle */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-xs font-semibold ${modeColor} whitespace-nowrap`}>
            {modeLabel}
          </span>

          {/* Toggle pill */}
          <button
            onClick={toggleMode}
            title={`Cambiar a ${orderMode === "dine-in" ? "Para llevar" : "Comer aquí"}`}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide cursor-pointer transition-all border whitespace-nowrap ${
              orderMode === "dine-in"
                ? "border-teal-300 text-teal-600 hover:bg-teal-100"
                : "border-amber-300 text-amber-600 hover:bg-amber-100"
            }`}
          >
            <i className={`${orderMode === "dine-in" ? "ri-shopping-bag-3-line" : "ri-restaurant-line"} text-[10px]`} />
            {orderMode === "dine-in" ? "Cambiar a llevar" : "Cambiar a aquí"}
          </button>
        </div>

        {/* Separador */}
        {itemCount > 0 && <div className="w-px h-4 bg-gray-300 flex-shrink-0" />}

        {/* Items en carrito */}
        {itemCount > 0 && (
          <span className="text-xs text-gray-500 flex-shrink-0 whitespace-nowrap">
            <i className="ri-shopping-basket-2-line mr-0.5 text-amber-500" />
            {itemCount} en carrito
          </span>
        )}

        {/* Indicador de sesión activa */}
        <div className="ml-auto flex-shrink-0 flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">Sesión activa</span>
        </div>
      </div>
    </div>
  );
}