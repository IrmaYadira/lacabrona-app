import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import InventoryBulkEntry from './InventoryBulkEntry';

interface Product {
  id: number;
  name: string;
  category_id: number | null;
  stock: number;
  price: number | null;
  status: string;
  product_categories?: { name: string } | null;
}

interface InventoryAdjustment {
  id: number;
  product_id: number;
  product_name: string;
  adjustment_type: string;
  quantity: number;
  stock_before: number;
  stock_after: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

interface PhysicalCount {
  id: number;
  product_id: number;
  product_name: string;
  physical_qty: number;
  system_qty: number;
  difference: number;
  note: string | null;
  counted_by: string | null;
  created_at: string;
}

type InventoryTab = 'productos' | 'entradas' | 'cuadre' | 'historial' | 'diferencias';

export default function InventoryManager() {
  const [activeTab, setActiveTab] = useState<InventoryTab>('productos');
  const [products, setProducts] = useState<Product[]>([]);
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [physicalCounts, setPhysicalCounts] = useState<PhysicalCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);

  // Modal de entrada
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryProduct, setEntryProduct] = useState<Product | null>(null);
  const [entryQuantity, setEntryQuantity] = useState('');
  const [entryNote, setEntryNote] = useState('');
  const [entryLoading, setEntryLoading] = useState(false);

  // Modal de cuadre
  const [showCountModal, setShowCountModal] = useState(false);
  const [countProduct, setCountProduct] = useState<Product | null>(null);
  const [countPhysical, setCountPhysical] = useState('');
  const [countNote, setCountNote] = useState('');
  const [countLoading, setCountLoading] = useState(false);

  // Modal de nuevo producto
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState<string>('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductStock, setNewProductStock] = useState('');
  const [newProductDescription, setNewProductDescription] = useState('');
  const [newProductLoading, setNewProductLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Edición inline de producto
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [editLoading, setEditLoading] = useState(false);

  // Quick name edit
  const [quickEditId, setQuickEditId] = useState<number | null>(null);
  const [quickEditName, setQuickEditName] = useState('');
  const [quickEditLoading, setQuickEditLoading] = useState(false);

  // Modal de ajuste de stock
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustStock, setAdjustStock] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);

  const handleStartEdit = (product: Product) => {
    setEditingProductId(product.id);
    setEditName(product.name);
    setEditPrice(product.price?.toString() ?? '');
    setEditStock(product.stock?.toString() ?? '0');
    setEditCategory(product.category_id ? String(product.category_id) : '');
  };

  const handleCancelEdit = () => {
    setEditingProductId(null);
    setEditName('');
    setEditPrice('');
    setEditStock('');
    setEditCategory('');
  };

  const handleSaveEdit = async (product: Product) => {
    const newPrice = parseFloat(editPrice);
    const newStock = parseInt(editStock);
    if (isNaN(newPrice) || newPrice < 0 || isNaN(newStock) || newStock < 0 || !editName.trim()) {
      showToast('Datos inválidos', 'error');
      return;
    }
    setEditLoading(true);

    const stockBefore = product.stock ?? 0;
    const stockDiff = newStock - stockBefore;

    // If stock changed, record adjustment
    if (stockDiff !== 0) {
      const { error: adjError } = await supabase.from('inventory_adjustments').insert({
        product_id: product.id,
        product_name: editName.trim(),
        adjustment_type: 'adjustment',
        quantity: stockDiff,
        stock_before: stockBefore,
        stock_after: newStock,
        note: `Ajuste de stock desde panel de inventario (antes: ${stockBefore}, después: ${newStock})`,
        created_by: 'admin',
      });
      if (adjError) {
        showToast('Error al registrar ajuste de stock', 'error');
        setEditLoading(false);
        return;
      }
    }

    const { error: updError } = await supabase.from('product_items').update({
      name: editName.trim(),
      price: newPrice,
      stock: newStock,
      category_id: editCategory ? parseInt(editCategory) : null,
      updated_at: new Date().toISOString(),
    }).eq('id', product.id);

    if (updError) {
      showToast('Error al actualizar producto', 'error');
      setEditLoading(false);
      return;
    }

    showToast(`Producto "${editName.trim()}" actualizado`);
    setEditLoading(false);
    setEditingProductId(null);
    await fetchData();
  };

  // Quick name edit
  const handleStartQuickEdit = (product: Product) => {
    setQuickEditId(product.id);
    setQuickEditName(product.name);
  };

  const handleCancelQuickEdit = () => {
    setQuickEditId(null);
    setQuickEditName('');
  };

  const handleSaveQuickEdit = async (product: Product) => {
    const trimmed = quickEditName.trim();
    if (!trimmed) {
      showToast('El nombre no puede estar vacío', 'error');
      return;
    }
    setQuickEditLoading(true);
    const { error } = await supabase.from('product_items').update({
      name: trimmed,
      updated_at: new Date().toISOString(),
    }).eq('id', product.id);
    if (error) {
      showToast('Error al renombrar producto', 'error');
      setQuickEditLoading(false);
      return;
    }
    showToast(`Producto renombrado a "${trimmed}"`);
    setQuickEditLoading(false);
    setQuickEditId(null);
    await fetchData();
  };

  // Modal de ajuste de stock
  const handleOpenAdjust = (product: Product) => {
    setAdjustProduct(product);
    setAdjustStock(String(product.stock ?? 0));
    setAdjustNote('');
    setShowAdjustModal(true);
  };

  const handleSaveAdjust = async () => {
    if (!adjustProduct || adjustStock === '') return;
    const newStock = parseInt(adjustStock);
    if (isNaN(newStock) || newStock < 0) {
      showToast('Stock inválido', 'error');
      return;
    }
    setAdjustLoading(true);
    const stockBefore = adjustProduct.stock ?? 0;
    const diff = newStock - stockBefore;

    if (diff !== 0) {
      const { error: adjError } = await supabase.from('inventory_adjustments').insert({
        product_id: adjustProduct.id,
        product_name: adjustProduct.name,
        adjustment_type: 'adjustment',
        quantity: diff,
        stock_before: stockBefore,
        stock_after: newStock,
        note: adjustNote.trim() || `Ajuste de stock: ${stockBefore} → ${newStock}`,
        created_by: 'admin',
      });
      if (adjError) {
        showToast('Error al registrar ajuste', 'error');
        setAdjustLoading(false);
        return;
      }
    }

    const { error: updError } = await supabase.from('product_items').update({
      stock: newStock,
      updated_at: new Date().toISOString(),
    }).eq('id', adjustProduct.id);

    if (updError) {
      showToast('Error al actualizar stock', 'error');
      setAdjustLoading(false);
      return;
    }

    showToast(`Stock ajustado: ${adjustProduct.name} → ${newStock} unidades`);
    setAdjustLoading(false);
    setShowAdjustModal(false);
    await fetchData();
  };

  // Modal de merma
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [wasteProduct, setWasteProduct] = useState<Product | null>(null);
  const [wasteQuantity, setWasteQuantity] = useState('');
  const [wasteNote, setWasteNote] = useState('');
  const [wasteLoading, setWasteLoading] = useState(false);

  const handleOpenWaste = (product: Product) => {
    setWasteProduct(product);
    setWasteQuantity('');
    setWasteNote('');
    setShowWasteModal(true);
  };

  const handleSaveWaste = async () => {
    if (!wasteProduct || !wasteQuantity || parseInt(wasteQuantity) <= 0) return;
    if (!wasteNote.trim()) {
      showToast('Debes indicar el motivo de la merma', 'error');
      return;
    }
    setWasteLoading(true);
    const qty = parseInt(wasteQuantity);
    const stockBefore = wasteProduct.stock ?? 0;
    const stockAfter = Math.max(0, stockBefore - qty);

    const { error: adjError } = await supabase.from('inventory_adjustments').insert({
      product_id: wasteProduct.id,
      product_name: wasteProduct.name,
      adjustment_type: 'waste',
      quantity: -qty,
      stock_before: stockBefore,
      stock_after: stockAfter,
      note: wasteNote.trim(),
      created_by: 'admin',
    });

    if (adjError) {
      showToast('Error al registrar merma', 'error');
      setWasteLoading(false);
      return;
    }

    const { error: updError } = await supabase.from('product_items').update({ stock: stockAfter, updated_at: new Date().toISOString() }).eq('id', wasteProduct.id);
    if (updError) {
      showToast('Error al actualizar stock', 'error');
      setWasteLoading(false);
      return;
    }

    showToast(`Merma registrada: ${wasteProduct.name} -${qty} unidades`);
    setWasteLoading(false);
    setShowWasteModal(false);
    await fetchData();
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: productsData }, { data: catsData }, { data: adjData }, { data: countData }] = await Promise.all([
      supabase.from('product_items').select('id, name, category_id, stock, price, status, product_categories(name)').order('name'),
      supabase.from('product_categories').select('id, name').order('sort_order'),
      supabase.from('inventory_adjustments').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('physical_inventory_counts').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    setProducts((productsData ?? []) as Product[]);
    setCategories(catsData ?? []);
    setAdjustments((adjData ?? []) as InventoryAdjustment[]);
    setPhysicalCounts((countData ?? []) as PhysicalCount[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel('inventory-manager')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_items' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_adjustments' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'physical_inventory_counts' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || String(p.category_id) === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Sorting
  const [sortField, setSortField] = useState<'name' | 'category' | 'stock' | 'price'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: 'name' | 'category' | 'stock' | 'price') => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;
    switch (sortField) {
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case 'category':
        aVal = (a.product_categories?.name ?? '').toLowerCase();
        bVal = (b.product_categories?.name ?? '').toLowerCase();
        break;
      case 'stock':
        aVal = a.stock ?? 0;
        bVal = b.stock ?? 0;
        break;
      case 'price':
        aVal = a.price ?? 0;
        bVal = b.price ?? 0;
        break;
      default:
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
    }
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleOpenEntry = (product: Product) => {
    setEntryProduct(product);
    setEntryQuantity('');
    setEntryNote('');
    setShowEntryModal(true);
  };

  const handleSaveEntry = async () => {
    if (!entryProduct || !entryQuantity || parseInt(entryQuantity) <= 0) return;
    setEntryLoading(true);
    const qty = parseInt(entryQuantity);
    const stockBefore = entryProduct.stock ?? 0;
    const stockAfter = stockBefore + qty;

    const { error: adjError } = await supabase.from('inventory_adjustments').insert({
      product_id: entryProduct.id,
      product_name: entryProduct.name,
      adjustment_type: 'entry',
      quantity: qty,
      stock_before: stockBefore,
      stock_after: stockAfter,
      note: entryNote || 'Entrada de inventario',
      created_by: 'admin',
    });

    if (adjError) {
      showToast('Error al registrar entrada', 'error');
      setEntryLoading(false);
      return;
    }

    const { error: updError } = await supabase.from('product_items').update({ stock: stockAfter, updated_at: new Date().toISOString() }).eq('id', entryProduct.id);
    if (updError) {
      showToast('Error al actualizar stock', 'error');
      setEntryLoading(false);
      return;
    }

    showToast(`Entrada registrada: ${entryProduct.name} +${qty} unidades`);
    setEntryLoading(false);
    setShowEntryModal(false);
    await fetchData();
  };

  const handleOpenCount = (product: Product) => {
    setCountProduct(product);
    setCountPhysical(String(product.stock ?? 0));
    setCountNote('');
    setShowCountModal(true);
  };

  const handleSaveCount = async () => {
    if (!countProduct || countPhysical === '') return;
    setCountLoading(true);
    const physicalQty = parseInt(countPhysical);
    const systemQty = countProduct.stock ?? 0;
    const difference = physicalQty - systemQty;

    const { error } = await supabase.from('physical_inventory_counts').insert({
      product_id: countProduct.id,
      product_name: countProduct.name,
      physical_qty: physicalQty,
      system_qty: systemQty,
      difference,
      note: countNote || null,
      counted_by: 'admin',
    });

    if (error) {
      showToast('Error al registrar cuadre', 'error');
      setCountLoading(false);
      return;
    }

    showToast(`Cuadre registrado: ${countProduct.name} — Diferencia: ${difference > 0 ? '+' : ''}${difference}`);
    setCountLoading(false);
    setShowCountModal(false);
    await fetchData();
  };

  const handleOpenNewProduct = () => {
    setNewProductName('');
    setNewProductCategory(categories[0]?.id ? String(categories[0].id) : '');
    setNewProductPrice('');
    setNewProductStock('');
    setNewProductDescription('');
    setShowNewProductModal(true);
  };

  const handleSaveNewProduct = async () => {
    if (!newProductName.trim() || !newProductPrice || parseFloat(newProductPrice) < 0 || !newProductStock || parseInt(newProductStock) < 0) {
      showToast('Completa todos los campos obligatorios', 'error');
      return;
    }
    setNewProductLoading(true);

    const stockQty = parseInt(newProductStock);
    const priceVal = parseFloat(newProductPrice);
    const categoryId = newProductCategory ? parseInt(newProductCategory) : null;

    const { data: productData, error: insertError } = await supabase
      .from('product_items')
      .insert({
        name: newProductName.trim(),
        category_id: categoryId,
        price: priceVal,
        stock: stockQty,
        status: 'active',
        description: newProductDescription.trim() || null,
        currency: 'USD',
        media: '[]',
        discount_enabled: false,
      })
      .select('id, name, stock')
      .single();

    if (insertError || !productData) {
      showToast('Error al crear el producto', 'error');
      setNewProductLoading(false);
      return;
    }

    // Registrar entrada inicial de inventario
    const { error: adjError } = await supabase.from('inventory_adjustments').insert({
      product_id: productData.id,
      product_name: productData.name,
      adjustment_type: 'entry',
      quantity: stockQty,
      stock_before: 0,
      stock_after: stockQty,
      note: 'Stock inicial al crear producto',
      created_by: 'admin',
    });

    if (adjError) {
      showToast('Producto creado pero error al registrar entrada', 'error');
      setNewProductLoading(false);
      setShowNewProductModal(false);
      await fetchData();
      return;
    }

    showToast(`Producto "${productData.name}" creado con ${stockQty} unidades de stock inicial`);
    setNewProductLoading(false);
    setShowNewProductModal(false);
    await fetchData();
  };

  // Get latest physical count per product
  const latestPhysicalCounts = new Map<number, PhysicalCount>();
  physicalCounts.forEach(c => {
    if (!latestPhysicalCounts.has(c.product_id)) {
      latestPhysicalCounts.set(c.product_id, c);
    }
  });

  const productsWithDifferences = products.map(p => {
    const count = latestPhysicalCounts.get(p.id);
    return {
      ...p,
      physicalQty: count?.physical_qty ?? null,
      difference: count?.difference ?? null,
      lastCountDate: count?.created_at ?? null,
    };
  }).filter(p => p.difference !== null && p.difference !== 0);

  const getStockBadge = (stock: number) => {
    if (stock <= 0) return 'bg-red-100 text-red-700 border-red-200';
    if (stock <= 5) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  };

  const getAdjustmentBadge = (type: string) => {
    switch (type) {
      case 'entry': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'sale': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'waste': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'adjustment': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'physical_count': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getAdjustmentLabel = (type: string) => {
    switch (type) {
      case 'entry': return 'Entrada';
      case 'sale': return 'Venta';
      case 'waste': return 'Merma';
      case 'adjustment': return 'Ajuste';
      case 'physical_count': return 'Cuadre';
      default: return type;
    }
  };

  const handleExportCSV = () => {
    const data = filteredProducts.length > 0 ? filteredProducts : products;
    const rows = [
      ['Producto', 'Categoria', 'Precio', 'Stock', 'Valor Total', 'Estado'],
      ...data.map(p => {
        const stock = p.stock ?? 0;
        const price = p.price ?? 0;
        const total = stock * price;
        let estado = 'OK';
        if (stock <= 0) estado = 'Sin stock';
        else if (stock <= 5) estado = 'Bajo';
        return [
          `"${p.name.replace(/"/g, '""')}"`,
          `"${(p.product_categories?.name ?? 'Sin categoria').replace(/"/g, '""')}"`,
          price.toFixed(2),
          String(stock),
          total.toFixed(2),
          estado,
        ];
      }),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `inventario_${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('CSV exportado correctamente');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-gray-900">Control de Inventario</h2>
          <p className="text-sm text-gray-500">Gestiona entradas, cuadre físico y diferencias</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white rounded-xl border border-gray-200 p-1 gap-1 overflow-x-auto">
            {([
              { id: 'productos' as InventoryTab, label: 'Productos', icon: 'ri-box-3-line' },
              { id: 'entradas' as InventoryTab, label: 'Entradas', icon: 'ri-file-list-3-line' },
              { id: 'cuadre' as InventoryTab, label: 'Cuadre', icon: 'ri-scales-3-line' },
              { id: 'diferencias' as InventoryTab, label: 'Diferencias', icon: 'ri-error-warning-line' },
              { id: 'historial' as InventoryTab, label: 'Historial', icon: 'ri-history-line' },
            ]).map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${
                  activeTab === t.id ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <i className={t.icon} />
                {t.label}
                {t.id === 'diferencias' && productsWithDifferences.length > 0 && (
                  <span className="bg-red-500 text-white text-xs font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                    {productsWithDifferences.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-bold flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-gray-900 text-white' : 'bg-red-500 text-white'
        }`}>
          <i className={toast.type === 'success' ? 'ri-check-line' : 'ri-error-warning-line'} />
          {toast.msg}
        </div>
      )}

      {/* ── TAB: PRODUCTOS ── */}
      {activeTab === 'productos' && (
        <>
          {/* Filters + New Product */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar producto..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="all">Todas las categorías</option>
              {categories.map(c => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={handleOpenNewProduct}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-add-line" /> Nuevo Producto
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-file-download-line" /> Exportar CSV
            </button>
          </div>

          {/* Products table */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <i className="ri-box-3-line text-4xl text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">No se encontraron productos</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <div className="grid grid-cols-12 text-xs font-semibold text-gray-500 uppercase tracking-wide items-center">
                  <button
                    onClick={() => handleSort('name')}
                    className="col-span-4 flex items-center gap-1 cursor-pointer hover:text-gray-700 transition-colors text-left"
                  >
                    Producto
                    {sortField === 'name' && (
                      sortDirection === 'asc'
                        ? <i className="ri-arrow-up-s-line text-amber-500" />
                        : <i className="ri-arrow-down-s-line text-amber-500" />
                    )}
                  </button>
                  <button
                    onClick={() => handleSort('category')}
                    className="col-span-2 flex items-center justify-center gap-1 cursor-pointer hover:text-gray-700 transition-colors text-center"
                  >
                    Categoría
                    {sortField === 'category' && (
                      sortDirection === 'asc'
                        ? <i className="ri-arrow-up-s-line text-amber-500" />
                        : <i className="ri-arrow-down-s-line text-amber-500" />
                    )}
                  </button>
                  <button
                    onClick={() => handleSort('price')}
                    className="col-span-1 flex items-center justify-center gap-1 cursor-pointer hover:text-gray-700 transition-colors text-center"
                  >
                    Precio
                    {sortField === 'price' && (
                      sortDirection === 'asc'
                        ? <i className="ri-arrow-up-s-line text-amber-500" />
                        : <i className="ri-arrow-down-s-line text-amber-500" />
                    )}
                  </button>
                  <button
                    onClick={() => handleSort('stock')}
                    className="col-span-2 flex items-center justify-center gap-1 cursor-pointer hover:text-gray-700 transition-colors text-center"
                  >
                    Stock
                    {sortField === 'stock' && (
                      sortDirection === 'asc'
                        ? <i className="ri-arrow-up-s-line text-amber-500" />
                        : <i className="ri-arrow-down-s-line text-amber-500" />
                    )}
                  </button>
                  <span className="col-span-3 text-right">Acciones</span>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {sortedProducts.map(product => {
                  const isEditing = editingProductId === product.id;
                  const isQuickEditing = quickEditId === product.id;
                  return (
                    <div key={product.id} className={`px-5 py-3 transition-colors ${isEditing ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                      <div className="grid grid-cols-12 items-center gap-2">
                        {/* Nombre */}
                        <div className="col-span-4">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              className="w-full px-2 py-1.5 border border-amber-300 rounded-lg text-sm font-bold text-gray-900 focus:outline-none focus:border-amber-500"
                            />
                          ) : isQuickEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={quickEditName}
                                onChange={e => setQuickEditName(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveQuickEdit(product);
                                  if (e.key === 'Escape') handleCancelQuickEdit();
                                }}
                                autoFocus
                                className="flex-1 px-2 py-1.5 border border-amber-300 rounded-lg text-sm font-bold text-gray-900 focus:outline-none focus:border-amber-500"
                              />
                              <button
                                onClick={() => handleSaveQuickEdit(product)}
                                disabled={quickEditLoading}
                                className="w-6 h-6 flex items-center justify-center rounded bg-emerald-500 text-white cursor-pointer"
                                title="Guardar"
                              >
                                {quickEditLoading ? (
                                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <i className="ri-check-line text-xs" />
                                )}
                              </button>
                              <button
                                onClick={handleCancelQuickEdit}
                                className="w-6 h-6 flex items-center justify-center rounded bg-gray-300 text-white cursor-pointer"
                                title="Cancelar"
                              >
                                <i className="ri-close-line text-xs" />
                              </button>
                            </div>
                          ) : (
                            <div className="group/name flex items-center gap-1">
                              <p
                                className="text-sm font-semibold text-gray-900 leading-tight cursor-pointer hover:text-amber-600 transition-colors"
                                onClick={() => handleStartQuickEdit(product)}
                                title="Haz clic para renombrar"
                              >
                                {product.name}
                              </p>
                              <i className="ri-pencil-line text-gray-300 text-xs opacity-0 group-hover/name:opacity-100 transition-opacity cursor-pointer" onClick={() => handleStartQuickEdit(product)} />
                            </div>
                          )}
                        </div>
                        {/* Categoría */}
                        <div className="col-span-2 text-center">
                          {isEditing ? (
                            <select
                              value={editCategory}
                              onChange={e => setEditCategory(e.target.value)}
                              className="w-full px-2 py-1.5 border border-amber-300 rounded-lg text-xs text-gray-600 focus:outline-none focus:border-amber-500 cursor-pointer bg-white"
                            >
                              <option value="">Sin categoría</option>
                              {categories.map(c => (
                                <option key={c.id} value={String(c.id)}>{c.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-gray-500">{product.product_categories?.name ?? 'Sin categoría'}</span>
                          )}
                        </div>
                        {/* Precio */}
                        <div className="col-span-1 text-center">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editPrice}
                              onChange={e => setEditPrice(e.target.value)}
                              min="0"
                              step="0.01"
                              className="w-full px-2 py-1.5 border border-amber-300 rounded-lg text-xs text-gray-600 focus:outline-none focus:border-amber-500"
                            />
                          ) : (
                            <span className="text-xs text-gray-500">MXN${(product.price ?? 0).toFixed(2)}</span>
                          )}
                        </div>
                        {/* Stock */}
                        <div className="col-span-2 text-center">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editStock}
                              onChange={e => setEditStock(e.target.value)}
                              min="0"
                              className="w-20 px-2 py-1.5 border border-amber-300 rounded-lg text-sm font-bold text-center text-gray-900 focus:outline-none focus:border-amber-500"
                            />
                          ) : (
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getStockBadge(product.stock ?? 0)}`}>
                              {product.stock ?? 0} unid.
                            </span>
                          )}
                        </div>
                        {/* Acciones */}
                        <div className="col-span-3 flex justify-end gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSaveEdit(product)}
                                disabled={editLoading}
                                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
                              >
                                {editLoading ? (
                                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <i className="ri-check-line" />
                                )}
                                Guardar
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
                              >
                                <i className="ri-close-line" /> Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleStartEdit(product)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
                              >
                                <i className="ri-pencil-line" /> Editar
                              </button>
                              <button
                                onClick={() => handleOpenEntry(product)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
                              >
                                <i className="ri-add-line" /> Entrada
                              </button>
                              <button
                                onClick={() => handleOpenAdjust(product)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
                                title="Ajustar stock a un número exacto"
                              >
                                <i className="ri-arrow-up-down-line" /> Ajustar
                              </button>
                              <button
                                onClick={() => handleOpenCount(product)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
                              >
                                <i className="ri-scales-3-line" /> Cuadre
                              </button>
                              <button
                                onClick={() => handleOpenWaste(product)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
                              >
                                <i className="ri-delete-bin-line" /> Merma
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400 font-semibold">
                  {sortedProducts.length} productos · Total en stock: {sortedProducts.reduce((s, p) => s + (p.stock ?? 0), 0)} unidades
                </span>
                <span className="text-xs text-gray-400 font-semibold">
                  Valor estimado: MXN${sortedProducts.reduce((s, p) => s + (p.stock ?? 0) * (p.price ?? 0), 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB: ENTRADAS MASIVAS ── */}
      {activeTab === 'entradas' && (
        <InventoryBulkEntry />
      )}

      {/* ── TAB: CUADRE ── */}
      {activeTab === 'cuadre' && (
        <>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar producto para cuadre..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="all">Todas las categorías</option>
              {categories.map(c => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <div className="grid grid-cols-12 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <span className="col-span-4">Producto</span>
                  <span className="col-span-2 text-center">Sistema</span>
                  <span className="col-span-2 text-center">Físico</span>
                  <span className="col-span-2 text-center">Diferencia</span>
                  <span className="col-span-2 text-right">Acción</span>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {products.filter(p => {
                  const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
                  const matchesCategory = selectedCategory === 'all' || String(p.category_id) === selectedCategory;
                  return matchesSearch && matchesCategory;
                }).map(product => {
                  const count = latestPhysicalCounts.get(product.id);
                  const diff = count?.difference ?? null;
                  return (
                    <div key={product.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                      <div className="grid grid-cols-12 items-center gap-2">
                        <div className="col-span-4">
                          <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-400">{product.product_categories?.name ?? 'Sin categoría'}</p>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="text-sm font-bold text-gray-900">{product.stock ?? 0}</span>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className={`text-sm font-bold ${count ? 'text-gray-900' : 'text-gray-300'}`}>
                            {count?.physical_qty ?? '—'}
                          </span>
                        </div>
                        <div className="col-span-2 text-center">
                          {diff !== null ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                              diff === 0 ? 'bg-emerald-100 text-emerald-700' : diff > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {diff > 0 ? '+' : ''}{diff}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">Sin cuadre</span>
                          )}
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <button
                            onClick={() => handleOpenCount(product)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
                          >
                            <i className="ri-scales-3-line" /> Contar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB: DIFERENCIAS ── */}
      {activeTab === 'diferencias' && (
        <>
          {productsWithDifferences.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <i className="ri-check-double-line text-4xl text-emerald-300 mb-3" />
              <p className="text-gray-700 font-semibold text-sm">No hay diferencias registradas</p>
              <p className="text-gray-400 text-xs mt-1">Usa la pestaña "Cuadre" para contar físicamente y detectar diferencias</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <div className="grid grid-cols-12 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <span className="col-span-4">Producto</span>
                  <span className="col-span-2 text-center">Sistema</span>
                  <span className="col-span-2 text-center">Físico</span>
                  <span className="col-span-2 text-center">Diferencia</span>
                  <span className="col-span-2 text-center">Fecha</span>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {productsWithDifferences.map(product => {
                  const count = latestPhysicalCounts.get(product.id);
                  return (
                    <div key={product.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                      <div className="grid grid-cols-12 items-center gap-2">
                        <div className="col-span-4">
                          <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-400">{product.product_categories?.name ?? 'Sin categoría'}</p>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="text-sm font-bold text-gray-900">{product.stock ?? 0}</span>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="text-sm font-bold text-gray-900">{count?.physical_qty ?? 0}</span>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                            (count?.difference ?? 0) > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {(count?.difference ?? 0) > 0 ? '+' : ''}{count?.difference ?? 0}
                          </span>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="text-xs text-gray-400">
                            {count?.created_at ? new Date(count.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400 font-semibold">
                  {productsWithDifferences.length} productos con diferencias
                </span>
                <span className="text-xs text-gray-400 font-semibold">
                  Diferencia total: {productsWithDifferences.reduce((s, p) => s + (p.difference ?? 0), 0)} unidades
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB: HISTORIAL ── */}
      {activeTab === 'historial' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : adjustments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <i className="ri-history-line text-4xl text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">Sin movimientos de inventario</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <div className="grid grid-cols-12 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <span className="col-span-2">Fecha</span>
                  <span className="col-span-3">Producto</span>
                  <span className="col-span-2 text-center">Tipo</span>
                  <span className="col-span-2 text-center">Cantidad</span>
                  <span className="col-span-3 text-center">Stock</span>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {adjustments.map(adj => (
                  <div key={adj.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="grid grid-cols-12 items-center gap-2">
                      <div className="col-span-2">
                        <span className="text-xs text-gray-500">
                          {new Date(adj.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="col-span-3">
                        <p className="text-sm font-semibold text-gray-900">{adj.product_name}</p>
                        <p className="text-xs text-gray-400">{adj.note || 'Sin nota'}</p>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${getAdjustmentBadge(adj.adjustment_type)}`}>
                          {getAdjustmentLabel(adj.adjustment_type)}
                        </span>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className={`text-sm font-bold ${adj.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {adj.quantity > 0 ? '+' : ''}{adj.quantity}
                        </span>
                      </div>
                      <div className="col-span-3 text-center">
                        <span className="text-xs text-gray-500">
                          {adj.stock_before} → <span className="font-bold text-gray-900">{adj.stock_after}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                <span className="text-xs text-gray-400 font-semibold">{adjustments.length} movimientos registrados</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════ MODAL: NUEVO PRODUCTO ══════════ */}
      {showNewProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowNewProductModal(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Nuevo Producto</h3>
                <p className="text-xs text-gray-500">Agrega un producto al catálogo con stock inicial</p>
              </div>
              <button onClick={() => setShowNewProductModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer">
                <i className="ri-close-line text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Nombre del producto *</label>
                <input
                  type="text"
                  value={newProductName}
                  onChange={e => setNewProductName(e.target.value)}
                  placeholder="Ej: Cerveza Modelo 355ml"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Categoría *</label>
                  <select
                    value={newProductCategory}
                    onChange={e => setNewProductCategory(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 cursor-pointer bg-white"
                  >
                    <option value="">Seleccionar...</option>
                    {categories.map(c => (
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Precio *</label>
                  <input
                    type="number"
                    value={newProductPrice}
                    onChange={e => setNewProductPrice(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Stock inicial *</label>
                <input
                  type="number"
                  value={newProductStock}
                  onChange={e => setNewProductStock(e.target.value)}
                  placeholder="Ej: 24"
                  min="0"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-amber-500"
                />
                <p className="text-xs text-gray-400 mt-1">Se registrará automáticamente como entrada de inventario</p>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Descripción (opcional)</label>
                <input
                  type="text"
                  value={newProductDescription}
                  onChange={e => setNewProductDescription(e.target.value)}
                  placeholder="Ej: Botella de vidrio, cerveza lager..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              {newProductName.trim() && newProductPrice && newProductStock && (
                <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Producto</span>
                    <span className="text-xs font-bold text-gray-900">{newProductName.trim()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Precio</span>
                    <span className="text-xs font-bold text-gray-900">MXN${parseFloat(newProductPrice).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Stock inicial</span>
                    <span className="text-xs font-bold text-emerald-700">{parseInt(newProductStock)} unidades</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Valor total</span>
                    <span className="text-xs font-bold text-gray-900">MXN${(parseFloat(newProductPrice) * parseInt(newProductStock)).toFixed(2)}</span>
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowNewProductModal(false)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                  Cancelar
                </button>
                <button
                  onClick={handleSaveNewProduct}
                  disabled={newProductLoading || !newProductName.trim() || !newProductPrice || !newProductStock || !newProductCategory}
                  className="flex-1 py-3 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white rounded-xl text-sm font-bold cursor-pointer whitespace-nowrap"
                >
                  {newProductLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Guardando...
                    </span>
                  ) : (
                    <><i className="ri-add-line mr-1" />Crear Producto</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MODAL: ENTRADA DE INVENTARIO ══════════ */}
      {showEntryModal && entryProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowEntryModal(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Entrada de Inventario</h3>
                <p className="text-xs text-gray-500">{entryProduct.name}</p>
              </div>
              <button onClick={() => setShowEntryModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer">
                <i className="ri-close-line text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                <span className="text-xs text-gray-500">Stock actual</span>
                <span className="text-sm font-bold text-gray-900">{entryProduct.stock ?? 0} unidades</span>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Cantidad a agregar</label>
                <input
                  type="number"
                  value={entryQuantity}
                  onChange={e => setEntryQuantity(e.target.value)}
                  placeholder="Ej: 24"
                  min="1"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Nota (opcional)</label>
                <input
                  type="text"
                  value={entryNote}
                  onChange={e => setEntryNote(e.target.value)}
                  placeholder="Ej: Compra del proveedor, entrada inicial..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              {entryQuantity && parseInt(entryQuantity) > 0 && (
                <div className="bg-emerald-50 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-xs text-emerald-700">Nuevo stock será</span>
                  <span className="text-sm font-bold text-emerald-700">
                    {(entryProduct.stock ?? 0) + parseInt(entryQuantity)} unidades
                  </span>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowEntryModal(false)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEntry}
                  disabled={entryLoading || !entryQuantity || parseInt(entryQuantity) <= 0}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold cursor-pointer whitespace-nowrap"
                >
                  {entryLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Guardando...
                    </span>
                  ) : (
                    <><i className="ri-add-line mr-1" />Registrar Entrada</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MODAL: AJUSTAR STOCK ══════════ */}
      {showAdjustModal && adjustProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowAdjustModal(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Ajustar Stock</h3>
                <p className="text-xs text-gray-500">{adjustProduct.name}</p>
              </div>
              <button onClick={() => setShowAdjustModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer">
                <i className="ri-close-line text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                <span className="text-xs text-gray-500">Stock actual</span>
                <span className="text-sm font-bold text-gray-900">{adjustProduct.stock ?? 0} unidades</span>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Nuevo stock exacto *</label>
                <input
                  type="number"
                  value={adjustStock}
                  onChange={e => setAdjustStock(e.target.value)}
                  placeholder="Ej: 50"
                  min="0"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-amber-500"
                />
                <p className="text-xs text-gray-400 mt-1">Ingresa el stock exacto que debe tener el producto</p>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Nota (opcional)</label>
                <input
                  type="text"
                  value={adjustNote}
                  onChange={e => setAdjustNote(e.target.value)}
                  placeholder="Ej: Corrección por conteo, ajuste inicial..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              {adjustStock !== '' && (
                <div className="bg-blue-50 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-xs text-blue-700">Diferencia</span>
                  <span className={`text-sm font-bold ${parseInt(adjustStock) - (adjustProduct.stock ?? 0) > 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                    {parseInt(adjustStock) - (adjustProduct.stock ?? 0) > 0 ? '+' : ''}
                    {parseInt(adjustStock) - (adjustProduct.stock ?? 0)} unidades
                  </span>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowAdjustModal(false)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                  Cancelar
                </button>
                <button
                  onClick={handleSaveAdjust}
                  disabled={adjustLoading || adjustStock === '' || parseInt(adjustStock) < 0}
                  className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold cursor-pointer whitespace-nowrap"
                >
                  {adjustLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Guardando...
                    </span>
                  ) : (
                    <><i className="ri-arrow-up-down-line mr-1" />Ajustar Stock</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MODAL: CUADRE FÍSICO ══════════ */}
      {showCountModal && countProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCountModal(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Cuadre Físico</h3>
                <p className="text-xs text-gray-500">{countProduct.name}</p>
              </div>
              <button onClick={() => setShowCountModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer">
                <i className="ri-close-line text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                <span className="text-xs text-gray-500">Stock en sistema</span>
                <span className="text-sm font-bold text-gray-900">{countProduct.stock ?? 0} unidades</span>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Cantidad física contada</label>
                <input
                  type="number"
                  value={countPhysical}
                  onChange={e => setCountPhysical(e.target.value)}
                  placeholder="Ej: 20"
                  min="0"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Nota (opcional)</label>
                <input
                  type="text"
                  value={countNote}
                  onChange={e => setCountNote(e.target.value)}
                  placeholder="Ej: Botellas rotas, caducadas..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              {countPhysical !== '' && (
                <div className={`rounded-xl p-3 flex items-center justify-between ${
                  (parseInt(countPhysical) - (countProduct.stock ?? 0)) === 0
                    ? 'bg-emerald-50'
                    : (parseInt(countPhysical) - (countProduct.stock ?? 0)) > 0
                      ? 'bg-blue-50'
                      : 'bg-red-50'
                }`}>
                  <span className={`text-xs ${
                    (parseInt(countPhysical) - (countProduct.stock ?? 0)) === 0
                      ? 'text-emerald-700'
                      : (parseInt(countPhysical) - (countProduct.stock ?? 0)) > 0
                        ? 'text-blue-700'
                        : 'text-red-700'
                  }`}>Diferencia</span>
                  <span className={`text-sm font-bold ${
                    (parseInt(countPhysical) - (countProduct.stock ?? 0)) === 0
                      ? 'text-emerald-700'
                      : (parseInt(countPhysical) - (countProduct.stock ?? 0)) > 0
                        ? 'text-blue-700'
                        : 'text-red-700'
                  }`}>
                    {(parseInt(countPhysical) - (countProduct.stock ?? 0)) > 0 ? '+' : ''}
                    {parseInt(countPhysical) - (countProduct.stock ?? 0)} unidades
                  </span>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowCountModal(false)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                  Cancelar
                </button>
                <button
                  onClick={handleSaveCount}
                  disabled={countLoading || countPhysical === ''}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold cursor-pointer whitespace-nowrap"
                >
                  {countLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Guardando...
                    </span>
                  ) : (
                    <><i className="ri-scales-3-line mr-1" />Registrar Cuadre</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MODAL: MERMA ══════════ */}
      {showWasteModal && wasteProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowWasteModal(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Registrar Merma</h3>
                <p className="text-xs text-gray-500">{wasteProduct.name}</p>
              </div>
              <button onClick={() => setShowWasteModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer">
                <i className="ri-close-line text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                <span className="text-xs text-gray-500">Stock actual</span>
                <span className="text-sm font-bold text-gray-900">{wasteProduct.stock ?? 0} unidades</span>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Unidades a dar de baja *</label>
                <input
                  type="number"
                  value={wasteQuantity}
                  onChange={e => setWasteQuantity(e.target.value)}
                  placeholder="Ej: 3"
                  min="1"
                  max={wasteProduct.stock ?? 0}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-amber-500"
                />
                <p className="text-xs text-gray-400 mt-1">No puede ser mayor al stock actual</p>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">Motivo de la merma *</label>
                <textarea
                  value={wasteNote}
                  onChange={e => setWasteNote(e.target.value)}
                  placeholder="Ej: Botellas rotas, producto caducado, derrame..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{wasteNote.length}/500</p>
              </div>
              {wasteQuantity && parseInt(wasteQuantity) > 0 && (
                <div className="bg-rose-50 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-xs text-rose-700">Nuevo stock será</span>
                  <span className="text-sm font-bold text-rose-700">
                    {Math.max(0, (wasteProduct.stock ?? 0) - parseInt(wasteQuantity))} unidades
                  </span>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowWasteModal(false)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                  Cancelar
                </button>
                <button
                  onClick={handleSaveWaste}
                  disabled={wasteLoading || !wasteQuantity || parseInt(wasteQuantity) <= 0 || !wasteNote.trim()}
                  className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold cursor-pointer whitespace-nowrap"
                >
                  {wasteLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Guardando...
                    </span>
                  ) : (
                    <><i className="ri-delete-bin-line mr-1" />Registrar Merma</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}