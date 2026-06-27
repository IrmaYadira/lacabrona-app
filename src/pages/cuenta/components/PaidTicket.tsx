import { useState, useRef } from 'react';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/b77c803d-575e-40d4-a158-35c12c991a6e/1e56aa27-e144-4e29-bb60-eddac5a8c656_logo-la-cabrona--123.jpg?v=f7c9d62f59fec067f747e7cb302ed285';

const WA_NUMBER = '523348567795';

const METHOD_ICONS: Record<string, string> = {
  cash: 'ri-money-dollar-circle-line',
  transfer: 'ri-bank-line',
  credit_card: 'ri-bank-card-line',
  debit_card: 'ri-bank-card-2-line',
};

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  credit_card: 'Tarjeta de Crédito',
  debit_card: 'Tarjeta de Débito',
};

const METHOD_COLORS: Record<string, string> = {
  cash: 'text-green-400',
  transfer: 'text-amber-400',
  credit_card: 'text-rose-400',
  debit_card: 'text-indigo-400',
};

const METHOD_BG: Record<string, string> = {
  cash: 'bg-green-500/10 border-green-500/30',
  transfer: 'bg-amber-500/10 border-amber-500/30',
  credit_card: 'bg-rose-500/10 border-rose-500/30',
  debit_card: 'bg-indigo-500/10 border-indigo-500/30',
};

interface AccountItem {
  id: number;
  product_name: string;
  size?: string;
  quantity: number;
  unit_price: number;
  folio_number: number;
  delivered: boolean;
  created_at: string;
}

interface PosPayment {
  id: number;
  payment_method: string;
  subtotal: number;
  card_fee: number | null;
  total: number;
  split_count: number | null;
  mixed_payments: Array<{ method: string; amount: number }> | null;
  created_at: string;
}

interface PaidTicketProps {
  spot: string;
  customerName?: string;
  items: AccountItem[];
  payment: PosPayment;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function PaidTicket({ spot, customerName, items, payment }: PaidTicketProps) {
  const [copied, setCopied] = useState(false);
  const ticketRef = useRef<HTMLDivElement | null>(null);

  const folios = [...new Set(items.map((i) => i.folio_number))].sort((a, b) => a - b);
  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const cardFee = payment.card_fee ?? 0;
  const total = payment.total;
  const splitCount = payment.split_count ?? 1;
  const perPerson = splitCount > 1 ? total / splitCount : total;

  const primaryMethod = payment.payment_method;
  const hasMixed = payment.mixed_payments && payment.mixed_payments.length > 1;

  const buildTicketText = (): string => {
    const date = formatDate(payment.created_at);
    const time = formatTime(payment.created_at);
    const lines: string[] = [
      '\uD83C\uDF57 LA CABRONA — Alitas & Beer',
      '─────────────────────────',
      `Mesa: ${spot}`,
      `Fecha: ${date} · ${time}`,
      `Ticket #${payment.id}`,
      '─────────────────────────',
    ];

    if (customerName) {
      lines.push(`Cliente: ${customerName}`);
      lines.push('─────────────────────────');
    }

    folios.forEach((folio) => {
      const folioItems = items.filter((i) => i.folio_number === folio);
      const folioTotal = folioItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
      lines.push(`Ronda #${String(folio).padStart(2, '0')} — $${folioTotal.toFixed(2)}`);
      folioItems.forEach((it) => {
        const sub = (it.unit_price * it.quantity).toFixed(2);
        lines.push(`  ${it.quantity > 1 ? `${it.quantity}x ` : ''}${it.product_name}  $${sub}`);
      });
    });

    lines.push('─────────────────────────');
    lines.push(`Subtotal: $${subtotal.toFixed(2)}`);
    if (cardFee > 0) {
      lines.push(`Cargo terminal: +$${cardFee.toFixed(2)}`);
    }
    lines.push(`TOTAL: $${total.toFixed(2)}`);
    if (hasMixed && payment.mixed_payments) {
      lines.push('Pago mixto:');
      payment.mixed_payments.forEach((p) => {
        lines.push(`  • ${METHOD_LABELS[p.method] ?? p.method}: $${p.amount.toFixed(2)}`);
      });
    } else {
      lines.push(`Pago: ${METHOD_LABELS[primaryMethod] ?? primaryMethod}`);
    }
    if (splitCount > 1) {
      lines.push(`Dividido: ${splitCount} personas · $${perPerson.toFixed(2)} c/u`);
    }
    lines.push('─────────────────────────');
    lines.push('\u00A1Gracias por tu visita! \uD83C\uDF7A');
    lines.push('barlacabrona.com');

    return lines.join('\n');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildTicketText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn('[PaidTicket] clipboard copy failed:', e);
    }
  };

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(buildTicketText());
    window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener');
  };

  const handleWhatsAppBar = () => {
    const msg = encodeURIComponent(buildTicketText());
    window.open(`https://wa.me/${WA_NUMBER}?text=${msg}`, '_blank', 'noopener');
  };

  const handleDownloadImage = async () => {
    if (!ticketRef.current) return;
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(ticketRef.current, {
        backgroundColor: '#111827',
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `Ticket-LaCabrona-${spot}-${payment.id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.warn('[PaidTicket] download image failed:', e);
    }
  };

  return (
    <div className="space-y-3">
      {/* Ticket visual */}
      <div
        ref={ticketRef}
        className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800"
      >
        {/* Header del ticket */}
        <div className="px-5 pt-5 pb-4 text-center border-b border-gray-800">
          <img
            src={LOGO_URL}
            alt="La Cabrona"
            className="w-16 h-16 rounded-full object-cover border-2 border-amber-500 mx-auto mb-3"
            crossOrigin="anonymous"
          />
          <h3
            className="text-white text-xl font-black tracking-widest"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            LA CABRONA
          </h3>
          <p className="text-amber-500 text-xs font-bold tracking-widest uppercase">Alitas & Beer</p>
          <p className="text-gray-600 text-xs mt-1">Zapopan, Jalisco</p>
        </div>

        {/* Info de mesa y fecha */}
        <div className="px-5 py-3 border-b border-gray-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-xs uppercase tracking-wide">Mesa</span>
            <span className="text-white text-sm font-bold">{spot}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-xs uppercase tracking-wide">Fecha</span>
            <span className="text-gray-300 text-xs font-semibold">
              {formatDate(payment.created_at)} · {formatTime(payment.created_at)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-xs uppercase tracking-wide">Ticket</span>
            <span className="text-amber-400 text-xs font-mono font-bold">#{payment.id}</span>
          </div>
          {customerName && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs uppercase tracking-wide">Cliente</span>
              <span className="text-amber-300 text-xs font-semibold">{customerName}</span>
            </div>
          )}
        </div>

        {/* Items por ronda */}
        <div className="px-5 py-3 border-b border-gray-800">
          {folios.map((folio) => {
            const folioItems = items.filter((i) => i.folio_number === folio);
            const folioTotal = folioItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
            return (
              <div key={folio} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-amber-500 text-xs font-black uppercase tracking-wide">
                    Ronda #{String(folio).padStart(2, '0')}
                  </span>
                  <span className="text-gray-400 text-xs font-bold">${folioTotal.toFixed(2)}</span>
                </div>
                <div className="space-y-1">
                  {folioItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <span className="text-gray-300 text-sm flex-1 min-w-0">
                        {item.quantity > 1 && (
                          <span className="text-amber-400 font-bold mr-1">{item.quantity}x</span>
                        )}
                        {item.product_name}
                        {item.size && (
                          <span className="text-gray-500 text-xs italic ml-1">({item.size})</span>
                        )}
                      </span>
                      <span className="text-white text-sm font-bold ml-2 flex-shrink-0">
                        ${(item.unit_price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Totales */}
        <div className="px-5 py-3 border-b border-gray-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-xs uppercase tracking-wide">Subtotal</span>
            <span className="text-gray-300 text-sm font-bold">${subtotal.toFixed(2)}</span>
          </div>
          {cardFee > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs uppercase tracking-wide">Cargo terminal</span>
              <span className="text-amber-400 text-sm font-bold">+${cardFee.toFixed(2)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-gray-800">
            <span className="text-white text-sm font-black uppercase tracking-wide">Total</span>
            <span className="text-amber-400 text-xl font-black">${total.toFixed(2)}</span>
          </div>
          {splitCount > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">
                Por persona ({splitCount})
              </span>
              <span className="text-green-400 text-sm font-bold">${perPerson.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Forma de pago */}
        <div className="px-5 py-3">
          {hasMixed && payment.mixed_payments ? (
            <div className="space-y-2">
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wide mb-2">
                Pago Mixto
              </p>
              {payment.mixed_payments.map((p, idx) => {
                const icon = METHOD_ICONS[p.method] ?? 'ri-money-dollar-circle-line';
                const label = METHOD_LABELS[p.method] ?? p.method;
                const color = METHOD_COLORS[p.method] ?? 'text-gray-400';
                const bg = METHOD_BG[p.method] ?? 'bg-gray-800 border-gray-700';
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border ${bg}`}
                  >
                    <div className="flex items-center gap-2">
                      <i className={`${icon} ${color} text-sm`} />
                      <span className={`text-sm font-bold ${color}`}>{label}</span>
                    </div>
                    <span className="text-white text-sm font-bold">${p.amount.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${
                METHOD_BG[primaryMethod] ?? 'bg-gray-800 border-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <i
                  className={`${METHOD_ICONS[primaryMethod] ?? 'ri-money-dollar-circle-line'} ${
                    METHOD_COLORS[primaryMethod] ?? 'text-gray-400'
                  } text-sm`}
                />
                <span
                  className={`text-sm font-bold ${METHOD_COLORS[primaryMethod] ?? 'text-gray-400'}`}
                >
                  {METHOD_LABELS[primaryMethod] ?? primaryMethod}
                </span>
              </div>
              <span className="text-white text-sm font-bold">${total.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 text-center border-t border-gray-800">
          <p className="text-gray-500 text-xs">\u00A1Gracias por tu visita!</p>
          <p className="text-amber-500 text-xs font-bold mt-1">barlacabrona.com</p>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="space-y-2">
        {/* Guardar en WhatsApp */}
        <button
          onClick={handleWhatsApp}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-green-600 hover:bg-green-700 active:scale-95 text-white rounded-xl text-sm font-black transition-all cursor-pointer whitespace-nowrap"
        >
          <i className="ri-whatsapp-line text-lg" />
          Guardar en mi WhatsApp
        </button>

        {/* Enviar al bar */}
        <button
          onClick={handleWhatsAppBar}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-green-600/15 border border-green-600/40 hover:bg-green-600/25 active:scale-95 text-green-400 rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap"
        >
          <i className="ri-whatsapp-line text-lg" />
          Enviar al bar por WhatsApp
        </button>

        {/* Descargar como imagen */}
        <button
          onClick={handleDownloadImage}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-gray-800 border border-gray-700 hover:bg-gray-700 active:scale-95 text-gray-300 hover:text-white rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap"
        >
          <i className="ri-download-2-line text-base" />
          Guardar como imagen
        </button>

        {/* Copiar texto */}
        <button
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-gray-600 hover:text-gray-400 text-xs font-semibold cursor-pointer transition-colors active:scale-95"
        >
          <i className={copied ? 'ri-check-line text-green-400' : 'ri-file-copy-line'} />
          <span className={copied ? 'text-green-400' : ''}>
            {copied ? '\u00A1Ticket copiado al portapapeles!' : 'Copiar ticket como texto'}
          </span>
        </button>
      </div>
    </div>
  );
}