import { supabasePos } from '../supabasePos';

/**
 * Descuenta stock de productos cuando se venden en el POS.
 * Busca el producto por nombre exacto en product_items y descuenta la cantidad.
 * Registra el movimiento en inventory_adjustments.
 */
export async function deductStockOnSale(
  items: Array<{ product_name: string; quantity: number }>,
  context: { accountId?: number; spot?: string; folio?: number } = {}
) {
  for (const item of items) {
    // Buscar producto por nombre exacto (case insensitive)
    const { data: product } = await supabasePos
      .from('product_items')
      .select('id, name, stock')
      .ilike('name', item.product_name.trim())
      .maybeSingle();

    if (!product) continue; // Producto no encontrado en catálogo
    if ((product.stock ?? 0) <= 0) continue; // Sin stock

    const stockBefore = product.stock ?? 0;
    const qty = Math.min(item.quantity, stockBefore);
    const stockAfter = stockBefore - qty;

    // Actualizar stock
    const { error: updError } = await supabasePos
      .from('product_items')
      .update({ stock: stockAfter, updated_at: new Date().toISOString() })
      .eq('id', product.id);

    if (updError) continue;

    // Registrar movimiento
    await supabasePos.from('inventory_adjustments').insert({
      product_id: product.id,
      product_name: product.name,
      adjustment_type: 'sale',
      quantity: -qty,
      stock_before: stockBefore,
      stock_after: stockAfter,
      note: `Venta${context.spot ? ` — ${context.spot}` : ''}${context.folio ? ` · Ronda #${String(context.folio).padStart(2, '0')}` : ''}`,
      created_by: 'pos_auto',
    });
  }
}

/**
 * Reintegra stock cuando se elimina un item de una cuenta (undo o corrección).
 */
export async function restoreStockOnDelete(
  productName: string,
  quantity: number,
  context: { accountId?: number; spot?: string } = {}
) {
  const { data: product } = await supabasePos
    .from('product_items')
    .select('id, name, stock')
    .ilike('name', productName.trim())
    .maybeSingle();

  if (!product) return;

  const stockBefore = product.stock ?? 0;
  const stockAfter = stockBefore + quantity;

  await supabasePos
    .from('product_items')
    .update({ stock: stockAfter, updated_at: new Date().toISOString() })
    .eq('id', product.id);

  await supabasePos.from('inventory_adjustments').insert({
    product_id: product.id,
    product_name: product.name,
    adjustment_type: 'adjustment',
    quantity: +quantity,
    stock_before: stockBefore,
    stock_after: stockAfter,
    note: `Reintegración por eliminación${context.spot ? ` — ${context.spot}` : ''}`,
    created_by: 'pos_auto',
  });
}