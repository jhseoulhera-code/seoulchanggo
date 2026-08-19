import { Camera, ShoppingCart, Search, User } from "lucide-react";
import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="flex items-center justify-between px-4 py-3 md:px-6">
        <Link href="/" className="text-xl font-bold text-primary">
          서울창고
        </Link>
        <div className="flex items-center gap-4 text-text-main">
          <button type="button" aria-label="마이페이지" className="cursor-not-allowed">
            <User size={22} />
          </button>
          <button type="button" aria-label="장바구니" className="cursor-not-allowed">
            <ShoppingCart size={22} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 pb-3 md:px-6">
        <div className="flex flex-1 items-center gap-2 rounded-full border border-border bg-white px-4 py-2.5">
          <Search size={18} className="text-text-secondary" />
          <input
            type="text"
            placeholder="상품을 검색해보세요"
            disabled
            className="w-full bg-transparent text-sm text-text-main placeholder:text-text-secondary focus:outline-none"
          />
        </div>
        <button
          type="button"
          aria-label="이미지로 검색"
          className="flex h-10 w-10 flex-shrink-0 cursor-not-allowed items-center justify-center rounded-full border border-border text-text-secondary"
        >
          <Camera size={18} />
        </button>
      </div>
    </header>
  );
}
