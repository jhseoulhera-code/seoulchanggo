"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Toast } from "@/components/common/Toast";
import type { ToastState } from "@/components/common/Toast";
import { OptionSelector } from "@/components/product/OptionSelector";
import { PurchaseActions } from "@/components/product/PurchaseActions";
import { QuantitySelector } from "@/components/product/QuantitySelector";
import { ShippingBadge } from "@/components/product/ShippingBadge";
import { ShippingInfoPanel } from "@/components/product/ShippingInfoPanel";
import { useCart } from "@/contexts/CartContext";
import { useMarket } from "@/contexts/MarketContext";
import { setBuyNowItem } from "@/lib/buyNow";
import { createCartItemId } from "@/lib/cart";
import { formatCurrency, getProductMarketPrice } from "@/lib/currency";
import { formatNumber } from "@/lib/intl";
import { isProductAvailableInMarket } from "@/lib/shipping";
import { getLocalizedProductName } from "@/lib/productLocalization";
import { shippingTypeLabel } from "@/lib/shippingLabels";
import { getMessages } from "@/messages";
import { categories } from "@/data/categories";
import type { Product } from "@/types";
import type { SelectedOptions } from "@/types/cart";

type ProductPurchasePanelProps = {
  product: Product;
};

export function ProductPurchasePanel({ product }: ProductPurchasePanelProps) {
  const { market } = useMarket();
  const cart = useCart();
  const router = useRouter();
  const messages = getMessages(market.locale);

  const [selectedOptions, setSelectedOptions] = useState<SelectedOptions>(() =>
    Object.fromEntries((product.options ?? []).map((group) => [group.name, group.choices[0]]))
  );
  const [quantity, setQuantity] = useState(1);
  const [toast, setToast] = useState<ToastState | null>(null);

  const hasDiscount = Boolean(product.discountRate);
  const eyebrow =
    product.brand ?? categories.find((item) => item.id === product.category)?.label ?? "";
  const isLowStock = typeof product.stock === "number" && product.stock < 10;
  const isAvailable = isProductAvailableInMarket(product, market.countryCode);
  const { salePrice, originalPrice } = getProductMarketPrice(product, market);

  function showToast(next: ToastState) {
    setToast(next);
    window.setTimeout(() => setToast(null), 2600);
  }

  function validateOptions(): boolean {
    const requiredGroups = product.options ?? [];
    const missing = requiredGroups.some((group) => !selectedOptions[group.name]);
    if (missing) {
      showToast({ message: messages.toast.optionRequired, tone: "error" });
      return false;
    }
    return true;
  }

  function handleAddToCart() {
    if (!isAvailable || !validateOptions()) return;

    if (typeof product.stock === "number") {
      const cartItemId = createCartItemId(product.id, selectedOptions);
      const existing = cart.items.find((item) => item.cartItemId === cartItemId);
      const projected = (existing?.quantity ?? 0) + quantity;
      if (projected > product.stock) {
        showToast({ message: messages.toast.outOfStock, tone: "error" });
      }
    }

    cart.addItem(product.id, selectedOptions, quantity, product.stock);
    showToast({
      message: messages.toast.addedToCart,
      tone: "success",
      actionHref: "/cart",
      actionLabel: messages.toast.viewCart,
    });
  }

  function handleBuyNow() {
    if (!isAvailable || !validateOptions()) return;

    setBuyNowItem({ productId: product.id, selectedOptions, quantity });
    router.push("/checkout?source=buynow");
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        {eyebrow && <p className="text-xs font-medium text-text-secondary">{eyebrow}</p>}
        <h1 className="mt-1 text-lg font-bold text-text-main md:text-xl">{getLocalizedProductName(product, market.locale)}</h1>
        <div className="mt-2 flex items-center gap-1 text-sm text-text-secondary">
          <Star size={14} className="fill-primary text-primary" />
          <span className="font-medium text-text-main">{product.rating.toFixed(1)}</span>
          <span>({formatNumber(product.reviewCount, market.locale)})</span>
        </div>
      </div>

      <div className="border-t border-border pt-5">
        <div className="flex items-baseline gap-2">
          {hasDiscount && (
            <span className="text-xl font-bold text-primary">{product.discountRate}%</span>
          )}
          <span className="text-2xl font-bold text-text-main">
            {formatCurrency(salePrice, market.currency)}
          </span>
        </div>
        {hasDiscount && (
          <span className="text-sm text-text-secondary line-through">
            {formatCurrency(originalPrice, market.currency)}
          </span>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ShippingBadge
            type={product.shippingType}
            label={shippingTypeLabel(product.shippingType, market.locale)}
            originCountry={product.originCountry}
          />
          {product.freeShipping && (
            <span className="text-xs font-medium text-primary">{messages.product.freeShipping}</span>
          )}
        </div>
      </div>

      <ShippingInfoPanel product={product} market={market} />

      {isAvailable && product.options && product.options.length > 0 && (
        <div className="border-t border-border pt-5">
          <OptionSelector
            options={product.options}
            selected={selectedOptions}
            onChange={(groupName, choice) =>
              setSelectedOptions((prev) => ({ ...prev, [groupName]: choice }))
            }
          />
        </div>
      )}

      {isAvailable && (
        <div className="border-t border-border pt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-text-secondary">수량</h3>
            {isLowStock && (
              <span className="text-xs text-text-secondary">재고 {product.stock}개 남음</span>
            )}
          </div>
          <div className="mt-2">
            <QuantitySelector value={quantity} onChange={setQuantity} max={product.stock} />
          </div>
        </div>
      )}

      <PurchaseActions
        variant="inline"
        onAddToCart={handleAddToCart}
        onBuyNow={handleBuyNow}
        disabled={!isAvailable}
      />
      <PurchaseActions
        variant="fixed"
        onAddToCart={handleAddToCart}
        onBuyNow={handleBuyNow}
        disabled={!isAvailable}
      />

      <Toast toast={toast} />
    </div>
  );
}
