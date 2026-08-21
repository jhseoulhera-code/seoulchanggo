import { AlertTriangle } from "lucide-react";

/**
 * STEP 14 spec section 40 — a route needs to exist before launch, but its
 * legal text must never be fabricated by this codebase. This is the shared
 * "content not yet written" state every /terms, /privacy, /shipping-policy,
 * /return-policy page renders until an operator (or the business's legal
 * counsel) supplies the real text.
 */
export function PolicyPlaceholderNotice() {
  return (
    <div className="flex flex-col items-center gap-3 border border-dashed border-border px-4 py-10 text-center">
      <AlertTriangle size={28} className="text-text-secondary" />
      <p className="text-sm font-bold text-text-main">아직 등록된 내용이 없습니다.</p>
      <p className="max-w-xs text-xs leading-relaxed text-text-secondary">
        이 페이지는 실서비스 오픈 전 운영자가 실제 약관/정책 문서로 채워야 하는 자리표시자(placeholder)입니다. 법률 검토를 거친 문구로 교체해주세요.
      </p>
    </div>
  );
}
