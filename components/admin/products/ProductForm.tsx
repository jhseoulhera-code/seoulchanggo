"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormField } from "@/components/common/FormField";
import { saveProductAction } from "@/lib/actions/adminProducts";
import type { AdminCategory, AdminOptionGroup, AdminProductDetail } from "@/types/admin";

type ProductFormProps = {
  initialDetail: AdminProductDetail;
  categories: AdminCategory[];
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function ProductForm({ initialDetail, categories }: ProductFormProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<AdminProductDetail>(initialDetail);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  /**
   * Matches/updates by currencyCode rather than marketCode: a product
   * loaded from the DB may not have a USD row yet (STEP 13 addendum — USD
   * pricing is opt-in, added after existing KR/IN-only products), so this
   * upserts a new entry into local state on first edit instead of relying
   * on an entry that's guaranteed to already exist the way KR/IN are.
   */
  function updatePrice(currencyCode: "KRW" | "INR" | "USD", field: "originalPrice" | "salePrice", value: number) {
    setDetail((prev) => {
      const exists = prev.prices.some((p) => p.currencyCode === currencyCode);
      if (exists) {
        return { ...prev, prices: prev.prices.map((p) => (p.currencyCode === currencyCode ? { ...p, [field]: value } : p)) };
      }
      const marketCode = currencyCode === "KRW" ? "KR" : currencyCode === "INR" ? "IN" : null;
      return {
        ...prev,
        prices: [...prev.prices, { marketCode, currencyCode, originalPrice: 0, salePrice: 0, [field]: value }],
      };
    });
  }

  function updateShippingMarket(countryCode: "KR" | "IN", patch: Partial<AdminProductDetail["shippingMarkets"][number]>) {
    setDetail((prev) => ({
      ...prev,
      shippingMarkets: prev.shippingMarkets.map((m) => (m.countryCode === countryCode ? { ...m, ...patch } : m)),
    }));
  }

  function addOptionGroup() {
    setDetail((prev) => ({ ...prev, optionGroups: [...prev.optionGroups, { name: "", choices: [] }] }));
  }

  function updateOptionGroup(index: number, patch: Partial<AdminOptionGroup>) {
    setDetail((prev) => ({
      ...prev,
      optionGroups: prev.optionGroups.map((group, i) => (i === index ? { ...group, ...patch } : group)),
    }));
  }

  function removeOptionGroup(index: number) {
    setDetail((prev) => ({ ...prev, optionGroups: prev.optionGroups.filter((_, i) => i !== index) }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const result = await saveProductAction(detail);
    setSaving(false);

    if (!result.ok) {
      setMessage({ tone: "error", text: result.error });
      return;
    }

    setMessage({ tone: "success", text: "저장되었습니다." });
    if (!detail.id) {
      router.push(`/admin/products/${result.data.id}`);
    } else {
      router.refresh();
    }
  }

  const krPrice = detail.prices.find((p) => p.currencyCode === "KRW");
  const inPrice = detail.prices.find((p) => p.currencyCode === "INR");
  const usdPrice = detail.prices.find((p) => p.currencyCode === "USD");
  const krMarket = detail.shippingMarkets.find((m) => m.countryCode === "KR");
  const inMarket = detail.shippingMarkets.find((m) => m.countryCode === "IN");

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-text-main">기본정보</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <FormField
            label="상품명 (한국어)"
            value={detail.nameKo}
            onChange={(v) => setDetail((prev) => ({ ...prev, nameKo: v, slug: prev.slug || slugify(v) }))}
          />
          <FormField
            label={detail.nameEn.trim() ? "상품명 (영어)" : "상품명 (영어) · EN 번역 없음"}
            value={detail.nameEn}
            onChange={(v) => setDetail((prev) => ({ ...prev, nameEn: v }))}
          />
          <FormField label="SKU" value={detail.sku} onChange={(v) => setDetail((prev) => ({ ...prev, sku: v }))} />
          <FormField label="Slug" value={detail.slug} onChange={(v) => setDetail((prev) => ({ ...prev, slug: v }))} />
          <FormField label="브랜드" value={detail.brand} onChange={(v) => setDetail((prev) => ({ ...prev, brand: v }))} />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-text-secondary">카테고리</span>
            <select
              value={detail.categoryId}
              onChange={(event) => setDetail((prev) => ({ ...prev, categoryId: event.target.value }))}
              className="border border-border px-3 py-2.5 text-sm text-text-main"
            >
              <option value="">선택</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.nameKo}
                </option>
              ))}
            </select>
          </label>
        </div>
        <FormField
          label="설명 (한국어)"
          value={detail.descriptionKo}
          onChange={(v) => setDetail((prev) => ({ ...prev, descriptionKo: v }))}
        />
        <FormField
          label={detail.descriptionEn.trim() ? "설명 (영어)" : "설명 (영어) · EN 번역 없음"}
          value={detail.descriptionEn}
          onChange={(v) => setDetail((prev) => ({ ...prev, descriptionEn: v }))}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-text-main">판매정보</h2>
        <label className="flex items-center gap-2.5 text-sm text-text-main">
          <input
            type="checkbox"
            checked={detail.isActive}
            onChange={(event) => setDetail((prev) => ({ ...prev, isActive: event.target.checked }))}
            className="h-4 w-4 accent-primary"
          />
          판매중 (해제 시 고객 화면에서 숨김)
        </label>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-2 border border-border p-3">
            <span className="text-xs font-bold text-text-secondary">KR (KRW)</span>
            <FormField
              label="정상가"
              type="number"
              value={String(krPrice?.originalPrice ?? 0)}
              onChange={(v) => updatePrice("KRW", "originalPrice", Number(v) || 0)}
            />
            <FormField
              label="판매가"
              type="number"
              value={String(krPrice?.salePrice ?? 0)}
              onChange={(v) => updatePrice("KRW", "salePrice", Number(v) || 0)}
            />
          </div>
          <div className="flex flex-col gap-2 border border-border p-3">
            <span className="text-xs font-bold text-text-secondary">IN (INR)</span>
            <FormField
              label="정상가"
              type="number"
              value={String(inPrice?.originalPrice ?? 0)}
              onChange={(v) => updatePrice("INR", "originalPrice", Number(v) || 0)}
            />
            <FormField
              label="판매가"
              type="number"
              value={String(inPrice?.salePrice ?? 0)}
              onChange={(v) => updatePrice("INR", "salePrice", Number(v) || 0)}
            />
          </div>
          <div className="flex flex-col gap-2 border border-border p-3">
            <span className="text-xs font-bold text-text-secondary">Global (USD)</span>
            <FormField
              label="정상가"
              type="number"
              value={String(usdPrice?.originalPrice ?? 0)}
              onChange={(v) => updatePrice("USD", "originalPrice", Number(v) || 0)}
            />
            <FormField
              label="판매가"
              type="number"
              value={String(usdPrice?.salePrice ?? 0)}
              onChange={(v) => updatePrice("USD", "salePrice", Number(v) || 0)}
            />
            <p className="text-[11px] leading-relaxed text-text-secondary">
              미입력(0) 시 KRW 판매가 기준 개발용 환율 환산값이 표시됩니다.
            </p>
          </div>
        </div>
        <FormField
          label="할인율(%) — 선택"
          type="number"
          value={detail.discountRate !== null ? String(detail.discountRate) : ""}
          onChange={(v) => setDetail((prev) => ({ ...prev, discountRate: v ? Number(v) : null }))}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-text-main">공급/배송</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-text-secondary">공급유형</span>
            <select
              value={detail.supplyType}
              onChange={(event) =>
                setDetail((prev) => ({ ...prev, supplyType: event.target.value as AdminProductDetail["supplyType"] }))
              }
              className="border border-border px-3 py-2.5 text-sm text-text-main"
            >
              <option value="DOMESTIC_STOCK">국내 재고</option>
              <option value="OVERSEAS_DIRECT">해외 직배송</option>
              <option value="OVERSEAS_AGENCY">해외 구매대행</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-text-secondary">배송유형</span>
            <select
              value={detail.shippingType}
              onChange={(event) =>
                setDetail((prev) => ({ ...prev, shippingType: event.target.value as AdminProductDetail["shippingType"] }))
              }
              className="border border-border px-3 py-2.5 text-sm text-text-main"
            >
              <option value="DOMESTIC">국내배송</option>
              <option value="OVERSEAS_DIRECT">해외직배송</option>
              <option value="OVERSEAS_AGENCY">해외구매대행</option>
            </select>
          </label>
          <FormField
            label="출고국가 (예: CN, US)"
            value={detail.originCountry}
            onChange={(v) => setDetail((prev) => ({ ...prev, originCountry: v.toUpperCase() }))}
          />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-text-secondary">기본 국제배송 방식</span>
            <select
              value={detail.defaultShippingMethod ?? ""}
              onChange={(event) =>
                setDetail((prev) => ({
                  ...prev,
                  defaultShippingMethod: (event.target.value || null) as AdminProductDetail["defaultShippingMethod"],
                }))
              }
              className="border border-border px-3 py-2.5 text-sm text-text-main"
            >
              <option value="">해당 없음</option>
              <option value="SEA">SEA (해상)</option>
              <option value="AIR">AIR (항공)</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2.5 text-sm text-text-main">
          <input
            type="checkbox"
            checked={detail.freeShipping}
            onChange={(event) => setDetail((prev) => ({ ...prev, freeShipping: event.target.checked }))}
            className="h-4 w-4 accent-primary"
          />
          무료배송
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-text-main">국가별 배송</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {(
            [
              { code: "KR" as const, market: krMarket },
              { code: "IN" as const, market: inMarket },
            ] as const
          ).map(({ code, market }) => (
            <div key={code} className="flex flex-col gap-2 border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-secondary">{code}</span>
                <label className="flex items-center gap-1.5 text-xs text-text-main">
                  <input
                    type="checkbox"
                    checked={market?.isAvailable ?? false}
                    onChange={(event) => updateShippingMarket(code, { isAvailable: event.target.checked })}
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
                  label="예상 최소일"
                  type="number"
                  value={String(market?.estimatedMinDays ?? "")}
                  onChange={(v) => updateShippingMarket(code, { estimatedMinDays: v ? Number(v) : null })}
                />
                <FormField
                  label="예상 최대일"
                  type="number"
                  value={String(market?.estimatedMaxDays ?? "")}
                  onChange={(v) => updateShippingMarket(code, { estimatedMaxDays: v ? Number(v) : null })}
                />
              </div>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-xs font-medium text-text-secondary">배송방식</span>
                <select
                  value={market?.shippingMethod ?? ""}
                  onChange={(event) =>
                    updateShippingMarket(code, {
                      shippingMethod: (event.target.value || null) as AdminProductDetail["shippingMarkets"][number]["shippingMethod"],
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
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-text-main">재고</h2>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs font-medium text-text-secondary">재고 유형</span>
          <select
            value={detail.stockType}
            onChange={(event) => setDetail((prev) => ({ ...prev, stockType: event.target.value as AdminProductDetail["stockType"] }))}
            className="w-48 border border-border px-3 py-2.5 text-sm text-text-main"
          >
            <option value="TRACKED">재고 관리</option>
            <option value="UNLIMITED">재고 무제한</option>
          </select>
        </label>
        {detail.stockType === "TRACKED" && (
          <FormField
            label="상품 재고 (옵션이 있으면 옵션별 재고 합계로 대체 가능)"
            type="number"
            value={String(detail.stockQuantity)}
            onChange={(v) => setDetail((prev) => ({ ...prev, stockQuantity: Number(v) || 0 }))}
          />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-text-main">옵션 (색상/사이즈 등 선택지)</h2>
          <button type="button" onClick={addOptionGroup} className="text-xs font-bold text-primary underline">
            + 옵션 그룹 추가
          </button>
        </div>
        {detail.optionGroups.length === 0 && <p className="text-xs text-text-secondary">옵션이 없는 상품입니다.</p>}
        {detail.optionGroups.map((group, index) => (
          <div key={index} className="flex flex-col gap-2 border border-border p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="옵션명 (예: 색상)"
                value={group.name}
                onChange={(event) => updateOptionGroup(index, { name: event.target.value })}
                className="flex-1 border border-border px-2 py-1.5 text-sm text-text-main outline-none"
              />
              <button type="button" onClick={() => removeOptionGroup(index)} className="text-xs text-red-600">
                삭제
              </button>
            </div>
            <input
              type="text"
              placeholder="선택지를 쉼표로 구분 (예: 화이트, 블랙)"
              value={group.choices.join(", ")}
              onChange={(event) =>
                updateOptionGroup(index, {
                  choices: event.target.value.split(",").map((choice) => choice.trim()).filter(Boolean),
                })
              }
              className="border border-border px-2 py-1.5 text-sm text-text-main outline-none"
            />
          </div>
        ))}
        {!detail.id && detail.optionGroups.length > 0 && (
          <p className="text-xs text-text-secondary">
            여기 입력한 선택지는 고객 화면 표시용입니다. 조합별 재고(Variant)는 저장 후 이 페이지에서 추가할 수 있습니다.
          </p>
        )}
      </section>

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="h-11 bg-primary px-6 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-border"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
        {message && (
          <span className={`text-sm ${message.tone === "success" ? "text-primary" : "text-red-600"}`}>{message.text}</span>
        )}
      </div>
    </div>
  );
}
