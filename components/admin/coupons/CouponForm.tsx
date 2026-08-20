"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveCouponAction } from "@/lib/actions/adminCoupons";
import { searchProductsForPickerAction } from "@/lib/actions/adminCategories";
import type { AdminCoupon } from "@/types/admin";
import type { AdminCategory } from "@/types/admin";
import type { AdminProductPickerItem } from "@/lib/repositories/admin/products";

function toDatetimeLocal(iso: string): string {
  return iso ? iso.slice(0, 16) : "";
}

type CouponFormProps = {
  initial: AdminCoupon | null;
  categories: AdminCategory[];
  productNamesById: Record<string, string>;
};

export function CouponForm({ initial, categories, productNamesById }: CouponFormProps) {
  const router = useRouter();
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [discountType, setDiscountType] = useState<"FIXED" | "PERCENT">(initial?.discountType ?? "PERCENT");
  const [discountValue, setDiscountValue] = useState(String(initial?.discountValue ?? 10));
  const [minimumOrderAmount, setMinimumOrderAmount] = useState(String(initial?.minimumOrderAmount ?? 0));
  const [maximumDiscountAmount, setMaximumDiscountAmount] = useState(
    initial?.maximumDiscountAmount != null ? String(initial.maximumDiscountAmount) : ""
  );
  const [validFrom, setValidFrom] = useState(() => toDatetimeLocal(initial?.validFrom ?? new Date().toISOString()));
  const [validUntil, setValidUntil] = useState(() =>
    toDatetimeLocal(initial?.validUntil ?? new Date(Date.now() + 30 * 86400000).toISOString())
  );
  const [usageLimit, setUsageLimit] = useState(initial?.usageLimit != null ? String(initial.usageLimit) : "");
  const [perUserLimit, setPerUserLimit] = useState(String(initial?.perUserLimit ?? 1));
  const [marketCode, setMarketCode] = useState<"" | "KR" | "IN">(initial?.marketCode ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [categoryIds, setCategoryIds] = useState<string[]>(initial?.categoryIds ?? []);
  const [productPicks, setProductPicks] = useState<Record<string, string>>(
    Object.fromEntries((initial?.productIds ?? []).map((id) => [id, productNamesById[id] ?? id]))
  );
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<AdminProductPickerItem[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleCategory(id: string) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function handleProductSearch() {
    if (!productQuery.trim()) return;
    const result = await searchProductsForPickerAction(productQuery);
    if (result.ok) setProductResults(result.data);
  }

  function addProduct(product: AdminProductPickerItem) {
    setProductPicks((prev) => ({ ...prev, [product.id]: product.nameKo }));
    setProductResults([]);
    setProductQuery("");
  }

  function removeProduct(id: string) {
    setProductPicks((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function validate(): string | null {
    if (!code.trim()) return "쿠폰 코드를 입력해주세요.";
    if (!name.trim()) return "쿠폰 이름을 입력해주세요.";
    if (discountType === "FIXED" && !marketCode) return "정액 쿠폰은 Market을 지정해야 합니다.";
    if (discountType === "PERCENT" && (Number(discountValue) <= 0 || Number(discountValue) > 100)) {
      return "정률 할인은 1~100 사이여야 합니다.";
    }
    if (new Date(validUntil) <= new Date(validFrom)) return "종료일은 시작일보다 이후여야 합니다.";
    return null;
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setPending(true);
    setError(null);
    const result = await saveCouponAction(initial?.id ?? null, {
      code: code.trim(),
      name: name.trim(),
      description,
      discountType,
      discountValue: Number(discountValue) || 0,
      minimumOrderAmount: Number(minimumOrderAmount) || 0,
      maximumDiscountAmount: maximumDiscountAmount ? Number(maximumDiscountAmount) : null,
      validFrom: new Date(validFrom).toISOString(),
      validUntil: new Date(validUntil).toISOString(),
      usageLimit: usageLimit ? Number(usageLimit) : null,
      perUserLimit: Number(perUserLimit) || 1,
      marketCode: marketCode || null,
      isActive,
      productIds: Object.keys(productPicks),
      categoryIds,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/admin/coupons");
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3 border border-border p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          쿠폰 코드
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          쿠폰 이름
          <input value={name} onChange={(e) => setName(e.target.value)} className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary sm:col-span-2">
          설명
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border border-border px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          할인 방식
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as "FIXED" | "PERCENT")}
            className="border border-border px-2 py-1.5 text-sm outline-none"
          >
            <option value="PERCENT">정률 할인 (%)</option>
            <option value="FIXED">정액 할인</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          할인 값 {discountType === "PERCENT" ? "(%)" : "(금액)"}
          <input
            type="number"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            className="border border-border px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          최소 주문금액
          <input
            type="number"
            value={minimumOrderAmount}
            onChange={(e) => setMinimumOrderAmount(e.target.value)}
            className="border border-border px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          최대 할인금액(정률 전용, 선택)
          <input
            type="number"
            value={maximumDiscountAmount}
            onChange={(e) => setMaximumDiscountAmount(e.target.value)}
            className="border border-border px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Market
          <select
            value={marketCode}
            onChange={(e) => setMarketCode(e.target.value as "" | "KR" | "IN")}
            className="border border-border px-2 py-1.5 text-sm outline-none"
          >
            <option value="">전체 Market</option>
            <option value="KR">KR 전용</option>
            <option value="IN">IN 전용</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          시작일시
          <input
            type="datetime-local"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className="border border-border px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          종료일시
          <input
            type="datetime-local"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="border border-border px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          전체 사용한도(선택)
          <input
            type="number"
            value={usageLimit}
            onChange={(e) => setUsageLimit(e.target.value)}
            className="border border-border px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          1인당 사용한도
          <input
            type="number"
            value={perUserLimit}
            onChange={(e) => setPerUserLimit(e.target.value)}
            className="border border-border px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-primary" />
          활성
        </label>
      </section>

      <section className="border border-border p-4">
        <h2 className="mb-2 text-sm font-bold text-text-main">적용 카테고리 (비워두면 전체 상품)</h2>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <label key={category.id} className="flex items-center gap-1.5 border border-border px-2 py-1 text-xs text-text-secondary">
              <input type="checkbox" checked={categoryIds.includes(category.id)} onChange={() => toggleCategory(category.id)} className="h-3.5 w-3.5 accent-primary" />
              {category.nameKo}
            </label>
          ))}
        </div>
      </section>

      <section className="border border-border p-4">
        <h2 className="mb-2 text-sm font-bold text-text-main">적용 상품 (비워두면 전체 상품)</h2>
        {Object.keys(productPicks).length > 0 && (
          <ul className="mb-3 flex flex-col divide-y divide-border border border-border">
            {Object.entries(productPicks).map(([id, name]) => (
              <li key={id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{name}</span>
                <button type="button" onClick={() => removeProduct(id)} className="text-xs text-red-600">
                  제거
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            상품 검색(이름/SKU)
            <input
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleProductSearch()}
              className="w-56 border border-border px-2 py-1.5 text-sm outline-none"
            />
          </label>
          <button type="button" onClick={handleProductSearch} className="h-[34px] border border-primary px-3 text-sm font-bold text-primary">
            검색
          </button>
        </div>
        {productResults.length > 0 && (
          <ul className="mt-2 flex flex-col divide-y divide-border border border-border">
            {productResults.map((product) => (
              <li key={product.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>
                  {product.nameKo} <span className="text-text-secondary">({product.sku})</span>
                </span>
                <button type="button" onClick={() => addProduct(product)} className="text-xs text-primary underline">
                  추가
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="h-11 self-start bg-primary px-6 text-sm font-bold text-white disabled:bg-border"
      >
        {pending ? "저장 중..." : "저장"}
      </button>
    </div>
  );
}
