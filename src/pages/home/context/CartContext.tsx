import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useCartSound } from "@/hooks/useCartSound";
import { saveCustomerProfile, getActiveCustomer } from "@/hooks/usePersistentCustomer";

export type OrderMode = "dine-in" | "pickup";

export interface CartItem {
  id: number;
  name: string;
  description: string;
  price: number;
  quantity: number;
  size?: string;
  image: string;
  category: string;
  notes?: string;
  sides?: string;
  noVeggies?: boolean;
  noMayo?: boolean;
  sauce?: string;
}

export interface FlashOffer {
  id: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  discount_pct: number;
  product_ids: number[] | null;
  category_key: string | null;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
}

export interface DiscountedItem extends CartItem {
  finalPrice: number;
  discountPct: number;
  discountAmount: number;
  offerTitle?: string;
}

interface CartContextType {
  items: CartItem[];
  discountedItems: DiscountedItem[];
  tableNumber: string;
  setTableNumber: (num: string) => void;
  customerName: string;
  setCustomerName: (name: string) => void;
  customerPhone: string;
  setCustomerPhone: (phone: string) => void;
  orderMode: OrderMode;
  setOrderMode: (mode: OrderMode) => void;
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (id: number, size?: string) => void;
  updateQuantity: (id: number, quantity: number, size?: string) => void;
  clearCart: () => void;
  subtotal: number;
  flashDiscount: number;
  total: number;
  itemCount: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  openCartWithMode: (mode: OrderMode) => void;
  sendToPOS: (
    cartItems: CartItem[],
    tableNum: string,
    name: string,
    phone: string,
    mode: OrderMode,
    closeAccount?: boolean,
    paymentMethod?: string
  ) => Promise<{ success: boolean; error?: string }>;
  closeExistingAccount: (
    tableNum: string,
    paymentMethod: string
  ) => Promise<{ success: boolean; total?: number; error?: string }>;
  flashOffers: FlashOffer[];
  productMap: Map<number, string>;
  favorites: number[];
  toggleFavorite: (productId: number) => void;
  isFavorite: (productId: number) => boolean;
  activeProfileId: string | null;
  setActiveProfileId: (id: string | null) => void;
  lastFavoriteAction: { id: number; added: boolean; name?: string } | null;
  lastCartAction: { name: string } | null;
  lastCartRemoveAction: { name: string } | null;
  accountId: number | null;
  setAccountId: (id: number | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// ─────────────────────────────────────────────
// Exported helpers: categorías y descuentos
// ─────────────────────────────────────────────

export function normalizeCat(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function categoryMatches(itemCat: string, offerKey: string | null): boolean {
  if (!offerKey) return false;
  const item = normalizeCat(itemCat);
  const offer = normalizeCat(offerKey);
  return item.includes(offer) || offer.includes(item);
}

export function productNameMatches(itemName: string, productName: string | undefined): boolean {
  if (!productName) return false;
  const item = normalizeCat(itemName);
  const prod = normalizeCat(productName);
  return item.includes(prod) || prod.includes(item);
}

export function getApplicableOffer(
  item: CartItem,
  offers: FlashOffer[],
  productMap: Map<number, string>
): FlashOffer | null {
  const now = Date.now();
  const activeOffers = offers.filter(o => {
    if (!o.is_active) return false;
    const start = new Date(o.start_time).getTime();
    const end = new Date(o.end_time).getTime();
    return now >= start && now <= end;
  });

  let bestOffer: FlashOffer | null = null;
  let bestDiscount = 0;

  for (const offer of activeOffers) {
    let applies = false;

    // Por categoría
    if (offer.category_key && categoryMatches(item.category, offer.category_key)) {
      applies = true;
    }

    // Por producto específico
    if (!applies && offer.product_ids && offer.product_ids.length > 0) {
      for (const pid of offer.product_ids) {
        const prodName = productMap.get(pid);
        if (productNameMatches(item.name, prodName)) {
          applies = true;
          break;
        }
      }
    }

    if (applies && offer.discount_pct > bestDiscount) {
      bestDiscount = offer.discount_pct;
      bestOffer = offer;
    }
  }

  return bestOffer;
}

export function getProductFlashOffer(
  productName: string,
  category: string,
  offers: FlashOffer[],
  productMap: Map<number, string>
): FlashOffer | null {
  return getApplicableOffer(
    { id: 0, name: productName, description: '', price: 0, quantity: 1, image: '', category },
    offers,
    productMap
  );
}

export function calculateDiscountedPrice(price: number, discountPct: number): number {
  return Math.round(price * (100 - discountPct) / 100 * 100) / 100;
}

// ─────────────────────────────────────────────
// Helper: perfiles y favoritos
// ─────────────────────────────────────────────

interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  lastUsed: number;
  favorites?: number[];
}

function loadProfiles(): CustomerProfile[] {
  try {
    const raw = localStorage.getItem('lc_customer_profiles');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomerProfile[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(p => p.name?.trim()).sort((a, b) => b.lastUsed - a.lastUsed);
  } catch (e) {
    console.warn('[CartContext] readCart failed:', e);
    return [];
  }
}

function saveProfiles(profiles: CustomerProfile[]) {
  try {
    localStorage.setItem('lc_customer_profiles', JSON.stringify(profiles.slice(0, 8)));
  } catch (e) {
    console.warn('[CartContext] writeCart failed:', e);
  }
}

function getActiveProfile(name: string, phone: string): CustomerProfile | null {
  const profiles = loadProfiles();
  return profiles.find(p => p.name.trim().toLowerCase() === name.trim().toLowerCase() && (!phone || p.phone.trim() === phone.trim())) ?? profiles[0] ?? null;
}

function updateProfileFavorites(profileId: string, favorites: number[]) {
  const profiles = loadProfiles();
  const idx = profiles.findIndex(p => p.id === profileId);
  if (idx >= 0) {
    profiles[idx].favorites = favorites;
    profiles[idx].lastUsed = Date.now();
    saveProfiles(profiles);
  }
}

// ─────────────────────────────────────────────
// Helper: buscar cuenta abierta por nombre del cliente
// ─────────────────────────────────────────────

export function CartProvider({ children }: { children: ReactNode }) {
  const { playAddSound, playRemoveSound } = useCartSound();
  const [items, setItems] = useState<CartItem[]>([]);
  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderMode, setOrderMode] = useState<OrderMode>("dine-in");
  const [isOpen, setIsOpen] = useState(false);

  // Ofertas flash y mapeo de productos Supabase
  const [flashOffers, setFlashOffers] = useState<FlashOffer[]>([]);
  const [productMap, setProductMap] = useState<Map<number, string>>(new Map());
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [lastCartAction, setLastCartAction] = useState<{ name: string } | null>(null);
  const [lastCartRemoveAction, setLastCartRemoveAction] = useState<{ name: string } | null>(null);
  const [lastFavoriteAction, setLastFavoriteAction] = useState<
    { id: number; added: boolean; name?: string } | null
  >(null);

  // Leer ofertas flash activas y productos de Supabase
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const now = new Date().toISOString();
      const [{ data: offersData }, { data: productsData }] = await Promise.all([
        supabase.from('flash_offers').select('*').eq('is_active', true).lte('start_time', now).gte('end_time', now),
        supabase.from('product_items').select('id, name').eq('status', 'active'),
      ]);

      if (!mounted) return;

      if (offersData) {
        setFlashOffers(offersData as FlashOffer[]);
      }

      if (productsData) {
        const map = new Map<number, string>();
        (productsData as { id: number; name: string }[]).forEach(p => map.set(p.id, p.name));
        setProductMap(map);
      }
    };

    load();

    // Refrescar cada 2 minutos
    const interval = setInterval(load, 120_000);

    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel('flash-offers-cart')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flash_offers' }, load)
      .subscribe();

    return () => {
      mounted = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  // Calcular items con descuento
  const discountedItems: DiscountedItem[] = items.map(item => {
    const offer = getApplicableOffer(item, flashOffers, productMap);
    if (offer) {
      const discountPct = offer.discount_pct;
      const discountFactor = (100 - discountPct) / 100;
      const finalPrice = Math.round(item.price * discountFactor * 100) / 100;
      const discountAmount = Math.round((item.price - finalPrice) * item.quantity * 100) / 100;
      return {
        ...item,
        finalPrice,
        discountPct,
        discountAmount,
        offerTitle: offer.title,
      };
    }
    return {
      ...item,
      finalPrice: item.price,
      discountPct: 0,
      discountAmount: 0,
    };
  });

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const flashDiscount = discountedItems.reduce((sum, i) => sum + i.discountAmount, 0);
  const total = Math.round((subtotal - flashDiscount) * 100) / 100;
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  // Leer ?mesa= de la URL automáticamente
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mesa = params.get('mesa');
    if (mesa) {
      setTableNumber(mesa);
      setOrderMode('dine-in');
    }
  }, []);

  // Leer datos del cliente desde localStorage al montar
  useEffect(() => {
    try {
      // Nuevo formato: array de perfiles
      const profilesRaw = localStorage.getItem('lc_customer_profiles');
      if (profilesRaw) {
        const profiles = JSON.parse(profilesRaw) as CustomerProfile[];
        if (Array.isArray(profiles) && profiles.length > 0) {
          const mostRecent = profiles.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))[0];
          if (mostRecent?.name) {
            setCustomerName(mostRecent.name);
            if (mostRecent.phone) setCustomerPhone(mostRecent.phone);
            setActiveProfileId(mostRecent.id);
            setFavorites(mostRecent.favorites ?? []);
            // Guardar también en el sistema persistente unificado
            saveCustomerProfile(mostRecent.name, mostRecent.phone || '');
            return;
          }
        }
      }
      // Fallback formato antiguo individual
      const savedName = localStorage.getItem('lc_customer_name');
      const savedPhone = localStorage.getItem('lc_customer_phone');
      if (savedName) setCustomerName(savedName);
      if (savedPhone) setCustomerPhone(savedPhone);
    } catch (e) {
      console.warn('[CartContext] loadOrders failed:', e);
    }
  }, []);

  // Escuchar cambios en localStorage desde otras pestañas o componentes
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'lc_customer_profiles' && e.newValue) {
        try {
          const profiles = JSON.parse(e.newValue) as CustomerProfile[];
          if (Array.isArray(profiles) && profiles.length > 0) {
            const mostRecent = profiles.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))[0];
            if (mostRecent?.name) {
              setCustomerName(mostRecent.name);
              if (mostRecent.phone) setCustomerPhone(mostRecent.phone);
              setActiveProfileId(mostRecent.id);
              setFavorites(mostRecent.favorites ?? []);
            }
          }
        } catch (e) {
          console.warn('[CartContext] diffOrder failed:', e);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Actualizar favoritos cuando cambia el perfil activo
  useEffect(() => {
    if (!activeProfileId) return;
    const profiles = loadProfiles();
    const profile = profiles.find(p => p.id === activeProfileId);
    if (profile) {
      setFavorites(profile.favorites ?? []);
    }
  }, [activeProfileId]);

  const openCartWithMode = useCallback((mode: OrderMode) => {
    setOrderMode(mode);
    setIsOpen(true);
  }, []);

  const toggleFavorite = useCallback((productId: number) => {
    setFavorites(prev => {
      const wasFav = prev.includes(productId);
      const next = wasFav ? prev.filter(id => id !== productId) : [...prev, productId];
      setLastFavoriteAction({ id: productId, added: !wasFav });
      // Auto-clear after 2.5s
      setTimeout(() => setLastFavoriteAction(null), 2500);
      if (activeProfileId) {
        updateProfileFavorites(activeProfileId, next);
      } else {
        // Si no hay perfil activo, actualizar el más reciente que coincida con nombre/teléfono
        const profile = getActiveProfile(customerName, customerPhone);
        if (profile) {
          updateProfileFavorites(profile.id, next);
          setActiveProfileId(profile.id);
        }
      }
      return next;
    });
  }, [activeProfileId, customerName, customerPhone]);

  const isFavorite = useCallback((productId: number) => {
    return favorites.includes(productId);
  }, [favorites]);

  // ─── Buscar cuenta abierta por nombre del cliente ───
  const [accountId, setAccountId] = useState<number | null>(null);

  const findOpenAccount = useCallback(async (customerNm: string, customerPh: string) => {
    const nm = customerNm.trim();
    const ph = customerPh.trim();

    // Búsqueda por nombre exacto (case-insensitive)
    if (nm) {
      const { data: r1 } = await supabase
        .from('pos_accounts')
        .select('id, folio_counter')
        .eq('status', 'open')
        .ilike('customer_name', nm)
        .limit(1);
      if (r1 && r1.length > 0) return r1[0];
    }

    // Búsqueda por spot (útil cuando se busca por número de mesa)
    if (nm) {
      const { data: rSpot } = await supabase
        .from('pos_accounts')
        .select('id, folio_counter')
        .eq('status', 'open')
        .ilike('spot', `%${nm}%`)
        .limit(1);
      if (rSpot && rSpot.length > 0) return rSpot[0];
    }

    // Búsqueda por teléfono si hay
    if (ph) {
      const { data: r2 } = await supabase
        .from('pos_accounts')
        .select('id, folio_counter')
        .eq('status', 'open')
        .ilike('customer_phone', ph)
        .limit(1);
      if (r2 && r2.length > 0) return r2[0];
    }

    return null;
  }, []);

  // Helper: timeout para cualquier promesa
  function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
    ]);
  }

  // ─── Enviar pedido al POS como ronda ───
  const sendToPOS = useCallback(async (
    cartItems: CartItem[],
    tableNum: string,
    name: string,
    phone: string,
    mode: OrderMode,
    closeAccount = false,
    paymentMethod = 'cash',
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Fallback al perfil persistente del cliente si no se proporcionan datos
      const activeProfile = getActiveCustomer();
      const effectiveName = name.trim() || activeProfile?.name || '';
      const effectivePhone = phone.trim() || activeProfile?.phone || '';

      // Calcular precios finales con descuento
      const itemsWithDiscount = cartItems.map(item => {
        const offer = getApplicableOffer(item, flashOffers, productMap);
        if (offer) {
          const discountFactor = (100 - offer.discount_pct) / 100;
          const finalPrice = Math.round(item.price * discountFactor * 100) / 100;
          return { ...item, finalPrice };
        }
        return { ...item, finalPrice: item.price };
      });

      if (mode === 'dine-in') {
        const clientLabel = effectiveName.trim() || 'Cliente';
        let existingAccount: { id: number; folio_counter: number } | null = null;

        // Si hay un accountId específico (desde "volver_cuenta"), usarlo directamente
        if (accountId) {
          const { data: acc } = await supabase
            .from('pos_accounts')
            .select('id, folio_counter')
            .eq('id', accountId)
            .maybeSingle();
          if (acc) {
            existingAccount = acc as { id: number; folio_counter: number };
          }
        }

        if (!existingAccount) {
          existingAccount = await withTimeout(findOpenAccount(effectiveName, effectivePhone), 8000, null);
        }

        let accountIdVal: number;
        let newFolio: number;

        if (existingAccount) {
          accountIdVal = existingAccount.id;
          newFolio = (existingAccount.folio_counter ?? 0) + 1;
          const { error: updErr } = await supabase
            .from('pos_accounts')
            .update({ folio_counter: newFolio, updated_at: new Date().toISOString() })
            .eq('id', accountIdVal);
          if (updErr) console.error('[POS] Error actualizando folio_counter:', updErr.message);
        } else {
          // No existe cuenta → crearla con nombre del cliente como spot
          const { data: newAcc, error: accErr } = await supabase
            .from('pos_accounts')
            .insert({
              area: 'principal',
              spot: clientLabel,
              customer_name: effectiveName || null,
              customer_phone: effectivePhone || null,
              status: 'open',
              folio_counter: 1,
            })
            .select('id')
            .maybeSingle();

          if (accErr) {
            console.error('[POS] Error creando cuenta:', accErr.message);
            return { success: false, error: `No se pudo crear la cuenta: ${accErr.message}` };
          }
          if (!newAcc) return { success: false, error: 'No se pudo crear la cuenta en el POS' };
          accountIdVal = newAcc.id;
          newFolio = 1;
        }

        // Insertar productos de esta ronda con precio final (con descuento aplicado)
        const inserts = itemsWithDiscount.map(item => ({
          account_id: accountIdVal,
          product_name: item.name + (item.size ? ` (${item.size})` : ''),
          size: item.notes ? `NOTA: ${item.notes}` : null,
          quantity: item.quantity,
          unit_price: item.finalPrice,
          folio_number: newFolio,
          origin: 'web',
        }));

        const { error: itemsErr } = await supabase.from('pos_account_items').insert(inserts);
        if (itemsErr) {
          console.error('[POS] Error insertando items:', itemsErr.message);
          return { success: false, error: `Error al guardar los productos: ${itemsErr.message}` };
        }

        // Si el cliente quiere cerrar la cuenta → registrar pago y cerrar
        if (closeAccount) {
          const { data: allItems } = await supabase
            .from('pos_account_items')
            .select('unit_price, quantity')
            .eq('account_id', accountIdVal);

          const totalSubtotal = (allItems ?? []).reduce(
            (s: number, i: { unit_price: number; quantity: number }) => s + i.unit_price * i.quantity, 0
          );
          const cardFee = paymentMethod === 'terminal' ? totalSubtotal * 0.03 : 0;
          const totalAmount = totalSubtotal + cardFee;

          const methodMap: Record<string, string> = {
            cash: 'cash',
            transfer: 'transfer',
            terminal: 'credit_card',
          };

          const { error: payErr } = await supabase.from('pos_payments').insert({
            account_id: accountIdVal,
            payment_method: methodMap[paymentMethod] ?? paymentMethod,
            subtotal: totalSubtotal,
            card_fee: cardFee,
            total: totalAmount,
            split_count: 1,
          });
          if (payErr) console.error('[POS] Error registrando pago:', payErr.message);

          const { error: closeErr } = await supabase
            .from('pos_accounts')
            .update({ status: 'closed', closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', accountIdVal);
          if (closeErr) console.error('[POS] Error cerrando cuenta:', closeErr.message);
        }

        return { success: true };

      } else {
        // Para llevar → crear cuenta nueva en área 'llevar'
        const { data: newAcc, error: accErr } = await supabase
          .from('pos_accounts')
          .insert({
            area: 'llevar',
            spot: `Llevar - ${effectiveName || 'Cliente'}`,
            customer_name: effectiveName || null,
            customer_phone: effectivePhone || null,
            status: 'open',
            folio_counter: 1,
          })
          .select('id')
          .maybeSingle();

        if (accErr) {
          console.error('[POS] Error creando cuenta llevar:', accErr.message);
          return { success: false, error: `No se pudo registrar el pedido: ${accErr.message}` };
        }
        if (!newAcc) return { success: false, error: 'No se pudo registrar el pedido' };

        const inserts = itemsWithDiscount.map(item => ({
          account_id: newAcc.id,
          product_name: item.name + (item.size ? ` (${item.size})` : ''),
          size: item.notes ? `NOTA: ${item.notes}` : null,
          quantity: item.quantity,
          unit_price: item.finalPrice,
          folio_number: 1,
          origin: 'web',
        }));

        const { error: itemsErr } = await supabase.from('pos_account_items').insert(inserts);
        if (itemsErr) {
          console.error('[POS] Error insertando items llevar:', itemsErr.message);
          return { success: false, error: `Error al guardar los productos: ${itemsErr.message}` };
        }

        return { success: true };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[POS] Excepción inesperada:', msg);
      return { success: false, error: `Error inesperado: ${msg}` };
    }
  }, [findOpenAccount, flashOffers, productMap, accountId]);

  // ─── Cerrar cuenta existente sin items nuevos ───
  const closeExistingAccount = useCallback(async (
    tableNum: string,
    paymentMethod: string,
  ): Promise<{ success: boolean; total?: number; error?: string }> => {
    try {
      let existingAccount: { id: number } | null = null;

      if (accountId) {
        const { data } = await supabase
          .from('pos_accounts')
          .select('id')
          .eq('id', accountId)
          .maybeSingle();
        if (data) existingAccount = data as { id: number };
      }

      if (!existingAccount) {
        existingAccount = await findOpenAccount(tableNum, '');
      }

      if (!existingAccount) {
        return { success: false, error: 'No se encontró una cuenta abierta para esta mesa' };
      }

      const accountIdVal = existingAccount.id;

      const { data: allItems } = await supabase
        .from('pos_account_items')
        .select('unit_price, quantity')
        .eq('account_id', accountIdVal);

      const totalSubtotal = (allItems ?? []).reduce(
        (s: number, i: { unit_price: number; quantity: number }) => s + i.unit_price * i.quantity, 0
      );
      const cardFee = paymentMethod === 'terminal' ? totalSubtotal * 0.03 : 0;
      const total = totalSubtotal + cardFee;

      const methodMap: Record<string, string> = {
        cash: 'cash',
        transfer: 'transfer',
        terminal: 'credit_card',
      };

      const { error: payErr } = await supabase.from('pos_payments').insert({
        account_id: accountIdVal,
        payment_method: methodMap[paymentMethod] ?? paymentMethod,
        subtotal: totalSubtotal,
        card_fee: cardFee,
        total,
        split_count: 1,
      });
      if (payErr) console.error('[POS] Error registrando pago al cerrar:', payErr.message);

      const { error: closeErr } = await supabase
        .from('pos_accounts')
        .update({ status: 'closed', closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', accountIdVal);
      if (closeErr) {
        console.error('[POS] Error cerrando cuenta:', closeErr.message);
        return { success: false, error: `Error al cerrar: ${closeErr.message}` };
      }

      return { success: true, total };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[POS] Excepción al cerrar cuenta:', msg);
      return { success: false, error: `Error inesperado: ${msg}` };
    }
  }, [findOpenAccount, accountId]);

  const addItem = useCallback((newItem: Omit<CartItem, "quantity">) => {
    playAddSound();
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.id === newItem.id && i.size === newItem.size && i.notes === newItem.notes
      );
      if (existing) {
        setLastCartAction({ name: newItem.name });
        setTimeout(() => setLastCartAction(null), 600);
        return prev.map((i) =>
          i.id === newItem.id && i.size === newItem.size && i.notes === newItem.notes
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      setLastCartAction({ name: newItem.name });
      setTimeout(() => setLastCartAction(null), 600);
      return [...prev, { ...newItem, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((id: number, size?: string) => {
    playRemoveSound();
    setItems((prev) => {
      const removed = prev.find((i) => i.id === id && i.size === size);
      if (removed) {
        setLastCartRemoveAction({ name: removed.name });
        setTimeout(() => setLastCartRemoveAction(null), 1800);
      }
      return prev.filter((i) => !(i.id === id && i.size === size));
    });
  }, []);

  const updateQuantity = useCallback(
    (id: number, quantity: number, size?: string) => {
      if (quantity <= 0) {
        removeItem(id, size);
        return;
      }
      setItems((prev) =>
        prev.map((i) =>
          i.id === id && i.size === size ? { ...i, quantity } : i
        )
      );
    },
    [removeItem]
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  return (
    <CartContext.Provider
      value={{
        items,
        discountedItems,
        tableNumber,
        setTableNumber,
        customerName,
        setCustomerName,
        customerPhone,
        setCustomerPhone,
        orderMode,
        setOrderMode,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        subtotal,
        flashDiscount,
        total,
        itemCount,
        isOpen,
        setIsOpen,
        openCartWithMode,
        sendToPOS,
        closeExistingAccount,
        flashOffers,
        productMap,
        favorites,
        toggleFavorite,
        isFavorite,
        lastFavoriteAction,
        lastCartAction,
        lastCartRemoveAction,
        setActiveProfileId,
        accountId,
        setAccountId,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart debe usarse dentro de CartProvider");
  }
  return context;
}