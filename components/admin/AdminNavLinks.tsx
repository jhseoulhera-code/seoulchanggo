"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV_GROUPS } from "@/components/admin/adminNav";
import { cn } from "@/lib/utils";

type AdminNavLinksProps = {
  onNavigate?: () => void;
};

export function AdminNavLinks({ onNavigate }: AdminNavLinksProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-4 px-3 py-4">
      {ADMIN_NAV_GROUPS.map((group) => (
        <div key={group.label || "root"} className="flex flex-col gap-1">
          {group.label && (
            <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-text-secondary">{group.label}</p>
          )}
          {group.items.map((item) => {
            const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium",
                  isActive ? "bg-primary-light text-primary" : "text-text-main hover:bg-primary-light/50"
                )}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
