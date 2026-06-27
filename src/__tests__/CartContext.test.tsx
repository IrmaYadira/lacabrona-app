import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  normalizeCat,
  categoryMatches,
  productNameMatches,
  getApplicableOffer,
  calculateDiscountedPrice,
  CartProvider,
  useCart,
  type CartItem,
  type FlashOffer,
} from '@/pages/home/context/CartContext';

// ── Helpers ──
function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <CartProvider>{children}</CartProvider>;
  };
}

function makeItem(overrides: Partial<CartItem> = {}): Omit<CartItem, 'quantity'> {
  return {
    id: 1,
    name: 'Michelada Clásica',
    description: 'Cerveza con limón, sal y salsa',
    price: 65,
    image: 'https://example.com/img.jpg',
    category: 'Micheladas',
    ...overrides,
  };
}

function makeOffer(overrides: Partial<FlashOffer> = {}): FlashOffer {
  const now = Date.now();
  return {
    id: 1,
    title: 'Happy Hour',
    subtitle: '2x1',
    description: 'Todas las micheladas',
    discount_pct: 20,
    product_ids: null,
    category_key: 'Micheladas',
    start_time: new Date(now - 3600000).toISOString(),
    end_time: new Date(now + 3600000).toISOString(),
    is_active: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ════════════════════════════════════════════════
// Pure Functions
// ════════════════════════════════════════════════

describe('normalizeCat', () => {
  it('lowercases and removes accents', () => {
    expect(normalizeCat('Micheladas')).toBe('micheladas');
    expect(normalizeCat('CERVEZAS')).toBe('cervezas');
    expect(normalizeCat('Alitas & Boneless')).toBe('alitasboneless');
  });

  it('removes special characters', () => {
    expect(normalizeCat('Cerveza (Artesanal)')).toBe('cervezaartesanal');
    expect(normalizeCat('Tacos al Pastor!')).toBe('tacosalpastor');
  });
});

describe('categoryMatches', () => {
  it('returns true when category matches offer key', () => {
    expect(categoryMatches('Micheladas', 'Micheladas')).toBe(true);
    expect(categoryMatches('MICHELADAS', 'micheladas')).toBe(true);
    expect(categoryMatches('Micheladas', 'micheladas')).toBe(true);
  });

  it('returns false when categories differ', () => {
    expect(categoryMatches('Cervezas', 'Micheladas')).toBe(false);
    expect(categoryMatches('Micheladas', null)).toBe(false);
  });

  it('handles partial match', () => {
    expect(categoryMatches('Micheladas Clásicas', 'Micheladas')).toBe(true);
    expect(categoryMatches('Micheladas', 'Micheladas Clásicas')).toBe(true);
  });
});

describe('productNameMatches', () => {
  it('returns true when names match', () => {
    expect(productNameMatches('Michelada Clásica', 'Michelada Clásica')).toBe(true);
    expect(productNameMatches('MICHELADA CLÁSICA', 'michelada clasica')).toBe(true);
  });

  it('returns false when names differ', () => {
    expect(productNameMatches('Michelada Clásica', 'Caguama')).toBe(false);
    expect(productNameMatches('Cerveza', undefined)).toBe(false);
  });
});

describe('calculateDiscountedPrice', () => {
  it('applies discount correctly', () => {
    expect(calculateDiscountedPrice(100, 20)).toBe(80);
    expect(calculateDiscountedPrice(65, 10)).toBe(58.5);
    expect(calculateDiscountedPrice(65, 0)).toBe(65);
    expect(calculateDiscountedPrice(65, 100)).toBe(0);
  });

  it('handles rounding to 2 decimals', () => {
    expect(calculateDiscountedPrice(65, 33)).toBe(43.55);
    expect(calculateDiscountedPrice(99.99, 15)).toBe(84.99);
  });
});

describe('getApplicableOffer', () => {
  const productMap = new Map<number, string>([[100, 'Michelada Clásica']]);

  const item: CartItem = {
    id: 1,
    name: 'Michelada Clásica',
    description: '',
    price: 65,
    quantity: 1,
    image: '',
    category: 'Micheladas',
  };

  it('returns null when no active offers', () => {
    const result = getApplicableOffer(item, [], productMap);
    expect(result).toBeNull();
  });

  it('matches by category', () => {
    const offer = makeOffer({ category_key: 'Micheladas', discount_pct: 25 });
    const result = getApplicableOffer(item, [offer], productMap);
    expect(result).not.toBeNull();
    expect(result!.discount_pct).toBe(25);
  });

  it('matches by product ID', () => {
    const offer = makeOffer({
      category_key: null,
      product_ids: [100],
      discount_pct: 30,
    });
    const result = getApplicableOffer(item, [offer], productMap);
    expect(result).not.toBeNull();
    expect(result!.discount_pct).toBe(30);
  });

  it('returns best discount among multiple offers', () => {
    const offer1 = makeOffer({ id: 1, discount_pct: 10 });
    const offer2 = makeOffer({ id: 2, discount_pct: 40 });
    const result = getApplicableOffer(item, [offer1, offer2], productMap);
    expect(result!.discount_pct).toBe(40);
  });

  it('ignores inactive offers', () => {
    const offer = makeOffer({ is_active: false, discount_pct: 50 });
    const result = getApplicableOffer(item, [offer], productMap);
    expect(result).toBeNull();
  });

  it('ignores expired offers', () => {
    const offer = makeOffer({
      start_time: new Date(Date.now() - 7200000).toISOString(),
      end_time: new Date(Date.now() - 3600000).toISOString(),
    });
    const result = getApplicableOffer(item, [offer], productMap);
    expect(result).toBeNull();
  });

  it('ignores future offers', () => {
    const offer = makeOffer({
      start_time: new Date(Date.now() + 3600000).toISOString(),
      end_time: new Date(Date.now() + 7200000).toISOString(),
    });
    const result = getApplicableOffer(item, [offer], productMap);
    expect(result).toBeNull();
  });
});

// ════════════════════════════════════════════════
// CartProvider Integration
// ════════════════════════════════════════════════

describe('CartProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('addItem', () => {
    it('adds a new item with quantity 1', () => {
      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() });

      act(() => {
        result.current.addItem(makeItem());
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].name).toBe('Michelada Clásica');
      expect(result.current.items[0].quantity).toBe(1);
    });

    it('increments quantity when same item added again', () => {
      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() });

      act(() => { result.current.addItem(makeItem()); });
      act(() => { result.current.addItem(makeItem()); });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].quantity).toBe(2);
    });

    it('adds separate entries for different sizes', () => {
      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() });

      act(() => { result.current.addItem(makeItem({ size: 'Grande' })); });
      act(() => { result.current.addItem(makeItem({ size: 'Chica' })); });

      expect(result.current.items).toHaveLength(2);
    });

    it('adds separate entries for different notes', () => {
      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() });

      act(() => { result.current.addItem(makeItem({ notes: 'Sin sal' })); });
      act(() => { result.current.addItem(makeItem({ notes: 'Extra picante' })); });

      expect(result.current.items).toHaveLength(2);
    });

    it('increments itemCount', () => {
      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() });

      act(() => { result.current.addItem(makeItem()); });
      act(() => { result.current.addItem(makeItem({ id: 2, name: 'Alitas' })); });
      act(() => { result.current.addItem(makeItem({ id: 2, name: 'Alitas' })); });

      expect(result.current.itemCount).toBe(3);
    });
  });

  describe('removeItem', () => {
    it('removes an item from cart', () => {
      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() });

      act(() => { result.current.addItem(makeItem()); });
      act(() => { result.current.addItem(makeItem({ id: 2, name: 'Alitas' })); });

      expect(result.current.items).toHaveLength(2);

      act(() => { result.current.removeItem(1); });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].id).toBe(2);
    });

    it('removes by id + size combo', () => {
      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() });

      act(() => { result.current.addItem(makeItem({ size: 'Grande' })); });
      act(() => { result.current.addItem(makeItem({ size: 'Chica' })); });

      act(() => { result.current.removeItem(1, 'Chica'); });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].size).toBe('Grande');
    });
  });

  describe('updateQuantity', () => {
    it('updates quantity', () => {
      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() });

      act(() => { result.current.addItem(makeItem()); });
      act(() => { result.current.updateQuantity(1, 5); });

      expect(result.current.items[0].quantity).toBe(5);
    });

    it('removes item when quantity is 0', () => {
      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() });

      act(() => { result.current.addItem(makeItem()); });
      act(() => { result.current.updateQuantity(1, 0); });

      expect(result.current.items).toHaveLength(0);
    });
  });

  describe('clearCart', () => {
    it('empties the cart', () => {
      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() });

      act(() => { result.current.addItem(makeItem()); });
      act(() => { result.current.addItem(makeItem({ id: 2, name: 'Alitas' })); });
      act(() => { result.current.clearCart(); });

      expect(result.current.items).toHaveLength(0);
      expect(result.current.itemCount).toBe(0);
    });
  });

  describe('subtotal / total', () => {
    it('calculates correct subtotal', () => {
      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() });

      act(() => {
        result.current.addItem(makeItem({ price: 65 }));
        result.current.addItem(makeItem({ id: 2, name: 'Alitas', price: 120 }));
        result.current.updateQuantity(2, 2);
      });

      // 65*1 + 120*2 = 305
      expect(result.current.subtotal).toBe(305);
    });

    it('total equals subtotal when no flash discounts', () => {
      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() });

      act(() => { result.current.addItem(makeItem({ price: 65 })); });

      expect(result.current.total).toBe(65);
      expect(result.current.flashDiscount).toBe(0);
    });
  });

  describe('tableNumber & orderMode', () => {
    it('defaults to empty table and dine-in mode', () => {
      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() });

      expect(result.current.tableNumber).toBe('');
      expect(result.current.orderMode).toBe('dine-in');
    });

    it('setTableNumber updates the table', () => {
      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() });

      act(() => { result.current.setTableNumber('Mesa 5'); });

      expect(result.current.tableNumber).toBe('Mesa 5');
    });

    it('setOrderMode switches between dine-in and pickup', () => {
      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() });

      act(() => { result.current.setOrderMode('pickup'); });

      expect(result.current.orderMode).toBe('pickup');
    });
  });

  describe('favorites', () => {
    it('toggleFavorite adds and removes from favorites', () => {
      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() });

      act(() => { result.current.toggleFavorite(5); });
      expect(result.current.isFavorite(5)).toBe(true);

      act(() => { result.current.toggleFavorite(5); });
      expect(result.current.isFavorite(5)).toBe(false);
    });

    it('isFavorite returns false for unknown product', () => {
      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() });

      expect(result.current.isFavorite(999)).toBe(false);
    });
  });

  describe('cart visibility', () => {
    it('isOpen defaults to false', () => {
      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() });
      expect(result.current.isOpen).toBe(false);
    });

    it('openCartWithMode sets mode and opens cart', () => {
      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() });

      act(() => { result.current.openCartWithMode('pickup'); });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.orderMode).toBe('pickup');
    });
  });

  describe('discounted items', () => {
    it('discountedItems maps items with original prices when no offers', () => {
      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() });

      act(() => { result.current.addItem(makeItem({ price: 65 })); });

      expect(result.current.discountedItems[0].finalPrice).toBe(65);
      expect(result.current.discountedItems[0].discountPct).toBe(0);
    });
  });
});