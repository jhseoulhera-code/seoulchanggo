import { Header } from "@/components/layout/Header";
import { QuickNav } from "@/components/layout/QuickNav";
import { BottomNav } from "@/components/layout/BottomNav";
import { Footer } from "@/components/layout/Footer";
import { PageContainer } from "@/components/common/PageContainer";
import { MainBanner } from "@/components/home/MainBanner";
import { CategorySection } from "@/components/home/CategorySection";
import { BestProducts } from "@/components/home/BestProducts";
import { DomesticProducts } from "@/components/home/DomesticProducts";
import { OverseasProducts } from "@/components/home/OverseasProducts";
import { DiscountProducts } from "@/components/home/DiscountProducts";
import { PromotionSection } from "@/components/home/PromotionSection";

export default function Home() {
  return (
    <>
      <Header />
      <QuickNav />
      <main className="pb-24 md:pb-10">
        <PageContainer className="flex flex-col gap-8 pt-4">
          <MainBanner />
          <CategorySection />
          <BestProducts />
          <DomesticProducts />
          <OverseasProducts />
          <DiscountProducts />
          <PromotionSection />
        </PageContainer>
        <Footer />
      </main>
      <BottomNav />
    </>
  );
}
