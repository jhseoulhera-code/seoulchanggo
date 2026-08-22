import type { AdminProductPrice } from "@/types/admin";

/**
 * Bug found in real use (STEP 16 follow-up): products.discount_rate has a
 * `check (discount_rate is null or (discount_rate between 0 and 100))`
 * constraint (20260820000200_schema_tables.sql), but the Wizard/ProductForm
 * both used to send whatever the admin typed into a free "할인율(%)" field
 * straight through to admin_upsert_product — a stray/mistaken value outside
 * that range reached the DB as a real INSERT and broke the constraint.
 *
 * discount_rate is meant to reflect the KRW price row's own original vs
 * sale price (confirmed against supabase/seed.sql: e.g. best-1's
 * 38900/29900 KRW row seeds discount_rate=23, exactly
 * round((38900-29900)/38900*100)) — so instead of trusting a
 * separately-typed number, this derives it from the same prices array
 * already being saved, and is the only thing admin_upsert_product's
 * p_discount_rate is ever built from now (lib/repositories/admin/products.ts's
 * upsertAdminProduct). No admin-supplied value can reach the DB unclamped
 * or unvalidated any more, for both create and edit (both go through that
 * one function) and CSV bulk import (which reuses it too).
 */
export function computeSafeDiscountRate(prices: Pick<AdminProductPrice, "currencyCode" | "originalPrice" | "salePrice">[]): number {
  const krwPrice = prices.find((p) => p.currencyCode === "KRW");
  if (!krwPrice) return 0;

  const { originalPrice, salePrice } = krwPrice;
  if (!Number.isFinite(originalPrice) || !Number.isFinite(salePrice)) return 0;
  if (originalPrice <= 0 || originalPrice <= salePrice) return 0;

  const rate = Math.round(((originalPrice - salePrice) / originalPrice) * 100);
  if (!Number.isFinite(rate)) return 0;

  return Math.min(100, Math.max(0, rate));
}
