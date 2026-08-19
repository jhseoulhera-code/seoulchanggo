import type { LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type QuickNavItem = {
  label: string;
  href: string;
};

export type Category = {
  id: string;
  label: string;
};
