import { Grid2x2, Home, Search, ShoppingCart, User } from "lucide-react";
import type { NavItem } from "@/types";

export const bottomNavItems: NavItem[] = [
  { label: "홈", href: "/", icon: Home },
  { label: "카테고리", href: "#", icon: Grid2x2 },
  { label: "검색", href: "#", icon: Search },
  { label: "마이", href: "#", icon: User },
  { label: "장바구니", href: "#", icon: ShoppingCart, badge: 3 },
];
