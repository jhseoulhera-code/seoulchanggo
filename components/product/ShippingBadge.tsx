import type { ShippingType } from "@/types";
import type { OriginCountryCode } from "@/types/market";

const DEFAULT_CODE: Record<ShippingType, string> = {
  domestic: "KR",
  overseas_direct: "CN",
  overseas_agent: "AG",
};

type ShippingBadgeProps = {
  type: ShippingType;
  label: string;
  originCountry?: OriginCountryCode;
};

export function ShippingBadge({ type, label, originCountry }: ShippingBadgeProps) {
  const code = type === "overseas_agent" ? "AG" : originCountry ?? DEFAULT_CODE[type];

  return (
    <span className="inline-flex items-stretch border border-border font-mono text-[10px] leading-none">
      <span className="flex items-center bg-primary-light px-1.5 py-1 font-bold tracking-wide text-primary">
        {code}
      </span>
      <span className="flex items-center border-l border-border px-1.5 py-1 text-text-secondary">
        {label}
      </span>
    </span>
  );
}
