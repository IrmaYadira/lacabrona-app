import { useCart, getProductFlashOffer, calculateDiscountedPrice } from "@/pages/home/context/CartContext";

interface FlashPriceProps {
  price: number;
  productName: string;
  category: string;
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  dark: {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
    xl: "text-xl",
  },
  light: {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
    xl: "text-xl",
  },
};

const priceColor = {
  dark: "text-amber-400",
  light: "text-amber-600",
};

const originalColor = {
  dark: "text-gray-500",
  light: "text-gray-400",
};

export default function FlashPrice({
  price,
  productName,
  category,
  variant = "light",
  size = "md",
  className = "",
}: FlashPriceProps) {
  const { flashOffers, productMap } = useCart();
  const offer = getProductFlashOffer(productName, category, flashOffers, productMap);

  if (!offer) {
    return (
      <span className={`${sizeClasses[variant][size]} ${priceColor[variant]} font-bold ${className}`}>
        ${price.toFixed(2)}
      </span>
    );
  }

  const discounted = calculateDiscountedPrice(price, offer.discount_pct);

  return (
    <div className={`flex flex-col items-start leading-tight ${className}`}>
      <span className={`${sizeClasses[variant][size]} ${originalColor[variant]} line-through`}>
        ${price.toFixed(2)}
      </span>
      <div className="flex items-center gap-1.5">
        <span className={`${sizeClasses[variant][size]} ${priceColor[variant]} font-bold`}>
          ${discounted.toFixed(2)}
        </span>
        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 animate-pulse">
          <i className="ri-flashlight-fill" />
          -{offer.discount_pct}%
        </span>
      </div>
    </div>
  );
}