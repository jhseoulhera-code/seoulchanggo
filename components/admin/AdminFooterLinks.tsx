"use client";

import { LogOut, Store } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export function AdminFooterLinks() {
  const auth = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await auth.logout();
    router.push("/");
  }

  return (
    <div className="flex flex-col gap-1 border-t border-border px-3 py-4">
      <Link href="/" className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-text-secondary">
        <Store size={18} />
        쇼핑몰 보기
      </Link>
      <button
        type="button"
        onClick={handleLogout}
        className="flex items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium text-text-secondary"
      >
        <LogOut size={18} />
        로그아웃
      </button>
    </div>
  );
}
