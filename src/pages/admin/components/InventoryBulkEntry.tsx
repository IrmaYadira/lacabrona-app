import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Product {
  id: number;
  name: string;
  category_id: number | null;
  stock: number;
  price: number | null;
  status: string;
  product_categories?: { name: string } | null;
}

interface EntryLine {
  id: string;
  productId: number | null;
  productName: string;
  quantity: string;
  currentStock: number;
}

interface BulkEntry {
  id: number;
  reference: string;
  supplier: string;
  entry_date: string;
  total_lines: number;
  total_units: number;
  created_at: string;
}

interface Toast {
  msg: string;
  type: 'success' | 'error';
}

export default function InventoryBulkEntry() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // Comprobante
  const [reference, setReference] = useState('');
  const [supplier, setSupplier] = useState('');
  const [entryDate, setEntryDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [note, setNote] = useState('');

  // Líneas de entrada
  const [lines, setLines] = useState<EntryLine[]>([]);

  // Producto buscado para cada línea
  const [searchByLine, setSearchByLine] = useState<Record<string, string>>();
  const [showPickerForLine, setShowPickerForLine] = useState<string | null>(null);

  // Historial de entradas masivas
  const [entries, setEntries] = useState<BulkEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchProducts = useCallback(async () => {
    const { data } = await supabase
      .from('product_items')
      .select('id, name, category_id, stock, price, status, product_categories(name)')
      .eq('status', 'active')
      .order('name');
    setProducts((data ?? []) as Product[]);
    setLoading(false);
  }, []);

  const fetchEntries = useCallback(async () => {
    // Agrupar por referencia (note que contiene el patrón de entrada masiva)
    const { data } = await supabase
      .from('inventory_adjustments')
      .select('*')
      .ilike('note', '%Entrada masiva%')
      .order('created_at', { ascending: false })
      .limit(200);

    const raw = (data ?? []) as Array<{
      id: number;
      note: string | null;
      created_at: string;
      quantity: number;
    }>;

    // Agrupar por la referencia extraída del note
    const grouped = new Map<string, { supplier: string; date: string; lines: number; units: number; created_at: string }>();
    raw.forEach(row => {
      const noteText = row.note ?? '';
      const refMatch = noteText.match(/Nota:\s*([^|]+)/);
      const ref = refMatch ? refMatch[1].trim() : 'Sin referencia';
      const supplierMatch = noteText.match(/Proveedor:\s*([^|]+)/);
      const supplierName = supplierMatch ? supplierMatch[1].trim() : '';
      const dateMatch = noteText.match(/Fecha:\s*([^|]+)/);
      const dateStr = dateMatch ? dateMatch[1].trim() : '';

      const existing = grouped.get(ref);
      if (existing) {
        existing.lines += 1;
        existing.units += row.quantity;
      } else {
        grouped.set(ref, {
          supplier: supplierName,
          date: dateStr,
          lines: 1,
          units: row.quantity,
          created_at: row.created_at,
        });
      }
    });

    const entriesList: BulkEntry[] = Array.from(grouped.entries()).map(([ref, info], idx) => ({
      id: idx + 1,
      reference: ref,
      supplier: info.supplier,
      entry_date: info.date,
      total_lines: info.lines,
      total_units: info.units,
      created_at: info.created_at,
    }));

    setEntries(entriesList);
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchEntries();
  }, [fetchProducts, fetchEntries]);

  const addLine = () => {
    const newId = `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setLines(prev => [...prev, { id: newId, productId: null, productName: '', quantity: '', currentStock: 0 }]);
    setSearchByLine(prev => ({ ...prev, [newId]: '' }));
  };

  const removeLine = (lineId: string) => {
    setLines(prev => prev.filter(l => l.id !== lineId));
    setSearchByLine(prev => {
      const copy = { ...prev };
      delete copy[lineId];
      return copy;
    });
  };

  const updateLineProduct = (lineId: string, product: Product) => {
    setLines(prev => prev.map(l =>
      l.id === lineId
        ? { ...l, productId: product.id, productName: product.name, currentStock: product.stock ?? 0 }
        : l
    ));
    setSearchByLine(prev => ({ ...prev, [lineId]: product.name }));
    setShowPickerForLine(null);
  };

  const updateLineQuantity = (lineId: string, qty: string) => {
    setLines(prev => prev.map(l =>
      l.id === lineId ? { ...l, quantity: qty } : l
    ));
  };

  const filteredProductsForLine = (lineId: string) => {
    const query = (searchByLine[lineId] ?? '').toLowerCase().trim();
    if (!query) return [];
    return products.filter(p =>
      p.name.toLowerCase().includes(query) &&
      !lines.some(l => l.id !== lineId && l.productId === p.id)
    ).slice(0, 6);
  };

  const getTotalUnits = () => {
    return lines.reduce((sum, l) => {
      const q = parseInt(l.quantity);
      return sum + (isNaN(q) ? 0 : q);
    }, 0);
  };

  const getTotalValue = () => {
    return lines.reduce((sum, l) => {
      const q = parseInt(l.quantity);
      const product = products.find(p => p.id === l.productId);
      const price = product?.price ?? 0;
      return sum + (isNaN(q) ? 0 : q * price);
    }, 0);
  };

  const handleSave = async () => {
    // Validaciones
    if (!reference.trim()) {
      showToast('Ingresa la nota o referencia del comprobante', 'error');
      return;
    }
    if (!supplier.trim()) {
      showToast('Ingresa el proveedor', 'error');
      return;
    }
    const validLines = lines.filter(l => l.productId !== null && l.quantity && parseInt(l.quantity) > 0);
    if (validLines.length === 0) {
      showToast('Agrega al menos una línea con producto y cantidad', 'error');
      return;
    }

    setSaving(true);

    const baseNote = `Entrada masiva | Nota: ${reference.trim()} | Proveedor: ${supplier.trim()} | Fecha: ${entryDate}${note.trim() ? ` | ${note.trim()}` : ''}`;

    const errors: string[] = [];

    for (const line of validLines) {
      const product = products.find(p => p.id === line.productId);
      if (!product) continue;

      const qty = parseInt(line.quantity);
      const stockBefore = product.stock ?? 0;
      const stockAfter = stockBefore + qty;

      const { error: adjError } = await supabase.from('inventory_adjustments').insert({
        product_id: product.id,
        product_name: product.name,
        adjustment_type: 'entry',
        quantity: qty,
        stock_before: stockBefore,
        stock_after: stockAfter,
        note: baseNote,
        created_by: 'admin',
      });

      if (adjError) {
        errors.push(`${product.name}: ${adjError.message}`);
        continue;
      }

      const { error: updError } = await supabase.from('product_items').update({
        stock: stockAfter,
        updated_at: new Date().toISOString(),
      }).eq('id', product.id);

      if (updError) {
        errors.push(`${product.name}: error al actualizar stock`);
      }
    }

    if (errors.length > 0) {
      showToast(`Errores en ${errors.length} productos`, 'error');
      console.error('Errores entrada masiva:', errors);
      setSaving(false);
      return;
    }

    showToast(`Entrada masiva registrada: ${validLines.length} productos, ${getTotalUnits()} unidades`);
    setSaving(false);

    // Reset
    setReference('');
    setSupplier('');
    setNote('');
    setLines([]);
    setSearchByLine({});
    setShowPickerForLine(null);
    await fetchProducts();
    await fetchEntries();
  };

  const getStockBadge = (stock: number) => {
    if (stock <= 0) return 'bg-red-100 text-red-700 border-red-200';
    if (stock <= 5) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  };

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-bold flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-gray-900 text-white' : 'bg-red-500 text-white'
        }`}>
          <i className={toast.type === 'success' ? 'ri-check-line' : 'ri-error-warning-line'} />
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-gray-900">Entrada Masiva</h2>
          <p className="text-sm text-gray-500">Registra múltiples productos en una sola entrada</p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
        >
          <i className={showHistory ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} />
          {showHistory ? 'Ocultar historial' : 'Ver entradas realizadas'}
        </button>
      </div>

      {/* Historial de entradas */}
      {showHistory && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">Entradas masivas registradas</h3>
          </div>
          {entries.length === 0 ? (
            <div className="p-8 text-center">
              <i className="ri-file-list-3-line text-3xl text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No hay entradas masivas registradas aún</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {entries.map(entry => (
                <div key={entry.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                        <i className="ri-file-list-3-line text-sm" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">Nota {entry.reference}</p>
                        <p className="text-xs text-gray-500">
                          {entry.supplier} · {entry.entry_date || new Date(entry.created_at).toLocaleDateString('es-MX')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-gray-500">{entry.total_lines} productos</span>
                      <span className="text-sm font-bold text-emerald-700">+{entry.total_units} unidades</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Comprobante */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <i className="ri-file-text-line text-amber-500 text-lg" />
          <h3 className="text-sm font-bold text-gray-900">Datos del comprobante</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Nota / Referencia *</label>
            <input
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="Ej: 7548"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Proveedor *</label>
            <input
              type="text"
              value={supplier}
              onChange={e => setSupplier(e.target.value)}
              placeholder="Ej: Corona, Pepsi, Coca..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Fecha</label>
            <input
              type="date"
              value={entryDate}
              onChange={e => setEntryDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Nota adicional (opcional)</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Ej: Entrega de lunes, caja dañada, etc."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Líneas de productos */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="ri-box-3-line text-amber-500 text-lg" />
            <h3 className="text-sm font-bold text-gray-900">Productos de la entrada</h3>
          </div>
          <button
            onClick={addLine}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-add-line" /> Agregar línea
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-xl">
            <i className="ri-box-3-line text-3xl text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No hay productos agregados. Haz clic en "Agregar línea" para empezar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lines.map((line, index) => (
              <div key={line.id} className="border border-gray-100 rounded-xl p-3 space-y-3 bg-gray-50/50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Línea</span>
                  <button
                    onClick={() => removeLine(line.id)}
                    className="ml-auto w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-500 cursor-pointer transition-colors"
                    title="Eliminar línea"
                  >
                    <i className="ri-delete-bin-line text-xs" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  {/* Producto */}
                  <div className="sm:col-span-7 relative">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Producto</label>
                    <div className="relative">
                      <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                      <input
                        type="text"
                        value={searchByLine[line.id] ?? ''}
                        onChange={e => {
                          setSearchByLine(prev => ({ ...prev, [line.id]: e.target.value }));
                          setShowPickerForLine(line.id);
                          if (line.productId !== null) {
                            setLines(prev => prev.map(l =>
                              l.id === line.id ? { ...l, productId: null, productName: '', currentStock: 0 } : l
                            ));
                          }
                        }}
                        onFocus={() => {
                          if ((searchByLine[line.id] ?? '').length > 0) {
                            setShowPickerForLine(line.id);
                          }
                        }}
                        placeholder="Escribe para buscar producto..."
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-amber-500"
                      />
                      {/* Producto seleccionado */}
                      {line.productId !== null && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-100">
                            <i className="ri-check-line" />
                            {line.productName}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${getStockBadge(line.currentStock)}`}>
                            Stock: {line.currentStock}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Dropdown de productos */}
                    {showPickerForLine === line.id && filteredProductsForLine(line.id).length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                        {filteredProductsForLine(line.id).map(product => (
                          <button
                            key={product.id}
                            onClick={() => updateLineProduct(line.id, product)}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2 border-b border-gray-50 last:border-0"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
                              <p className="text-xs text-gray-400">{product.product_categories?.name ?? 'Sin categoría'}</p>
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap ${getStockBadge(product.stock ?? 0)}`}>
                              {product.stock ?? 0} unid.
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Sin resultados */}
                    {showPickerForLine === line.id &&
                      (searchByLine[line.id] ?? '').length > 0 &&
                      filteredProductsForLine(line.id).length === 0 && (
                        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-center">
                          <p className="text-xs text-gray-400">No se encontraron productos</p>
                        </div>
                      )}
                  </div>

                  {/* Cantidad */}
                  <div className="sm:col-span-5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Cantidad</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={e => updateLineQuantity(line.id, e.target.value)}
                        placeholder="Ej: 40"
                        min="1"
                        className="flex-1 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-amber-500"
                      />
                      {line.quantity && parseInt(line.quantity) > 0 && line.productId !== null && (
                        <div className="text-xs text-gray-500 whitespace-nowrap">
                          Nuevo: <span className="font-bold text-emerald-700">{line.currentStock + parseInt(line.quantity)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Totales */}
        {lines.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Total de líneas</span>
              <span className="text-sm font-bold text-gray-900">{lines.filter(l => l.productId !== null && l.quantity && parseInt(l.quantity) > 0).length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Total unidades</span>
              <span className="text-sm font-bold text-emerald-700">{getTotalUnits()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Valor estimado</span>
              <span className="text-sm font-bold text-gray-900">${getTotalValue().toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Botón guardar */}
        {lines.length > 0 && (
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setLines([]);
                setSearchByLine({});
                setReference('');
                setSupplier('');
                setNote('');
              }}
              className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap"
            >
              Limpiar todo
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !reference.trim() || !supplier.trim()}
              className="flex-[2] py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold cursor-pointer whitespace-nowrap"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Registrando entrada...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <i className="ri-save-line" />
                  Guardar entrada masiva
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Cerrar dropdown al hacer click fuera */}
      {showPickerForLine !== null && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowPickerForLine(null)}
        />
      )}
    </div>
  );
}