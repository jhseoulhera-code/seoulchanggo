import {
  allProducts as staticAllProducts,
  bestProducts as staticBestProducts,
  discountProducts as staticDiscountProducts,
  domesticProducts as staticDomesticProducts,
  getProductsByCategory as staticGetProductsByCategory,
  overseasProducts as staticOverseasProducts,
  searchProducts as staticSearchProducts,
} from "@/data/products";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  ProductImageRow,
  ProductPriceRow,
  ProductRow,
  ProductShippingMarketRow,
  ShippingTypeEnum,
} from "@/types/database";
import type { Product, ProductOptionGroup, ShippingType } from "@/types";
import type { CountryCode, OriginCountryCode } from "@/types/market";

const SHIPPING_LABEL: Record<ShippingType, string> = {
  domestic: "국내출고",
  overseas_direct: "직배송",
  overseas_agent: "구매대행",
};

const SHIPPING_TYPE_FROM_DB: Record<ShippingTypeEnum, ShippingType> = {
  DOMESTIC: "domestic",
  OVERSEAS_DIRECT: "overseas_direct",
  OVERSEAS_AGENCY: "overseas_agent",
};

const PRODUCT_SELECT =
  "*, categories(slug), product_prices(*), product_shipping_markets(*), product_images(*)";

type ProductJoinRow = ProductRow & {
  categories: { slug: string } | null;
  product_prices: ProductPriceRow[];
  product_shipping_markets: ProductShippingMarketRow[];
  product_images: ProductImageRow[];
};

function mapProductRow(row: ProductJoinRow): Product {
  const shippingType = SHIPPING_TYPE_FROM_DB[row.shipping_type];
  const krPrice = row.product_prices.find((price) => price.market_code === "KR");

  const marketPrices: NonNullable<Product["marketPrices"]> = {};
  row.product_prices.forEach((price) => {
    if (price.market_code === "KR") return;
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
    name: row.name_ko,
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
    options: Array.isArray(row.option_groups) ? (row.option_groups as unknown as ProductOptionGroup[]) : undefined,
    stock: row.stock_type === "TRACKED" ? row.stock_quantity : undefined,
    marketPrices: Object.keys(marketPrices).length > 0 ? marketPrices : undefined,
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

export async function searchProducts(query: string): Promise<Product[]> {
  if (!isSupabaseConfigured()) return staticSearchProducts(query);

  const normalized = query.trim();
  const supabase = await createClient();

  if (!normalized) {
    const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).eq("is_active", true).limit(12);
    if (error) fail("searchProducts", error);
    return ((data ?? []) as unknown as ProductJoinRow[]).map(mapProductRow);
  }

  // Basic name/brand search per STEP 08 scope — no search engine, no image search.
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .or(`name_ko.ilike.%${normalized}%,brand.ilike.%${normalized}%`);
  if (error) fail("searchProducts", error);

  const matched = ((data ?? []) as unknown as ProductJoinRow[]).map(mapProductRow);
  if (matched.length > 0) return matched;

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .limit(12);
  if (fallbackError) fail("searchProducts fallback", fallbackError);
  return ((fallbackData ?? []) as unknown as ProductJoinRow[]).map(mapProductRow);
}

/**
 * HOME sections. The dummy catalog hand-curates a distinct product set per
 * section; the DB has no such "featured" concept yet (not in the STEP 08
 * spec's table list), so these are the closest rule-derived equivalent —
 * see the STEP 08 report for the exact rule per section and why the specific
 * items shown may differ once this is actually wired to a live project.
 */
export async function getBestProducts(limit = 8): Promise<Product[]> {
  if (!isSupabaseConfigured()) return staticBestProducts;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .order("review_count", { ascending: false })
    .limit(limit);
  if (error) fail("getBestProducts", error);
  return ((data ?? []) as unknown as ProductJoinRow[]).map(mapProductRow);
}

export async function getDomesticProducts(limit = 6): Promise<Product[]> {
  if (!isSupabaseConfigured()) return staticDomesticProducts;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .eq("shipping_type", "DOMESTIC")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("getDomesticProducts", error);
  return ((data ?? []) as unknown as ProductJoinRow[]).map(mapProductRow);
}

export async function getOverseasProducts(limit = 6): Promise<Product[]> {
  if (!isSupabaseConfigured()) return staticOverseasProducts;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .in("shipping_type", ["OVERSEAS_DIRECT", "OVERSEAS_AGENCY"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("getOverseasProducts", error);
  return ((data ?? []) as unknown as ProductJoinRow[]).map(mapProductRow);
}

export async function getDiscountProducts(limit = 6): Promise<Product[]> {
  if (!isSupabaseConfigured()) return staticDiscountProducts;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .not("discount_rate", "is", null)
    .order("discount_rate", { ascending: false })
    .limit(limit);
  if (error) fail("getDiscountProducts", error);
  return ((data ?? []) as unknown as ProductJoinRow[]).map(mapProductRow);
}
