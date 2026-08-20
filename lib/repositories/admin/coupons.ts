import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CouponRow } from "@/types/database";
import type { AdminCoupon } from "@/types/admin";

function fail(context: string, error: { message: string }): never {
  console.error(`[admin/coupons] ${context} failed:`, error.message);
  throw new Error("쿠폰 데이터를 처리하지 못했습니다.");
}

type CouponJoinRow = CouponRow & {
  coupon_products: { product_id: string }[];
  coupon_categories: { category_id: string }[];
  coupon_usages: { id: string }[];
};

function mapCoupon(row: CouponJoinRow): AdminCoupon {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    minimumOrderAmount: row.minimum_order_amount,
    maximumDiscountAmount: row.maximum_discount_amount,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    usageLimit: row.usage_limit,
    perUserLimit: row.per_user_limit,
    marketCode: row.market_code,
    isActive: row.is_active,
    usedCount: row.coupon_usages.length,
    productIds: row.coupon_products.map((p) => p.product_id),
    categoryIds: row.coupon_categories.map((c) => c.category_id),
    createdAt: row.created_at,
  };
}

const COUPON_SELECT = "*, coupon_products(product_id), coupon_categories(category_id), coupon_usages(id)";

export async function listAdminCoupons(): Promise<AdminCoupon[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("coupons").select(COUPON_SELECT).order("created_at", { ascending: false });
  if (error) fail("listAdminCoupons", error);
  return ((data ?? []) as unknown as CouponJoinRow[]).map(mapCoupon);
}

export async function getAdminCouponDetail(id: string): Promise<AdminCoupon | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("coupons").select(COUPON_SELECT).eq("id", id).maybeSingle();
  if (error) fail("getAdminCouponDetail", error);
  return data ? mapCoupon(data as unknown as CouponJoinRow) : null;
}

export type AdminCouponInput = {
  code: string;
  name: string;
  description: string;
  discountType: "FIXED" | "PERCENT";
  discountValue: number;
  minimumOrderAmount: number;
  maximumDiscountAmount: number | null;
  validFrom: string;
  validUntil: string;
  usageLimit: number | null;
  perUserLimit: number;
  marketCode: "KR" | "IN" | null;
  isActive: boolean;
  productIds: string[];
  categoryIds: string[];
};

export type SaveCouponResult = { ok: true; id: string } | { ok: false; error: string };

async function replaceCouponScope(
  supabase: Awaited<ReturnType<typeof createClient>>,
  couponId: string,
  productIds: string[],
  categoryIds: string[]
): Promise<void> {
  await supabase.from("coupon_products").delete().eq("coupon_id", couponId);
  await supabase.from("coupon_categories").delete().eq("coupon_id", couponId);
  if (productIds.length > 0) {
    await supabase.from("coupon_products").insert(productIds.map((product_id) => ({ coupon_id: couponId, product_id })) as never);
  }
  if (categoryIds.length > 0) {
    await supabase
      .from("coupon_categories")
      .insert(categoryIds.map((category_id) => ({ coupon_id: couponId, category_id })) as never);
  }
}

export async function createAdminCoupon(input: AdminCouponInput): Promise<SaveCouponResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coupons")
    .insert({
      code: input.code,
      name: input.name,
      description: input.description || null,
      discount_type: input.discountType,
      discount_value: input.discountValue,
      minimum_order_amount: input.minimumOrderAmount,
      maximum_discount_amount: input.maximumDiscountAmount,
      valid_from: input.validFrom,
      valid_until: input.validUntil,
      usage_limit: input.usageLimit,
      per_user_limit: input.perUserLimit,
      market_code: input.marketCode,
      is_active: input.isActive,
    } as never)
    .select("id")
    .single();

  if (error) {
    console.error("[admin/coupons] createAdminCoupon failed:", error.message);
    return { ok: false, error: error.code === "23505" ? "이미 사용 중인 쿠폰 코드입니다." : "쿠폰을 생성하지 못했습니다." };
  }

  const id = (data as unknown as { id: string }).id;
  await replaceCouponScope(supabase, id, input.productIds, input.categoryIds);
  return { ok: true, id };
}

export async function updateAdminCoupon(id: string, input: AdminCouponInput): Promise<SaveCouponResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("coupons")
    .update({
      code: input.code,
      name: input.name,
      description: input.description || null,
      discount_type: input.discountType,
      discount_value: input.discountValue,
      minimum_order_amount: input.minimumOrderAmount,
      maximum_discount_amount: input.maximumDiscountAmount,
      valid_from: input.validFrom,
      valid_until: input.validUntil,
      usage_limit: input.usageLimit,
      per_user_limit: input.perUserLimit,
      market_code: input.marketCode,
      is_active: input.isActive,
    } as never)
    .eq("id", id);

  if (error) {
    console.error("[admin/coupons] updateAdminCoupon failed:", error.message);
    return { ok: false, error: error.code === "23505" ? "이미 사용 중인 쿠폰 코드입니다." : "쿠폰을 수정하지 못했습니다." };
  }

  await replaceCouponScope(supabase, id, input.productIds, input.categoryIds);
  return { ok: true, id };
}

export async function setAdminCouponActive(id: string, isActive: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("coupons").update({ is_active: isActive } as never).eq("id", id);
  if (error) fail("setAdminCouponActive", error);
}
