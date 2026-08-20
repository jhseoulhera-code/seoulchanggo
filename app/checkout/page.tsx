import { PackageSearch } from "lucide-react";
import Link from "next/link";
import { PageContainer } from "@/components/common/PageContainer";
import { ListHeader } from "@/components/layout/ListHeader";

export default function CheckoutPage() {
  return (
    <>
      <ListHeader title="주문/결제" hideCartIcon />
      <main className="pb-16">
        <PageContainer>
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <PackageSearch size={40} className="text-text-secondary" />
            <p className="text-sm text-text-secondary">
              주문 단계는 다음 STEP에서 연결됩니다.
            </p>
            <Link
              href="/cart"
              className="border border-primary px-4 py-2 text-sm font-bold text-primary"
            >
              장바구니로 돌아가기
            </Link>
          </div>
        </PageContainer>
      </main>
    </>
  );
}
