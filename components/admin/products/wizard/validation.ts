// Relative + .ts-extensioned (not a "@/" alias) so this stays importable by
// scripts/test-admin-product-wizard.mts under plain Node, same reasoning as
// lib/ai/productAssistant's cross-file imports (see registry.ts's comment).
import { hasDuplicateSkus } from "../../../../lib/admin/productOptions.ts";
import type { AdminProductDetail } from "@/types/admin";

export type ValidationIssue = { field: string; message: string };

/**
 * Wizard Step 5's registration gate (STEP 16 spec section 1, Step 5
 * "검증" list). Pure function — no Supabase/React import — so it can be
 * unit-tested directly (see scripts/test-product-wizard-validation.mts)
 * and reused identically by both the Step 5 summary screen and the final
 * "상품 등록" button's guard.
 */
export function validateProductForRegistration(detail: AdminProductDetail): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!detail.nameKo.trim()) {
    issues.push({ field: "nameKo", message: "상품명(한국어)을 입력해주세요." });
  }
  if (!detail.categoryId) {
    issues.push({ field: "categoryId", message: "카테고리를 선택해주세요." });
  }
  if (!detail.sku.trim()) {
    issues.push({ field: "sku", message: "SKU를 입력해주세요." });
  }

  const hasAnyPrice = detail.prices.some((price) => price.salePrice > 0);
  if (!hasAnyPrice) {
    issues.push({ field: "prices", message: "최소 1개 통화의 판매가를 입력해주세요." });
  }

  if (detail.stockType === "TRACKED" && detail.stockQuantity <= 0) {
    issues.push({ field: "stockQuantity", message: "재고관리 상품은 재고수량을 0보다 크게 입력해야 합니다." });
  }

  // STEP 18 spec section 24 — "옵션 있음" (optionGroups non-empty) requires
  // at least one complete group and at least one generated variant, each
  // with its own SKU, before registration; "옵션 없음" needs nothing extra
  // here since SKU/판매가/재고 are already the checks above.
  if (detail.optionGroups.length > 0) {
    const incompleteGroup = detail.optionGroups.some((group) => !group.name.trim() || group.choices.length === 0);
    if (incompleteGroup) {
      issues.push({ field: "optionGroups", message: "모든 옵션 그룹에 그룹명과 옵션값을 1개 이상 입력해주세요." });
    }
    if (detail.variants.length === 0) {
      issues.push({ field: "variants", message: "옵션 조합을 1개 이상 생성해주세요." });
    }
    if (detail.variants.some((v) => !v.sku.trim())) {
      issues.push({ field: "variants", message: "모든 옵션 조합에 SKU를 입력해주세요." });
    }
    if (hasDuplicateSkus(detail.variants)) {
      issues.push({ field: "variants", message: "옵션 조합의 SKU가 중복되었습니다." });
    }
    const krwSalePrice = detail.prices.find((p) => p.currencyCode === "KRW")?.salePrice ?? 0;
    if (detail.variants.some((v) => krwSalePrice + v.additionalPrice < 0)) {
      issues.push({ field: "variants", message: "옵션 조합의 판매가는 0 이상이어야 합니다." });
    }
    if (detail.variants.some((v) => v.stockQuantity < 0)) {
      issues.push({ field: "variants", message: "옵션 조합의 재고는 0 이상이어야 합니다." });
    }
  }

  return issues;
}

/** Step 5 shows this separately as a recommendation, not a registration blocker. */
export function hasNoPrimaryImage(detail: AdminProductDetail): boolean {
  return !detail.images.some((image) => image.isPrimary);
}

/** STEP 18 spec section 24 — the DB's partial unique index already prevents this from being persisted, but the Wizard's own local state can transiently disagree before a save round-trips, so this stays checkable independently of the DB. */
export function hasMultiplePrimaryImages(detail: AdminProductDetail): boolean {
  return detail.images.filter((image) => image.isPrimary).length > 1;
}

/** STEP 18 spec section 24 ("이미지 sortOrder 정상화") — collapses whatever sortOrder values are currently on the list into a clean, gap-free 0..n-1 sequence in the list's current order. */
export function normalizeImageSortOrder<T extends { sortOrder: number }>(images: T[]): T[] {
  return images.map((image, index) => ({ ...image, sortOrder: index }));
}
