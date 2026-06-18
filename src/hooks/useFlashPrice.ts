import { useCart, getProductFlashOffer, calculateDiscountedPrice } from "@/pages/home/context/CartContext";

export interface FlashPriceResult {
  hasOffer: boolean;
  originalPrice: number;
  discountedPrice: number;
  discountPct: number;
  offerTitle: string | null;
}

export function useFlashPrice(productName: string, category: string, price: number): FlashPriceResult {
  const { flashOffers, productMap } = useCart();
  const offer = getProductFlashOffer(productName, category, flashOffers, productMap);

  if (!offer) {
    return {
      hasOffer: false,
      originalPrice: price,
      discountedPrice: price,
      discountPct: 0,
      offerTitle: null,
    };
  }

  return {
    hasOffer: true,
    originalPrice: price,
    discountedPrice: calculateDiscountedPrice(price, offer.discount_pct),
    discountPct: offer.discount_pct,
    offerTitle: offer.title,
  };
}