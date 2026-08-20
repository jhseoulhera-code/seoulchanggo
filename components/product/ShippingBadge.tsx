import type { ShippingType } from "@/types";

const SHIPPING_CODE: Record<ShippingType, string> = {
  domestic: "KR",
  overseas_direct: "CN",
  overseas_agent: "AG",
};

type ShippingBadgeProps = {
  type: ShippingType;
  label: string;
};

export function ShippingBadge({ type, label }: ShippingBadgeProps) {
  return (
    <span className="inline-flex items-stretch border border-border font-mono text-[10px] leading-none">
      <span className="flex items-center bg-primary-light px-1.5 py-1 font-bold tracking-wide text-primary">
        {SHIPPING_CODE[type]}
      </span>
      <span className="flex items-center border-l border-border px-1.5 py-1 text-text-secondary">
        {label}
      </span>
    </span>
  );
}
