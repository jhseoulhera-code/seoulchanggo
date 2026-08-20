import { Clock, MapPin, Truck } from "lucide-react";
import { SHIPPING_INFO } from "@/data/shippingInfo";
import type { Product } from "@/types";

type ShippingInfoPanelProps = {
  product: Product;
};

export function ShippingInfoPanel({ product }: ShippingInfoPanelProps) {
  const info = SHIPPING_INFO[product.shippingType];
  const feeLine = product.freeShipping ? "무료배송" : info.defaultFee;

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
