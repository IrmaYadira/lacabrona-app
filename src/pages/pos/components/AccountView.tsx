import { useState, useEffect, useCallback, useRef } from 'react';
import { supabasePos } from '../supabasePos';
import type { PosAccount, PosAccountItem, PaymentMethod } from '../types';
import { AREA_LABELS } from '../types';
import { REWARD_TIERS } from '@/hooks/useLoyaltyRewards';
import MenuPickerModal, { type CartEntry } from './MenuPickerModal';
import CloseAccountModal, { type MixedPaymentEntry } from './CloseAccountModal';
import PrintTicketModal from './PrintTicketModal';
import MergeAccountModal from './MergeAccountModal';
import CustomerHistoryPanel from './CustomerHistoryPanel';
import ItemHistoryPanel from './ItemHistoryPanel';
import YaSabeMenu from './YaSabeMenu';
import { detectExtras } from '../utils/extrasPrice';
import { useAccountViewData } from '../hooks/useAccountViewData';
import { sendPushNotification } from '@/hooks/usePushNotifications';
import { deductStockOnSale } from '../utils/inventory';

interface AccountViewProps {
  accountId: number;
  spotLabel: string;
  areaLabel: string;
  onBack: () => void;
  onAccountClosed: () => void;
  onGoToAccount?: (accountId: number) => void;
  autoOpenClose?: boolean;
  waiterName?: string;
}

type OrderMode = 'new_round' | 'add_to_current' | 'add_to_specific';

function useElapsedTime(createdAt?: string) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!createdAt) return;
    const update = () => {
      const diff = Date.now() - new Date(createdAt).getTime();
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      setElapsed(hrs > 0 ? `${hrs}h ${remMins}m` : `${mins}m`);
    };
    update();
    const iv = setInterval(update, 30000);
    return () => clearInterval(iv);
  }, [createdAt]);
  return elapsed;
}

function getElapsedColor(createdAt?: string) {
  if (!createdAt) return 'text-gray-400';
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (mins >= 120) return 'text-red-500 font-bold';
  if (mins >= 60) return 'text-orange-500 font-semibold';
  return 'text-gray-400';
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function minutesSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

export default function AccountView({ accountId, spotLabel, areaLabel, onBack, onAccountClosed, onGoToAccount, autoOpenClose, waiterName }: AccountViewProps) {
  const {
    account,
    items,
    setItems,
    loading,
    fetchAccount,
    recentEvents,
    customerSelfie,
    customerLoyaltyPts,
    selfieImgError,
    setSelfieImgError,
    autoCloseTriggered,
  } = useAccountViewData(accountId);

  const [showModeSelector, setShowModeSelector] = useState(false);
  const [orderMode, setOrderMode] = useState<OrderMode | null>(null);
  const [targetFolio, setTargetFolio] = useState<number | null>(null);
  const [showClose, setShowClose] = useState(false);
  const [showIncompleteWarning, setShowIncompleteWarning] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [printFolio, setPrintFolio] = useState<number | undefined>(undefined);
  const [printItems, setPrintItems] = useState<PosAccountItem[]>([]);
  const [closedSummary, setClosedSummary] = useState<{ total: number; method: string; split: number } | null>(null);
  const [clientPhone, setClientPhone] = useState('');
  const [showMerge, setShowMerge] = useState(false);
  const [editNoteItem, setEditNoteItem] = useState<{ id: number; currentNote: string } | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  // Modal para editar/agregar producto manual
  const [editItemModal, setEditItemModal] = useState<{
    id?: number;
    name: string;
    price: number;
    quantity: number;
    note: string;
    folio_number?: number;
  } | null>(null);
  // Notas internas de la cuenta
  const [internalNote, setInternalNote] = useState('');
  const internalNoteInitRef = useRef(false);
  useEffect(() => {
    if (account && !internalNoteInitRef.current) {
      setInternalNote(account.notes ?? '');
      internalNoteInitRef.current = true;
    }
  }, [account]);
  const [editingNote, setEditingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [historyItem, setHistoryItem] = useState<{ id: number; name: string } | null>(null);
  // Undo: guarda la última acción reversible
  const [undoAction, setUndoAction] = useState<{
    label: string;
    restore: () => Promise<void>;
  } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showRecentEvents, setShowRecentEvents] = useState(false);

  // ── Funciones helpers ──
  const handleRequestClose = () => {
    const undelivered = items.filter(i => !i.delivered).length;
    if (undelivered > 0) {
      setShowIncompleteWarning(true);
    } else {
      setShowClose(true);
    }
  };

  // Auto-abrir modal de cierre cuando viene desde una llamada de cobro
  useEffect(() => {
    if (autoOpenClose && !loading && account && !autoCloseTriggered.current) {
      autoCloseTriggered.current = true;
      // Pequeño delay para que el UI termine de renderizar
      const timer = setTimeout(() => {
        handleRequestClose();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoOpenClose, loading, account]);

  const sendComandaWhatsApp = async (folioNumber: number, entries: CartEntry[], accountData: PosAccount, isAddition: boolean) => {
    const barPhone = '5213348567795';
    const folioTotal = entries.reduce((s, e) => s + e.menuItem.price * e.quantity, 0);
    const areaLabel = AREA_LABELS[accountData.area as keyof typeof AREA_LABELS] ?? accountData.area;
    const prefix = isAddition
      ? `➕ *AGREGA A RONDA #${String(folioNumber).padStart(2, '0')}*`
      : `🍗 *NUEVA RONDA #${String(folioNumber).padStart(2, '0')}*`;
    let msg = `${prefix}\n`;
    msg += `📍 *${accountData.spot}* (${areaLabel})\n`;
    if (accountData.customer_name) msg += `👤 *Cliente:* ${accountData.customer_name}\n`;
    msg += `\n`;
    entries.forEach(e => {
      msg += `  • ${e.quantity}x ${e.menuItem.name}`;
      if (e.note) msg += ` _(${e.note})_`;
      msg += ` — $${(e.menuItem.price * e.quantity).toFixed(2)}\n`;
    });
    msg += `\n*Subtotal: $${folioTotal.toFixed(2)}*\n`;
    msg += `⏰ ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}\n`;
    msg += `\n_La Cabrona POS_`;

    window.open(`https://wa.me/${barPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    setTimeout(() => {
      window.open(`https://wa.me/523316108329?text=${encodeURIComponent(msg)}`, '_blank');
    }, 800);

    // Guardar log del ticket enviado
    await supabasePos.from('pos_account_events').insert({
      account_id: accountData.id,
      customer_id: accountData.customer_id ?? null,
      event_type: 'whatsapp_ticket',
      description: isAddition
        ? `Agrega a Ronda #${String(folioNumber).padStart(2, '0')} — ${accountData.customer_name || accountData.spot}`
        : `Nueva Ronda #${String(folioNumber).padStart(2, '0')} — ${accountData.customer_name || accountData.spot}`,
      metadata: {
        folio_number: folioNumber,
        is_addition: isAddition,
        spot: accountData.spot,
        area: accountData.area,
        area_label: areaLabel,
        customer_name: accountData.customer_name ?? null,
        zona: accountData.zona ?? null,
        subtotal: folioTotal,
        items: entries.map(e => ({
          name: e.menuItem.name,
          quantity: e.quantity,
          unit_price: e.menuItem.price,
          note: e.note || null,
        })),
        message_text: msg,
        sent_at: new Date().toISOString(),
      },
    });
  };

  const handleOpenOrderMenu = () => {
    if (!account) return;
    // Si no hay rondas aún, directo a nueva ronda
    if ((account.folio_counter ?? 0) === 0) {
      setOrderMode('new_round');
      return;
    }
    // Si hay rondas, mostrar selector
    setShowModeSelector(true);
  };

  const handleSelectMode = (mode: OrderMode, folio?: number) => {
    setShowModeSelector(false);
    setOrderMode(mode);
    if (folio !== undefined) setTargetFolio(folio);
    else setTargetFolio(null);
  };

  const handleConfirmComanda = async (entries: CartEntry[]) => {
    if (!account) return;

    if (orderMode === 'add_to_current' || orderMode === 'add_to_specific') {
      const currentFolio = orderMode === 'add_to_specific' && targetFolio !== null
        ? targetFolio
        : (account.folio_counter ?? 1);
      const inserts = entries.map(entry => ({
        account_id: accountId,
        product_name: entry.menuItem.name,
        size: entry.note || null,
        quantity: entry.quantity,
        unit_price: entry.menuItem.price,
        folio_number: currentFolio,
      }));
      await supabasePos.from('pos_account_items').insert(inserts);
      await deductStockOnSale(
        entries.map(e => ({ product_name: e.menuItem.name, quantity: e.quantity })),
        { accountId: account.id, spot: account.spot, folio: currentFolio }
      );
      const folioTotal = entries.reduce((s, e) => s + e.menuItem.price * e.quantity, 0);
      sendPushNotification(
        account.id,
        'Se agregó a tu ronda actual 🍺',
        `Ronda #${String(currentFolio).padStart(2, '0')}: ${entries.map(e => `${e.quantity}x ${e.menuItem.name}`).join(', ')} · Subtotal $${folioTotal.toFixed(2)}`,
        { tag: `add-${account.id}-${currentFolio}`, data: { url: `/cuenta?id=${account.id}` } }
      ).catch(() => {});
      setOrderMode(null);
      setTargetFolio(null);
      fetchAccount();
      sendComandaWhatsApp(currentFolio, entries, account, true);
      // Mostrar ticket de comanda para imprimir
      const comandaItems: PosAccountItem[] = entries.map((e, idx) => ({
        id: idx,
        account_id: accountId,
        product_name: e.menuItem.name,
        size: e.note || undefined,
        quantity: e.quantity,
        unit_price: e.menuItem.price,
        folio_number: currentFolio,
        created_at: new Date().toISOString(),
      }));
      setPrintItems(comandaItems);
      setPrintFolio(currentFolio);
      setShowPrint(true);
    } else {
      const newFolio = (account.folio_counter ?? 0) + 1;
      await supabasePos
        .from('pos_accounts')
        .update({ folio_counter: newFolio, updated_at: new Date().toISOString() })
        .eq('id', accountId);
      const inserts = entries.map(entry => ({
        account_id: accountId,
        product_name: entry.menuItem.name,
        size: entry.note || null,
        quantity: entry.quantity,
        unit_price: entry.menuItem.price,
        folio_number: newFolio,
      }));
      await supabasePos.from('pos_account_items').insert(inserts);
      await deductStockOnSale(
        entries.map(e => ({ product_name: e.menuItem.name, quantity: e.quantity })),
        { accountId: account.id, spot: account.spot, folio: newFolio }
      );
      const folioTotal = entries.reduce((s, e) => s + e.menuItem.price * e.quantity, 0);
      sendPushNotification(
        account.id,
        'Nueva ronda agregada a tu cuenta 🍗',
        `Ronda #${String(newFolio).padStart(2, '0')}: ${entries.map(e => `${e.quantity}x ${e.menuItem.name}`).join(', ')} · Subtotal $${folioTotal.toFixed(2)}`,
        { tag: `newround-${account.id}-${newFolio}`, data: { url: `/cuenta?id=${account.id}` } }
      ).catch(() => {});
      setOrderMode(null);
      setTargetFolio(null);
      fetchAccount();
      sendComandaWhatsApp(newFolio, entries, account, false);
      // Mostrar ticket de comanda para imprimir
      const comandaItems: PosAccountItem[] = entries.map((e, idx) => ({
        id: idx,
        account_id: accountId,
        product_name: e.menuItem.name,
        size: e.note || undefined,
        quantity: e.quantity,
        unit_price: e.menuItem.price,
        folio_number: newFolio,
        created_at: new Date().toISOString(),
      }));
      setPrintItems(comandaItems);
      setPrintFolio(newFolio);
      setShowPrint(true);
    }
  };

  const triggerUndo = useCallback((label: string, restore: () => Promise<void>) => {
    // Cancelar undo anterior si hay uno en curso
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoAction({ label, restore });
    undoTimerRef.current = setTimeout(() => {
      setUndoAction(null);
    }, 6000);
  }, []);

  const handleUndo = useCallback(async () => {
    if (!undoAction) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    await undoAction.restore();
    setUndoAction(null);
    fetchAccount();
  }, [undoAction, fetchAccount]);

  const handleUpdateQty = async (itemId: number, qty: number) => {
    const prevItem = items.find(i => i.id === itemId);
    if (qty <= 0) {
      // Primero quitar del estado local (optimista)
      setItems(prev => prev.filter(i => i.id !== itemId));
      await supabasePos.from('pos_account_items').delete().eq('id', itemId);
      if (prevItem) {
        await supabasePos.from('pos_account_events').insert({
          account_id: accountId,
          item_id: itemId,
          event_type: 'item_deleted',
          description: `Eliminado: ${prevItem.product_name} (era ${prevItem.quantity}x)`,
          metadata: { product_name: prevItem.product_name, prev_qty: prevItem.quantity, folio: prevItem.folio_number },
        });
        // Ofrecer Deshacer — re-inserta el ítem
        triggerUndo(
          `"${prevItem.product_name}" eliminado`,
          async () => {
            await supabasePos.from('pos_account_items').insert({
              account_id: accountId,
              product_name: prevItem.product_name,
              size: prevItem.size ?? null,
              quantity: prevItem.quantity,
              unit_price: prevItem.unit_price,
              folio_number: prevItem.folio_number,
            });
          }
        );
      }
    } else {
      const prevQty = prevItem?.quantity;
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity: qty } : i));
      await supabasePos.from('pos_account_items').update({ quantity: qty }).eq('id', itemId);
      if (prevItem && prevQty !== undefined && prevQty !== qty) {
        await supabasePos.from('pos_account_events').insert({
          account_id: accountId,
          item_id: itemId,
          event_type: 'qty_changed',
          description: `Cantidad cambiada: ${prevItem.product_name} · ${prevQty} → ${qty}`,
          metadata: { product_name: prevItem.product_name, prev_qty: prevQty, new_qty: qty, folio: prevItem.folio_number },
        });
        // Ofrecer Deshacer — vuelve a la cantidad anterior
        triggerUndo(
          `${prevItem.product_name}: ${prevQty}x → ${qty}x`,
          async () => {
            await supabasePos.from('pos_account_items').update({ quantity: prevQty }).eq('id', itemId);
          }
        );
      }
    }
    fetchAccount();
  };

  const handleEditNote = (itemId: number, currentNote: string) => {
    setEditNoteItem({ id: itemId, currentNote });
    setEditNoteText(currentNote);
  };

  const handleOpenEditItem = (item: PosAccountItem) => {
    setEditItemModal({
      id: item.id,
      name: item.product_name,
      price: item.unit_price,
      quantity: item.quantity,
      note: item.size ?? '',
      folio_number: item.folio_number,
    });
  };

  const handleOpenAddManual = (folioNum?: number) => {
    setEditItemModal({
      name: '',
      price: 0,
      quantity: 1,
      note: '',
      folio_number: folioNum ?? (account?.folio_counter ?? 0) > 0 ? account?.folio_counter : 1,
    });
  };

  const handleSaveItemEdit = async () => {
    if (!editItemModal || !account) return;
    const { id, name, price, quantity, note, folio_number } = editItemModal;
    const folioNum = folio_number ?? (account.folio_counter ?? 0) > 0 ? (account.folio_counter ?? 1) : 1;

    if (id) {
      // Editar item existente
      const prevItem = items.find(i => i.id === id);
      await supabasePos
        .from('pos_account_items')
        .update({
          product_name: name.trim(),
          unit_price: price,
          quantity,
          size: note.trim() || null,
        })
        .eq('id', id);
      await supabasePos.from('pos_account_events').insert({
        account_id: accountId,
        item_id: id,
        event_type: 'item_edited',
        description: `Editado: ${prevItem?.product_name ?? name} — ${quantity}x · $${price.toFixed(2)}${note ? ` · ${note}` : ''}`,
        metadata: {
          product_name: name,
          prev_name: prevItem?.product_name,
          prev_price: prevItem?.unit_price,
          prev_qty: prevItem?.quantity,
          prev_note: prevItem?.size,
          new_price: price,
          new_qty: quantity,
          new_note: note || null,
          folio: folioNum,
        },
      });
      // Push notification al cliente
      sendPushNotification(
        account.id,
        'Se modificó tu pedido 📝',
        `${name} — ${quantity}x · $${(price * quantity).toFixed(2)}${note ? ` · ${note}` : ''}`,
        { tag: `edited-${account.id}-${id}`, data: { url: `/cuenta?id=${account.id}` } }
      ).catch(() => {});
    } else {
      // Agregar producto manual nuevo
      const { data: inserted } = await supabasePos
        .from('pos_account_items')
        .insert({
          account_id: accountId,
          product_name: name.trim(),
          unit_price: price,
          quantity,
          size: note.trim() || null,
          folio_number: folioNum,
        })
        .select('id');
      const insertedId = inserted?.[0]?.id;
      await supabasePos.from('pos_account_events').insert({
        account_id: accountId,
        item_id: insertedId ?? null,
        event_type: 'item_added_manual',
        description: `Agregado manual: ${name} — ${quantity}x · $${price.toFixed(2)}${note ? ` · ${note}` : ''}`,
        metadata: {
          product_name: name,
          unit_price: price,
          quantity,
          note: note || null,
          folio: folioNum,
        },
      });
      // Push notification al cliente
      sendPushNotification(
        account.id,
        'Se agregó a tu cuenta 🍗',
        `${name} — ${quantity}x · $${(price * quantity).toFixed(2)}${note ? ` · ${note}` : ''}`,
        { tag: `manual-${account.id}-${Date.now()}`, data: { url: `/cuenta?id=${account.id}` } }
      ).catch(() => {});
    }

    setEditItemModal(null);
    fetchAccount();
  };

  const handleSaveNote = async () => {
    if (!editNoteItem) return;
    const prevItem = items.find(i => i.id === editNoteItem.id);
    await supabasePos
      .from('pos_account_items')
      .update({ size: editNoteText.trim() || null })
      .eq('id', editNoteItem.id);
    await supabasePos.from('pos_account_events').insert({
      account_id: accountId,
      item_id: editNoteItem.id,
      event_type: 'note_changed',
      description: editNoteText.trim()
        ? `Nota editada: ${prevItem?.product_name ?? ''} · "${editNoteItem.currentNote || 'sin nota'}" → "${editNoteText.trim()}"`
        : `Nota eliminada: ${prevItem?.product_name ?? ''} (era "${editNoteItem.currentNote}")`,
      metadata: {
        product_name: prevItem?.product_name,
        prev_note: editNoteItem.currentNote || null,
        new_note: editNoteText.trim() || null,
        folio: prevItem?.folio_number,
      },
    });
    setEditNoteItem(null);
    fetchAccount();
  };

  const handleSaveInternalNote = async (note: string) => {
    setSavingNote(true);
    await supabasePos
      .from('pos_accounts')
      .update({ notes: note.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', accountId);
    setSavingNote(false);
    setEditingNote(false);
  };

  const handleCloseAccount = async (
    method: PaymentMethod,
    splitCount: number,
    total: number,
    fee: number,
    mixedPayments?: MixedPaymentEntry[],
    tip?: number,
    closedByWaiter?: string
  ) => {
    // Refrescar account actual para evitar datos stale del closure
    const { data: freshAccount } = await supabasePos
      .from('pos_accounts')
      .select('*, pos_account_items(*), pos_customers(id, loyalty_points)')
      .eq('id', accountId)
      .eq('status', 'open')
      .maybeSingle();
    const currentAccount = (freshAccount as PosAccount | null) ?? account;
    if (!currentAccount) {
      alert('Error: no se pudo cargar la cuenta actual. Intenta de nuevo.');
      return;
    }

    const methodLabels: Record<PaymentMethod, string> = {
      cash: 'Efectivo',
      transfer: 'Transferencia',
      credit_card: 'Tarjeta de Crédito',
      debit_card: 'Tarjeta de Débito',
    };
    const label = mixedPayments && mixedPayments.length > 1 ? 'Pago Mixto' : methodLabels[method];

    try {
      const paymentPayload: Record<string, unknown> = {
        account_id: accountId,
        payment_method: method,
        subtotal: total - fee - (tip ?? 0),
        card_fee: fee,
        total,
        split_count: splitCount,
        tip: tip ?? 0,
        closed_by: closedByWaiter ?? waiterName ?? null,
      };
      if (mixedPayments && mixedPayments.length > 0) {
        paymentPayload.mixed_payments = mixedPayments;
      }

      const { error: paymentError } = await supabasePos.from('pos_payments').insert(paymentPayload);
      if (paymentError) throw new Error(`Error guardando pago: ${paymentError.message}`);

      const { error: accountError } = await supabasePos.from('pos_accounts').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', accountId);
      if (accountError) throw new Error(`Error cerrando cuenta: ${accountError.message}`);

      // Enviar push notification al cliente con acciones y ticket adjunto
      const ticketUrl = `/cuenta?id=${currentAccount.id}`;
      const ticketTextLines = [
        '🍗 LA CABRONA — Alitas & Beer',
        `Mesa: ${currentAccount.spot}`,
        `Total: $${total.toFixed(2)}`,
        `Pago: ${label}`,
        '¡Gracias por tu visita!',
        `Ver ticket completo: ${typeof window !== 'undefined' ? window.location.origin : ''}${ticketUrl}`,
      ];
      const ticketText = ticketTextLines.join('\n');
      sendPushNotification(
        currentAccount.id,
        'Cuenta cerrada ✅',
        `Tu cuenta en ${currentAccount.spot} ha sido cerrada. Total: $${total.toFixed(2)}. ¡Gracias por visitarnos!`,
        {
          tag: `closed-${currentAccount.id}`,
          data: {
            url: ticketUrl,
            ticketUrl,
            ticketText,
            accountId: currentAccount.id,
            spot: currentAccount.spot,
            total: total.toFixed(2),
            method: label,
          },
          actions: [
            { action: 'view-ticket', title: 'Ver ticket' },
            { action: 'whatsapp', title: 'Guardar en WhatsApp' },
          ],
        }
      ).catch(() => {});

      // ── Resolver customer_id y sumar puntos (ATÓMICO) ──
      // Usamos RPC o una secuencia de queries con lock implícito para evitar race conditions.
      // Estrategia: leer los puntos ANTES de cualquier update y aplicar todo en secuencia.
      const custId = currentAccount.customer_id ?? null;
      let resolvedCustId = custId;
      let resolvedByNameOrPhone = false;

      // Paso 1: Intentar resolver por teléfono si no hay customer_id directo
      if (!resolvedCustId && currentAccount?.customer_phone) {
        const rawPhone = currentAccount.customer_phone.trim();
        const cleanPhone = rawPhone.replace(/\D/g, '');
        if (cleanPhone.length >= 8) {
          // Buscar por número limpio, luego raw, luego últimos 10 dígitos
          let foundId: number | null = null;
          const { data: exact } = await supabasePos.from('pos_customers').select('id').eq('phone', cleanPhone).maybeSingle();
          if (exact?.id) foundId = exact.id;
          if (!foundId) {
            const { data: raw } = await supabasePos.from('pos_customers').select('id').eq('phone', rawPhone).maybeSingle();
            if (raw?.id) foundId = raw.id;
          }
          if (!foundId) {
            const last10 = cleanPhone.slice(-10);
            const { data: partial } = await supabasePos.from('pos_customers').select('id').ilike('phone', `%${last10}%`).maybeSingle();
            if (partial?.id) foundId = partial.id;
          }
          if (foundId) {
            resolvedCustId = foundId;
            resolvedByNameOrPhone = true;
          }
        }
      }

      // Paso 2: Fallback por nombre si no se encontró por teléfono
      if (!resolvedCustId && currentAccount?.customer_name) {
        const cleanName = currentAccount.customer_name.trim();
        let foundId: number | null = null;
        const { data: exactName } = await supabasePos.from('pos_customers').select('id').ilike('name', cleanName).maybeSingle();
        if (exactName?.id) foundId = exactName.id;
        if (!foundId) {
          const { data: partialName } = await supabasePos.from('pos_customers').select('id').ilike('name', `%${cleanName}%`).maybeSingle();
          if (partialName?.id) foundId = partialName.id;
        }
        if (foundId) {
          resolvedCustId = foundId;
          resolvedByNameOrPhone = true;
        }
      }

      // Paso 3: Si resolvimos por nombre/teléfono, vincular customer_id a la cuenta
      if (resolvedByNameOrPhone && resolvedCustId) {
        await supabasePos
          .from('pos_accounts')
          .update({ customer_id: resolvedCustId, updated_at: new Date().toISOString() })
          .eq('id', accountId);
      }

      // Paso 4: Sumar puntos (lectura + escritura en secuencia para evitar race)
      if (resolvedCustId) {
        // Leer estado actual del cliente
        const { data: custData } = await supabasePos
          .from('pos_customers')
          .select('total_spent, loyalty_points')
          .eq('id', resolvedCustId)
          .maybeSingle();

        const prevTotal = Number(custData?.total_spent ?? 0);
        const prevPoints = Number(custData?.loyalty_points ?? 0);
        const newTotal = prevTotal + total;
        const pointsEarned = Math.floor(total / 100);
        const newPoints = prevPoints + pointsEarned;

        // Escribir update atómico
        const { error: custUpdateErr } = await supabasePos
          .from('pos_customers')
          .update({
            total_spent: newTotal,
            loyalty_points: newPoints,
            last_visit: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', resolvedCustId);

        if (custUpdateErr) {
          console.error('Error actualizando puntos del cliente:', custUpdateErr);
        }

        // Registrar en historial de lealtad (solo si hubo puntos)
        if (pointsEarned > 0) {
          await supabasePos.from('loyalty_point_adjustments').insert({
            customer_id: resolvedCustId,
            delta: pointsEarned,
            points_before: prevPoints,
            points_after: newPoints,
            reason: `Cierre de cuenta — ${currentAccount.spot} — Total $${total.toFixed(2)} · Pago: ${label}`,
            adjusted_by: 'pos_auto',
          });
        }

        // Registrar evento de cierre con metadata de puntos
        await supabasePos.from('pos_account_events').insert({
          account_id: accountId,
          customer_id: resolvedCustId,
          event_type: 'account_closed',
          description: `Cuenta cerrada — $${total.toFixed(2)} · ${label}${pointsEarned > 0 ? ` · +${pointsEarned} pts (total: ${newPoints})` : ''}`,
          metadata: {
            spot: currentAccount?.spot,
            total,
            payment_method: label,
            split_count: splitCount,
            points_earned: pointsEarned,
            loyalty_points_before: prevPoints,
            loyalty_points_after: newPoints,
            resolved_via: resolvedByNameOrPhone ? (currentAccount?.customer_phone ? 'phone' : 'name') : 'direct_id',
          },
        });
      } else {
        // Cliente no encontrado — registrar para debug
        console.warn('⚠️ handleCloseAccount: No se pudo resolver customer_id para', {
          spot: currentAccount?.spot,
          customer_name: currentAccount?.customer_name,
          customer_phone: currentAccount?.customer_phone,
          customer_id_in_account: custId,
        });
        await supabasePos.from('pos_account_events').insert({
          account_id: accountId,
          event_type: 'account_closed',
          description: `Cuenta cerrada — $${total.toFixed(2)} · ${label} · ⚠️ Sin cliente vinculado (no se sumaron puntos)`,
          metadata: {
            spot: currentAccount?.spot,
            total,
            payment_method: label,
            split_count: splitCount,
            customer_name: currentAccount?.customer_name ?? null,
            customer_phone: currentAccount?.customer_phone ?? null,
            customer_id_attempted: custId,
            loyalty_error: 'Cliente no encontrado en pos_customers',
          },
        });
      }

      setClosedSummary({ total, method: label, split: splitCount });
      setShowClose(false);
      setShowWhatsApp(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido al cerrar cuenta';
      console.error('handleCloseAccount error:', err);
      // Mostrar error como un toast simple inline
      alert('No se pudo cerrar la cuenta: ' + message + '\n\nIntenta de nuevo. Si persiste, contacta soporte.');
    }
  };

  const sendWhatsApp = (phoneOverride?: string) => {
    if (!account || !closedSummary) return;
    const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const fee = closedSummary.total - subtotal;
    const folioNums = [...new Set(items.map(i => i.folio_number))].sort((a, b) => a - b);

    let msg = `🍗🍺 *LA CABRONA* 🍺🍗\n`;
    msg += `      *Alitas & Beer*\n`;
    msg += `📍 Zapopan, Jalisco\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `Hola ${account.customer_name || 'amigo/a'}! Aquí está tu cuenta:\n\n`;
    folioNums.forEach(folio => {
      const folioItems = items.filter(i => i.folio_number === folio);
      const folioTotal = folioItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
      msg += `📋 *Ronda #${String(folio).padStart(2, '0')}* — $${folioTotal.toFixed(2)}\n`;
      folioItems.forEach(i => {
        msg += `  • ${i.quantity}x ${i.product_name}${i.size ? ` (${i.size})` : ''} — $${(i.unit_price * i.quantity).toFixed(2)}\n`;
      });
      msg += `\n`;
    });
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `Subtotal: $${subtotal.toFixed(2)}\n`;
    if (fee > 0) msg += `Cargo terminal (3%): +$${fee.toFixed(2)}\n`;
    msg += `\n*TOTAL: $${closedSummary.total.toFixed(2)}*\n`;
    msg += `Forma de pago: ${closedSummary.method}\n`;
    if (closedSummary.split > 1) msg += `Dividido entre ${closedSummary.split} personas: $${(closedSummary.total / closedSummary.split).toFixed(2)} c/u\n`;
    msg += `\n¡Gracias por visitarnos! Vuelve pronto 🍗🍺\n`;
    msg += `📍 Domicilio Sinaloa 690, Zapopan`;

    const rawPhone = phoneOverride || account.customer_phone || '';
    const phone = '52' + rawPhone.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    onAccountClosed();
  };

  const handleYaSabeAdd = async (entries: CartEntry[]) => {
    if (!account) return;
    if ((account.folio_counter ?? 0) === 0) {
      // Primera ronda
      const newFolio = 1;
      await supabasePos
        .from('pos_accounts')
        .update({ folio_counter: newFolio, updated_at: new Date().toISOString() })
        .eq('id', accountId);
      const inserts = entries.map(entry => ({
        account_id: accountId,
        product_name: entry.menuItem.name,
        size: entry.note || null,
        quantity: entry.quantity,
        unit_price: entry.menuItem.price,
        folio_number: newFolio,
      }));
      await supabasePos.from('pos_account_items').insert(inserts);
      await deductStockOnSale(
        entries.map(e => ({ product_name: e.menuItem.name, quantity: e.quantity })),
        { accountId: account.id, spot: account.spot, folio: newFolio }
      );
      const folioTotal = entries.reduce((s, e) => s + e.menuItem.price * e.quantity, 0);
      sendPushNotification(
        account.id,
        '¡Tu primera ronda está en camino! 🍗',
        `Ronda #${String(newFolio).padStart(2, '0')}: ${entries.map(e => `${e.quantity}x ${e.menuItem.name}`).join(', ')} · Subtotal $${folioTotal.toFixed(2)}`,
        { tag: `newround-${account.id}-${newFolio}`, data: { url: `/cuenta?id=${account.id}` } }
      ).catch(() => {});
      sendComandaWhatsApp(newFolio, entries, account, false);
      fetchAccount();
      const comandaItems: PosAccountItem[] = entries.map((e, idx) => ({
        id: idx,
        account_id: accountId,
        product_name: e.menuItem.name,
        size: e.note || undefined,
        quantity: e.quantity,
        unit_price: e.menuItem.price,
        folio_number: newFolio,
        created_at: new Date().toISOString(),
      }));
      setPrintItems(comandaItems);
      setPrintFolio(newFolio);
      setShowPrint(true);
    } else {
      // Agregar a ronda actual
      const currentFolioNum = account.folio_counter ?? 1;
      const inserts = entries.map(entry => ({
        account_id: accountId,
        product_name: entry.menuItem.name,
        size: entry.note || null,
        quantity: entry.quantity,
        unit_price: entry.menuItem.price,
        folio_number: currentFolioNum,
      }));
      await supabasePos.from('pos_account_items').insert(inserts);
      await deductStockOnSale(
        entries.map(e => ({ product_name: e.menuItem.name, quantity: e.quantity })),
        { accountId: account.id, spot: account.spot, folio: currentFolioNum }
      );
      const folioTotal = entries.reduce((s, e) => s + e.menuItem.price * e.quantity, 0);
      sendPushNotification(
        account.id,
        'Se agregó a tu ronda actual 🍺',
        `Ronda #${String(currentFolioNum).padStart(2, '0')}: ${entries.map(e => `${e.quantity}x ${e.menuItem.name}`).join(', ')} · Subtotal $${folioTotal.toFixed(2)}`,
        { tag: `add-${account.id}-${currentFolioNum}`, data: { url: `/cuenta?id=${account.id}` } }
      ).catch(() => {});
      sendComandaWhatsApp(currentFolioNum, entries, account, true);
      fetchAccount();
      const comandaItems: PosAccountItem[] = entries.map((e, idx) => ({
        id: idx,
        account_id: accountId,
        product_name: e.menuItem.name,
        size: e.note || undefined,
        quantity: e.quantity,
        unit_price: e.menuItem.price,
        folio_number: currentFolioNum,
        created_at: new Date().toISOString(),
      }));
      setPrintItems(comandaItems);
      setPrintFolio(currentFolioNum);
      setShowPrint(true);
    }
  };

  // Imprimir comanda desde YaSabeMenu
  const handleYaSabePrint = (entries: CartEntry[], folioNumber: number) => {
    if (!account) return;
    const comandaItems: PosAccountItem[] = entries.map((e, idx) => ({
      id: idx,
      account_id: accountId,
      product_name: e.menuItem.name,
      size: e.note || undefined,
      quantity: e.quantity,
      unit_price: e.menuItem.price,
      folio_number: folioNumber,
      created_at: new Date().toISOString(),
    }));
    setPrintItems(comandaItems);
    setPrintFolio(folioNumber);
    setShowPrint(true);
  };

  const handleMarkRondaDelivered = async (folioNum: number) => {
    const ids = items.filter(i => i.folio_number === folioNum && !i.customer_delivered).map(i => i.id);
    if (ids.length === 0) return;
    // Optimista: actualizar local inmediatamente
    setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, customer_delivered: true } : i));
    const { error } = await supabasePos.from('pos_account_items').update({ customer_delivered: true }).in('id', ids);
    if (error) {
      console.error('Error marcando entregado al cliente:', error);
      alert('No se pudo marcar como entregado. Intenta de nuevo.\n\nError: ' + error.message);
      // Revertir optimista
      fetchAccount();
      return;
    }
    await supabasePos.from('pos_account_events').insert({
      account_id: accountId,
      event_type: 'ronda_delivered',
      description: `Ronda #${String(folioNum).padStart(2, '0')} entregada al cliente`,
      metadata: { folio_number: folioNum, item_ids: ids },
    });
    fetchAccount();
  };

  const handleMerged = (targetId: number) => {
    setShowMerge(false);
    if (onGoToAccount) {
      onGoToAccount(targetId);
    } else {
      onBack();
    }
  };

  const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const folios = [...new Set(items.map(i => i.folio_number))].sort((a, b) => a - b);
  const currentFolio = account?.folio_counter ?? 0;
  const elapsed = useElapsedTime(account?.created_at);
  const elapsedColor = getElapsedColor(account?.created_at);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!account) return null;

  const openedAt = account.created_at ? formatTime(account.created_at) : '';
  const displayName = account.customer_name || spotLabel || 'Cliente';
  const hasCustomer = !!account.customer_name;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer flex-shrink-0">
          <i className="ri-arrow-left-line text-gray-600" />
        </button>

        {/* Avatar del cliente */}
        {(() => {
          const initials = (displayName ?? 'C')
            .split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
          const avatarColors = ['bg-amber-500','bg-emerald-500','bg-rose-500','bg-violet-500','bg-cyan-500','bg-orange-500'];
          const avatarColor = avatarColors[(account.id ?? 0) % avatarColors.length];
          const canRedeem = hasCustomer && customerLoyaltyPts != null && REWARD_TIERS.find(t => (customerLoyaltyPts ?? 0) >= t.points);
          return (
            <div className="relative flex-shrink-0">
              {customerSelfie && !selfieImgError ? (
                <img
                  src={customerSelfie}
                  alt={displayName}
                  onError={() => setSelfieImgError(true)}
                  className="w-11 h-11 rounded-full object-cover object-top border-2 border-amber-300 ring-2 ring-amber-100"
                />
              ) : (
                <div className={`w-11 h-11 rounded-full flex items-center justify-center ${avatarColor} border-2 border-white`}>
                  <span className="text-white font-bold text-sm">{initials}</span>
                </div>
              )}
              {/* Dot de presencia */}
              {hasCustomer && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-white" />
              )}
              {/* Badge de lealtad canjeable */}
              {canRedeem && (
                <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center" title={`${customerLoyaltyPts} pts — puede canjear`}>
                  <i className="ri-vip-crown-2-fill text-white" style={{ fontSize: 9 }} />
                </div>
              )}
            </div>
          );
        })()}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-gray-900 text-base">
              {displayName}
            </h2>
            {!hasCustomer && (
              <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-semibold">
                Sin cliente
              </span>
            )}
            {currentFolio > 0 && (
              <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold">
                {currentFolio} ronda{currentFolio !== 1 ? 's' : ''}
              </span>
            )}
            {hasCustomer && customerLoyaltyPts != null && customerLoyaltyPts > 0 && (() => {
              const canRedeemNow = REWARD_TIERS.find(t => (customerLoyaltyPts ?? 0) >= t.points);
              return (
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${canRedeemNow ? 'bg-amber-500 text-white animate-pulse' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  <i className="ri-vip-crown-2-fill text-[10px]" />
                  {customerLoyaltyPts} pts{canRedeemNow ? ' · ¡Canjea!' : ''}
                </span>
              );
            })()}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {hasCustomer && account.customer_phone && (
              <span className="text-xs text-gray-500 flex items-center gap-0.5">
                <i className="ri-phone-line" />
                {account.customer_phone}
              </span>
            )}
            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
              {areaLabel}
            </span>
            <span className={`text-xs flex items-center gap-1 ${elapsedColor}`}>
              <i className="ri-time-line" />
              {openedAt && `Abrió ${openedAt}`}
              {elapsed && ` · ${elapsed}`}
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowPrint(true)}
          className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap flex-shrink-0"
        >
          <i className="ri-printer-line mr-1" />
          Imprimir
        </button>
        <button
          onClick={() => setShowMerge(true)}
          className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap flex-shrink-0"
        >
          <i className="ri-git-merge-line mr-1" />
          Fusionar
        </button>
        <button
          onClick={handleRequestClose}
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap flex-shrink-0"
        >
          <i className="ri-close-circle-line mr-1" />
          Cerrar Cuenta
        </button>
      </div>

      {/* Historial del cliente — solo cuando hay cliente */}
      {hasCustomer && (
        <CustomerHistoryPanel
          customerId={account.customer_id}
          customerName={account.customer_name}
          currentAccountTotal={total}
        />
      )}

      {/* ===== TARJETA DE LEALTAD CON FOTO — solo cuando hay cliente ===== */}
      {hasCustomer && customerLoyaltyPts != null && customerLoyaltyPts > 0 && (() => {
        const canRedeemTier = REWARD_TIERS.find(t => (customerLoyaltyPts ?? 0) >= t.points);
        const allRedeemable = REWARD_TIERS.filter(t => (customerLoyaltyPts ?? 0) >= t.points);
        const nextTier = REWARD_TIERS.find(t => (customerLoyaltyPts ?? 0) < t.points);
        const initials = (account.customer_name ?? 'C')
          .split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
        const avatarColors = ['bg-amber-500','bg-emerald-500','bg-rose-500','bg-violet-500','bg-cyan-500','bg-orange-500'];
        const avatarColor = avatarColors[(account.id ?? 0) % avatarColors.length];

        return (
          <div className={`border-b overflow-hidden ${
            canRedeemTier
              ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'
              : 'bg-gray-50 border-gray-100'
          }`}>
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Foto grande del cliente */}
              <div className="relative flex-shrink-0">
                {customerSelfie && !selfieImgError ? (
                  <img
                    src={customerSelfie}
                    alt={account.customer_name ?? 'Cliente'}
                    onError={() => setSelfieImgError(true)}
                    className={`w-16 h-16 rounded-xl object-cover object-top border-2 shadow-sm ${
                      canRedeemTier ? 'border-amber-400 ring-2 ring-amber-200' : 'border-gray-200'
                    }`}
                  />
                ) : (
                  <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${avatarColor} border-2 ${
                    canRedeemTier ? 'border-amber-400 ring-2 ring-amber-200' : 'border-transparent'
                  }`}>
                    <span className="text-white font-black text-xl">{initials}</span>
                  </div>
                )}
                {canRedeemTier && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center shadow-sm">
                    <i className="ri-vip-crown-2-fill text-white" style={{ fontSize: 10 }} />
                  </div>
                )}
              </div>

              {/* Info de lealtad */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-black text-gray-900 truncate">
                    {account.customer_name || 'Cliente'}
                  </p>
                  {canRedeemTier && (
                    <span className="text-[10px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-full animate-pulse whitespace-nowrap">
                      ¡PUEDE CANJEAR!
                    </span>
                  )}
                </div>

                {/* Barra de puntos */}
                <div className="mt-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                      <i className="ri-vip-crown-2-fill text-[11px]" />
                      {customerLoyaltyPts} puntos
                    </span>
                    {nextTier && (
                      <span className="text-[10px] text-gray-400">
                        Faltan {nextTier.points - customerLoyaltyPts} para {nextTier.title}
                      </span>
                    )}
                  </div>
                  {/* Barra visual */}
                  {(() => {
                    const maxPts = REWARD_TIERS[REWARD_TIERS.length - 1]?.points ?? 100;
                    const pct = Math.min(100, Math.round((customerLoyaltyPts / maxPts) * 100));
                    return (
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    );
                  })()}
                </div>

                {/* Premios canjeables */}
                {allRedeemable.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {allRedeemable.map(tier => (
                      <span
                        key={tier.points}
                        className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full whitespace-nowrap"
                      >
                        🎁 {tier.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== NOTAS INTERNAS DE LA CUENTA ===== */}
      {!editingNote ? (
        <div
          onClick={() => { setEditingNote(true); setTimeout(() => noteInputRef.current?.focus(), 50); }}
          className={`flex items-center gap-2.5 px-4 py-2 border-b cursor-pointer transition-colors group ${
            internalNote
              ? 'bg-violet-50 border-violet-100 hover:bg-violet-100'
              : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
          }`}
        >
          <div className={`w-6 h-6 flex items-center justify-center flex-shrink-0 ${
            internalNote ? 'text-violet-500' : 'text-gray-400'
          }`}>
            <i className="ri-sticky-note-2-line text-sm" />
          </div>
          {internalNote ? (
            <p className="flex-1 text-xs text-violet-800 font-medium truncate">{internalNote}</p>
          ) : (
            <p className="flex-1 text-xs text-gray-400 italic">Agregar nota interna (factura, VIP, observaciones...)</p>
          )}
          <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {internalNote && (
              <button
                onClick={e => { e.stopPropagation(); setInternalNote(''); handleSaveInternalNote(''); }}
                className="w-5 h-5 flex items-center justify-center rounded-full bg-violet-200 hover:bg-red-200 text-violet-700 hover:text-red-600 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-[10px]" />
              </button>
            )}
            <i className="ri-edit-line text-xs text-gray-400" />
          </div>
        </div>
      ) : (
        <div className="border-b border-violet-200 bg-violet-50">
          {/* Tags de acceso rápido */}
          <div className="flex items-center gap-1.5 px-4 pt-2 pb-1 flex-wrap">
            <span className="text-[10px] text-violet-500 font-semibold uppercase tracking-wide mr-1">Rápido:</span>
            {['Pide factura', 'Mesa VIP', 'Cobrar con terminal', 'Invitación de la casa', 'Alergia', 'No molestar'].map(tag => (
              <button
                key={tag}
                onClick={() => {
                  const current = internalNote.trim();
                  const already = current.includes(tag);
                  const updated = already
                    ? current.replace(tag, '').replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '').trim()
                    : current ? `${current}, ${tag}` : tag;
                  setInternalNote(updated);
                }}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer transition-colors whitespace-nowrap border ${
                  internalNote.includes(tag)
                    ? 'bg-violet-500 border-violet-500 text-white'
                    : 'bg-white border-violet-200 text-violet-600 hover:border-violet-400 hover:bg-violet-50'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          {/* Textarea */}
          <div className="px-4 pb-2 flex items-end gap-2">
            <textarea
              ref={noteInputRef}
              value={internalNote}
              onChange={e => setInternalNote(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveInternalNote(internalNote); }
                if (e.key === 'Escape') { setEditingNote(false); }
              }}
              placeholder="Escribe una observación interna..."
              rows={2}
              maxLength={200}
              className="flex-1 px-3 py-2 bg-white border border-violet-200 rounded-lg text-xs focus:outline-none focus:border-violet-500 resize-none text-gray-800 placeholder-gray-400"
            />
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              <button
                onClick={() => handleSaveInternalNote(internalNote)}
                disabled={savingNote}
                className="flex items-center justify-center gap-1 bg-violet-500 hover:bg-violet-600 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
              >
                {savingNote ? (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <><i className="ri-save-line" /> Guardar</>
                )}
              </button>
              <button
                onClick={() => setEditingNote(false)}
                className="flex items-center justify-center gap-1 bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap"
              >
                Cancelar
              </button>
            </div>
          </div>
          <p className="px-4 pb-1.5 text-[10px] text-violet-400">Enter para guardar · Esc para cancelar · Solo visible para el staff</p>
        </div>
      )}

      {/* Barra de cambios recientes */}
      {recentEvents.length > 0 && (() => {
        const EVENT_ICONS: Record<string, { icon: string; color: string }> = {
          qty_changed:  { icon: 'ri-arrow-up-down-line', color: 'text-amber-500' },
          note_changed: { icon: 'ri-edit-line',           color: 'text-sky-500'   },
          item_deleted: { icon: 'ri-delete-bin-line',     color: 'text-red-500'   },
          item_edited:  { icon: 'ri-pencil-line',         color: 'text-violet-500' },
          item_added_manual: { icon: 'ri-add-circle-line', color: 'text-green-500' },
        };
        const latestEvent = recentEvents[0];
        const cfg = EVENT_ICONS[latestEvent.event_type] ?? { icon: 'ri-information-line', color: 'text-gray-400' };
        const hasDeleted = recentEvents.some(e => e.event_type === 'item_deleted');
        const stripPrefix = (desc: string) => desc.replace(/^(Cantidad cambiada|Nota editada|Nota eliminada|Eliminado):\s*/i, '');
        return (
          <div
            className={`border-b px-4 py-2 flex items-center gap-2 cursor-pointer select-none transition-colors ${
              hasDeleted
                ? 'bg-red-50 border-red-100 hover:bg-red-100'
                : 'bg-amber-50 border-amber-100 hover:bg-amber-100'
            }`}
            onClick={() => setShowRecentEvents(v => !v)}
          >
            {/* Icono del evento más reciente */}
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
              <i className={`${cfg.icon} text-sm ${cfg.color}`} />
            </div>

            {/* Resumen inline */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-700 font-medium truncate">
                {stripPrefix(latestEvent.description)}
              </p>
              {recentEvents.length > 1 && !showRecentEvents && (
                <p className="text-xs text-gray-400">
                  +{recentEvents.length - 1} cambio{recentEvents.length - 1 !== 1 ? 's' : ''} más
                </p>
              )}
            </div>

            {/* Badge conteo + toggle */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                hasDeleted ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
              }`}>
                {recentEvents.length}
              </span>
              <i className={`text-gray-400 text-xs transition-transform ${
                showRecentEvents ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'
              }`} />
            </div>
          </div>
        );
      })()}

      {/* Panel expandido de cambios recientes */}
      {showRecentEvents && recentEvents.length > 0 && (() => {
        const EVENT_CFG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
          qty_changed:  { icon: 'ri-arrow-up-down-line', color: 'text-amber-600', bg: 'bg-amber-100', label: 'Cantidad' },
          note_changed: { icon: 'ri-edit-line',           color: 'text-sky-600',   bg: 'bg-sky-100',   label: 'Nota'     },
          item_deleted: { icon: 'ri-delete-bin-line',     color: 'text-red-600',   bg: 'bg-red-100',   label: 'Eliminado'},
          item_edited:  { icon: 'ri-pencil-line',         color: 'text-violet-600', bg: 'bg-violet-100', label: 'Editado' },
          item_added_manual: { icon: 'ri-add-circle-line', color: 'text-green-600', bg: 'bg-green-100', label: 'Agregado' },
        };
        const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        const stripPrefix = (desc: string) => desc.replace(/^(Cantidad cambiada|Nota editada|Nota eliminada|Eliminado):\s*/i, '');
        return (
          <div className="border-b border-amber-100 bg-white divide-y divide-gray-50">
            {recentEvents.map((ev, idx) => {
              const cfg = EVENT_CFG[ev.event_type] ?? { icon: 'ri-information-line', color: 'text-gray-500', bg: 'bg-gray-100', label: '?' };
              return (
                <div key={ev.id} className={`flex items-center gap-2.5 px-4 py-2 ${
                  idx === 0 ? 'bg-amber-50/60' : ''
                }`}>
                  <div className={`w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 ${cfg.bg}`}>
                    <i className={`${cfg.icon} text-xs ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-800 truncate">{stripPrefix(ev.description)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {idx === 0 && (
                      <span className="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold">Ahora</span>
                    )}
                    <span className="text-xs text-gray-400">{fmtTime(ev.created_at)}</span>
                  </div>
                </div>
              );
            })}
            <div className="px-4 py-1.5 flex justify-end">
              <button
                onClick={() => setShowRecentEvents(false)}
                className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
              >
                Ocultar
              </button>
            </div>
          </div>
        );
      })()}

      {/* Items grouped by ronda */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {items.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
              <i className="ri-receipt-line text-2xl text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm font-medium">Cuenta vacía</p>
            <p className="text-gray-400 text-xs mt-1">Agrega la primera ronda</p>
            <button
              onClick={handleOpenOrderMenu}
              className="mt-4 bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-add-circle-line mr-2" />
              Primera Ronda
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {folios.map((folio, folioIdx) => {
              const folioItems = items.filter(i => i.folio_number === folio);
              const folioTotal = folioItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
              const folioQty = folioItems.reduce((s, i) => s + i.quantity, 0);
              const folioCreatedAt = folioItems[0]?.created_at ?? '';
              const folioTime = folioCreatedAt ? formatTime(folioCreatedAt) : '';
              const isLast = folioIdx === folios.length - 1;
              const minsAgo = folioCreatedAt ? minutesSince(folioCreatedAt) : 0;
              const allRondaDelivered = folioItems.length > 0 && folioItems.every(i => i.delivered);
              const someDelivered = folioItems.some(i => i.delivered);
              const allCustomerDelivered = folioItems.length > 0 && folioItems.every(i => i.customer_delivered);

              return (
                <div
                  key={folio}
                  className={`rounded-xl border overflow-hidden transition-all ${
                    allCustomerDelivered
                      ? 'border-emerald-300 ring-1 ring-emerald-200'
                      : allRondaDelivered
                        ? 'border-green-300 ring-1 ring-green-200'
                        : isLast ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200'
                  }`}
                >
                  {/* Ronda header */}
                  <div className={`flex items-center justify-between px-3 py-2 border-b ${
                    allCustomerDelivered
                      ? 'bg-emerald-50 border-emerald-200'
                      : allRondaDelivered
                        ? 'bg-green-50 border-green-200'
                        : isLast ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'
                  }`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-white text-xs font-bold px-2 py-0.5 rounded-full ${
                        allCustomerDelivered ? 'bg-emerald-500' : allRondaDelivered ? 'bg-green-500' : isLast ? 'bg-amber-500' : 'bg-gray-400'
                      }`}>
                        Ronda #{String(folio).padStart(2, '0')}
                      </span>
                      {allCustomerDelivered && (
                        <span className="text-xs text-emerald-700 font-bold flex items-center gap-1 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                          <i className="ri-user-received-2-line" />En mesa
                        </span>
                      )}
                      {allRondaDelivered && !allCustomerDelivered && (
                        <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                          <i className="ri-checkbox-circle-fill" />Lista en cocina
                        </span>
                      )}
                      {!allRondaDelivered && someDelivered && (
                        <span className="text-xs text-orange-500 font-semibold flex items-center gap-1">
                          <i className="ri-loader-2-line" />Parcial
                        </span>
                      )}
                      {isLast && !allRondaDelivered && (
                        <span className="text-xs text-amber-600 font-semibold">Última</span>
                      )}
                      <span className="text-xs text-gray-400">{folioQty} producto{folioQty !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {folioTime && (
                        <span className="text-xs text-gray-400 hidden sm:flex items-center gap-1">
                          <i className="ri-time-line" />
                          {folioTime}
                          {minsAgo > 0 && <span className="text-gray-300">· {minsAgo}m</span>}
                        </span>
                      )}
                      <span className={`text-sm font-bold ${allCustomerDelivered ? 'text-emerald-600' : allRondaDelivered ? 'text-green-600' : isLast ? 'text-amber-600' : 'text-gray-600'}`}>
                        ${folioTotal.toFixed(2)}
                      </span>
                      {/* Estado de entrega al cliente */}
                      {allCustomerDelivered ? (
                        <div
                          title="Ronda entregada al cliente"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap bg-emerald-100 text-emerald-700"
                        >
                          <i className="ri-user-received-2-line" />
                          <span className="hidden sm:inline">En mesa</span>
                        </div>
                      ) : allRondaDelivered ? (
                        <button
                          onClick={() => handleMarkRondaDelivered(folio)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap bg-green-500 hover:bg-green-600 text-white cursor-pointer transition-colors"
                        >
                          <i className="ri-user-received-2-line" />
                          <span className="hidden sm:inline">Entregado al cliente</span>
                        </button>
                      ) : (
                        <div
                          title="Pendiente de entrega"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap bg-gray-100 text-gray-400"
                        >
                          <i className="ri-time-line" />
                          <span className="hidden sm:inline">Pendiente</span>
                        </div>
                      )}
                      {/* Botón agregar producto manual a esta ronda */}
                      <button
                        onClick={() => handleOpenAddManual(folio)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-800 hover:text-white text-gray-500 cursor-pointer transition-colors"
                        title="Agregar producto manual a esta ronda"
                      >
                        <i className="ri-add-line text-xs" />
                      </button>
                      <button
                        onClick={() => { setPrintItems(folioItems); setPrintFolio(folio); setShowPrint(true); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-800 hover:text-white text-gray-500 cursor-pointer transition-colors"
                        title="Imprimir comanda de esta ronda"
                      >
                        <i className="ri-printer-line text-xs" />
                      </button>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="divide-y divide-gray-50 bg-white">
                    {folioItems.map((item) => (
                      <div key={item.id} className={`flex items-center gap-2 px-3 py-2 transition-colors ${item.customer_delivered ? 'bg-emerald-50/60' : item.delivered ? 'bg-green-50/50' : ''}`}>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleUpdateQty(item.id, item.quantity - 1)}
                            className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-200 hover:border-red-400 hover:text-red-500 text-gray-400 cursor-pointer transition-colors"
                          >
                            <i className="ri-subtract-line text-xs" />
                          </button>
                          <span className="w-5 text-center text-sm font-bold text-gray-900">{item.quantity}</span>
                          <button
                            onClick={() => handleUpdateQty(item.id, item.quantity + 1)}
                            className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-200 hover:border-amber-500 hover:text-amber-600 text-gray-400 cursor-pointer transition-colors"
                          >
                            <i className="ri-add-line text-xs" />
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-sm font-medium leading-tight ${
                              item.customer_delivered ? 'text-emerald-700 line-through decoration-emerald-400 decoration-1' : item.delivered ? 'text-green-700 line-through decoration-green-400 decoration-1' : 'text-gray-900'
                            }`}>{item.product_name}</p>
                            {item.customer_delivered && (
                              <i className="ri-user-received-2-line text-emerald-500 text-xs flex-shrink-0" title="Entregado al cliente" />
                            )}
                            {!item.customer_delivered && item.delivered && (
                              <i className="ri-checkbox-circle-fill text-green-500 text-xs flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {item.size
                              ? (
                                <button
                                  onClick={() => handleEditNote(item.id, item.size ?? '')}
                                  className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 cursor-pointer group"
                                  title="Editar nota"
                                >
                                  <span className="italic">{item.size}</span>
                                  <i className="ri-edit-line opacity-0 group-hover:opacity-100 transition-opacity text-xs" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleEditNote(item.id, '')}
                                  className="flex items-center gap-0.5 text-xs text-gray-300 hover:text-amber-500 cursor-pointer transition-colors"
                                  title="Agregar nota"
                                >
                                  <i className="ri-edit-line text-xs" />
                                  <span>nota</span>
                                </button>
                              )
                            }
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* Botón historial */}
                          <button
                            onClick={() => setHistoryItem({ id: item.id, name: item.product_name })}
                            title="Ver historial de cambios"
                            className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 text-gray-300 hover:border-amber-400 hover:text-amber-500 hover:bg-amber-50 cursor-pointer transition-all"
                          >
                            <i className="ri-history-line text-xs" />
                          </button>
                          {/* Botón editar producto */}
                          <button
                            onClick={() => handleOpenEditItem(item)}
                            title="Editar producto"
                            className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 text-gray-300 hover:border-amber-400 hover:text-amber-500 hover:bg-amber-50 cursor-pointer transition-all"
                          >
                            <i className="ri-pencil-line text-xs" />
                          </button>
                          <div
                            title={item.customer_delivered ? 'Entregado al cliente' : item.delivered ? 'Listo en cocina' : 'Pendiente de entrega'}
                            className={`w-7 h-7 flex items-center justify-center rounded-full border-2 ${
                              item.customer_delivered
                                ? 'border-emerald-400 bg-emerald-400 text-white'
                                : item.delivered
                                  ? 'border-green-400 bg-green-400 text-white'
                                  : 'border-gray-200 text-gray-300'
                            }`}
                          >
                            {item.customer_delivered && <i className="ri-user-received-2-line text-xs font-bold" />}
                            {!item.customer_delivered && item.delivered && <i className="ri-check-line text-xs font-bold" />}
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-bold ${item.customer_delivered ? 'text-emerald-600' : item.delivered ? 'text-green-600' : 'text-gray-900'}`}>${(item.unit_price * item.quantity).toFixed(2)}</p>
                            <p className="text-xs text-gray-400">${item.unit_price.toFixed(2)} c/u</p>
                            {/* Badges de extras con cobro para el POS */}
                            {(() => {
                              const extras = detectExtras(item.size ?? '');
                              if (extras.length === 0) return null;
                              return (
                                <div className="flex flex-col items-end gap-0.5 mt-0.5">
                                  {extras.map((ex, idx) => (
                                    <span key={idx} className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 whitespace-nowrap">
                                      +{ex.label} ${ex.price}
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Botón Pedir Algo Más — grande y visible */}
            <button
              onClick={handleOpenOrderMenu}
              className="w-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-white py-4 rounded-xl font-bold text-base cursor-pointer transition-all whitespace-nowrap flex items-center justify-center gap-2 shadow-sm"
            >
              <i className="ri-add-circle-fill text-xl" />
              Pedir Algo Más
            </button>

            {/* Resumen total */}
            <div className="bg-gray-900 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">
                  {folios.length} ronda{folios.length !== 1 ? 's' : ''} · {items.reduce((s, i) => s + i.quantity, 0)} productos
                </p>
                {elapsed && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    <i className="ri-time-line mr-1" />
                    Llevan {elapsed} en el bar
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Total Cuenta</p>
                <p className="text-2xl font-bold text-amber-400">${total.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="px-4 py-3 border-t border-gray-100 bg-white">
        <div className="flex gap-2">
          <button
            onClick={handleOpenOrderMenu}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-add-circle-line mr-2" />
            {currentFolio === 0 ? 'Primera Ronda' : 'Pedir Algo Más'}
          </button>
          <button
            onClick={() => handleOpenAddManual()}
            className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap flex-shrink-0"
          >
            <i className="ri-add-line mr-1" />
            Manual
          </button>
          <button
            onClick={handleRequestClose}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-xl font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-close-circle-line mr-1" />
            Cerrar
          </button>
        </div>
      </div>

      {/* Mode selector modal */}
      {showModeSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowModeSelector(false)} />
          <div className="relative bg-white rounded-2xl p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
            <h3 className="font-bold text-gray-900 text-base mb-1">¿Dónde agregas?</h3>
            <p className="text-xs text-gray-500 mb-4">
              Elige a qué ronda quieres agregar o crea una nueva
            </p>

            <div className="space-y-2">
              {/* Nueva ronda — siempre primero y destacada */}
              <button
                onClick={() => handleSelectMode('new_round')}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-amber-300 bg-amber-50 hover:border-amber-500 hover:bg-amber-100 cursor-pointer transition-all text-left"
              >
                <div className="w-9 h-9 flex items-center justify-center bg-amber-500 rounded-lg flex-shrink-0">
                  <i className="ri-add-circle-fill text-white text-lg" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">
                    Nueva Ronda #{String(currentFolio + 1).padStart(2, '0')}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Crea una nueva ronda separada</p>
                </div>
                <div className="ml-auto">
                  <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold">Nueva</span>
                </div>
              </button>

              {/* Separador */}
              {folios.length > 0 && (
                <div className="flex items-center gap-2 py-1">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-xs text-gray-400 font-medium">o agrega a una ronda existente</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
              )}

              {/* Lista de rondas existentes */}
              {folios.map((folio) => {
                const folioItems = items.filter(i => i.folio_number === folio);
                const folioTotal = folioItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
                const folioQty = folioItems.reduce((s, i) => s + i.quantity, 0);
                const allDelivered = folioItems.every(i => i.delivered);
                const allCustomerDelivered = folioItems.every(i => i.customer_delivered);
                const isCurrentFolio = folio === currentFolio;
                return (
                  <button
                    key={folio}
                    onClick={() => handleSelectMode('add_to_specific', folio)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all text-left ${
                      isCurrentFolio
                        ? 'border-green-200 bg-green-50 hover:border-green-400 hover:bg-green-100'
                        : 'border-gray-200 bg-gray-50 hover:border-amber-300 hover:bg-amber-50'
                    }`}
                  >
                    <div className={`w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0 ${
                      allCustomerDelivered ? 'bg-emerald-500' : allDelivered ? 'bg-green-500' : isCurrentFolio ? 'bg-green-400' : 'bg-gray-300'
                    }`}>
                      <i className={`text-white text-base ${
                        allCustomerDelivered ? 'ri-user-received-2-line' : allDelivered ? 'ri-checkbox-circle-fill' : 'ri-restaurant-line'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-gray-900 text-sm">Ronda #{String(folio).padStart(2, '0')}</p>
                        {isCurrentFolio && (
                          <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full font-bold">Actual</span>
                        )}
                        {allCustomerDelivered && (
                          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-0.5">
                            <i className="ri-user-received-2-line text-xs" />En mesa
                          </span>
                        )}
                        {allDelivered && !allCustomerDelivered && (
                          <span className="text-xs text-green-600 font-semibold flex items-center gap-0.5">
                            <i className="ri-checkbox-circle-fill text-xs" />Lista en cocina
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {folioQty} producto{folioQty !== 1 ? 's' : ''} · ${folioTotal.toFixed(2)}
                      </p>
                    </div>
                    <i className="ri-arrow-right-line text-gray-400 flex-shrink-0" />
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setShowModeSelector(false)}
              className="w-full mt-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 cursor-pointer transition-colors whitespace-nowrap"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Menu picker */}
      {orderMode !== null && (
        <MenuPickerModal
          onConfirm={handleConfirmComanda}
          onClose={() => { setOrderMode(null); setTargetFolio(null); }}
          addToFolio={
            orderMode === 'add_to_current' ? currentFolio
            : orderMode === 'add_to_specific' && targetFolio !== null ? targetFolio
            : undefined
          }
          nextFolioNumber={orderMode === 'new_round' ? currentFolio + 1 : undefined}
        />
      )}

      {showPrint && account && (
        <PrintTicketModal
          account={account}
          items={printFolio !== undefined ? printItems : items}
          mode={printFolio !== undefined ? 'comanda' : 'cuenta'}
          folioNumber={printFolio}
          onClose={() => { setShowPrint(false); setPrintFolio(undefined); setPrintItems([]); }}
        />
      )}

      {/* Flotante Ya Sabe */}
      <YaSabeMenu
        onAdd={handleYaSabeAdd}
        onOpenFullMenu={handleOpenOrderMenu}
        onUpdateQty={handleUpdateQty}
        onPrintComanda={handleYaSabePrint}
        accountItems={items}
        currentFolio={currentFolio}
        accountSpot={account.spot}
        accountArea={AREA_LABELS[account.area as keyof typeof AREA_LABELS] ?? account.area}
        accountCustomerName={account.customer_name ?? undefined}
        accountCreatedAt={account.created_at}
      />

      {showMerge && account && (
        <MergeAccountModal
          sourceAccount={account}
          sourceItems={items}
          onClose={() => setShowMerge(false)}
          onMerged={(id) => handleMerged(id)}
        />
      )}

      {/* Panel historial de item */}
      {historyItem && (
        <ItemHistoryPanel
          itemId={historyItem.id}
          productName={historyItem.name}
          onClose={() => setHistoryItem(null)}
        />
      )}

      {/* Modal editar nota de item */}
      {editNoteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setEditNoteItem(null)} />
          <div className="relative bg-white rounded-2xl p-5 w-full max-w-sm">
            <h4 className="font-bold text-gray-900 text-base mb-1">Editar nota / especificación</h4>
            <p className="text-xs text-gray-400 mb-3">Deja vacío para quitar la nota del producto</p>
            <input
              type="text"
              value={editNoteText}
              onChange={(e) => setEditNoteText(e.target.value)}
              placeholder="Ej: BBQ, sin cebolla, extra picante..."
              autoFocus
              maxLength={80}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500 transition-colors"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveNote(); if (e.key === 'Escape') setEditNoteItem(null); }}
            />
            {editNoteItem.currentNote && editNoteText.trim() === '' && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <i className="ri-error-warning-line" />
                Si guardas así, se borra la nota actual
              </p>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setEditNoteItem(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNote}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold cursor-pointer whitespace-nowrap transition-colors"
              >
                <i className="ri-save-line mr-1" />
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de advertencia: ítems sin entregar */}
      {showIncompleteWarning && (() => {
        const undelivered = items.filter(i => !i.delivered);
        const total_undelivered = undelivered.length;
        // Agrupar por nombre para mostrar un resumen limpio
        const grouped = undelivered.reduce<Record<string, number>>((acc, item) => {
          acc[item.product_name] = (acc[item.product_name] ?? 0) + item.quantity;
          return acc;
        }, {});
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/70" onClick={() => setShowIncompleteWarning(false)} />
            <div className="relative bg-white rounded-2xl w-full max-w-sm overflow-hidden">
              {/* Header rojo advertencia */}
              <div className="bg-red-500 px-5 pt-5 pb-4 text-white">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 flex items-center justify-center bg-white/20 rounded-full flex-shrink-0">
                    <i className="ri-error-warning-line text-xl" />
                  </div>
                  <div>
                    <h3 className="font-black text-base leading-tight">¿Cerrar cuenta incompleta?</h3>
                    <p className="text-white/80 text-xs mt-1">
                      {total_undelivered} ítem{total_undelivered !== 1 ? 's' : ''} sin marcar como entregado{total_undelivered !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Lista de ítems pendientes */}
              <div className="px-5 pt-4 pb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Pendientes de entrega:</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {Object.entries(grouped).map(([name, qty]) => (
                    <div key={name} className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                        <i className="ri-time-line text-red-400 text-xs" />
                      </div>
                      <span className="text-sm text-gray-800 font-medium flex-1 truncate">{name}</span>
                      <span className="text-xs font-bold text-red-500 whitespace-nowrap">{qty}x</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Puedes marcarlos como entregados antes de cerrar, o cerrar de todos modos si ya se entregaron sin marcar.
                </p>
              </div>

              {/* Acciones */}
              <div className="px-5 pb-5 flex flex-col gap-2">
                <button
                  onClick={() => { setShowIncompleteWarning(false); setShowClose(true); }}
                  className="w-full py-3 bg-red-500 hover:bg-red-600 active:scale-95 text-white rounded-xl font-black text-sm cursor-pointer transition-all whitespace-nowrap"
                >
                  <i className="ri-close-circle-line mr-2" />
                  Cerrar de todos modos
                </button>
                <button
                  onClick={() => setShowIncompleteWarning(false)}
                  className="w-full py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <i className="ri-arrow-go-back-line mr-1" />
                  Revisar cuenta
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showClose && account && (
        <CloseAccountModal
          account={{ ...account, pos_account_items: items }}
          closedBy={waiterName}
          onClose={() => setShowClose(false)}
          onConfirm={handleCloseAccount}
        />
      )}

      {/* ===== BARRA DE DESHACER ===== */}
      {undoAction && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 bg-gray-900 border border-amber-500 rounded-2xl px-4 py-3 shadow-xl"
          style={{ minWidth: 280, maxWidth: '90vw' }}
        >
          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
            <i className="ri-alarm-warning-line text-amber-400 text-lg" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-bold leading-tight truncate">{undoAction.label}</p>
            <p className="text-gray-400 text-[10px] mt-0.5">Se deshace en 6 segundos</p>
          </div>
          <button
            onClick={handleUndo}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-white px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all whitespace-nowrap"
          >
            <i className="ri-arrow-go-back-line" />
            Deshacer
          </button>
          <button
            onClick={() => {
              if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
              setUndoAction(null);
            }}
            className="w-6 h-6 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-300 cursor-pointer transition-colors flex-shrink-0"
          >
            <i className="ri-close-line text-sm" />
          </button>
        </div>
      )}

      {/* WhatsApp confirm */}
      {showWhatsApp && closedSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="text-center mb-4">
              <div className="w-14 h-14 mx-auto mb-3 bg-green-100 rounded-full flex items-center justify-center">
                <i className="ri-check-double-line text-2xl text-green-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-1">Cuenta Cerrada</h3>
              <p className="text-gray-500 text-sm">
                Total: <strong className="text-amber-600">${closedSummary.total.toFixed(2)}</strong>
                {' · '}{closedSummary.method}
              </p>
            </div>

            <div className="bg-green-50 rounded-xl p-4 mb-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">
                <i className="ri-whatsapp-line mr-1 text-green-600" />
                Enviar cuenta al cliente
              </p>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={clientPhone || account?.customer_phone || ''}
                  onChange={e => setClientPhone(e.target.value)}
                  placeholder="Número WhatsApp cliente"
                  className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-500"
                />
                <button
                  onClick={() => sendWhatsApp(clientPhone || account?.customer_phone || '')}
                  disabled={!(clientPhone || account?.customer_phone)}
                  className="bg-green-500 hover:bg-green-600 disabled:bg-gray-200 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
                >
                  <i className="ri-send-plane-line" />
                </button>
              </div>
              {!(clientPhone || account?.customer_phone) && (
                <p className="text-xs text-gray-400 mt-1">Escribe el número para enviar</p>
              )}
            </div>

            <button
              onClick={onAccountClosed}
              className="w-full border border-gray-200 text-gray-600 py-3 rounded-xl font-medium text-sm cursor-pointer hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              Volver al Panel
            </button>
          </div>
        </div>
      )}

      {/* ===== MODAL EDITAR / AGREGAR PRODUCTO MANUAL ===== */}
      {editItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setEditItemModal(null)} />
          <div className="relative bg-white rounded-2xl p-5 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <h4 className="font-bold text-gray-900 text-base mb-1">
              {editItemModal.id ? 'Editar producto' : 'Agregar producto manual'}
            </h4>
            <p className="text-xs text-gray-400 mb-4">
              {editItemModal.id ? 'Modifica el nombre, precio o cantidad' : 'Producto que no está en el menú'}
            </p>

            <div className="space-y-3">
              {/* Nombre */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Nombre del producto</label>
                <input
                  type="text"
                  value={editItemModal.name}
                  onChange={e => setEditItemModal({ ...editItemModal, name: e.target.value })}
                  placeholder="Ej: Cerveza artesanal, botella agua..."
                  autoFocus={!editItemModal.id}
                  maxLength={60}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* Precio y Cantidad en fila */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Precio unitario</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">$</span>
                    <input
                      type="number"
                      value={editItemModal.price}
                      onChange={e => setEditItemModal({ ...editItemModal, price: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="w-full pl-7 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                </div>
                <div className="w-28">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Cantidad</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditItemModal({ ...editItemModal, quantity: Math.max(1, editItemModal.quantity - 1) })}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:border-red-400 hover:text-red-500 text-gray-400 cursor-pointer transition-colors"
                    >
                      <i className="ri-subtract-line text-xs" />
                    </button>
                    <span className="text-sm font-bold text-gray-900 w-6 text-center">{editItemModal.quantity}</span>
                    <button
                      onClick={() => setEditItemModal({ ...editItemModal, quantity: editItemModal.quantity + 1 })}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:border-amber-500 hover:text-amber-600 text-gray-400 cursor-pointer transition-colors"
                    >
                      <i className="ri-add-line text-xs" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Nota / especificación */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Nota / especificación</label>
                <input
                  type="text"
                  value={editItemModal.note}
                  onChange={e => setEditItemModal({ ...editItemModal, note: e.target.value })}
                  placeholder="Ej: sin cebolla, extra picante..."
                  maxLength={80}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* Vista previa */}
              <div className="bg-gray-900 rounded-xl px-3 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">Subtotal</span>
                  <span className="text-white text-sm font-black">
                    ${(editItemModal.price * editItemModal.quantity).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-gray-500 text-xs">{editItemModal.quantity}x · ${editItemModal.price.toFixed(2)} c/u</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setEditItemModal(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveItemEdit}
                disabled={!editItemModal.name.trim() || editItemModal.price <= 0 || editItemModal.quantity <= 0}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl text-sm font-bold cursor-pointer whitespace-nowrap transition-colors"
              >
                <i className="ri-save-line mr-1" />
                {editItemModal.id ? 'Guardar cambios' : 'Agregar a cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}