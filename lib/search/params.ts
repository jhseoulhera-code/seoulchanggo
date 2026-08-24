import type { ShippingType, SortOption } from "@/types";

/**
 * The full URL-reflected search state (STEP 12 spec section 2) — reload,
 * back/forward, and copy-pasting the URL all reproduce the same result set.
 * minPrice/maxPrice/discount and priceLow/priceHigh sort are applied
 * client-side (see components/product/SearchResultsClient.tsx) since price
 * is Market-dependent and Market itself has no server-side representation
 * anywhere in this app (contexts/MarketContext.tsx) — everything else here
 * is resolved server-side in lib/repositories/products.ts.
 */
export type SearchQueryState = {
  q: string;
  sort: SortOption;
  shipping: ShippingType[];
  minPrice: number | null;
  maxPrice: number | null;
  discount: boolean;
  category: string | null;
  page: number;
};

const VALID_SORTS: SortOption[] = ["recommended", "popular", "priceLow", "priceHigh", "reviews", "latest"];
const VALID_SHIPPING: ShippingType[] = ["domestic", "overseas_direct", "overseas_agent", "direct_pickup"];

export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function numberOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseSearchParams(params: RawSearchParams): SearchQueryState {
  const sortRaw = first(params.sort);
  const shippingRaw = first(params.shipping);

  return {
    q: first(params.q) ?? "",
    sort: VALID_SORTS.includes(sortRaw as SortOption) ? (sortRaw as SortOption) : "recommended",
    shipping: shippingRaw
      ? shippingRaw.split(",").filter((value): value is ShippingType => VALID_SHIPPING.includes(value as ShippingType))
      : [],
    minPrice: numberOrNull(first(params.minPrice)),
    maxPrice: numberOrNull(first(params.maxPrice)),
    discount: first(params.discount) === "1",
    category: first(params.category) || null,
    page: Math.max(1, Number(first(params.page)) || 1),
  };
}

/** Inverse of parseSearchParams — omits defaults so the URL stays short (no ?sort=recommended&page=1 noise). */
export function buildSearchQueryString(state: Partial<SearchQueryState> & { q: string }): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.sort && state.sort !== "recommended") params.set("sort", state.sort);
  if (state.shipping && state.shipping.length > 0) params.set("shipping", state.shipping.join(","));
  if (state.minPrice != null) params.set("minPrice", String(state.minPrice));
  if (state.maxPrice != null) params.set("maxPrice", String(state.maxPrice));
  if (state.discount) params.set("discount", "1");
  if (state.category) params.set("category", state.category);
  if (state.page && state.page > 1) params.set("page", String(state.page));
  return params.toString();
}
