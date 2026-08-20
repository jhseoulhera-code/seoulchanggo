import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { PromotionRow } from "@/types/database";
import type { AdminPromotion } from "@/types/admin";

function fail(context: string, error: { message: string }): never {
  console.error(`[admin/promotions] ${context} failed:`, error.message);
  throw new Error("기획전 데이터를 처리하지 못했습니다.");
}

type PromotionJoinRow = PromotionRow & {
  promotion_products: { product_id: string; sort_order: number; products: { name_ko: string } | null }[];
};

function mapPromotion(row: PromotionJoinRow): AdminPromotion {
  return {
    id: row.id,
    slug: row.slug,
    titleKo: row.title_ko,
    titleEn: row.title_en,
    descriptionKo: row.description_ko,
    descriptionEn: row.description_en,
    imageUrl: row.image_url,
    marketCode: row.market_code,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isActive: row.is_active,
    products: [...row.promotion_products]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({ productId: item.product_id, productNameKo: item.products?.name_ko ?? "-", sortOrder: item.sort_order })),
  };
}

const PROMOTION_SELECT = "*, promotion_products(product_id, sort_order, products(name_ko))";

export async function listAdminPromotions(): Promise<AdminPromotion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("promotions").select(PROMOTION_SELECT).order("created_at", { ascending: false });
  if (error) fail("listAdminPromotions", error);
  return ((data ?? []) as unknown as PromotionJoinRow[]).map(mapPromotion);
}

export async function getAdminPromotionDetail(id: string): Promise<AdminPromotion | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("promotions").select(PROMOTION_SELECT).eq("id", id).maybeSingle();
  if (error) fail("getAdminPromotionDetail", error);
  return data ? mapPromotion(data as unknown as PromotionJoinRow) : null;
}

export type AdminPromotionInput = {
  slug: string;
  titleKo: string;
  titleEn: string;
  descriptionKo: string;
  descriptionEn: string;
  imageUrl: string;
  marketCode: "KR" | "IN" | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
};

export type SavePromotionResult = { ok: true; id: string } | { ok: false; error: string };

export async function createAdminPromotion(input: AdminPromotionInput): Promise<SavePromotionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promotions")
    .insert({
      slug: input.slug,
      title_ko: input.titleKo,
      title_en: input.titleEn,
      description_ko: input.descriptionKo || null,
      description_en: input.descriptionEn || null,
      image_url: input.imageUrl || null,
      market_code: input.marketCode,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      is_active: input.isActive,
    } as never)
    .select("id")
    .single();

  if (error) {
    console.error("[admin/promotions] createAdminPromotion failed:", error.message);
    return { ok: false, error: error.code === "23505" ? "이미 사용 중인 slug입니다." : "기획전을 생성하지 못했습니다." };
  }
  return { ok: true, id: (data as unknown as { id: string }).id };
}

export async function updateAdminPromotion(id: string, input: AdminPromotionInput): Promise<SavePromotionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("promotions")
    .update({
      slug: input.slug,
      title_ko: input.titleKo,
      title_en: input.titleEn,
      description_ko: input.descriptionKo || null,
      description_en: input.descriptionEn || null,
      image_url: input.imageUrl || null,
      market_code: input.marketCode,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      is_active: input.isActive,
    } as never)
    .eq("id", id);

  if (error) {
    console.error("[admin/promotions] updateAdminPromotion failed:", error.message);
    return { ok: false, error: error.code === "23505" ? "이미 사용 중인 slug입니다." : "기획전을 수정하지 못했습니다." };
  }
  return { ok: true, id };
}

export async function addPromotionProduct(promotionId: string, productId: string, sortOrder: number): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("promotion_products")
    .insert({ promotion_id: promotionId, product_id: productId, sort_order: sortOrder } as never);
  if (error) fail("addPromotionProduct", error);
}

export async function removePromotionProduct(promotionId: string, productId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("promotion_products").delete().eq("promotion_id", promotionId).eq("product_id", productId);
  if (error) fail("removePromotionProduct", error);
}

export async function reorderPromotionProduct(promotionId: string, productId: string, sortOrder: number): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("promotion_products")
    .update({ sort_order: sortOrder } as never)
    .eq("promotion_id", promotionId)
    .eq("product_id", productId);
  if (error) fail("reorderPromotionProduct", error);
}
