import { SectionHeading } from "@/components/common/SectionHeading";
import { PlaceholderBox } from "@/components/common/PlaceholderBox";

export function PromotionSection() {
  return (
    <section className="mt-6 mb-6">
      <SectionHeading title="기획전" />
      <div className="mt-3 px-4 md:px-6">
        <PlaceholderBox label="기획전 영역" className="h-32 w-full md:h-40" />
      </div>
    </section>
  );
}
