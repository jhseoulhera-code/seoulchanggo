import { PageContainer } from "@/components/common/PageContainer";
import { BottomNav } from "@/components/layout/BottomNav";
import { ListHeader } from "@/components/layout/ListHeader";
import { PolicyPlaceholderNotice } from "@/components/common/PolicyPlaceholderNotice";

export default function ShippingPolicyPage() {
  return (
    <>
      <ListHeader title="배송정책" hideCartIcon />
      <main className="pb-24 md:pb-10">
        <PageContainer className="pt-4">
          <PolicyPlaceholderNotice />
        </PageContainer>
      </main>
      <BottomNav />
    </>
  );
}
