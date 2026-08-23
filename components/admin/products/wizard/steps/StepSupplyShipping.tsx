"use client";

import { FormField } from "@/components/common/FormField";
import type { AdminProductDetail } from "@/types/admin";

type StepSupplyShippingProps = {
  detail: AdminProductDetail;
  onChange: (patch: Partial<AdminProductDetail>) => void;
};

/** 공급형태와 배송방식은 서로 다른 필드로 유지 — supply_type(재고 소싱 방식)과 shipping_type(고객에게 어떻게 발송되는지)은 이미 별개 컬럼(STEP 08)이라 그대로 둔다. */
export function StepSupplyShipping({ detail, onChange }: StepSupplyShippingProps) {
  const krMarket = detail.shippingMarkets.find((m) => m.countryCode === "KR");
  const inMarket = detail.shippingMarkets.find((m) => m.countryCode === "IN");

  function updateShippingMarket(countryCode: "KR" | "IN", patch: Partial<AdminProductDetail["shippingMarkets"][number]>) {
    onChange({ shippingMarkets: detail.shippingMarkets.map((m) => (m.countryCode === countryCode ? { ...m, ...patch } : m)) });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-text-main">공급/배송</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-text-secondary">공급형태</span>
            <select
              value={detail.supplyType}
              onChange={(e) => onChange({ supplyType: e.target.value as AdminProductDetail["supplyType"] })}
              className="border border-border px-3 py-2.5 text-sm text-text-main"
            >
              <option value="DOMESTIC_STOCK">국내 재고</option>
              <option value="OVERSEAS_DIRECT">해외 직배송</option>
              <option value="OVERSEAS_AGENCY">해외 구매대행</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-text-secondary">배송방식</span>
            <select
              value={detail.shippingType}
              onChange={(e) => onChange({ shippingType: e.target.value as AdminProductDetail["shippingType"] })}
              className="border border-border px-3 py-2.5 text-sm text-text-main"
            >
              <option value="DOMESTIC">국내배송 (DOMESTIC_PARCEL)</option>
              <option value="OVERSEAS_DIRECT">해외직배송</option>
              <option value="OVERSEAS_AGENCY">해외구매대행</option>
            </select>
          </label>
          <FormField
            label="출고국 / 원산지 (예: CN, US, KR)"
            value={detail.originCountry}
            onChange={(v) => onChange({ originCountry: v.toUpperCase() })}
          />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-text-secondary">국제배송 방식</span>
            <select
              value={detail.defaultShippingMethod ?? ""}
              onChange={(e) =>
                onChange({ defaultShippingMethod: (e.target.value || null) as AdminProductDetail["defaultShippingMethod"] })
              }
              className="border border-border px-3 py-2.5 text-sm text-text-main"
            >
              <option value="">해당 없음</option>
              <option value="SEA">OVERSEAS_SEA (해상)</option>
              <option value="AIR">OVERSEAS_AIR (항공)</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2.5 text-sm text-text-main">
          <input
            type="checkbox"
            checked={detail.freeShipping}
            onChange={(e) => onChange({ freeShipping: e.target.checked })}
            className="h-4 w-4 accent-primary"
          />
          무료배송 (체크 시 배송비 0원 고정, 아래 국가별 배송비는 무시됩니다)
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-text-main">국가별 배송 / 무료배송 기준</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {([{ code: "KR" as const, market: krMarket }, { code: "IN" as const, market: inMarket }] as const).map(
            ({ code, market }) => (
              <div key={code} className="flex flex-col gap-2 border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-secondary">{code}</span>
                  <label className="flex items-center gap-1.5 text-xs text-text-main">
                    <input
                      type="checkbox"
                      checked={market?.isAvailable ?? false}
                      onChange={(e) => updateShippingMarket(code, { isAvailable: e.target.checked })}
                      className="h-4 w-4 accent-primary"
                    />
                    배송가능
                  </label>
                </div>
                <FormField
                  label="배송비"
                  type="number"
                  value={String(market?.shippingFee ?? 0)}
                  onChange={(v) => updateShippingMarket(code, { shippingFee: Number(v) || 0 })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    label="예상 출고/도착 최소일"
                    type="number"
                    optionalTag="(선택)"
                    value={String(market?.estimatedMinDays ?? "")}
                    onChange={(v) => updateShippingMarket(code, { estimatedMinDays: v ? Number(v) : null })}
                  />
                  <FormField
                    label="최대일"
                    type="number"
                    optionalTag="(선택)"
                    value={String(market?.estimatedMaxDays ?? "")}
                    onChange={(v) => updateShippingMarket(code, { estimatedMaxDays: v ? Number(v) : null })}
                  />
                </div>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-xs font-medium text-text-secondary">배송방식</span>
                  <select
                    value={market?.shippingMethod ?? ""}
                    onChange={(e) =>
                      updateShippingMarket(code, {
                        shippingMethod: (e.target.value || null) as AdminProductDetail["shippingMarkets"][number]["shippingMethod"],
                      })
                    }
                    className="border border-border px-3 py-2.5 text-sm text-text-main"
                  >
                    <option value="">해당 없음</option>
                    <option value="SEA">SEA</option>
                    <option value="AIR">AIR</option>
                  </select>
                </label>
              </div>
            )
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-text-main">재고</h2>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs font-medium text-text-secondary">재고관리 방식</span>
          <select
            value={detail.stockType}
            onChange={(e) => onChange({ stockType: e.target.value as AdminProductDetail["stockType"] })}
            className="w-56 border border-border px-3 py-2.5 text-sm text-text-main"
          >
            <option value="TRACKED">TRACKED (재고 관리)</option>
            <option value="UNLIMITED">UNLIMITED (재고 무제한)</option>
          </select>
        </label>
        {detail.stockType === "TRACKED" && (
          <FormField
            label="재고수량"
            type="number"
            value={String(detail.stockQuantity)}
            onChange={(v) => onChange({ stockQuantity: Number(v) || 0 })}
          />
        )}
        {/* STEP 18 spec section 13 — 품절 is derived from stock, not a separately settable flag (matches lib/repositories/admin/inventory.ts's existing convention). Only meaningful for an option-less product; a product with variants shows this per-variant instead (StepMediaOptions). */}
        {detail.optionGroups.length === 0 && detail.stockType === "TRACKED" && detail.stockQuantity <= 0 && (
          <p className="w-fit bg-red-50 px-2 py-1 text-xs font-bold text-red-600">품절 (재고 0)</p>
        )}
        {detail.stockType === "TRACKED" && detail.stockQuantity <= 0 && (
          <p className="text-xs text-red-600">재고관리 상품은 재고수량이 0보다 커야 등록할 수 있습니다.</p>
        )}
      </section>
    </div>
  );
}
