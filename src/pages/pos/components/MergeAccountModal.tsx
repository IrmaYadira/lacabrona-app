import { useState, useEffect, useCallback } from 'react';
import { supabasePos } from '../supabasePos';
import type { PosAccount, PosAccountItem } from '../types';
import { AREA_LABELS } from '../types';

interface MergeAccountModalProps {
  sourceAccount: PosAccount;
  sourceItems: PosAccountItem[];
  onClose: () => void;
  onMerged: (targetId: number) => void;
}

export default function MergeAccountModal({
  sourceAccount,
  sourceItems,
  onClose,
  onMerged,
}: MergeAccountModalProps) {
  const [accounts, setAccounts] = useState<PosAccount[]>([]);
  const [loading, setLoading] = useState(true);
  // IDs de cuentas ADICIONALES a fusionar (además de la cuenta origen actual)
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  // ID de la cuenta que queda como "destino final"
  const [targetId, setTargetId] = useState<number | null>(null);
  const [step, setStep] = useState<'select' | 'confirm' | 'done'>('select');
  const [merging, setMerging] = useState(false);
  const [mergedTotal, setMergedTotal] = useState(0);
  const [mergedCount, setMergedCount] = useState(0);

  const fetchAccounts = useCallback(async () => {
    const { data } = await supabasePos
      .from('pos_accounts')
      .select('*, pos_account_items(*)')
      .eq('status', 'open')
      .neq('id', sourceAccount.id);
    setAccounts((data ?? []) as PosAccount[]);
    setLoading(false);
  }, [sourceAccount.id]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    // Si se deselecciona la que era destino, limpiar destino
    setTargetId(prev => (prev === id ? null : prev));
  };

  // Todas las cuentas involucradas: origen + seleccionadas
  const selectedAccounts = accounts.filter(a => selectedIds.includes(a.id));

  // Todas las cuentas del grupo (origen + seleccionadas)
  const allGroupAccounts: PosAccount[] = [
    { ...sourceAccount, pos_account_items: sourceItems },
    ...selectedAccounts,
  ];

  const sourceTotal = sourceItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const selectedTotal = selectedAccounts.reduce(
    (s, a) => s + (a.pos_account_items ?? []).reduce((ss, i) => ss + i.unit_price * i.quantity, 0),
    0
  );
  const grandTotal = sourceTotal + selectedTotal;

  const targetAccount = targetId
    ? allGroupAccounts.find(a => a.id === targetId) ?? null
    : null;

  const canGoConfirm = selectedIds.length >= 1;
  const canMerge = !!targetId;

  const handleMerge = async () => {
    if (!targetId) return;
    setMerging(true);

    try {
      // Cuentas que se mueven (todas menos la destino)
      const accountsToMove = allGroupAccounts.filter(a => a.id !== targetId);
      const destAccount = allGroupAccounts.find(a => a.id === targetId)!;

      let currentFolioCounter = destAccount.folio_counter ?? 0;
      let totalItemsMoved = 0;

      for (const acc of accountsToMove) {
        const accItems: PosAccountItem[] =
          acc.id === sourceAccount.id
            ? sourceItems
            : (acc.pos_account_items ?? []);

        if (accItems.length === 0) continue;

        const folioNums = [...new Set(accItems.map(i => i.folio_number))].sort((a, b) => a - b);
        const folioMap: Record<number, number> = {};
        folioNums.forEach((f, idx) => {
          folioMap[f] = currentFolioCounter + idx + 1;
        });
        currentFolioCounter += folioNums.length;

        // Insertar items en destino
        const inserts = accItems.map(item => ({
          account_id: targetId,
          product_name: item.product_name,
          size: item.size || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          folio_number: folioMap[item.folio_number] ?? (currentFolioCounter),
          delivered: item.delivered,
          created_at: item.created_at,
        }));
        await supabasePos.from('pos_account_items').insert(inserts);

        // Borrar items originales
        const ids = accItems.map(i => i.id);
        if (ids.length > 0) {
          await supabasePos.from('pos_account_items').delete().in('id', ids);
        }

        const accTotal = accItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
        const destLabel = `${destAccount.spot} (${AREA_LABELS[destAccount.area as keyof typeof AREA_LABELS] ?? destAccount.area})`;
        const sourceLabel = `${acc.spot} (${AREA_LABELS[acc.area as keyof typeof AREA_LABELS] ?? acc.area})`;

        // Cerrar cuenta origen
        await supabasePos.from('pos_accounts').update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          notes: `Fusionada con ${destLabel}`,
        }).eq('id', acc.id);

        // Pago $0 en historial
        await supabasePos.from('pos_payments').insert({
          account_id: acc.id,
          payment_method: 'cash',
          subtotal: 0,
          card_fee: 0,
          total: 0,
          split_count: 1,
        });

        // Registrar evento de fusión en cuenta origen (fusionada)
        if (acc.customer_id) {
          await supabasePos.from('pos_account_events').insert({
            account_id: acc.id,
            customer_id: acc.customer_id,
            event_type: 'account_merged',
            description: `Cuenta ${sourceLabel} fusionada hacia ${destLabel}`,
            metadata: {
              spot: acc.spot,
              merged_from: sourceLabel,
              merged_into: destLabel,
              total: accTotal,
              items_count: accItems.length,
            },
          });
        }

        // Registrar evento de fusión en cuenta destino
        const destCustomerId = destAccount.customer_id ?? null;
        if (destCustomerId) {
          await supabasePos.from('pos_account_events').insert({
            account_id: targetId,
            customer_id: destCustomerId,
            event_type: 'account_merged',
            description: `${sourceLabel} fusionada a esta cuenta`,
            metadata: {
              spot: destAccount.spot,
              merged_from: sourceLabel,
              merged_into: destLabel,
              total: accTotal,
              items_count: accItems.length,
            },
          });
        }

        totalItemsMoved += accItems.reduce((s, i) => s + i.quantity, 0);
      }

      // Actualizar folio_counter en destino
      await supabasePos
        .from('pos_accounts')
        .update({ folio_counter: currentFolioCounter, updated_at: new Date().toISOString() })
        .eq('id', targetId);

      setMergedTotal(grandTotal);
      setMergedCount(totalItemsMoved);
      setStep('done');
    } catch (err) {
      console.error('Error fusionando:', err);
    } finally {
      setMerging(false);
    }
  };

  const areaLabel = (area: string) =>
    AREA_LABELS[area as keyof typeof AREA_LABELS] ?? area;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={!merging && step !== 'done' ? onClose : undefined}
      />
      <div className="relative bg-white rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <i className="ri-git-merge-line text-indigo-500" />
              Fusionar Cuentas
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === 'select' && 'Selecciona las cuentas a unir y elige cuál queda como destino'}
              {step === 'confirm' && 'Confirma el resumen antes de fusionar'}
              {step === 'done' && 'Fusión completada'}
            </p>
          </div>
          {step !== 'done' && !merging && (
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
            >
              <i className="ri-close-line text-gray-500" />
            </button>
          )}
        </div>

        {/* PASO: DONE */}
        {step === 'done' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-3 bg-green-100 rounded-full flex items-center justify-center">
                <i className="ri-git-merge-line text-3xl text-green-600" />
              </div>
              <h4 className="font-bold text-gray-900 text-xl mb-1">¡Fusión completada!</h4>
              <p className="text-sm text-gray-500 mb-1">
                {mergedCount} producto{mergedCount !== 1 ? 's' : ''} fusionados en:
              </p>
              <p className="font-bold text-indigo-600 text-sm mb-4">
                {targetAccount?.spot} — {areaLabel(targetAccount?.area ?? '')}
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 inline-block mb-4">
                <p className="text-xs text-gray-500 mb-1">Total combinado</p>
                <p className="text-3xl font-black text-amber-600">${mergedTotal.toFixed(2)}</p>
              </div>
              <p className="text-xs text-gray-400 mb-6">
                Las cuentas fusionadas fueron cerradas automáticamente
              </p>
              <button
                onClick={() => targetId && onMerged(targetId)}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className="ri-arrow-right-line mr-2" />
                Ir a la cuenta fusionada
              </button>
            </div>
          </div>
        )}

        {/* PASO: CONFIRM */}
        {step === 'confirm' && !merging && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              Resumen — ¿cuál queda como cuenta final?
            </p>
            <p className="text-xs text-gray-400">
              Toca la cuenta donde quieres que queden todos los productos
            </p>

            <div className="space-y-2">
              {allGroupAccounts.map(acc => {
                const accItems = acc.id === sourceAccount.id
                  ? sourceItems
                  : (acc.pos_account_items ?? []);
                const accTotal = accItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
                const isTarget = targetId === acc.id;

                return (
                  <button
                    key={acc.id}
                    onClick={() => setTargetId(isTarget ? null : acc.id)}
                    className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      isTarget
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-indigo-300 bg-white'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                      isTarget ? 'bg-green-500' : 'bg-gray-100'
                    }`}>
                      {isTarget
                        ? <i className="ri-checkbox-circle-fill text-white text-xl" />
                        : <i className="ri-map-pin-2-line text-gray-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className={`font-bold text-sm ${isTarget ? 'text-green-800' : 'text-gray-900'}`}>
                          {acc.spot}
                        </p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          isTarget ? 'bg-green-200 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {areaLabel(acc.area)}
                        </span>
                        {acc.id === sourceAccount.id && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
                            Actual
                          </span>
                        )}
                        {isTarget && (
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">
                            ← Destino
                          </span>
                        )}
                      </div>
                      {acc.customer_name && (
                        <p className="text-xs text-gray-500 mt-0.5">{acc.customer_name}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {accItems.slice(0, 4).map((item, idx) => (
                          <span key={idx} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            {item.quantity}x {item.product_name}
                          </span>
                        ))}
                        {accItems.length > 4 && (
                          <span className="text-xs text-gray-400">+{accItems.length - 4} más</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="text-xs text-gray-400">Subtotal</p>
                      <p className="text-base font-black text-gray-700">${accTotal.toFixed(2)}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Total combinado preview */}
            <div className="bg-gray-900 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Total combinado</p>
                <span className="text-xs text-green-400 font-semibold">
                  {allGroupAccounts.length} cuentas
                </span>
              </div>
              {allGroupAccounts.map(acc => {
                const accItems = acc.id === sourceAccount.id ? sourceItems : (acc.pos_account_items ?? []);
                const accTotal = accItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
                return (
                  <div key={acc.id} className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400 flex items-center gap-1">
                      {acc.id === targetId && <i className="ri-star-fill text-green-400 text-xs" />}
                      {acc.spot}
                    </span>
                    <span className="text-amber-300">${accTotal.toFixed(2)}</span>
                  </div>
                );
              })}
              <div className="border-t border-gray-700 pt-2 mt-1 flex justify-between items-center">
                <span className="text-white font-bold">Gran Total</span>
                <span className="text-amber-400 text-2xl font-black">${grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {!canMerge && (
              <p className="text-xs text-center text-amber-600 flex items-center justify-center gap-1">
                <i className="ri-information-line" />
                Selecciona cuál cuenta queda como destino final
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('select')}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className="ri-arrow-left-line mr-1" />
                Atrás
              </button>
              <button
                onClick={handleMerge}
                disabled={!canMerge}
                className="flex-1 py-3 bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-2"
              >
                <i className="ri-git-merge-line" />
                Fusionar {allGroupAccounts.length} Cuentas
              </button>
            </div>
          </div>
        )}

        {/* Spinner de fusionando */}
        {merging && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-sm font-semibold text-gray-700">Fusionando cuentas...</p>
            <p className="text-xs text-gray-400">No cierres esta ventana</p>
          </div>
        )}

        {/* PASO: SELECT */}
        {step === 'select' && !merging && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* Cuenta actual (origen) — siempre incluida */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Cuenta actual (siempre incluida)
              </p>
              <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <i className="ri-checkbox-circle-fill text-white text-xl" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-bold text-gray-900 text-sm">{sourceAccount.spot}</p>
                    <span className="text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full font-bold">
                      {areaLabel(sourceAccount.area)}
                    </span>
                  </div>
                  {sourceAccount.customer_name && (
                    <p className="text-xs text-gray-600 mt-0.5">{sourceAccount.customer_name}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {sourceItems.slice(0, 4).map((item, idx) => (
                      <span key={idx} className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        {item.quantity}x {item.product_name}
                      </span>
                    ))}
                    {sourceItems.length > 4 && (
                      <span className="text-xs text-amber-600">+{sourceItems.length - 4} más</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">Total</p>
                  <p className="text-base font-black text-amber-600">${sourceTotal.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Otras cuentas para agregar */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                Agregar otras cuentas a la fusión
              </p>
              <p className="text-xs text-gray-400 mb-2">
                Puedes seleccionar una o varias a la vez
              </p>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : accounts.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <i className="ri-inbox-line text-3xl text-gray-300 mb-2 block" />
                  <p className="text-sm text-gray-500">No hay otras cuentas abiertas</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {accounts.map(acc => {
                    const accItems = acc.pos_account_items ?? [];
                    const accTotal = accItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
                    const isSelected = selectedIds.includes(acc.id);

                    return (
                      <button
                        key={acc.id}
                        onClick={() => toggleSelect(acc.id)}
                        className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected ? 'bg-indigo-500' : 'bg-gray-100'
                        }`}>
                          {isSelected
                            ? <i className="ri-checkbox-circle-fill text-white text-xl" />
                            : <i className="ri-add-circle-line text-gray-400 text-xl" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className={`font-bold text-sm ${isSelected ? 'text-indigo-800' : 'text-gray-900'}`}>
                              {acc.spot}
                            </p>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                              isSelected ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {areaLabel(acc.area)}
                            </span>
                          </div>
                          {acc.customer_name && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{acc.customer_name}</p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {accItems.slice(0, 3).map((item, idx) => (
                              <span key={idx} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                {item.quantity}x {item.product_name}
                              </span>
                            ))}
                            {accItems.length > 3 && (
                              <span className="text-xs text-gray-400">+{accItems.length - 3} más</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <p className="text-xs text-gray-400">Subtotal</p>
                          <p className="text-base font-black text-gray-700">${accTotal.toFixed(2)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Barra de resumen flotante */}
            {canGoConfirm && (
              <div className="bg-gray-900 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-400">
                    {allGroupAccounts.length} cuentas seleccionadas
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {allGroupAccounts.map(a => a.spot).join(' + ')}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">Total combinado</p>
                  <p className="text-xl font-black text-amber-400">${grandTotal.toFixed(2)}</p>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                onClick={() => setStep('confirm')}
                disabled={!canGoConfirm}
                className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-2"
              >
                Siguiente
                <i className="ri-arrow-right-line" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}