import { PageContainer } from "@/components/common/PageContainer";
import { BottomNav } from "@/components/layout/BottomNav";
import { ListHeader } from "@/components/layout/ListHeader";
import { PolicyPlaceholderNotice } from "@/components/common/PolicyPlaceholderNotice";

export default function ReturnPolicyPage() {
  return (
    <>
      <ListHeader title="교환/반품정책" hideCartIcon />
      <main className="pb-24 md:pb-10">
        <PageContainer className="pt-4">
          <PolicyPlaceholderNotice />
        </PageContainer>
      </main>
      <BottomNav />
    </>
  );
}
