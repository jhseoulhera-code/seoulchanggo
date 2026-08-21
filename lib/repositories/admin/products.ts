import "server-only";

import { escapeIlikePattern, sanitizeForOrFilter } from "@/lib/search/normalize";
import { createClient } from "@/lib/supabase/server";
import type {
  ProductImageRow,
  ProductPriceRow,
  ProductRow,
  ProductShippingMarketRow,
  ProductVariantRow,
} from "@/types/database";
import type { AdminProductDetail, AdminProductListItem } from "@/types/admin";

function fail(context: string, error: { message: string }): never {
  console.error(`[admin/products] ${context} failed:`, error.message);
  throw new Error("상품 데이터를 처리하지 못했습니다.");
}

export type AdminProductFilters = {
  q?: string;
  categoryId?: string;
  supplyType?: string;
  shippingType?: string;
  status?: "active" | "inactive";
  stockStatus?: "low" | "out";
};

const LOW_STOCK_THRESHOLD = 5;

type ProductListRow = ProductRow & {
  categories: { name_ko: string } | null;
  product_prices: Pick<ProductPriceRow, "market_code" | "currency_code" | "sale_price">[];
  product_images: Pick<ProductImageRow, "image_url" | "is_primary" | "sort_order">[];
};

export async function listAdminProducts(filters: AdminProductFilters = {}): Promise<AdminProductListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select(
      "*, categories(name_ko), product_prices(market_code, currency_code, sale_price), product_images(image_url, is_primary, sort_order)"
    )
    .order("created_at", { ascending: false });

  if (filters.q) {
    const pattern = `%${escapeIlikePattern(sanitizeForOrFilter(filters.q))}%`;
    query = query.or(`name_ko.ilike.${pattern},sku.ilike.${pattern},brand.ilike.${pattern}`);
  }
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.supplyType) query = query.eq("supply_type", filters.supplyType);
  if (filters.shippingType) query = query.eq("shipping_type", filters.shippingType);
  if (filters.status) query = query.eq("is_active", filters.status === "active");

  const { data, error } = await query.limit(200);
  if (error) fail("listAdminProducts", error);

  let rows = (data ?? []) as unknown as ProductListRow[];

  if (filters.stockStatus === "out") {
    rows = rows.filter((row) => row.stock_type === "TRACKED" && row.stock_quantity === 0);
  } else if (filters.stockStatus === "low") {
    rows = rows.filter(
      (row) => row.stock_type === "TRACKED" && row.stock_quantity > 0 && row.stock_quantity <= LOW_STOCK_THRESHOLD
    );
  }

  return rows.map((row) => {
    const krPrice = row.product_prices.find((p) => p.market_code === "KR");
    const inPrice = row.product_prices.find((p) => p.market_code === "IN");
    const usdPrice = row.product_prices.find((p) => p.market_code === null && p.currency_code === "USD");
    const sortedImages = [...row.product_images].sort((a, b) => a.sort_order - b.sort_order);
    const primary = sortedImages.find((image) => image.is_primary) ?? sortedImages[0];
    return {
      id: row.id,
      sku: row.sku,
      slug: row.slug,
      nameKo: row.name_ko,
      hasEnglishName: Boolean(row.name_en?.trim()),
      hasUsdPrice: Boolean(usdPrice && usdPrice.sale_price > 0),
      brand: row.brand,
      categoryId: row.category_id,
      categoryName: row.categories?.name_ko ?? "-",
      supplyType: row.supply_type,
      shippingType: row.shipping_type,
      krPrice: krPrice?.sale_price ?? null,
      inPrice: inPrice?.sale_price ?? null,
      stockQuantity: row.stock_quantity,
      stockType: row.stock_type,
      isActive: row.is_active,
      primaryImageUrl: primary?.image_url ?? null,
    };
  });
}

export type AdminProductPickerItem = { id: string; nameKo: string; sku: string };

export async function searchAdminProductsForPicker(query: string): Promise<AdminProductPickerItem[]> {
  if (!query.trim()) return [];
  const supabase = await createClient();
  const pattern = `%${escapeIlikePattern(sanitizeForOrFilter(query))}%`;
  const { data, error } = await supabase
    .from("products")
    .select("id, name_ko, sku")
    .or(`name_ko.ilike.${pattern},sku.ilike.${pattern}`)
    .limit(10);
  if (error) fail("searchAdminProductsForPicker", error);
  return ((data ?? []) as unknown as { id: string; name_ko: string; sku: string }[]).map((row) => ({
    id: row.id,
    nameKo: row.name_ko,
    sku: row.sku,
  }));
}

export async function getAdminProductNamesByIds(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("id, name_ko").in("id", ids);
  if (error) fail("getAdminProductNamesByIds", error);
  return Object.fromEntries(((data ?? []) as unknown as { id: string; name_ko: string }[]).map((row) => [row.id, row.name_ko]));
}

export function emptyAdminProductDraft(): AdminProductDetail {
  return {
    id: null,
    sku: "",
    categoryId: "",
    slug: "",
    brand: "",
    nameKo: "",
    nameEn: "",
    descriptionKo: "",
    descriptionEn: "",
    originCountry: "",
    supplyType: "DOMESTIC_STOCK",
    shippingType: "DOMESTIC",
    defaultShippingMethod: null,
    stockType: "TRACKED",
    stockQuantity: 0,
    optionGroups: [],
    isActive: true,
    freeShipping: false,
    discountRate: null,
    prices: [
      { marketCode: "KR", currencyCode: "KRW", originalPrice: 0, salePrice: 0 },
      { marketCode: "IN", currencyCode: "INR", originalPrice: 0, salePrice: 0 },
      { marketCode: null, currencyCode: "USD", originalPrice: 0, salePrice: 0 },
    ],
    shippingMarkets: [
      { countryCode: "KR", isAvailable: true, shippingFee: 3000, estimatedMinDays: 1, estimatedMaxDays: 3, shippingMethod: null },
      { countryCode: "IN", isAvailable: true, shippingFee: 5000, estimatedMinDays: 10, estimatedMaxDays: 25, shippingMethod: "SEA" },
    ],
    variants: [],
    images: [],
  };
}

type ProductDetailRow = ProductRow & {
  product_prices: ProductPriceRow[];
  product_shipping_markets: ProductShippingMarketRow[];
  product_variants: ProductVariantRow[];
  product_images: ProductImageRow[];
};

export async function getAdminProductDetail(id: string): Promise<AdminProductDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, product_prices(*), product_shipping_markets(*), product_variants(*), product_images(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) fail("getAdminProductDetail", error);
  if (!data) return null;

  const row = data as unknown as ProductDetailRow;
  return {
    id: row.id,
    sku: row.sku,
    categoryId: row.category_id,
    slug: row.slug,
    brand: row.brand ?? "",
    nameKo: row.name_ko,
    nameEn: row.name_en ?? "",
    descriptionKo: row.description_ko ?? "",
    descriptionEn: row.description_en ?? "",
    originCountry: row.origin_country ?? "",
    supplyType: row.supply_type,
    shippingType: row.shipping_type,
    defaultShippingMethod: row.default_shipping_method,
    stockType: row.stock_type,
    stockQuantity: row.stock_quantity,
    optionGroups: Array.isArray(row.option_groups) ? (row.option_groups as unknown as AdminProductDetail["optionGroups"]) : [],
    isActive: row.is_active,
    freeShipping: row.free_shipping,
    discountRate: row.discount_rate,
    prices: row.product_prices.map((p) => ({
      marketCode: p.market_code,
      currencyCode: p.currency_code,
      originalPrice: p.original_price,
      salePrice: p.sale_price,
    })),
    shippingMarkets: row.product_shipping_markets.map((m) => ({
      countryCode: m.country_code,
      isAvailable: m.is_available,
      shippingFee: m.shipping_fee,
      estimatedMinDays: m.estimated_min_days,
      estimatedMaxDays: m.estimated_max_days,
      shippingMethod: m.shipping_method,
    })),
    variants: row.product_variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      optionValues: (v.option_values as unknown as Record<string, string>) ?? {},
      additionalPrice: v.additional_price,
      stockQuantity: v.stock_quantity,
      isActive: v.is_active,
    })),
    images: [...row.product_images]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((image) => ({
        id: image.id,
        imageUrl: image.image_url,
        altKo: image.alt_ko,
        sortOrder: image.sort_order,
        isPrimary: image.is_primary,
      })),
  };
}

export type UpsertProductResult = { ok: true; id: string } | { ok: false; error: string };

export async function upsertAdminProduct(detail: AdminProductDetail): Promise<UpsertProductResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_upsert_product", {
    p_id: detail.id,
    p_sku: detail.sku,
    p_category_id: detail.categoryId,
    p_slug: detail.slug,
    p_brand: detail.brand || null,
    p_name_ko: detail.nameKo,
    p_name_en: detail.nameEn || null,
    p_description_ko: detail.descriptionKo || null,
    p_description_en: detail.descriptionEn || null,
    p_origin_country: detail.originCountry || null,
    p_supply_type: detail.supplyType,
    p_shipping_type: detail.shippingType,
    p_default_shipping_method: detail.defaultShippingMethod,
    p_stock_type: detail.stockType,
    p_stock_quantity: detail.stockQuantity,
    p_option_groups: detail.optionGroups,
    p_is_active: detail.isActive,
    p_free_shipping: detail.freeShipping,
    p_discount_rate: detail.discountRate,
    p_prices: detail.prices.map((p) => ({
      market_code: p.marketCode,
      currency_code: p.currencyCode,
      original_price: p.originalPrice,
      sale_price: p.salePrice,
    })),
    p_shipping_markets: detail.shippingMarkets.map((m) => ({
      country_code: m.countryCode,
      is_available: m.isAvailable,
      shipping_fee: m.shippingFee,
      estimated_min_days: m.estimatedMinDays,
      estimated_max_days: m.estimatedMaxDays,
      shipping_method: m.shippingMethod,
    })),
  } as never);

  if (error) {
    console.error("[admin/products] upsertAdminProduct failed:", error.message);
    return { ok: false, error: "상품을 저장하지 못했습니다." };
  }
  return { ok: true, id: data as unknown as string };
}

export async function addAdminProductVariant(
  productId: string,
  input: { sku: string; optionValues: Record<string, string>; additionalPrice: number; stockQuantity: number }
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("product_variants").insert({
    product_id: productId,
    sku: input.sku,
    option_values: input.optionValues,
    additional_price: input.additionalPrice,
    stock_quantity: input.stockQuantity,
  } as never);
  if (error) fail("addAdminProductVariant", error);
}

export async function updateAdminProductVariant(
  variantId: string,
  patch: Partial<{ stockQuantity: number; additionalPrice: number; isActive: boolean }>
): Promise<void> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.stockQuantity !== undefined) update.stock_quantity = patch.stockQuantity;
  if (patch.additionalPrice !== undefined) update.additional_price = patch.additionalPrice;
  if (patch.isActive !== undefined) update.is_active = patch.isActive;

  const { error } = await supabase.from("product_variants").update(update as never).eq("id", variantId);
  if (error) fail("updateAdminProductVariant", error);
}

export async function deleteAdminProductVariant(variantId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("product_variants").delete().eq("id", variantId);
  if (error) fail("deleteAdminProductVariant", error);
}

export async function addAdminProductImage(
  productId: string,
  input: { imageUrl: string; altKo: string; sortOrder: number; isPrimary: boolean }
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("product_images").insert({
    product_id: productId,
    image_url: input.imageUrl,
    alt_ko: input.altKo || null,
    sort_order: input.sortOrder,
    is_primary: input.isPrimary,
  } as never);
  if (error) fail("addAdminProductImage", error);
}

export async function deleteAdminProductImage(imageId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (error) fail("deleteAdminProductImage", error);
}

export async function setAdminProductPrimaryImage(productId: string, imageId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_primary_image", {
    p_product_id: productId,
    p_image_id: imageId,
  } as never);
  if (error) fail("setAdminProductPrimaryImage", error);
}
