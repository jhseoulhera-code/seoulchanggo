import type { AiProviderName, CheckMissingFieldsResult, MissingFieldCheckInput } from "@/lib/ai/productAssistant/types";

/**
 * STEP 17 spec section 2D: this check is deliberately deterministic, not
 * something an LLM judges — "AI가 판단하면 안 되는 항목은 manual confirmation
 * required" reads most consistently as "this specific check should not be
 * probabilistic at all." Shared by every provider (mock and OpenAI both
 * call this instead of each having their own copy, so there is exactly one
 * place this logic can drift from Step 5's own validateProductForRegistration).
 * Always isFallback:true regardless of which provider is active — no LLM
 * call is ever made for this specific feature — but `provider` still
 * reflects the caller's own identity so the UI's "AI: OpenAI"/"AI: Mock"
 * label stays consistent with whichever provider the admin has selected.
 */
export function checkMissingFields(input: MissingFieldCheckInput, provider: AiProviderName): CheckMissingFieldsResult {
  const findings: CheckMissingFieldsResult["findings"] = [];
  if (!input.nameKo.trim()) findings.push({ field: "nameKo", message: "상품명(한국어)이 비어 있습니다." });
  if (!input.nameEn.trim()) findings.push({ field: "nameEn", message: "영문 상품명이 없습니다 — 해외 판매 시 필요합니다." });
  if (!input.descriptionKo.trim()) findings.push({ field: "descriptionKo", message: "상세 설명이 비어 있습니다." });
  if (!input.categoryId) findings.push({ field: "categoryId", message: "카테고리가 선택되지 않았습니다." });
  if (!input.hasAnyPrice) findings.push({ field: "prices", message: "판매 가능한 통화가 하나도 없습니다." });
  if (!input.hasPrimaryImage) findings.push({ field: "images", message: "대표 이미지가 없습니다." });
  if (input.stockType === "TRACKED" && input.stockQuantity <= 0) {
    findings.push({ field: "stockQuantity", message: "재고관리 상품인데 재고수량이 0입니다." });
  }

  findings.push({
    field: "manual_review_required",
    message:
      "가격, 원산지, 재고, 배송방식, 통관정보, 규제/인증 여부는 AI가 판단하지 않습니다 — 반드시 담당자가 직접 확인 후 등록하세요.",
  });

  return {
    provider,
    isFallback: true,
    message:
      (findings.length > 1 ? "누락된 항목이 있습니다." : "확인 결과 누락된 필수 항목이 없습니다.") +
      " (규칙 기반 자동 점검 — LLM을 사용하지 않습니다.)",
    findings,
  };
}
