"use client";

import Image from "next/image";
import { Trash2 } from "lucide-react";
import { ProductImagePlaceholder } from "@/components/product/ProductImagePlaceholder";
import { QuantitySelector } from "@/components/product/QuantitySelector";
import { formatCurrency } from "@/lib/currency";
import { getLocalizedProductName } from "@/lib/productLocalization";
import { getMessages, t } from "@/messages";
import type { CartLineView } from "@/types/cart";
import type { Market } from "@/types/market";

type CartItemRowProps = {
  line: CartLineView;
  market: Market;
  onToggle: (checked: boolean) => void;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
};

export function CartItemRow({ line, market, onToggle, onQuantityChange, onRemove }: CartItemRowProps) {
  const messages = getMessages(market.locale);
  const { product, cartItem, isAvailable, isPurchasable } = line;
  // STEP 20 spec section 17 — a sold-out/deactivated/no-longer-sold line
  // stays visible with a clear "can't be bought right now" state instead of
  // being silently hidden or (worse) still counted toward the total.
  const canSelect = isAvailable && isPurchasable;

  return (
    <div className="flex gap-3 border-t border-border py-4 first:border-t-0">
      <input
        type="checkbox"
        checked={cartItem.checked && canSelect}
        disabled={!canSelect}
        onChange={(event) => onToggle(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-primary disabled:opacity-40"
      />

      <div className="relative h-20 w-20 shrink-0 overflow-hidden border border-border">
        {product.image ? (
          <Image src={product.image} alt="" fill sizes="80px" className="object-cover" />
        ) : (
          <ProductImagePlaceholder category={product.category} className="h-full w-full" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="line-clamp-2 text-sm text-text-main">{getLocalizedProductName(product, market.locale)}</p>
        {line.optionLabel && <p className="text-xs text-text-secondary">{line.optionLabel}</p>}

        {!isAvailable ? (
          <p className="text-xs font-medium text-text-secondary">
            {t(messages.cart.unavailableInMarket, { country: market.countryName })}
          </p>
        ) : !isPurchasable ? (
          <p className="w-fit bg-red-50 px-1.5 py-0.5 text-xs font-bold text-red-600">{messages.cart.unavailableItem}</p>
        ) : (
          <>
            <div className="flex items-baseline gap-1.5">
              {product.discountRate && !cartItem.variantId && (
                <span className="text-xs font-bold text-primary">{product.discountRate}%</span>
              )}
              <span className="text-sm font-bold text-text-main">{formatCurrency(line.unitPrice, market.currency)}</span>
            </div>
            {line.priceChanged && (
              <p className="text-[11px] text-amber-700">
                {messages.cart.priceChanged}{" "}
                <span className="text-text-secondary">
                  ({t(messages.cart.previousPrice, { price: formatCurrency(cartItem.unitPriceSnapshot, "KRW") })})
                </span>
              </p>
            )}

            <div className="mt-1">
              <QuantitySelector value={cartItem.quantity} onChange={onQuantityChange} max={line.currentStock ?? undefined} />
            </div>
          </>
        )}
      </div>

      <button type="button" aria-label={messages.cart.remove} onClick={onRemove} className="h-fit shrink-0 text-text-secondary">
        <Trash2 size={17} />
      </button>
    </div>
  );
}
