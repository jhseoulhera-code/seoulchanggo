import { ChevronLeft, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { PageContainer } from "@/components/common/PageContainer";

type ListHeaderProps = {
  title: string;
};

export function ListHeader({ title }: ListHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <PageContainer>
        <div className="flex items-center justify-between py-3.5">
          <div className="flex items-center gap-2">
            <Link href="/" aria-label="홈으로" className="text-text-main">
              <ChevronLeft size={22} />
            </Link>
            <h1 className="text-base font-bold text-text-main">{title}</h1>
          </div>
          <button type="button" aria-label="장바구니" className="relative cursor-not-allowed text-text-main">
            <ShoppingCart size={21} />
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
              3
            </span>
          </button>
        </div>
      </PageContainer>
    </header>
  );
}
