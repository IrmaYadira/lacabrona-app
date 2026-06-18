interface WhatsAppFloatProps {
  onOrderNow?: () => void;
}

export default function WhatsAppFloat({ onOrderNow }: WhatsAppFloatProps) {
  return (
    <button
      type="button"
      onClick={onOrderNow}
      className="fixed bottom-6 left-5 z-50 flex items-center gap-3 bg-amber-500 hover:bg-amber-600 text-white px-6 py-4 rounded-full transition-all duration-300 cursor-pointer whitespace-nowrap"
      aria-label="Hacer pedido"
    >
      <div className="w-7 h-7 flex items-center justify-center">
        <i className="ri-restaurant-line text-2xl" />
      </div>
      <span className="text-base font-bold">Pedir ahora</span>
      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
    </button>
  );
}