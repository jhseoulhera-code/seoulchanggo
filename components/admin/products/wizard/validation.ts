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

  return issues;
}

/** Step 5 shows this separately as a recommendation, not a registration blocker. */
export function hasNoPrimaryImage(detail: AdminProductDetail): boolean {
  return !detail.images.some((image) => image.isPrimary);
}
