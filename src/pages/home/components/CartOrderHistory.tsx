import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";

interface HistoryItem {
  id: number;
  product_name: string;
  size?: string;
  quantity: number;
  unit_price: number;
  folio_number: number;
  delivered: boolean;
  created_at: string;
}

interface HistoryRound {
  folio: number;
  items: HistoryItem[];
  total: number;
  time: string;
  allDelivered: boolean;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CartOrderHistory() {
  const { customerName, customerPhone, orderMode } = useCart();
  const navigate = useNavigate();
  const [rounds, setRounds] = useState<HistoryRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountTotal, setAccountTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Buscar cuenta abierta por nombre o teléfono
      let accountId: number | null = null;

      if (customerName.trim()) {
        const { data: acc } = await supabase
          .from("pos_accounts")
          .select("id")
          .eq("status", "open")
          .ilike("customer_name", customerName.trim())
          .limit(1);
        if (acc && acc.length > 0) accountId = acc[0].id;
      }

      if (!accountId && customerPhone.trim()) {
        const { data: acc } = await supabase
          .from("pos_accounts")
          .select("id")
          .eq("status", "open")
          .ilike("customer_phone", customerPhone.trim())
          .limit(1);
        if (acc && acc.length > 0) accountId = acc[0].id;
      }

      if (!accountId) {
        setRounds([]);
        setAccountTotal(0);
        setLoading(false);
        return;
      }

      const { data: items, error: itemsErr } = await supabase
        .from("pos_account_items")
        .select("id, product_name, size, quantity, unit_price, folio_number, delivered, created_at")
        .eq("account_id", accountId)
        .order("folio_number", { ascending: true })
        .order("id", { ascending: true });

      if (itemsErr) throw itemsErr;

      const allItems = (items ?? []) as HistoryItem[];
      const totalAcc = allItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
      setAccountTotal(totalAcc);

      // Agrupar por ronda
      const folioMap = new Map<number, HistoryItem[]>();
      allItems.forEach((item) => {
        const f = item.folio_number;
        if (!folioMap.has(f)) folioMap.set(f, []);
        folioMap.get(f)!.push(item);
      });

      const built: HistoryRound[] = Array.from(folioMap.entries()).map(([folio, roundItems]) => ({
        folio,
        items: roundItems,
        total: roundItems.reduce((s, i) => s + i.unit_price * i.quantity, 0),
        time: roundItems[0]?.created_at ? formatTime(roundItems[0].created_at) : "",
        allDelivered: roundItems.every((i) => i.delivered),
      }));

      setRounds(built);
    } catch {
      setError("No se pudo cargar el historial");
    } finally {
      setLoading(false);
    }
  }, [customerName, customerPhone]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Suscripción en tiempo real
  useEffect(() => {
    const channel = supabase
      .channel("cart-history-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pos_account_items" },
        () => fetchHistory()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchHistory]);

  // ── Estado vacío: no tiene nombre/teléfono o no hay cuenta abierta ──
  if (!customerName.trim() && !customerPhone.trim()) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <i className="ri-user-line text-2xl text-gray-400" />
        </div>
        <p className="text-gray-600 text-sm font-semibold">Ingresa tu nombre</p>
        <p className="text-gray-400 text-xs mt-1 leading-relaxed max-w-[240px]">
          Escribe tu nombre en la pestaña "Pedido" para ver el historial de tu cuenta
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-xs">Buscando tu cuenta...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-3">
        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
          <i className="ri-wifi-off-line text-red-400 text-xl" />
        </div>
        <p className="text-gray-500 text-sm">{error}</p>
        <button
          onClick={fetchHistory}
          className="text-amber-600 text-xs font-semibold cursor-pointer hover:underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (rounds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <i className="ri-history-line text-2xl text-gray-400" />
        </div>
        <p className="text-gray-600 text-sm font-semibold">Sin rondas previas</p>
        <p className="text-gray-400 text-xs mt-1 leading-relaxed max-w-[240px]">
          {orderMode === "dine-in"
            ? "Cuando envíes tu primer pedido aparecerá aquí"
            : "Tus pedidos anteriores aparecerán aquí"}
        </p>
      </div>
    );
  }

  const totalItems = rounds.reduce((s, r) => s + r.items.reduce((si, i) => si + i.quantity, 0), 0);
  const pendingRounds = rounds.filter((r) => !r.allDelivered).length;

  return (
    <div className="pb-4">
      {/* Resumen de la cuenta */}
      <div className="mx-4 mt-3 mb-4 bg-gray-900 rounded-2xl px-4 py-3.5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-gray-400 text-[10px] uppercase tracking-widest font-bold">Acumulado en cuenta</p>
            <p className="text-amber-400 text-3xl font-black leading-tight">${accountTotal.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-[10px] uppercase tracking-widest font-bold">Rondas</p>
            <p className="text-white text-3xl font-black leading-tight">{rounds.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2 border-t border-gray-700 flex-wrap">
          <span className="text-gray-400 text-xs">{totalItems} producto{totalItems !== 1 ? "s" : ""} pedidos</span>
          {pendingRounds > 0 && (
            <span className="flex items-center gap-1 text-amber-400 text-xs font-bold">
              <i className="ri-loader-2-line animate-spin text-xs" />
              {pendingRounds} en camino
            </span>
          )}
          <button
            onClick={fetchHistory}
            className="ml-auto text-gray-600 hover:text-gray-300 cursor-pointer transition-colors"
            title="Actualizar"
          >
            <i className="ri-refresh-line text-sm" />
          </button>
        </div>
      </div>

      {/* Rondas — más reciente primero */}
      <div className="space-y-3 px-4">
        {[...rounds].reverse().map((round, idx) => {
          const isLatest = idx === 0;
          return (
            <div
              key={round.folio}
              className={`rounded-xl border overflow-hidden ${
                isLatest
                  ? round.allDelivered
                    ? "border-green-200 bg-green-50"
                    : "border-amber-200 bg-amber-50"
                  : "border-gray-100 bg-gray-50"
              }`}
            >
              {/* Header ronda */}
              <div
                className={`flex items-center justify-between px-3 py-2.5 ${
                  isLatest
                    ? round.allDelivered
                      ? "bg-green-100"
                      : "bg-amber-100"
                    : "bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-black px-2.5 py-1 rounded-full ${
                      round.allDelivered
                        ? "bg-green-500 text-white"
                        : isLatest
                        ? "bg-amber-500 text-white"
                        : "bg-gray-300 text-gray-700"
                    }`}
                  >
                    Ronda #{String(round.folio).padStart(2, "0")}
                  </span>
                  {isLatest && !round.allDelivered && (
                    <span className="flex items-center gap-1 text-amber-600 text-[10px] font-bold">
                      <i className="ri-loader-2-line animate-spin" />
                      En camino
                    </span>
                  )}
                  {round.allDelivered && (
                    <span className="flex items-center gap-1 text-green-600 text-[10px] font-semibold">
                      <i className="ri-checkbox-circle-fill" />
                      Entregada
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {round.time && (
                    <span className="text-gray-400 text-[10px]">{round.time}</span>
                  )}
                  <span
                    className={`text-sm font-black ${
                      round.allDelivered
                        ? "text-green-600"
                        : isLatest
                        ? "text-amber-600"
                        : "text-gray-600"
                    }`}
                  >
                    ${round.total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Items de la ronda */}
              <div className="divide-y divide-gray-100">
                {round.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2.5 px-3 py-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        item.delivered
                          ? "bg-green-100 text-green-500"
                          : "bg-amber-100 text-amber-500"
                      }`}
                    >
                      {item.delivered ? (
                        <i className="ri-check-line text-xs" />
                      ) : (
                        <i className="ri-time-line text-xs" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs font-semibold leading-snug ${
                          item.delivered ? "text-gray-400" : "text-gray-800"
                        }`}
                      >
                        {item.quantity > 1 && (
                          <span className="text-amber-500 font-black mr-1">
                            {item.quantity}&times;
                          </span>
                        )}
                        {item.product_name}
                      </p>
                      {item.size && (
                        <p className="text-[10px] text-amber-500 mt-0.5">{item.size}</p>
                      )}
                    </div>
                    <p
                      className={`text-xs font-bold flex-shrink-0 ${
                        item.delivered ? "text-gray-400" : "text-gray-700"
                      }`}
                    >
                      ${(item.unit_price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Total acumulado al final */}
      <div className="mx-4 mt-4 flex items-center justify-between bg-gray-100 rounded-xl px-4 py-3">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
          Total acumulado
        </span>
        <span className="text-lg font-black text-amber-600">${accountTotal.toFixed(2)}</span>
      </div>

      {/* CTA → /cuenta */}
      <div className="mx-4 mt-3">
        <button
          onClick={() => navigate("/cuenta")}
          className="w-full flex items-center justify-center gap-2.5 bg-gray-900 hover:bg-gray-800 active:scale-[0.98] text-white rounded-xl px-4 py-3.5 transition-all cursor-pointer whitespace-nowrap"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-receipt-line text-amber-400 text-base" />
          </div>
          <span className="text-sm font-bold tracking-wide">Ver mi cuenta completa</span>
          <div className="w-5 h-5 flex items-center justify-center ml-auto">
            <i className="ri-arrow-right-line text-gray-400 text-base" />
          </div>
        </button>
        <p className="text-center text-[10px] text-gray-400 mt-2">
          Corte detallado, solicitar cuenta y más
        </p>
      </div>
    </div>
  );
}