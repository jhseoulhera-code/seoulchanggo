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

export type ProductOptionGroup = {
  name: string;
  choices: string[];
};

export type ProductSpec = {
  label: string;
  value: string;
};

export type Product = {
  id: string;
  name: string;
  image: string;
  images?: string[];
  brand?: string;
  originalPrice: number;
  salePrice: number;
  discountRate?: number;
  rating: number;
  reviewCount: number;
  shippingType: ShippingType;
  shippingLabel: string;
  freeShipping: boolean;
  category: string;
  description?: string;
  specifications?: ProductSpec[];
  options?: ProductOptionGroup[];
  stock?: number;
};

export type ReviewSort = "latest" | "ratingHigh" | "ratingLow" | "helpful";

export type Review = {
  id: string;
  author: string;
  rating: number;
  date: string;
  optionLabel?: string;
  content: string;
  hasPhoto?: boolean;
  hasVideo?: boolean;
  helpfulCount: number;
};

export type InquiryStatus = "answered" | "pending";

export type Inquiry = {
  id: string;
  author: string;
  date: string;
  status: InquiryStatus;
  question: string;
  answer?: string;
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
