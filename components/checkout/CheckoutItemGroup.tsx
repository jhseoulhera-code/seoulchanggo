"use client";

import { AlertTriangle } from "lucide-react";
import { ProductImagePlaceholder } from "@/components/product/ProductImagePlaceholder";
import { ShippingBadge } from "@/components/product/ShippingBadge";
import { SHIPPING_INFO, SHIPPING_METHOD_LABEL } from "@/data/shippingInfo";
import { formatCurrency } from "@/lib/currency";
import { getMessages, t } from "@/messages";
import type { ShippingType } from "@/types";
import type { Market } from "@/types/market";
import type { CheckoutItem } from "@/types/order";
import type { ShippingQuote } from "@/lib/shipping/quote";

const GROUP_LABEL_KEY: Record<ShippingType, "groupDomestic" | "groupOverseasDirect" | "groupOverseasAgency"> = {
  domestic: "groupDomestic",
  overseas_direct: "groupOverseasDirect",
  overseas_agent: "groupOverseasAgency",
};

type CheckoutItemGroupProps = {
  shippingType: ShippingType;
  items: CheckoutItem[];
  market: Market;
  /** STEP 21 — omitted on the "blocked" screen, where a shared quote across mixed-state items wouldn't mean anything. */
  quote?: ShippingQuote;
};

function shippingQuoteText(
  quote: ShippingQuote,
  market: Market,
  messages: ReturnType<typeof getMessages>
): string {
  switch (quote.status) {
    case "FREE":
      return messages.checkout.shippingFree;
    case "CALCULATED":
      return formatCurrency(quote.amount ?? 0, market.currency);
    case "UNAVAILABLE":
      return messages.checkout.shippingUnavailable;
    case "PENDING":
      return messages.checkout.shippingPending;
  }
}

export function CheckoutItemGroup({ shippingType, items, market, quote }: CheckoutItemGroupProps) {
  const messages = getMessages(market.locale);
  const groupLabel = messages.cart[GROUP_LABEL_KEY[shippingType]];
  const info = SHIPPING_INFO[shippingType];
  const methodItem = items.find((item) => item.internationalShippingMethod);
  const methodLabel = methodItem?.internationalShippingMethod
    ? SHIPPING_METHOD_LABEL[methodItem.internationalShippingMethod][market.locale]
    : null;

  return (
    <section className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <ShippingBadge type={shippingType} label={groupLabel} />
        <span className="text-sm font-bold text-text-main">{groupLabel}</span>
        <span className="text-xs text-text-secondary">
          · {info.eta[market.locale]}
          {methodLabel ? ` · ${methodLabel}` : ""}
        </span>
        {quote && (
          <span
            className={`ml-auto text-xs font-bold ${
              quote.status === "UNAVAILABLE" ? "text-red-600" : quote.status === "PENDING" ? "text-amber-600" : "text-text-main"
            }`}
          >
            {shippingQuoteText(quote, market, messages)}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {items.map((item) => (
          <div key={`${item.productId}-${item.optionLabel}`} className="flex gap-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden border border-border">
              <ProductImagePlaceholder category={item.category} className="h-full w-full" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="line-clamp-2 text-sm text-text-main">{item.productName}</p>
              {item.optionLabel && (
                <p className="text-xs text-text-secondary">
                  {messages.checkout.optionSectionLabel}: {item.optionLabel}
                </p>
              )}

              {!item.isAvailable ? (
                <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                  <AlertTriangle size={12} className="shrink-0" />
                  {t(messages.cart.unavailableInMarket, { country: market.countryName })}
                </p>
              ) : !item.isPurchasable ? (
                <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                  <AlertTriangle size={12} className="shrink-0" />
                  {messages.checkout.unavailableBadge}
                </p>
              ) : (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-text-secondary">
                    {formatCurrency(item.unitPrice, market.currency)} × {item.quantity}
                    {item.priceChanged && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                        {messages.checkout.priceChangedBadge}
                      </span>
                    )}
                  </span>
                  <span className="font-bold text-text-main">
                    {formatCurrency(item.subtotal, market.currency)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
