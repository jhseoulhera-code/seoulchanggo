import type { Promotion } from "@/types";

type PromotionCardProps = {
  promotion: Promotion;
};

export function PromotionCard({ promotion }: PromotionCardProps) {
  const Icon = promotion.icon;

  return (
    <div
      className="flex h-28 w-56 flex-shrink-0 flex-col justify-between rounded-lg border border-border p-4"
      style={{ backgroundColor: promotion.background }}
    >
      <Icon size={22} className="text-primary" strokeWidth={1.5} />
      <div>
        <p className="text-sm font-bold text-text-main">{promotion.title}</p>
        <p className="mt-0.5 text-xs text-text-secondary">{promotion.subtitle}</p>
      </div>
    </div>
  );
}
