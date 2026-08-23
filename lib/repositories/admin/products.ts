import "server-only";

import { computeSafeDiscountRate } from "@/lib/admin/productPricing";
import { PRODUCT_IMAGE_MAX_COUNT } from "@/lib/admin/productImages";
import { escapeIlikePattern, sanitizeForOrFilter } from "@/lib/search/normalize";
import { createClient } from "@/lib/supabase/server";
import type {
  ProductImageRow,
  ProductPriceRow,
  ProductRow,
  ProductShippingMarketRow,
  ProductVariantRow,
} from "@/types/database";
import type { AdminProductDetail, AdminProductListItem, AdminProductVariant } from "@/types/admin";

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
  /** Independent of `status` above (which is_active-based) — filters on the newer workflow `status` column (STEP 16). */
  productStatus?: "DRAFT" | "ACTIVE" | "INACTIVE";
  /** true = missing a usable (>0) sale price for at least one of KRW/INR/USD. */
  priceMissing?: boolean;
  /** true = no product_images row at all. */
  imageMissing?: boolean;
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
  if (filters.productStatus) query = query.eq("status", filters.productStatus);

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
  if (filters.imageMissing) {
    rows = rows.filter((row) => row.product_images.length === 0);
  }
  if (filters.priceMissing) {
    rows = rows.filter((row) => {
      const hasKrw = row.product_prices.some((p) => p.currency_code === "KRW" && p.sale_price > 0);
      const hasInr = row.product_prices.some((p) => p.currency_code === "INR" && p.sale_price > 0);
      const hasUsd = row.product_prices.some((p) => p.currency_code === "USD" && p.sale_price > 0);
      return !hasKrw || !hasInr || !hasUsd;
    });
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
      status: row.status,
      primaryImageUrl: primary?.image_url ?? null,
      imageCount: row.product_images.length,
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
    // New products created through the Wizard start as DRAFT until the
    // admin explicitly registers them (Step 5) — see the migration comment
    // for why this is independent of isActive above, which the older
    // single-page ProductForm still drives directly and unchanged.
    status: "DRAFT",
    freeShipping: false,
    discountRate: null,
    shortDescriptionKo: "",
    shortDescriptionEn: "",
    seoTitle: "",
    seoDescription: "",
    searchTags: [],
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
    status: row.status,
    freeShipping: row.free_shipping,
    discountRate: row.discount_rate,
    shortDescriptionKo: row.short_description_ko ?? "",
    shortDescriptionEn: row.short_description_en ?? "",
    seoTitle: row.seo_title ?? "",
    seoDescription: row.seo_description ?? "",
    searchTags: row.search_tags ?? [],
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
    // Never trust detail.discountRate directly — see computeSafeDiscountRate's
    // own comment for the real check-constraint violation this replaced.
    p_discount_rate: computeSafeDiscountRate(detail.prices),
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
    p_status: detail.status,
    p_short_description_ko: detail.shortDescriptionKo || null,
    p_seo_title: detail.seoTitle || null,
    p_seo_description: detail.seoDescription || null,
    p_search_tags: detail.searchTags,
    p_short_description_en: detail.shortDescriptionEn || null,
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
): Promise<{ id: string; sku: string; optionValues: Record<string, string>; additionalPrice: number; stockQuantity: number; isActive: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .insert({
      product_id: productId,
      sku: input.sku,
      option_values: input.optionValues,
      additional_price: input.additionalPrice,
      stock_quantity: input.stockQuantity,
    } as never)
    .select()
    .single();
  if (error) fail("addAdminProductVariant", error);
  const row = data as unknown as ProductVariantRow;
  return {
    id: row.id,
    sku: row.sku,
    optionValues: (row.option_values as unknown as Record<string, string>) ?? {},
    additionalPrice: row.additional_price,
    stockQuantity: row.stock_quantity,
    isActive: row.is_active,
  };
}

export async function updateAdminProductVariant(
  variantId: string,
  patch: Partial<{ sku: string; stockQuantity: number; additionalPrice: number; isActive: boolean }>
): Promise<void> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.sku !== undefined) {
    const sku = patch.sku.trim();
    if (!sku) throw new Error("SKU를 입력해주세요.");
    const { data: conflict } = await supabase.from("product_variants").select("id").eq("sku", sku).neq("id", variantId).maybeSingle();
    if (conflict) throw new Error("이미 사용 중인 SKU입니다.");
    update.sku = sku;
  }
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

/**
 * STEP 18 spec section 16 — the option-group -> Cartesian-product editor can
 * regenerate many rows at once; saving that as N sequential
 * addAdminProductVariant/updateAdminProductVariant/deleteAdminProductVariant
 * calls risks a half-saved option set if one of them fails partway through.
 * admin_replace_product_variants (STEP 18 migration) does the whole
 * replace-by-sku in one transaction instead. The single-row helpers above
 * are untouched and still used for one-off edits from the variant table.
 */
export async function replaceAdminProductVariants(
  productId: string,
  variants: Pick<AdminProductVariant, "sku" | "optionValues" | "additionalPrice" | "stockQuantity" | "isActive">[]
): Promise<AdminProductVariant[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_replace_product_variants", {
    p_product_id: productId,
    p_variants: variants.map((v) => ({
      sku: v.sku,
      option_values: v.optionValues,
      additional_price: v.additionalPrice,
      stock_quantity: v.stockQuantity,
      is_active: v.isActive,
    })),
  } as never);
  if (error) {
    console.error("[admin/products] replaceAdminProductVariants failed:", error.message);
    // Unlike fail()'s generic message, this surfaces the RPC's own reason
    // (duplicate sku, sku owned by another product, negative stock, ...) —
    // all raised as plain, non-sensitive validation text the admin needs to
    // act on, never a raw DB/internal error.
    if (error.message.includes("duplicate sku")) throw new Error("옵션 조합 SKU가 중복되었습니다.");
    if (error.message.includes("already used by another product")) throw new Error("이미 다른 상품에서 사용 중인 SKU가 있습니다.");
    if (error.message.includes("sku is required")) throw new Error("모든 옵션 조합에 SKU를 입력해주세요.");
    if (error.message.includes("stock_quantity must be")) throw new Error("재고는 0 이상이어야 합니다.");
    throw new Error("옵션 조합을 저장하지 못했습니다.");
  }
  return ((data ?? []) as unknown as ProductVariantRow[]).map((row) => ({
    id: row.id,
    sku: row.sku,
    optionValues: (row.option_values as unknown as Record<string, string>) ?? {},
    additionalPrice: row.additional_price,
    stockQuantity: row.stock_quantity,
    isActive: row.is_active,
  }));
}

export async function addAdminProductImage(
  productId: string,
  input: { imageUrl: string; altKo: string; sortOrder: number; isPrimary: boolean }
): Promise<{ id: string; imageUrl: string; altKo: string | null; sortOrder: number; isPrimary: boolean }> {
  const supabase = await createClient();

  // STEP 18 spec section 6 — server-side enforcement of the image count
  // limit, since the client-side check in ImageUploadManager.tsx can't stop
  // a direct call to this action.
  const { count } = await supabase
    .from("product_images")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId);
  if ((count ?? 0) >= PRODUCT_IMAGE_MAX_COUNT) {
    throw new Error(`이미지는 상품당 최대 ${PRODUCT_IMAGE_MAX_COUNT}개까지 등록할 수 있습니다.`);
  }

  const { data, error } = await supabase
    .from("product_images")
    .insert({
      product_id: productId,
      image_url: input.imageUrl,
      alt_ko: input.altKo || null,
      sort_order: input.sortOrder,
      is_primary: input.isPrimary,
    } as never)
    .select()
    .single();
  if (error) fail("addAdminProductImage", error);
  const row = data as unknown as ProductImageRow;
  return { id: row.id, imageUrl: row.image_url, altKo: row.alt_ko, sortOrder: row.sort_order, isPrimary: row.is_primary };
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

/** Wizard Step 4's reorder control — one round trip via admin_reorder_product_images (STEP 16). */
export async function reorderAdminProductImages(productId: string, orderedImageIds: string[]): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_reorder_product_images", {
    p_product_id: productId,
    p_image_ids: orderedImageIds,
  } as never);
  if (error) fail("reorderAdminProductImages", error);
}

/**
 * Admin product list "복제" (STEP 16 spec section 2) — copies core fields,
 * prices, shipping markets (via admin_upsert_product, id:null), then images
 * and variants (which admin_upsert_product deliberately doesn't touch — see
 * that RPC's own comment) via the same plain insert helpers the UI already
 * uses one row at a time. The new product always starts as DRAFT regardless
 * of the source product's status, and gets a fresh sku/slug so the unique
 * constraints on both never collide with the original.
 */
export async function duplicateAdminProduct(sourceId: string): Promise<UpsertProductResult> {
  const source = await getAdminProductDetail(sourceId);
  if (!source) return { ok: false, error: "복제할 상품을 찾을 수 없습니다." };

  const suffix = Date.now().toString(36).toUpperCase();
  const duplicate: AdminProductDetail = {
    ...source,
    id: null,
    sku: `${source.sku}-COPY-${suffix}`,
    slug: `${source.slug}-copy-${suffix.toLowerCase()}`,
    nameKo: `${source.nameKo} (복사본)`,
    status: "DRAFT",
    isActive: false,
    variants: [],
    images: [],
  };

  const result = await upsertAdminProduct(duplicate);
  if (!result.ok) return result;

  // STEP 18 note: addAdminProductImage now enforces PRODUCT_IMAGE_MAX_COUNT
  // (see its own comment) — a source product already at that limit must
  // still duplicate its core fields successfully rather than throwing
  // partway through this loop, so per-item failures here are logged and
  // skipped instead of aborting the whole duplication.
  for (const image of source.images) {
    try {
      await addAdminProductImage(result.id, {
        imageUrl: image.imageUrl,
        altKo: image.altKo ?? "",
        sortOrder: image.sortOrder,
        isPrimary: image.isPrimary,
      });
    } catch (error) {
      console.error("[admin/products] duplicateAdminProduct: skipped one image:", error instanceof Error ? error.message : error);
    }
  }
  for (const variant of source.variants) {
    try {
      await addAdminProductVariant(result.id, {
        sku: `${variant.sku}-COPY-${suffix}`,
        optionValues: variant.optionValues,
        additionalPrice: variant.additionalPrice,
        stockQuantity: variant.stockQuantity,
      });
    } catch (error) {
      console.error("[admin/products] duplicateAdminProduct: skipped one variant:", error instanceof Error ? error.message : error);
    }
  }

  return result;
}
