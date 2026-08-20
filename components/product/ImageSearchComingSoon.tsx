import { Camera } from "lucide-react";
import Link from "next/link";

export function ImageSearchComingSoon() {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <Camera size={36} className="text-text-secondary" />
      <p className="text-sm text-text-main">이미지 검색 기능은 준비 중입니다.</p>
      <p className="text-xs text-text-secondary">곧 사진으로 상품을 찾아보실 수 있어요.</p>
      <Link href="/search" className="mt-2 text-xs font-bold text-primary underline">
        텍스트로 검색하기
      </Link>
    </div>
  );
}
