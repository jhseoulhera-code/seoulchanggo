"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { AdminDrawer } from "@/components/admin/AdminDrawer";
import { AdminFooterLinks } from "@/components/admin/AdminFooterLinks";
import { AdminNavLinks } from "@/components/admin/AdminNavLinks";

type AdminShellProps = {
  adminName: string;
  children: ReactNode;
};

export function AdminShell({ adminName, children }: AdminShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border md:flex">
        <div className="border-b border-border px-4 py-4">
          <span className="text-sm font-bold text-primary">서울창고 Admin</span>
        </div>
        <AdminNavLinks />
        <AdminFooterLinks />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:justify-end">
          <button
            type="button"
            aria-label="메뉴 열기"
            onClick={() => setDrawerOpen(true)}
            className="text-text-main md:hidden"
          >
            <Menu size={22} />
          </button>
          <span className="text-sm text-text-secondary">{adminName}</span>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>

      <AdminDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <span className="text-sm font-bold text-primary">서울창고 Admin</span>
          <button type="button" aria-label="메뉴 닫기" onClick={() => setDrawerOpen(false)} className="text-text-main">
            <X size={20} />
          </button>
        </div>
        <AdminNavLinks onNavigate={() => setDrawerOpen(false)} />
        <AdminFooterLinks />
      </AdminDrawer>
    </div>
  );
}
