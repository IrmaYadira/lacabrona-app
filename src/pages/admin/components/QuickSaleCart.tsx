import type { SaleItem } from './QuickSaleMenuPicker';

interface QuickSaleCartProps {
  items: SaleItem[];
  onUpdateQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}

export default function QuickSaleCart({ items, onUpdateQty, onRemove }: QuickSaleCartProps) {
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-center px-4">
        <div className="w-14 h-14 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
          <i className="ri-shopping-basket-line text-2xl text-gray-300" />
        </div>
        <p className="text-gray-400 text-sm font-medium">Carrito vacío</p>
        <p className="text-gray-300 text-xs mt-1">Selecciona productos del menú</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Items */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2 bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
            {/* Quantity controls */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => item.quantity <= 1 ? onRemove(item.id) : onUpdateQty(item.id, item.quantity - 1)}
                className="w-6 h-6 flex items-center justify-center rounded-full border border-amber-200 hover:border-red-400 hover:bg-red-50 text-amber-600 hover:text-red-500 cursor-pointer transition-colors text-xs"
              >
                <i className={item.quantity <= 1 ? 'ri-delete-bin-line' : 'ri-subtract-line'} />
              </button>
              <span className="w-6 text-center text-sm font-bold text-gray-900">{item.quantity}</span>
              <button
                onClick={() => onUpdateQty(item.id, item.quantity + 1)}
                className="w-6 h-6 flex items-center justify-center rounded-full border border-amber-200 hover:border-amber-500 hover:bg-amber-100 text-amber-600 cursor-pointer transition-colors text-xs"
              >
                <i className="ri-add-line" />
              </button>
            </div>

            {/* Product info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 leading-tight truncate">{item.name}</p>
              {item.note && <p className="text-xs text-amber-600 truncate">{item.note}</p>}
            </div>

            {/* Price */}
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-gray-900">MXN${(item.price * item.quantity).toFixed(2)}</p>
              {item.quantity > 1 && <p className="text-xs text-gray-400">MXN${item.price.toFixed(2)} c/u</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Total bar */}
      <div className="border-t border-gray-100 px-3 py-3 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">{count} producto{count !== 1 ? 's' : ''}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total</p>
            <p className="text-2xl font-black text-amber-600">MXN${total.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}