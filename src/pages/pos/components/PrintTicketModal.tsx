import { useRef, useState } from 'react';
import type { PosAccount, PosAccountItem, PaymentMethod } from '../types';
import { AREA_LABELS } from '../types';
// Inline MixedPaymentEntry to break circular dep with CloseAccountModal
interface MixedPaymentEntry { method: PaymentMethod; amount: number; }
import { useBluetoothPrinterContext } from '../context/BluetoothPrinterContext';
import type { EscPosTicketData } from '../hooks/useBluetoothPrinter';
import { detectExtras } from '../utils/extrasPrice';
import { isBarItem } from '../utils/isBarItem';

interface PrintTicketModalProps {
  account: PosAccount;
  items: PosAccountItem[];
  paymentMethod?: PaymentMethod;
  mixedPayments?: MixedPaymentEntry[];
  splitCount?: number;
  total?: number;
  cardFee?: number;
  tip?: number;
  mode: 'comanda' | 'cuenta';
  folioNumber?: number; // solo para comanda de una ronda específica
  onClose: () => void;
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  credit_card: 'Tarjeta de Crédito',
  debit_card: 'Tarjeta de Débito',
};

function formatDateTime(iso?: string) {
  if (!iso) return new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

function formatTimeOnly(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function generateFolioPago(accountId: number) {
  const now = new Date();
  const pad = (n: number, l = 2) => String(n).padStart(l, '0');
  return `LC-${pad(now.getDate())}${pad(now.getMonth() + 1)}${String(now.getFullYear()).slice(2)}-${pad(now.getHours())}${pad(now.getMinutes())}-${String(accountId).padStart(4, '0')}`;
}

const MIXED_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  credit_card: 'Tarjeta Crédito',
  debit_card: 'Tarjeta Débito',
};

// Helper to render item size/notes in ticket — highlights NOTA: prefix + extras con cobro
function renderItemNote(size: string | null | undefined): JSX.Element | null {
  if (!size) return null;
  const extras = detectExtras(size);
  const isNota = size.startsWith('NOTA:');
  return (
    <>
      {isNota ? (
        <div style={{ fontSize: '10px', marginLeft: '8px', fontWeight: 'bold', color: '#000', borderLeft: '2px solid #000', paddingLeft: '4px', marginTop: '2px' }}>
          *** {size} ***
        </div>
      ) : (
        <div style={{ fontSize: '10px', marginLeft: '8px', color: '#444' }}>
          &gt; {size}
        </div>
      )}
      {extras.length > 0 && (
        <div style={{ marginLeft: '8px', marginTop: '2px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {extras.map((ex, idx) => (
            <span key={idx} style={{ fontSize: '10px', fontWeight: 'bold', background: '#fef3c7', border: '1px solid #d97706', borderRadius: '9999px', padding: '1px 5px', color: '#92400e' }}>
              +{ex.label} ${ex.price}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function renderGroupedItems(folioItems: PosAccountItem[]) {
  const kitchenItems = folioItems.filter(i => !isBarItem(i.product_name));
  const barItems = folioItems.filter(i => isBarItem(i.product_name));

  return (
    <div style={{ margin: '4px 0' }}>
      {/* Grupo Cocina */}
      {kitchenItems.length > 0 && (
        <div>
          <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#d97706', textTransform: 'uppercase', letterSpacing: '1px', margin: '6px 0 3px', borderBottom: '1px dashed #d97706', paddingBottom: '2px' }}>
            COCINA
          </div>
          {kitchenItems.map((item, idx) => (
            <div key={idx} style={{ margin: '3px 0' }}>
              <div className="row" style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
                <span style={{ flex: 1 }}>
                  <span className="bold">{item.quantity}x</span> {item.product_name}
                </span>
                <span style={{ whiteSpace: 'nowrap' }}>${(item.unit_price * item.quantity).toFixed(2)}</span>
              </div>
              {renderItemNote(item.size)}
            </div>
          ))}
        </div>
      )}
      {/* Grupo Barra */}
      {barItems.length > 0 && (
        <div>
          <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#0284c7', textTransform: 'uppercase', letterSpacing: '1px', margin: '6px 0 3px', borderBottom: '1px dashed #0284c7', paddingBottom: '2px' }}>
            BARRA
          </div>
          {barItems.map((item, idx) => (
            <div key={idx} style={{ margin: '3px 0' }}>
              <div className="row" style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
                <span style={{ flex: 1 }}>
                  <span className="bold">{item.quantity}x</span> {item.product_name}
                </span>
                <span style={{ whiteSpace: 'nowrap' }}>${(item.unit_price * item.quantity).toFixed(2)}</span>
              </div>
              {renderItemNote(item.size)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PrintTicketModal({
  account,
  items,
  paymentMethod,
  mixedPayments,
  splitCount = 1,
  total,
  cardFee = 0,
  tip = 0,
  mode,
  folioNumber,
  onClose,
}: PrintTicketModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [showBtPanel, setShowBtPanel] = useState(false);
  const bt = useBluetoothPrinterContext();

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const finalTotal = total ?? subtotal;
  const perPerson = splitCount > 1 ? finalTotal / splitCount : finalTotal;

  const folios = [...new Set(items.map(i => i.folio_number))].sort((a, b) => a - b);

  // Folio único de pago — generado una sola vez por render
  const folioPago = mode === 'cuenta' && paymentMethod ? generateFolioPago(account.id) : null;
  const horaImpresion = formatTimeOnly();

  // ── Construir datos para ESC/POS ───────────────────────────────────────
  const buildTicketData = (): EscPosTicketData => {
    const paymentLabel = mixedPayments && mixedPayments.length > 1
      ? 'Pago Mixto'
      : paymentMethod ? PAYMENT_LABELS[paymentMethod] : undefined;
    return {
      mode,
      spot: account.spot,
      area: AREA_LABELS[account.area as keyof typeof AREA_LABELS] ?? account.area,
      customerName: account.customer_name ?? undefined,
      createdAt: account.created_at,
      folioNumber,
      items: items.map(i => ({
        product_name: i.product_name,
        size: i.size ?? undefined,
        quantity: i.quantity,
        unit_price: i.unit_price,
        folio_number: i.folio_number,
      })),
      subtotal,
      finalTotal,
      cardFee,
      splitCount,
      paymentLabel,
      folioPago: folioPago ?? undefined,
      horaImpresion,
    };
  };

  const handleBtPrint = async () => {
    await bt.print(buildTicketData());
  };

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank', 'width=400,height=700');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Ticket - La Cabrona</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              width: 58mm;
              max-width: 58mm;
              margin: 0 auto;
              padding: 3mm;
              color: #000;
              background: #fff;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .big { font-size: 14px; }
            .huge { font-size: 16px; }
            .separator { border-top: 1px dashed #000; margin: 4px 0; }
            .separator-solid { border-top: 2px solid #000; margin: 4px 0; }
            .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 4px; }
            .row .name { flex: 1; }
            .row .price { white-space: nowrap; }
            .folio-header { background: #000; color: #fff; padding: 2px 6px; margin: 4px 0; font-weight: bold; }
            .note { font-size: 10px; margin-left: 8px; color: #444; }
            .total-row { font-size: 13px; font-weight: bold; }
            .per-person { font-size: 11px; font-weight: bold; border: 1px dashed #000; padding: 3px 6px; margin-top: 4px; }
            @media print {
              body { width: 58mm; }
              @page { margin: 0; size: 58mm auto; }
            }
          </style>
        </head>
        <body>
          ${printContent}
          <script>window.onload = function() { window.print(); setTimeout(function(){ window.close(); }, 500); }<\/script>
        </body>
      </html>
    `);
    win.document.close();
  };

  // ── Status helpers ─────────────────────────────────────────────────────
  const btStatusLabel: Record<string, string> = {
    idle: 'Sin conectar',
    connecting: 'Conectando…',
    connected: `Conectada`,
    printing: 'Imprimiendo…',
    success: '¡Impreso!',
    error: 'Error',
    unsupported: 'No compatible',
  };
  const btStatusColor: Record<string, string> = {
    idle: 'text-gray-400',
    connecting: 'text-amber-400',
    connected: 'text-green-400',
    printing: 'text-amber-400',
    success: 'text-green-400',
    error: 'text-red-400',
    unsupported: 'text-gray-500',
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-sm max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">Vista de Impresión</h3>
            <p className="text-xs text-gray-500">
              {mode === 'comanda' ? 'Comanda de cocina/bar' : 'Cuenta del cliente'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer">
            <i className="ri-close-line text-gray-500" />
          </button>
        </div>

        {/* Sello PAGADO visible en pantalla */}
        {folioPago && (
          <div className="mx-5 mt-4 mb-0 bg-green-50 border-2 border-green-500 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className="ri-checkbox-circle-fill text-white text-2xl" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-green-700 font-black text-lg tracking-widest">PAGADO</p>
                <p className="text-green-600 text-xs font-mono font-bold">{folioPago}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-green-800 font-black text-xl">${finalTotal.toFixed(2)}</p>
                <p className="text-green-600 text-xs">{horaImpresion}</p>
              </div>
            </div>
            {paymentMethod && (
              <div className="mt-2 pt-2 border-t border-green-200 flex items-center justify-between">
                <span className="text-xs text-green-600">
                  {mixedPayments && mixedPayments.length > 1 ? 'Pago Mixto' : PAYMENT_LABELS[paymentMethod]}
                </span>
                {splitCount > 1 && (
                  <span className="text-xs text-green-600 font-semibold">
                    {splitCount} personas · ${perPerson.toFixed(2)} c/u
                  </span>
                )}
                <span className="text-xs text-green-500 italic">Muestra este sello al cliente</span>
              </div>
            )}
          </div>
        )}

        {/* ── Panel Bluetooth 58mm ── */}
        <div className="mx-5 mt-4 mb-0">
          <button
            onClick={() => setShowBtPanel(p => !p)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-900 hover:bg-gray-800 rounded-xl cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-7 h-7 flex items-center justify-center rounded-lg ${
                bt.status === 'connected' || bt.status === 'printing' || bt.status === 'success'
                  ? 'bg-green-500' : bt.status === 'error' ? 'bg-red-500' : 'bg-gray-700'
              }`}>
                <i className="ri-bluetooth-line text-white text-sm" />
              </div>
              <div className="text-left">
                <p className="text-white text-xs font-bold leading-tight">
                  {bt.status === 'connected' || bt.status === 'printing' || bt.status === 'success'
                    ? bt.deviceName ?? 'Impresora BT'
                    : 'Impresora Bluetooth 58mm'}
                </p>
                <p className={`text-[10px] leading-tight ${btStatusColor[bt.status]}`}>
                  {bt.status === 'connected' || bt.status === 'printing' || bt.status === 'success'
                    ? btStatusLabel[bt.status]
                    : 'Toca para configurar'}
                </p>
              </div>
            </div>
            {showBtPanel
              ? <i className="ri-arrow-up-s-line text-gray-400" />
              : <i className="ri-arrow-down-s-line text-gray-400" />
            }
          </button>

          {showBtPanel && (
            <div className="bg-gray-900 rounded-b-xl px-4 pb-3 pt-2 space-y-2 -mt-1 border-t border-gray-700/50">

              {/* Info de soporte */}
              {!bt.isSupported ? (
                <div className="flex items-start gap-2 bg-red-900/30 border border-red-500/30 rounded-xl px-3 py-2.5">
                  <i className="ri-error-warning-line text-red-400 text-base flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-300 text-xs font-bold">Navegador no compatible</p>
                    <p className="text-red-400 text-[10px] mt-0.5">
                      Web Bluetooth requiere Chrome o Edge en Android/Desktop. Safari y Firefox no son compatibles.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Estado actual */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        bt.status === 'connected' ? 'bg-green-400 animate-pulse' :
                        bt.status === 'printing'  ? 'bg-amber-400 animate-pulse' :
                        bt.status === 'success'   ? 'bg-green-400' :
                        bt.status === 'error'     ? 'bg-red-400' : 'bg-gray-600'
                      }`} />
                      <span className={`text-xs font-semibold ${btStatusColor[bt.status]}`}>
                        {btStatusLabel[bt.status]}
                        {bt.status === 'connected' && bt.deviceName && ` · ${bt.deviceName}`}
                      </span>
                    </div>
                    {(bt.status === 'connected' || bt.status === 'success') && (
                      <button
                        onClick={bt.disconnect}
                        className="text-[10px] text-gray-500 hover:text-red-400 cursor-pointer transition-colors whitespace-nowrap"
                      >
                        Desconectar
                      </button>
                    )}
                  </div>

                  {/* Error */}
                  {bt.status === 'error' && bt.errorMsg && (
                    <div className="bg-red-900/30 border border-red-500/30 rounded-xl px-3 py-2">
                      <p className="text-red-300 text-[10px] leading-relaxed">{bt.errorMsg}</p>
                    </div>
                  )}

                  {/* Instrucciones cuando no está conectado */}
                  {(bt.status === 'idle' || bt.status === 'error') && (
                    <div className="bg-gray-800 rounded-xl px-3 py-2 space-y-1">
                      <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide">Cómo conectar</p>
                      <p className="text-gray-500 text-[10px] leading-relaxed">
                        1. Enciende la impresora y activa su Bluetooth.<br />
                        2. Toca "Conectar" — el navegador mostrará la lista de dispositivos.<br />
                        3. Selecciona tu impresora (ej. "XP-58", "MTP-II", "Goojprt").<br />
                        4. Listo. La conexión se recuerda durante la sesión.
                      </p>
                    </div>
                  )}

                  {/* Botones */}
                  <div className="flex gap-2">
                    {bt.status === 'idle' || bt.status === 'error' ? (
                      <button
                        onClick={bt.connect}
                        disabled={bt.status === 'connecting'}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap"
                      >
                        <i className="ri-bluetooth-connect-line" />
                        Conectar impresora
                      </button>
                    ) : bt.status === 'connecting' ? (
                      <div className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-800 rounded-xl">
                        <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-amber-400 text-xs font-semibold">Buscando…</span>
                      </div>
                    ) : (
                      <button
                        onClick={handleBtPrint}
                        disabled={bt.status === 'printing'}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${
                          bt.status === 'printing'
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            : bt.status === 'success'
                            ? 'bg-green-600 hover:bg-green-500 text-white'
                            : 'bg-green-500 hover:bg-green-400 text-white active:scale-95'
                        }`}
                      >
                        {bt.status === 'printing' ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                            Imprimiendo…
                          </>
                        ) : bt.status === 'success' ? (
                          <><i className="ri-checkbox-circle-fill" />¡Impreso!</>
                        ) : (
                          <><i className="ri-printer-line" />Imprimir por BT</>
                        )}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Ticket preview */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-4 font-mono text-xs text-black mx-auto" style={{ maxWidth: '220px' }}>
            <div ref={printRef}>
              {/* Encabezado */}
              <div className="center bold">
                <div className="huge bold">LA CABRONA</div>
                <div>Alitas &amp; Beer</div>
                <div>Sinaloa 690, Zapopan</div>
                <div>Tel: 33-4856-7795</div>
              </div>

              <div className="separator-solid" style={{ borderTop: '2px solid #000', margin: '6px 0' }} />

              {/* Info de mesa/cuenta */}
              <div className="center">
                <div className="big bold">{mode === 'comanda' ? '*** COMANDA ***' : '*** CUENTA ***'}</div>
              </div>
              <div className="separator" style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

              <div className="row" style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span>Mesa:</span>
                <span className="bold">{account.spot}</span>
              </div>
              <div className="row" style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span>Area:</span>
                <span>{AREA_LABELS[account.area as keyof typeof AREA_LABELS] ?? account.area}</span>
              </div>
              {account.customer_name && (
                <div className="row" style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                  <span>Cliente:</span>
                  <span className="bold">{account.customer_name}</span>
                </div>
              )}
              <div className="row" style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span>Fecha:</span>
                <span>{formatDateTime(account.created_at)}</span>
              </div>
              <div className="row" style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span>Impresion:</span>
                <span>{formatDateTime()}</span>
              </div>

              <div className="separator-solid" style={{ borderTop: '2px solid #000', margin: '6px 0' }} />

              {/* Items agrupados por ronda - separados Cocina / Barra */}
              {mode === 'comanda' && folioNumber !== undefined ? (
                <>
                  <div className="folio-header" style={{ background: '#000', color: '#fff', padding: '2px 6px', margin: '4px 0', fontWeight: 'bold' }}>
                    RONDA #{String(folioNumber).padStart(2, '0')}
                  </div>
                  {renderGroupedItems(items.filter(i => i.folio_number === folioNumber))}
                </>
              ) : (
                folios.map(folio => {
                  const folioItems = items.filter(i => i.folio_number === folio);
                  const folioTotal = folioItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
                  return (
                    <div key={folio}>
                      <div className="folio-header" style={{ background: '#000', color: '#fff', padding: '2px 6px', margin: '4px 0', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                        <span>RONDA #{String(folio).padStart(2, '0')}</span>
                        <span>${folioTotal.toFixed(2)}</span>
                      </div>
                      {renderGroupedItems(folioItems)}
                    </div>
                  );
                })
              )}

              <div className="separator-solid" style={{ borderTop: '2px solid #000', margin: '6px 0' }} />

              {/* Totales */}
              <div>
                <div className="row" style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {cardFee > 0 && (
                  <div className="row" style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                    <span>Cargo terminal (3%):</span>
                    <span>+${cardFee.toFixed(2)}</span>
                  </div>
                )}
                {tip > 0 && (
                  <div className="row" style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                    <span>Propina:</span>
                    <span>+${tip.toFixed(2)}</span>
                  </div>
                )}
                <div className="separator" style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />
                <div className="row total-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', margin: '4px 0' }}>
                  <span>TOTAL:</span>
                  <span>${finalTotal.toFixed(2)}</span>
                </div>
                {splitCount > 1 && (
                  <div className="per-person" style={{ border: '1px dashed #000', padding: '3px 6px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    <span>Por persona ({splitCount}):</span>
                    <span>${perPerson.toFixed(2)}</span>
                  </div>
                )}
                {mixedPayments && mixedPayments.length > 0 ? (
                  <div style={{ margin: '4px 0' }}>
                    <div className="bold" style={{ marginBottom: '3px' }}>PAGOS MIXTOS:</div>
                    {mixedPayments.map((p, idx) => {
                      const fee = (['credit_card', 'debit_card'] as PaymentMethod[]).includes(p.method)
                        ? p.amount * 0.03
                        : 0;
                      return (
                        <div key={idx} className="row" style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0', paddingLeft: '8px' }}>
                          <span>{MIXED_METHOD_LABELS[p.method]}:</span>
                          <span className="bold">${(p.amount + fee).toFixed(2)}{fee > 0 ? ` (+$${fee.toFixed(2)})` : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : paymentMethod ? (
                  <div className="row" style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                    <span>Forma de pago:</span>
                    <span className="bold">{PAYMENT_LABELS[paymentMethod]}</span>
                  </div>
                ) : null}
                {(paymentMethod === 'transfer' && !mixedPayments) && (
                  <div style={{ border: '1px dashed #000', padding: '4px 6px', margin: '6px 0' }}>
                    <div className="bold center" style={{ textAlign: 'center', marginBottom: '3px' }}>DATOS TRANSFERENCIA</div>
                    <div className="row" style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                      <span>Banco:</span><span className="bold">Inbursa</span>
                    </div>
                    <div className="row" style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                      <span>Titular:</span><span className="bold">Irma Leal</span>
                    </div>
                    <div style={{ margin: '2px 0' }}>
                      <div>CLABE:</div>
                      <div className="bold" style={{ letterSpacing: '1px' }}>036320500328209850</div>
                    </div>
                    <div style={{ margin: '4px 0 2px', fontSize: '10px' }}>
                      WA: 3348567795
                    </div>
                  </div>
                )}
              </div>

              <div className="separator-solid" style={{ borderTop: '2px solid #000', margin: '6px 0' }} />

              {/* Sello PAGADO */}
              {folioPago && (
                <div style={{ border: '3px solid #000', borderRadius: '4px', padding: '6px 8px', margin: '6px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'black', letterSpacing: '4px', fontFamily: 'Courier New' }}>
                    PAGADO
                  </div>
                  <div style={{ fontSize: '10px', marginTop: '3px' }}>
                    Folio: <strong>{folioPago}</strong>
                  </div>
                  <div style={{ fontSize: '10px' }}>
                    Hora: <strong>{horaImpresion}</strong>
                  </div>
                  {paymentMethod && (
                    <div style={{ fontSize: '10px', marginTop: '2px' }}>
                      Forma: <strong>{mixedPayments && mixedPayments.length > 1 ? 'Pago Mixto' : PAYMENT_LABELS[paymentMethod]}</strong>
                    </div>
                  )}
                  {splitCount > 1 && (
                    <div style={{ fontSize: '10px' }}>
                      Dividido: <strong>{splitCount} personas</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Pie de ticket */}
              <div className="center">
                <div>Gracias por su visita!</div>
                <div>Vuelva pronto</div>
                <div style={{ marginTop: '4px', fontSize: '9px', color: '#555' }}>
                  Este no es un comprobante fiscal
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors whitespace-nowrap"
          >
            Cancelar
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-2"
          >
            <i className="ri-printer-line text-lg" />
            Imprimir (PDF)
          </button>
        </div>
      </div>
    </div>
  );
}