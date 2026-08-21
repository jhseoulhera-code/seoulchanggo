import { SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <SearchX size={32} className="text-text-secondary" />
      <p className="text-sm text-text-secondary">요청하신 페이지를 찾을 수 없습니다.</p>
      <Link href="/" className="border border-primary px-4 py-2 text-sm font-bold text-primary">
        홈으로 돌아가기
      </Link>
    </div>
  );
}
