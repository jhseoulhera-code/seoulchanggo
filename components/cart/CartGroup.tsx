"use client";

import { CartItemRow } from "@/components/cart/CartItemRow";
import { ShippingBadge } from "@/components/product/ShippingBadge";
import { getMessages } from "@/messages";
import type { ShippingType } from "@/types";
import type { CartLineView } from "@/types/cart";
import type { Market } from "@/types/market";

const GROUP_LABEL_KEY: Record<ShippingType, "groupDomestic" | "groupOverseasDirect" | "groupOverseasAgency"> = {
  domestic: "groupDomestic",
  overseas_direct: "groupOverseasDirect",
  overseas_agent: "groupOverseasAgency",
};

type CartGroupProps = {
  shippingType: ShippingType;
  lines: CartLineView[];
  market: Market;
  onToggleItem: (cartItemId: string, checked: boolean) => void;
  onToggleGroup: (cartItemIds: string[], checked: boolean) => void;
  onQuantityChange: (cartItemId: string, quantity: number) => void;
  onRemove: (cartItemId: string) => void;
};

export function CartGroup({
  shippingType,
  lines,
  market,
  onToggleItem,
  onToggleGroup,
  onQuantityChange,
  onRemove,
}: CartGroupProps) {
  const messages = getMessages(market.locale);
  const groupLabel = messages.cart[GROUP_LABEL_KEY[shippingType]];
  const availableIds = lines.filter((line) => line.isAvailable).map((line) => line.cartItem.cartItemId);
  const allChecked = availableIds.length > 0 && availableIds.every((id) =>
    lines.find((line) => line.cartItem.cartItemId === id)?.cartItem.checked
  );

  return (
    <section className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={allChecked}
          disabled={availableIds.length === 0}
          onChange={(event) => onToggleGroup(availableIds, event.target.checked)}
          className="h-4 w-4 accent-primary disabled:opacity-40"
        />
        <ShippingBadge
          type={shippingType}
          label={lines[0]?.product.shippingLabel ?? ""}
        />
        <span className="text-sm font-bold text-text-main">{groupLabel}</span>
      </div>

      <div>
        {lines.map((line) => (
          <CartItemRow
            key={line.cartItem.cartItemId}
            line={line}
            market={market}
            onToggle={(checked) => onToggleItem(line.cartItem.cartItemId, checked)}
            onQuantityChange={(quantity) => onQuantityChange(line.cartItem.cartItemId, quantity)}
            onRemove={() => onRemove(line.cartItem.cartItemId)}
          />
        ))}
      </div>
    </section>
  );
}
