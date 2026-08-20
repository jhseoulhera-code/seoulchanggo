import { mapProductRow, PRODUCT_SELECT, type ProductJoinRow } from "@/lib/repositories/products";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { PromotionRow } from "@/types/database";
import type { Product } from "@/types";

export type PromotionDetail = {
  id: string;
  slug: string;
  titleKo: string;
  titleEn: string;
  descriptionKo: string | null;
  descriptionEn: string | null;
  imageUrl: string | null;
  products: Product[];
};

function isWithinWindow(row: PromotionRow): boolean {
  const now = Date.now();
  const startsOk = !row.starts_at || new Date(row.starts_at).getTime() <= now;
  const endsOk = !row.ends_at || new Date(row.ends_at).getTime() >= now;
  return startsOk && endsOk;
}

/** Returns null when Supabase isn't configured (STEP 04's dummy promotions have no slug-addressable detail page yet), not found, inactive, or outside its date window. */
export async function getPromotionBySlug(slug: string): Promise<PromotionDetail | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.from("promotions").select("*").eq("slug", slug).eq("is_active", true).maybeSingle();
  if (error) {
    console.error("[promotions] getPromotionBySlug failed:", error.message);
    return null;
  }
  if (!data) return null;

  const promotion = data as unknown as PromotionRow;
  if (!isWithinWindow(promotion)) return null;

  const { data: items, error: itemsError } = await supabase
    .from("promotion_products")
    .select(`sort_order, products(${PRODUCT_SELECT})`)
    .eq("promotion_id", promotion.id)
    .order("sort_order", { ascending: true });
  if (itemsError) {
    console.error("[promotions] getPromotionBySlug product lookup failed:", itemsError.message);
    return null;
  }

  type ItemRow = { sort_order: number; products: ProductJoinRow | null };
  const products = ((items ?? []) as unknown as ItemRow[])
    .map((row) => row.products)
    .filter((product): product is ProductJoinRow => product !== null)
    .map(mapProductRow);

  return {
    id: promotion.id,
    slug: promotion.slug,
    titleKo: promotion.title_ko,
    titleEn: promotion.title_en,
    descriptionKo: promotion.description_ko,
    descriptionEn: promotion.description_en,
    imageUrl: promotion.image_url,
    products,
  };
}
