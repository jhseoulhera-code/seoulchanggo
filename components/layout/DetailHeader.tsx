import { ChevronLeft, Heart, Share2 } from "lucide-react";
import Link from "next/link";
import { PageContainer } from "@/components/common/PageContainer";

export function DetailHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <PageContainer>
        <div className="flex items-center justify-between py-3.5">
          <Link href="/" aria-label="홈으로" className="text-text-main">
            <ChevronLeft size={22} />
          </Link>
          <div className="flex items-center gap-4 text-text-main">
            <button type="button" aria-label="공유하기" className="cursor-not-allowed">
              <Share2 size={19} />
            </button>
            <button type="button" aria-label="찜하기" className="cursor-not-allowed">
              <Heart size={20} />
            </button>
          </div>
        </div>
      </PageContainer>
    </header>
  );
}
