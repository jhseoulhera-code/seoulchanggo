"use client";

import { AlertTriangle, Clock, MapPin, Truck } from "lucide-react";
import { SHIPPING_INFO } from "@/data/shippingInfo";
import { formatCurrency } from "@/lib/currency";
import { getShippingFeeForMarket, isProductAvailableInMarket } from "@/lib/shipping";
import { getMessages, t } from "@/messages";
import type { Product } from "@/types";
import type { Market } from "@/types/market";

type ShippingInfoPanelProps = {
  product: Product;
  market: Market;
};

export function ShippingInfoPanel({ product, market }: ShippingInfoPanelProps) {
  const info = SHIPPING_INFO[product.shippingType];
  const messages = getMessages(market.locale);
  const isAvailable = isProductAvailableInMarket(product, market.countryCode);

  if (!isAvailable) {
    return (
      <div className="flex items-start gap-2 border border-border bg-primary-light/40 p-3.5 text-sm text-text-main">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-text-secondary" />
        <span>{t(messages.cart.unavailableInMarket, { country: market.countryName })}</span>
      </div>
    );
  }

  const fee = getShippingFeeForMarket(product, market);
  const feeLine = product.freeShipping ? "무료배송" : formatCurrency(fee, market.currency);

  return (
    <div className="flex flex-col gap-2.5 border border-border p-3.5 text-sm">
      <div className="flex items-center gap-2">
        <MapPin size={15} className="shrink-0 text-primary" />
        <span className="text-text-main">{info.origin}</span>
      </div>
      <div className="flex items-center gap-2">
        <Clock size={15} className="shrink-0 text-primary" />
        <span className="text-text-main">{info.eta}</span>
        <span className="text-text-secondary">· {info.methodNote}</span>
      </div>
      <div className="flex items-center gap-2">
        <Truck size={15} className="shrink-0 text-primary" />
        <span className={product.freeShipping ? "font-medium text-primary" : "text-text-main"}>
          {feeLine}
        </span>
      </div>

      {info.agencyNotice && (
        <p className="border-t border-border pt-2.5 text-xs leading-relaxed text-text-secondary">
          {info.agencyNotice}
        </p>
      )}
    </div>
  );
}
