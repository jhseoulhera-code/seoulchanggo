import { PageContainer } from "@/components/common/PageContainer";
import { BottomNav } from "@/components/layout/BottomNav";
import { ListHeader } from "@/components/layout/ListHeader";
import { FaqAccordion } from "@/components/faq/FaqAccordion";
import { getFaqs } from "@/lib/repositories/faqs";

export default async function FaqPage() {
  const faqs = await getFaqs();

  return (
    <>
      <ListHeader title="자주 묻는 질문" hideCartIcon />
      <main className="pb-24 md:pb-10">
        <PageContainer className="pt-4">
          <FaqAccordion faqs={faqs} />
        </PageContainer>
      </main>
      <BottomNav />
    </>
  );
}
