import type { AdminCategory } from "@/types/admin";

type ProductFilterBarProps = {
  categories: AdminCategory[];
  current: {
    q?: string;
    categoryId?: string;
    supplyType?: string;
    shippingType?: string;
    status?: string;
    stockStatus?: string;
  };
};

/** Plain GET form — no client JS needed; submitting just reloads the page with new searchParams. */
export function ProductFilterBar({ categories, current }: ProductFilterBarProps) {
  return (
    <form method="GET" className="flex flex-wrap items-end gap-2 border border-border p-3">
      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        검색(상품명/SKU/브랜드)
        <input
          type="text"
          name="q"
          defaultValue={current.q}
          className="w-48 border border-border px-2 py-1.5 text-sm text-text-main outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        카테고리
        <select name="categoryId" defaultValue={current.categoryId ?? ""} className="border border-border px-2 py-1.5 text-sm text-text-main">
          <option value="">전체</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.nameKo}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        공급유형
        <select name="supplyType" defaultValue={current.supplyType ?? ""} className="border border-border px-2 py-1.5 text-sm text-text-main">
          <option value="">전체</option>
          <option value="DOMESTIC_STOCK">국내 재고</option>
          <option value="OVERSEAS_DIRECT">해외 직배송</option>
          <option value="OVERSEAS_AGENCY">해외 구매대행</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        배송유형
        <select name="shippingType" defaultValue={current.shippingType ?? ""} className="border border-border px-2 py-1.5 text-sm text-text-main">
          <option value="">전체</option>
          <option value="DOMESTIC">국내배송</option>
          <option value="OVERSEAS_DIRECT">해외직배송</option>
          <option value="OVERSEAS_AGENCY">해외구매대행</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        판매상태
        <select name="status" defaultValue={current.status ?? ""} className="border border-border px-2 py-1.5 text-sm text-text-main">
          <option value="">전체</option>
          <option value="active">판매중</option>
          <option value="inactive">판매중지</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        재고상태
        <select name="stockStatus" defaultValue={current.stockStatus ?? ""} className="border border-border px-2 py-1.5 text-sm text-text-main">
          <option value="">전체</option>
          <option value="low">재고 부족</option>
          <option value="out">품절</option>
        </select>
      </label>
      <button type="submit" className="h-[34px] bg-primary px-4 text-sm font-bold text-white">
        검색
      </button>
    </form>
  );
}
