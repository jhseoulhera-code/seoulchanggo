"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { PageContainer } from "@/components/common/PageContainer";
import { ListHeader } from "@/components/layout/ListHeader";
import { CartEmptyState } from "@/components/cart/CartEmptyState";
import { CartGroup } from "@/components/cart/CartGroup";
import { CartSummary } from "@/components/cart/CartSummary";
import { useCart } from "@/contexts/CartContext";
import { useMarket } from "@/contexts/MarketContext";
import { calculateCartSummary, enrichCartItems, groupLinesByShippingType } from "@/lib/cart";
import { getMessages } from "@/messages";
import type { Product } from "@/types";

type CartPageClientProps = {
  products: Product[];
};

export function CartPageClient({ products }: CartPageClientProps) {
  const { market } = useMarket();
  const cart = useCart();
  const router = useRouter();
  const messages = getMessages(market.locale);

  const lines = useMemo(
    () => enrichCartItems(cart.items, products, market),
    [cart.items, products, market]
  );
  const groups = useMemo(() => groupLinesByShippingType(lines), [lines]);
  const totals = useMemo(() => calculateCartSummary(lines), [lines]);

  const availableIds = lines.filter((line) => line.isAvailable && line.isPurchasable).map((line) => line.cartItem.cartItemId);
  const allChecked =
    availableIds.length > 0 &&
    availableIds.every((id) => lines.find((line) => line.cartItem.cartItemId === id)?.cartItem.checked);

  function handleCheckout() {
    router.push("/checkout?source=cart");
  }

  return (
    <>
      <ListHeader title={messages.cart.title} hideCartIcon />
      <main className={lines.length > 0 ? "pb-40 md:pb-10" : "pb-10"}>
        <PageContainer>
          {lines.length === 0 ? (
            <CartEmptyState messages={messages} />
          ) : (
            <div className="flex flex-col gap-6 pt-4 md:flex-row md:items-start">
              <div className="flex-1">
                <label className="flex items-center gap-2.5 border-b border-border pb-3 text-sm font-medium text-text-main">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(event) => cart.setCheckedMany(availableIds, event.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  {messages.cart.selectAll}
                </label>

                <div className="flex flex-col gap-4">
                  {groups.map((group) => (
                    <CartGroup
                      key={group.shippingType}
                      shippingType={group.shippingType}
                      lines={group.lines}
                      market={market}
                      onToggleItem={(cartItemId, checked) => cart.setChecked(cartItemId, checked)}
                      onToggleGroup={(cartItemIds, checked) => cart.setCheckedMany(cartItemIds, checked)}
                      onQuantityChange={(cartItemId, quantity) => cart.setQuantity(cartItemId, quantity)}
                      onRemove={(cartItemId) => cart.removeItem(cartItemId)}
                    />
                  ))}
                </div>
              </div>

              <div className="hidden md:block md:w-80 md:shrink-0">
                <div className="sticky top-20">
                  <CartSummary totals={totals} market={market} variant="card" onCheckout={handleCheckout} />
                </div>
              </div>
            </div>
          )}
        </PageContainer>
      </main>

      {lines.length > 0 && (
        <CartSummary totals={totals} market={market} variant="fixed" onCheckout={handleCheckout} />
      )}
    </>
  );
}
