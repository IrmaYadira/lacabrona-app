const STORAGE_KEY = 'pos_paused_products';

export function getPausedProducts(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function setPausedProducts(paused: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...paused]));
}

export function togglePausedProduct(id: string): Set<string> {
  const paused = getPausedProducts();
  if (paused.has(id)) {
    paused.delete(id);
  } else {
    paused.add(id);
  }
  setPausedProducts(paused);
  return paused;
}

export function isProductPaused(id: string): boolean {
  return getPausedProducts().has(id);
}