import { SectionHeading } from "@/components/common/SectionHeading";
import { PromotionCard } from "@/components/home/PromotionCard";
import { promotions } from "@/data/promotions";

export function PromotionSection() {
  return (
    <section>
      <SectionHeading titleKey="promotion" showMore />
      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1">
        {promotions.map((promotion) => (
          <PromotionCard key={promotion.id} promotion={promotion} />
        ))}
      </div>
    </section>
  );
}
