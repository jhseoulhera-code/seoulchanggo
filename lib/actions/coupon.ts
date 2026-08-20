"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { CountryCode } from "@/types/market";

export type ApplyCouponResult =
  | { ok: true; couponId: string; discountAmount: number }
  | { ok: false; error: string };

const ERROR_LABEL: Record<string, string> = {
  NOT_FOUND: "존재하지 않는 쿠폰 코드입니다.",
  USAGE_LIMIT_REACHED: "쿠폰 사용 한도가 모두 소진되었습니다.",
  PER_USER_LIMIT_REACHED: "이미 사용하신 쿠폰입니다.",
};

/**
 * Re-derives the discount from the DB — never trusts a client-computed
 * amount. Also the exact check re-run inside create_order at order time, so
 * a coupon that passes here but is exhausted a moment later is caught again
 * there (STEP 10 spec section 37).
 */
export async function applyCouponAction(
  code: string,
  marketCode: CountryCode,
  subtotal: number,
  productSlugs: string[]
): Promise<ApplyCouponResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "쿠폰 기능은 Supabase 연결 후 사용할 수 있습니다." };
  }
  if (!code.trim()) {
    return { ok: false, error: "쿠폰 코드를 입력해주세요." };
  }

  const supabase = await createClient();
  const { data: products, error: productsError } = await supabase.from("products").select("id, slug").in("slug", productSlugs);
  if (productsError) {
    console.error("[coupon] applyCouponAction product lookup failed:", productsError.message);
    return { ok: false, error: "쿠폰을 확인하지 못했습니다." };
  }

  const productIds = ((products ?? []) as unknown as { id: string; slug: string }[]).map((row) => row.id);

  const { data, error } = await supabase.rpc("validate_coupon_code", {
    p_code: code.trim().toUpperCase(),
    p_market_code: marketCode,
    p_subtotal: subtotal,
    p_product_ids: productIds,
  } as never);

  if (error) {
    console.error("[coupon] validate_coupon_code failed:", error.message);
    return { ok: false, error: "쿠폰을 확인하지 못했습니다." };
  }

  const result = data as unknown as { ok: boolean; error?: string; coupon_id?: string; discount_amount?: number };
  if (!result.ok) {
    return { ok: false, error: ERROR_LABEL[result.error ?? ""] ?? "적용할 수 없는 쿠폰입니다." };
  }

  return { ok: true, couponId: result.coupon_id as string, discountAmount: result.discount_amount as number };
}

export type AvailableCoupon = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: "FIXED" | "PERCENT";
  discountValue: number;
  minimumOrderAmount: number;
  maximumDiscountAmount: number | null;
  validUntil: string;
};

export async function listAvailableCouponsAction(marketCode: CountryCode): Promise<AvailableCoupon[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc("list_available_coupons", { p_market_code: marketCode } as never);
  if (error) {
    console.error("[coupon] list_available_coupons failed:", error.message);
    return [];
  }

  type Row = {
    id: string;
    code: string;
    name: string;
    description: string | null;
    discount_type: "FIXED" | "PERCENT";
    discount_value: number;
    minimum_order_amount: number;
    maximum_discount_amount: number | null;
    valid_until: string;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    minimumOrderAmount: row.minimum_order_amount,
    maximumDiscountAmount: row.maximum_discount_amount,
    validUntil: row.valid_until,
  }));
}
