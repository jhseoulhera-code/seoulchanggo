"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
import { convertFromKrw, formatCurrency, getProductMarketPrice } from "@/lib/currency";
import { formatNumber } from "@/lib/intl";
import { isProductAvailableInMarket } from "@/lib/shipping";
import { getLocalizedProductName, getLocalizedProductShortDescription } from "@/lib/productLocalization";
import { shippingTypeLabel } from "@/lib/shippingLabels";
import {
  calculateVariantPrice,
  findMatchingVariant,
  getEffectiveStock,
  getOptionValueStatus,
  isProductSoldOut,
  normalizePurchaseSelection,
} from "@/lib/storefront/productVariants";
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

  const optionGroups = product.options ?? [];
  // STEP 19 spec section 19 — a product WITH option_groups but no real
  // variants yet (incomplete admin data) still takes this branch rather
  // than being silently treated as option-less: getOptionValueStatus and
  // isProductSoldOut both naturally resolve to "unavailable"/"sold out"
  // against an empty variants list, so it renders as an honestly
  // unpurchasable product instead of a wrong price/stock.
  const hasOptions = optionGroups.length > 0;
  const variants = useMemo(() => product.variants ?? [], [product.variants]);
  const groupNames = optionGroups.map((g) => g.name);

  const [selectedOptions, setSelectedOptions] = useState<SelectedOptions>(() =>
    hasOptions ? {} : Object.fromEntries(optionGroups.map((group) => [group.name, group.choices[0]]))
  );
  const [quantity, setQuantity] = useState(1);
  const [toast, setToast] = useState<ToastState | null>(null);

  const eyebrow = product.brand ?? categories.find((item) => item.id === product.category)?.label ?? "";
  const isAvailable = isProductAvailableInMarket(product, market.countryCode);
  const { salePrice: basePrice, originalPrice: baseOriginalPrice } = getProductMarketPrice(product, market);
  const shortDescription = getLocalizedProductShortDescription(product, market.locale);

  const matchedVariant = useMemo(
    () => (hasOptions ? findMatchingVariant(variants, selectedOptions, groupNames) : null),
    [hasOptions, variants, selectedOptions, groupNames]
  );

  const productSoldOut = hasOptions
    ? isProductSoldOut(true, variants, product.stock)
    : isProductSoldOut(false, [], product.stock);

  // STEP 18 documented additional_price as a raw KRW delta with no
  // per-market override — converting it the same way getProductMarketPrice
  // converts the base price keeps a non-KRW market's final price honest
  // instead of mixing units.
  const additionalPriceInMarketCurrency = matchedVariant
    ? market.currency === "KRW"
      ? matchedVariant.additionalPrice
      : convertFromKrw(matchedVariant.additionalPrice, market.currency)
    : 0;
  const unitPrice = hasOptions
    ? matchedVariant
      ? calculateVariantPrice(basePrice, additionalPriceInMarketCurrency)
      : null
    : basePrice;

  const effectiveStock = hasOptions
    ? getEffectiveStock(true, matchedVariant, product.stock)
    : getEffectiveStock(false, null, product.stock);

  const canSelectQuantity = isAvailable && !productSoldOut && (!hasOptions || matchedVariant !== null);
  const isLowStock = canSelectQuantity && effectiveStock > 0 && effectiveStock < 10;

  const hasDiscount = !hasOptions && Boolean(product.discountRate);

  function showToast(next: ToastState) {
    setToast(next);
    window.setTimeout(() => setToast(null), 2600);
  }

  // --- option-less purchase path (unchanged from before STEP 19, aside
  // from the sold-out gate this step's spec explicitly asks for) ----------
  function handleAddToCartLegacy() {
    if (!isAvailable || productSoldOut) return;

    if (typeof product.stock === "number") {
      const cartItemId = createCartItemId(product.id, selectedOptions);
      const existing = cart.items.find((item) => item.cartItemId === cartItemId);
      const projected = (existing?.quantity ?? 0) + quantity;
      if (projected > product.stock) {
        showToast({ message: messages.toast.outOfStock, tone: "error" });
        return;
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

  function handleBuyNowLegacy() {
    if (!isAvailable || productSoldOut) return;
    setBuyNowItem({ productId: product.id, selectedOptions, quantity });
    router.push("/checkout?source=buynow");
  }

  // --- variant-aware path (STEP 19 — new) ---------------------------------
  // cart.addItem/setBuyNowItem re-derive price purely from the product's
  // own base price (lib/cart.ts's enrichCartItem), with no notion of a
  // selected variant's SKU/price/stock — wiring a variant selection through
  // them as-is would silently show the wrong price in the cart. STEP 19
  // explicitly scopes real cart/order persistence out (see PurchaseSelection
  // in types/purchase.ts); this only confirms the selection is valid and
  // normalizes it into the exact payload STEP 20 will need.
  function handleVariantSelection() {
    if (!isAvailable || productSoldOut) return;
    if (!matchedVariant) {
      showToast({ message: messages.product.selectVariantPrompt, tone: "error" });
      return;
    }
    const selection = normalizePurchaseSelection({
      productId: product.id,
      productSku: product.sku ?? product.id,
      quantity,
      unitPrice: unitPrice ?? 0,
      variant: matchedVariant,
      maxStock: effectiveStock,
    });
    if (!selection) return;
    showToast({ message: messages.product.purchaseSelectionPending, tone: "success" });
  }

  const legacyDisabled = !isAvailable || productSoldOut;
  const variantDisabled = !isAvailable || productSoldOut || !matchedVariant || quantity < 1 || quantity > effectiveStock;

  const totalPrice = unitPrice !== null ? unitPrice * quantity : null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        {eyebrow && <p className="text-xs font-medium text-text-secondary">{eyebrow}</p>}
        <h1 className="mt-1 text-lg font-bold text-text-main md:text-xl">{getLocalizedProductName(product, market.locale)}</h1>
        {shortDescription && <p className="mt-1.5 text-sm text-text-secondary">{shortDescription}</p>}
        <div className="mt-2 flex items-center gap-1 text-sm text-text-secondary">
          <Star size={14} className="fill-primary text-primary" />
          <span className="font-medium text-text-main">{product.rating.toFixed(1)}</span>
          <span>({formatNumber(product.reviewCount, market.locale)})</span>
        </div>
      </div>

      <div className="border-t border-border pt-5">
        {hasOptions ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2 text-sm text-text-secondary">
              <span>{messages.product.basePriceLabel}</span>
              <span>{formatCurrency(basePrice, market.currency)}</span>
            </div>
            {matchedVariant && matchedVariant.additionalPrice !== 0 && (
              <div className="flex items-baseline gap-2 text-sm text-text-secondary">
                <span>{messages.product.optionPriceLabel}</span>
                <span>
                  {additionalPriceInMarketCurrency > 0 ? "+" : ""}
                  {formatCurrency(additionalPriceInMarketCurrency, market.currency)}
                </span>
              </div>
            )}
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-bold text-text-secondary">{messages.product.finalPriceLabel}</span>
              <span className="text-2xl font-bold text-text-main">
                {unitPrice !== null ? formatCurrency(unitPrice, market.currency) : "-"}
              </span>
            </div>
            {productSoldOut && (
              <span className="w-fit bg-red-50 px-2 py-1 text-xs font-bold text-red-600">{messages.product.soldOut}</span>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              {hasDiscount && <span className="text-xl font-bold text-primary">{product.discountRate}%</span>}
              <span className="text-2xl font-bold text-text-main">{formatCurrency(basePrice, market.currency)}</span>
              {productSoldOut && (
                <span className="ml-1 w-fit bg-red-50 px-2 py-1 text-xs font-bold text-red-600">{messages.product.soldOut}</span>
              )}
            </div>
            {hasDiscount && <span className="text-sm text-text-secondary line-through">{formatCurrency(baseOriginalPrice, market.currency)}</span>}
          </>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ShippingBadge type={product.shippingType} label={shippingTypeLabel(product.shippingType, market.locale)} originCountry={product.originCountry} />
          {product.freeShipping && <span className="text-xs font-medium text-primary">{messages.product.freeShipping}</span>}
        </div>
      </div>

      <ShippingInfoPanel product={product} market={market} />

      {isAvailable && !productSoldOut && hasOptions && (
        <div className="border-t border-border pt-5">
          <OptionSelector
            options={optionGroups}
            selected={selectedOptions}
            onChange={(groupName, choice) => setSelectedOptions((prev) => ({ ...prev, [groupName]: choice }))}
            getStatus={(groupName, choice) => getOptionValueStatus(variants, groupName, choice, selectedOptions)}
            soldOutLabel={messages.product.soldOut}
          />
          {Object.keys(selectedOptions).length === groupNames.length && !matchedVariant && (
            <p className="mt-2 text-xs text-red-600">{messages.product.optionCombinationSoldOut}</p>
          )}
        </div>
      )}
      {canSelectQuantity && (
        <div className="border-t border-border pt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-text-secondary">수량</h3>
            {isLowStock && <span className="text-xs text-text-secondary">{`재고 ${effectiveStock}개 남음`}</span>}
          </div>
          <div className="mt-2">
            <QuantitySelector value={quantity} onChange={setQuantity} max={effectiveStock} />
          </div>
          {totalPrice !== null && (
            <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
              <span className="text-xs font-bold text-text-secondary">{messages.product.totalPriceLabel}</span>
              <span className="text-lg font-bold text-text-main">{formatCurrency(totalPrice, market.currency)}</span>
            </div>
          )}
        </div>
      )}

      <PurchaseActions
        variant="inline"
        onAddToCart={hasOptions ? handleVariantSelection : handleAddToCartLegacy}
        onBuyNow={hasOptions ? handleVariantSelection : handleBuyNowLegacy}
        disabled={hasOptions ? variantDisabled : legacyDisabled}
      />
      <PurchaseActions
        variant="fixed"
        onAddToCart={hasOptions ? handleVariantSelection : handleAddToCartLegacy}
        onBuyNow={hasOptions ? handleVariantSelection : handleBuyNowLegacy}
        disabled={hasOptions ? variantDisabled : legacyDisabled}
      />

      <Toast toast={toast} />
    </div>
  );
}
