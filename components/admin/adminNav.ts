import {
  FileText,
  HelpCircle,
  Image as ImageIcon,
  LayoutDashboard,
  ListTree,
  Megaphone,
  MessageCircleQuestion,
  Package,
  ShoppingBag,
  Star,
  Ticket,
  Users,
  Warehouse,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type AdminNavGroup = {
  /** Empty label renders no group header — used for the standalone Dashboard link. */
  label: string;
  items: AdminNavItem[];
};

/** Grouped per STEP 10 spec section 30 so the sidebar stays scannable as it grows. */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  { label: "", items: [{ href: "/admin", label: "대시보드", icon: LayoutDashboard }] },
  {
    label: "상품",
    items: [
      { href: "/admin/products", label: "상품관리", icon: ShoppingBag },
      { href: "/admin/inventory", label: "재고관리", icon: Warehouse },
      { href: "/admin/categories", label: "카테고리", icon: ListTree },
    ],
  },
  { label: "주문", items: [{ href: "/admin/orders", label: "주문관리", icon: Package }] },
  {
    label: "고객",
    items: [
      { href: "/admin/customers", label: "회원관리", icon: Users },
      { href: "/admin/reviews", label: "리뷰관리", icon: Star },
      { href: "/admin/inquiries", label: "상품문의", icon: MessageCircleQuestion },
    ],
  },
  {
    label: "마케팅",
    items: [
      { href: "/admin/coupons", label: "쿠폰관리", icon: Ticket },
      { href: "/admin/banners", label: "배너관리", icon: ImageIcon },
      { href: "/admin/promotions", label: "기획전", icon: Megaphone },
    ],
  },
  {
    label: "콘텐츠",
    items: [
      { href: "/admin/notices", label: "공지사항", icon: FileText },
      { href: "/admin/faqs", label: "FAQ", icon: HelpCircle },
    ],
  },
];

/** Flat view, kept for anything that just needs "all admin routes" (e.g. active-path matching). */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((group) => group.items);
