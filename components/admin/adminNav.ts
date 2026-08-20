import { LayoutDashboard, ListTree, Package, ShoppingBag, Users, Warehouse } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Matches the STEP 09 spec's sidebar list exactly (6 items); HOME curation is reached from within Categories, not a 7th top-level entry. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/products", label: "상품관리", icon: ShoppingBag },
  { href: "/admin/inventory", label: "재고관리", icon: Warehouse },
  { href: "/admin/categories", label: "카테고리", icon: ListTree },
  { href: "/admin/orders", label: "주문관리", icon: Package },
  { href: "/admin/customers", label: "회원관리", icon: Users },
];
