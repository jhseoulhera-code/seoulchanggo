import { Globe, Plane, Truck } from "lucide-react";
import type { ShippingType } from "@/types";

const SHIPPING_LABEL: Record<ShippingType, string> = {
  domestic: "국내배송",
  overseas_direct: "해외직배송",
  overseas_agent: "해외구매대행",
};

const SHIPPING_ICON: Record<ShippingType, typeof Truck> = {
  domestic: Truck,
  overseas_direct: Plane,
  overseas_agent: Globe,
};

type ShippingBadgeProps = {
  type: ShippingType;
};

export function ShippingBadge({ type }: ShippingBadgeProps) {
  const Icon = SHIPPING_ICON[type];

  return (
    <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] text-text-secondary">
      <Icon size={11} />
      {SHIPPING_LABEL[type]}
    </span>
  );
}
