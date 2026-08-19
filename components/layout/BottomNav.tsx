import Link from "next/link";
import { bottomNavItems } from "@/data/bottomNav";
import { cn } from "@/lib/utils";

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background md:hidden">
      {bottomNavItems.map((item) => {
        const isActive = item.href === "/";
        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs",
              isActive ? "text-primary" : "text-text-secondary"
            )}
          >
            <item.icon size={22} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
