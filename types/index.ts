import type { LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
};

export type QuickNavItem = {
  label: string;
  href: string;
};

export type Category = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export type ShippingType = "domestic" | "overseas_direct" | "overseas_agent";

export type Product = {
  id: string;
  name: string;
  image: string;
  originalPrice: number;
  salePrice: number;
  discountRate?: number;
  rating: number;
  reviewCount: number;
  shippingType: ShippingType;
  shippingLabel: string;
  freeShipping: boolean;
  category: string;
};

export type SortOption =
  | "recommended"
  | "popular"
  | "priceLow"
  | "priceHigh"
  | "reviews";

export type PriceRangeId = "under10k" | "10kTo30k" | "30kTo50k" | "over50k";

export type HeroSlide = {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  background: string;
  icon: LucideIcon;
};

export type Promotion = {
  id: string;
  title: string;
  subtitle: string;
  background: string;
  icon: LucideIcon;
};
