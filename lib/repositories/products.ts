import {
  allProducts as staticAllProducts,
  bestProducts as staticBestProducts,
  discountProducts as staticDiscountProducts,
  domesticProducts as staticDomesticProducts,
  getProductsByCategory as staticGetProductsByCategory,
  overseasProducts as staticOverseasProducts,
  searchProducts as staticSearchProducts,
} from "@/data/products";
import { escapeIlikePattern, normalizeSearchQuery, sanitizeForOrFilter } from "@/lib/search/normalize";
import { createStaticClient as createClient } from "@/lib/supabase/static";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  ProductImageRow,
  ProductPriceRow,
  ProductRow,
  ProductShippingMarketRow,
  ProductVariantRow,
  ShippingTypeEnum,
} from "@/types/database";
import type { Product, ProductOptionGroup, ShippingType, SortOption } from "@/types";
import type { CountryCode, OriginCountryCode } from "@/types/market";

const SHIPPING_LABEL: Record<ShippingType, string> = {
  domestic: "국내출고",
  overseas_direct: "직배송",
  overseas_agent: "구매대행",
  direct_pickup: "직접수령",
};

const SHIPPING_TYPE_FROM_DB: Record<ShippingTypeEnum, ShippingType> = {
  DOMESTIC: "domestic",
  OVERSEAS_DIRECT: "overseas_direct",
  OVERSEAS_AGENCY: "overseas_agent",
  DIRECT_PICKUP: "direct_pickup",
};

// STEP 19: product_variants(*) joined here (not a separate detail-only
// query) so every existing caller of getAllProducts/getProductBySlug/
// searchProducts/home-section fetches gets real variant data through the
// exact same mapProductRow mapping, rather than forking a parallel
// "customer detail" query architecture for one page. RLS
// (product_variants_public_read) already scopes this to active variants
// of active products — no admin-only column is added by this join.
export const PRODUCT_SELECT =
  "*, categories(slug), product_prices(*), product_shipping_markets(*), product_images(*), product_variants(*)";

export type ProductJoinRow = ProductRow & {
  categories: { slug: string } | null;
  product_prices: ProductPriceRow[];
  product_shipping_markets: ProductShippingMarketRow[];
  product_images: ProductImageRow[];
  product_variants?: ProductVariantRow[];
};

export function mapProductRow(row: ProductJoinRow): Product {
  const shippingType = SHIPPING_TYPE_FROM_DB[row.shipping_type];
  const krPrice = row.product_prices.find((price) => price.market_code === "KR");
  const usdPrice = row.product_prices.find((price) => price.market_code === null && price.currency_code === "USD");

  const marketPrices: NonNullable<Product["marketPrices"]> = {};
  row.product_prices.forEach((price) => {
    if (price.market_code === "KR" || price.market_code === null) return;
    marketPrices[price.market_code] = { salePrice: price.sale_price, originalPrice: price.original_price };
  });

  const availableCountries = row.product_shipping_markets
    .filter((market) => market.is_available)
    .map((market) => market.country_code) as CountryCode[];

  const shippingFees: NonNullable<Product["shippingFees"]> = {};
  row.product_shipping_markets.forEach((market) => {
    shippingFees[market.country_code] = market.shipping_fee;
  });

  const sortedImages = [...row.product_images].sort((a, b) => a.sort_order - b.sort_order);
  const primaryImage = sortedImages.find((image) => image.is_primary) ?? sortedImages[0];

  return {
    id: row.slug,
    dbId: row.id,
    sku: row.sku,
    name: row.name_ko,
    nameEn: row.name_en ?? undefined,
    image: primaryImage?.image_url ?? "",
    images: sortedImages.length > 0 ? sortedImages.map((image) => image.image_url) : undefined,
    brand: row.brand ?? undefined,
    originalPrice: krPrice?.original_price ?? 0,
    salePrice: krPrice?.sale_price ?? 0,
    discountRate: row.discount_rate ?? undefined,
    rating: row.rating,
    reviewCount: row.review_count,
    shippingType,
    shippingLabel: SHIPPING_LABEL[shippingType],
    freeShipping: row.free_shipping,
    category: row.categories?.slug ?? "",
    description: row.description_ko ?? undefined,
    descriptionEn: row.description_en ?? undefined,
    shortDescription: row.short_description_ko ?? undefined,
    shortDescriptionEn: row.short_description_en ?? undefined,
    seoTitle: row.seo_title ?? undefined,
    seoDescription: row.seo_description ?? undefined,
    options: Array.isArray(row.option_groups) ? (row.option_groups as unknown as ProductOptionGroup[]) : undefined,
    variants:
      row.product_variants && row.product_variants.length > 0
        ? row.product_variants.map((v) => ({
            id: v.id,
            sku: v.sku,
            optionValues: (v.option_values as unknown as Record<string, string>) ?? {},
            additionalPrice: v.additional_price,
            stockQuantity: v.stock_quantity,
            isActive: v.is_active,
          }))
        : undefined,
    stock: row.stock_type === "TRACKED" ? row.stock_quantity : undefined,
    marketPrices: Object.keys(marketPrices).length > 0 ? marketPrices : undefined,
    globalPrice: usdPrice ? { salePrice: usdPrice.sale_price, originalPrice: usdPrice.original_price } : undefined,
    availableCountries: availableCountries.length > 0 ? availableCountries : undefined,
    originCountry: (row.origin_country as OriginCountryCode | null) ?? undefined,
    shippingFees: Object.keys(shippingFees).length > 0 ? shippingFees : undefined,
    internationalShippingMethod: row.default_shipping_method ?? undefined,
  };
}

function fail(context: string, error: { message: string }): never {
  console.error(`[products] ${context} failed:`, error.message);
  throw new Error("상품 정보를 불러오지 못했습니다.");
}

export async function getAllProducts(): Promise<Product[]> {
  if (!isSupabaseConfigured()) return staticAllProducts;

  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).eq("is_active", true);
  if (error) fail("getAllProducts", error);
  return ((data ?? []) as unknown as ProductJoinRow[]).map(mapProductRow);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (!isSupabaseConfigured()) return staticAllProducts.find((product) => product.id === slug) ?? null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) fail("getProductBySlug", error);
  return data ? mapProductRow(data as unknown as ProductJoinRow) : null;
}

export async function getProductsByCategory(categoryId: string): Promise<Product[]> {
  if (!isSupabaseConfigured()) return staticGetProductsByCategory(categoryId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .eq("categories.slug", categoryId);
  if (error) fail("getProductsByCategory", error);
  // The nested filter above still returns products whose category doesn't match with a null
  // `categories` relation in some PostgREST versions, so filter defensively client-side too.
  return (data ?? [])
    .map((row) => mapProductRow(row as unknown as ProductJoinRow))
    .filter((product) => product.category === categoryId);
}

const SHIPPING_TYPE_TO_DB: Record<ShippingType, ShippingTypeEnum> = {
  domestic: "DOMESTIC",
  overseas_direct: "OVERSEAS_DIRECT",
  overseas_agent: "OVERSEAS_AGENCY",
  direct_pickup: "DIRECT_PICKUP",
};

const DEFAULT_SEARCH_PAGE_SIZE = 24;

export type SearchFilters = {
  q?: string;
  category?: string;
  shipping?: ShippingType[];
  sort?: SortOption;
  page?: number;
  pageSize?: number;
};

export type SearchResult = {
  products: Product[];
  totalCount: number;
  hasMore: boolean;
};

/**
 * STEP 12: real DB text search + server-side filters/sort/pagination.
 * Deliberately never falls back to showing unrelated products when nothing
 * matches (the STEP 03 dummy fallback this replaced did exactly that) —
 * an empty match is reported as zero results; app/search/page.tsx shows a
 * clearly-separate "이런 상품은 어떠세요?" recommendation section instead
 * (reusing getBestProducts(), not a second search implementation).
 *
 * minPrice/maxPrice/discount-only filtering and priceLow/priceHigh sorting
 * are NOT done here — price is Market-dependent and Market has no
 * server-side representation anywhere in this app (see
 * contexts/MarketContext.tsx). Those are applied client-side in
 * components/product/SearchResultsClient.tsx, same as every other listing
 * page in this app already resolves market pricing client-side.
 */
export async function searchProducts(filters: SearchFilters = {}): Promise<SearchResult> {
  const normalized = normalizeSearchQuery(filters.q ?? "");
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? DEFAULT_SEARCH_PAGE_SIZE;

  if (!normalized) {
    return { products: [], totalCount: 0, hasMore: false };
  }

  if (!isSupabaseConfigured()) {
    return staticSearchProducts({ ...filters, q: normalized, page, pageSize });
  }

  const supabase = await createClient();
  let query = supabase.from("products").select(PRODUCT_SELECT, { count: "exact" }).eq("is_active", true);

  const pattern = `%${escapeIlikePattern(sanitizeForOrFilter(normalized))}%`;
  query = query.or(`name_ko.ilike.${pattern},name_en.ilike.${pattern},brand.ilike.${pattern},sku.ilike.${pattern}`);

  if (filters.category) {
    query = query.eq("categories.slug", filters.category);
  }
  if (filters.shipping && filters.shipping.length > 0) {
    query = query.in(
      "shipping_type",
      filters.shipping.map((type) => SHIPPING_TYPE_TO_DB[type])
    );
  }

  switch (filters.sort) {
    case "popular":
    case "reviews":
      query = query.order("review_count", { ascending: false }).order("rating", { ascending: false });
      break;
    case "latest":
      query = query.order("created_at", { ascending: false });
      break;
    case "priceLow":
    case "priceHigh":
      // Market-dependent — SearchResultsClient re-sorts by resolved price client-side;
      // this keeps a stable, deterministic server order in the meantime.
      query = query.order("created_at", { ascending: false });
      break;
    case "recommended":
    default:
      query = query
        .order("discount_rate", { ascending: false, nullsFirst: false })
        .order("review_count", { ascending: false });
      break;
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) fail("searchProducts", error);

  // The nested categories.slug filter can still return a null-relation row on some
  // PostgREST versions, so filter defensively client-side too (matches getProductsByCategory).
  const rows = ((data ?? []) as unknown as ProductJoinRow[]).map(mapProductRow);
  const products = filters.category ? rows.filter((product) => product.category === filters.category) : rows;
  const totalCount = count ?? products.length;

  return { products, totalCount, hasMore: from + products.length < totalCount };
}

/**
 * HOME sections — backed by home_sections/home_section_items (STEP 08.5), a
 * genuine merchandising relation rather than a fixed rule, so HOME shows the
 * same hand-picked products data/products.ts always curated once seeded.
 */
async function getHomeSectionProducts(sectionKey: string, limit: number): Promise<Product[]> {
  const supabase = await createClient();
  const { data: section, error: sectionError } = await supabase
    .from("home_sections")
    .select("id")
    .eq("section_key", sectionKey)
    .eq("is_active", true)
    .maybeSingle();
  if (sectionError) fail(`getHomeSectionProducts(${sectionKey})`, sectionError);
  if (!section) return [];

  const { data, error } = await supabase
    .from("home_section_items")
    .select(`sort_order, products(${PRODUCT_SELECT})`)
    .eq("section_id", (section as unknown as { id: string }).id)
    .order("sort_order", { ascending: true })
    .limit(limit);
  if (error) fail(`getHomeSectionProducts(${sectionKey})`, error);

  type SectionItemRow = { sort_order: number; products: ProductJoinRow | null };
  return ((data ?? []) as unknown as SectionItemRow[])
    .map((row) => row.products)
    .filter((product): product is ProductJoinRow => product !== null)
    .map(mapProductRow);
}

export async function getBestProducts(limit = 8): Promise<Product[]> {
  if (!isSupabaseConfigured()) return staticBestProducts;
  return getHomeSectionProducts("BEST", limit);
}

export async function getDomesticProducts(limit = 6): Promise<Product[]> {
  if (!isSupabaseConfigured()) return staticDomesticProducts;
  return getHomeSectionProducts("DOMESTIC_FEATURED", limit);
}

export async function getOverseasProducts(limit = 6): Promise<Product[]> {
  if (!isSupabaseConfigured()) return staticOverseasProducts;
  return getHomeSectionProducts("OVERSEAS_FEATURED", limit);
}

export async function getDiscountProducts(limit = 6): Promise<Product[]> {
  if (!isSupabaseConfigured()) return staticDiscountProducts;
  return getHomeSectionProducts("DISCOUNT_FEATURED", limit);
}
