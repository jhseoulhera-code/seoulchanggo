"use client";

import { SHIPPING_INFO } from "@/data/shippingInfo";
import { useMarket } from "@/contexts/MarketContext";
import { getMessages } from "@/messages";
import type { Product } from "@/types";

export function ShippingExchangeTab({ product }: { product: Product }) {
  const { market } = useMarket();
  const messages = getMessages(market.locale);
  const info = SHIPPING_INFO[product.shippingType];
  const feeLine = product.freeShipping ? messages.product.freeShipping : info.defaultFee[market.locale];

  const rows = [
    { label: messages.shippingExchange.shippingMethod, value: `${info.title[market.locale]} · ${info.methodNote[market.locale]}` },
    { label: messages.shippingExchange.shippingPeriod, value: info.eta[market.locale] },
    { label: messages.shippingExchange.shippingFee, value: feeLine },
    { label: messages.shippingExchange.exchangeCondition, value: messages.shippingExchange.exchangeConditionValue },
    { label: messages.shippingExchange.returnCondition, value: messages.shippingExchange.returnConditionValue },
  ];

  return (
    <div className="flex flex-col py-5 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex gap-4 border-t border-border py-3 first:border-t-0">
          <span className="w-20 flex-shrink-0 text-text-secondary">{row.label}</span>
          <span className="text-text-main">{row.value}</span>
        </div>
      ))}

      {product.shippingType === "overseas_direct" && (
        <div className="border-t border-border py-3">
          <p className="mb-1 text-xs font-bold text-text-secondary">{messages.shippingExchange.overseasDirectNoticeTitle}</p>
          <p className="text-xs leading-relaxed text-text-secondary">{messages.shippingExchange.overseasDirectNoticeBody}</p>
        </div>
      )}

      {product.shippingType === "overseas_agent" && info.agencyNotice && (
        <div className="border-t border-border py-3">
          <p className="mb-1 text-xs font-bold text-text-secondary">{messages.shippingExchange.overseasAgencyNoticeTitle}</p>
          <p className="text-xs leading-relaxed text-text-secondary">
            {info.agencyNotice[market.locale]} {messages.shippingExchange.overseasAgencyNoticeSuffix}
          </p>
        </div>
      )}
    </div>
  );
}
