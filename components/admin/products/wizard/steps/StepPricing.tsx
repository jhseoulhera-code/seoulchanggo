"use client";

import { FormField } from "@/components/common/FormField";
import { computeSafeDiscountRate } from "@/lib/admin/productPricing";
import type { AdminProductDetail } from "@/types/admin";

type StepPricingProps = {
  detail: AdminProductDetail;
  onChange: (patch: Partial<AdminProductDetail>) => void;
};

const CURRENCY_META = {
  KRW: { label: "KR (KRW)", marketCode: "KR" as const },
  INR: { label: "IN (INR)", marketCode: "IN" as const },
  USD: { label: "Global (USD)", marketCode: null },
};

/**
 * STEP 16 spec section 1 Step 2 — reuses product_prices exactly as-is
 * (STEP 13's per-currency rows), and deliberately never auto-fills a price
 * from lib/currency.ts's DEV_EXCHANGE_RATES: an admin who leaves a currency
 * at 0 here gets that currency's usual PRICE_NOT_READY behavior in
 * production (create_order already enforces this — see STEP 15/15.5), not
 * a silently-confirmed dev-rate price.
 */
export function StepPricing({ detail, onChange }: StepPricingProps) {
  function updatePrice(currencyCode: "KRW" | "INR" | "USD", field: "originalPrice" | "salePrice", value: number) {
    const exists = detail.prices.some((p) => p.currencyCode === currencyCode);
    if (exists) {
      onChange({ prices: detail.prices.map((p) => (p.currencyCode === currencyCode ? { ...p, [field]: value } : p)) });
      return;
    }
    onChange({
      prices: [
        ...detail.prices,
        { marketCode: CURRENCY_META[currencyCode].marketCode, currencyCode, originalPrice: 0, salePrice: 0, [field]: value },
      ],
    });
  }

  const hasAnyPrice = detail.prices.some((p) => p.salePrice > 0);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-text-main">가격</h2>
      {!hasAnyPrice && <p className="text-xs text-red-600">최소 1개 통화의 판매가를 입력해야 등록할 수 있습니다.</p>}
      <div className="grid gap-3 md:grid-cols-3">
        {(Object.keys(CURRENCY_META) as (keyof typeof CURRENCY_META)[]).map((currencyCode) => {
          const price = detail.prices.find((p) => p.currencyCode === currencyCode);
          return (
            <div key={currencyCode} className="flex flex-col gap-2 border border-border p-3">
              <span className="text-xs font-bold text-text-secondary">{CURRENCY_META[currencyCode].label}</span>
              <FormField
                label="정상가"
                type="number"
                optionalTag="(선택)"
                value={String(price?.originalPrice ?? 0)}
                onChange={(v) => updatePrice(currencyCode, "originalPrice", Number(v) || 0)}
              />
              <FormField
                label="판매가"
                type="number"
                value={String(price?.salePrice ?? 0)}
                onChange={(v) => updatePrice(currencyCode, "salePrice", Number(v) || 0)}
              />
              {currencyCode === "USD" && (
                <p className="text-[11px] leading-relaxed text-text-secondary">
                  미입력(0) 시 개발 환경에서는 KRW 기준 환산가가 임시로 보이지만, 프로덕션에서는 USD 판매가 차단됩니다.
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-text-secondary">
        할인율(뱃지 표시용): <span className="font-bold text-primary">{computeSafeDiscountRate(detail.prices)}%</span> — KRW 정상가/판매가
        기준으로 자동 계산됩니다. 정상가가 없거나 판매가보다 낮거나 같으면 0%로 저장됩니다.
      </p>
    </section>
  );
}
