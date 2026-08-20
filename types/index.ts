import type { LucideIcon } from "lucide-react";
import type { CountryCode, InternationalShippingMethod, OriginCountryCode } from "@/types/market";

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
  /** Real DB UUID (STEP 10) — undefined for static mock products, since reviews/inquiries need Supabase. */
  dbId?: string;
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
  /** Per-market authoritative price in that market's own currency. Falls back to a dev exchange-rate conversion of salePrice/originalPrice when absent for the current market. */
  marketPrices?: Partial<Record<CountryCode, { salePrice: number; originalPrice: number }>>;
  /** Countries this product can be shipped to. Omitted/empty means it ships everywhere — avoids a magic "ALL" string. */
  availableCountries?: CountryCode[];
  /** Country the product physically ships from (distinct from shippingType). */
  originCountry?: OriginCountryCode;
  /** Per-destination-market shipping fee override, in KRW. Falls back to a shippingType default when absent. */
  shippingFees?: Partial<Record<CountryCode, number>>;
  /** Default international transport mode for overseas items; sea is the business default. */
  internationalShippingMethod?: InternationalShippingMethod;
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
  | "reviews"
  | "latest";

export type PriceRangeId = "under10k" | "10kTo30k" | "30kTo50k" | "over50k";

export type HeroSlide = {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel?: string;
  background: string;
  /**
   * Mock/icon-only slides (no real banner image) fall back to this. A name,
   * not a component reference — HeroSlide[] crosses a Server→Client
   * Component boundary (MainBanner → MainBannerSlider) once banners are
   * DB-backed, and React can't serialize a function/component value across
   * that boundary. MainBannerSlider resolves the name to a component itself.
   */
  iconName?: string;
  /** Real DB banners (STEP 10) render an image instead of the icon block. */
  imageUrl?: string;
  mobileImageUrl?: string;
  linkUrl?: string;
  /** null/undefined means "show in every market/locale" — matches the DB's nullable columns. */
  marketCode?: CountryCode | null;
  locale?: import("@/types/market").LocaleCode | null;
};

export type Promotion = {
  id: string;
  title: string;
  subtitle: string;
  background: string;
  icon: LucideIcon;
};
