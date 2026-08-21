import { Plus } from "lucide-react";
import Link from "next/link";
import { AdminErrorScreen } from "@/components/admin/AdminBlockerScreen";
import { ProductFilterBar } from "@/components/admin/products/ProductFilterBar";
import { ProductImagePlaceholder } from "@/components/product/ProductImagePlaceholder";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { listAdminCategories } from "@/lib/repositories/admin/categories";
import { listAdminProducts } from "@/lib/repositories/admin/products";
import { SHIPPING_TYPE_LABEL, SUPPLY_TYPE_LABEL } from "@/lib/adminLabels";
import { formatCurrency } from "@/lib/currency";

type SearchParams = Record<string, string | string[] | undefined>;

function toStr(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminProductsPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const filters = {
    q: toStr(searchParams.q),
    categoryId: toStr(searchParams.categoryId),
    supplyType: toStr(searchParams.supplyType),
    shippingType: toStr(searchParams.shippingType),
    status: toStr(searchParams.status) as "active" | "inactive" | undefined,
    stockStatus: toStr(searchParams.stockStatus) as "low" | "out" | undefined,
  };

  let products: Awaited<ReturnType<typeof listAdminProducts>> | null = null;
  let categories: Awaited<ReturnType<typeof listAdminCategories>> | null = null;
  let errorMessage: string | null = null;
  try {
    [products, categories] = await Promise.all([listAdminProducts(filters), listAdminCategories()]);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "상품 목록을 불러오지 못했습니다.";
  }

  if (errorMessage || !products || !categories) {
    return <AdminErrorScreen message={errorMessage ?? "상품 목록을 불러오지 못했습니다."} />;
  }

  return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-text-main">상품관리</h1>
          <Link href="/admin/products/new" className="flex items-center gap-1.5 bg-primary px-4 py-2 text-sm font-bold text-white">
            <Plus size={16} />
            상품 등록
          </Link>
        </div>

        <ProductFilterBar categories={categories} current={filters} />

        <p className="text-xs text-text-secondary">총 {products.length}개</p>

        {products.length === 0 ? (
          <p className="border border-border p-6 text-center text-sm text-text-secondary">조건에 맞는 상품이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto border border-border">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
                <tr>
                  <th className="px-3 py-2">이미지</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">상품명</th>
                  <th className="px-3 py-2">브랜드</th>
                  <th className="px-3 py-2">카테고리</th>
                  <th className="px-3 py-2">공급유형</th>
                  <th className="px-3 py-2">배송유형</th>
                  <th className="px-3 py-2">KR 가격</th>
                  <th className="px-3 py-2">IN 가격</th>
                  <th className="px-3 py-2">재고</th>
                  <th className="px-3 py-2">판매상태</th>
                  <th className="px-3 py-2">수정</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const soldOut = product.stockType === "TRACKED" && product.stockQuantity === 0;
                  return (
                    <tr key={product.id} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2">
                        <div className="h-10 w-10 overflow-hidden border border-border">
                          {product.primaryImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.primaryImageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <ProductImagePlaceholder category="" className="h-full w-full" />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-text-secondary">{product.sku}</td>
                      <td className="px-3 py-2 text-text-main">
                        {product.nameKo}
                        {!product.hasEnglishName && (
                          <span className="ml-1.5 border border-amber-400 bg-amber-50 px-1 py-0.5 text-[10px] font-bold text-amber-700">
                            EN 번역 없음
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">{product.brand ?? "-"}</td>
                      <td className="px-3 py-2 text-text-secondary">{product.categoryName}</td>
                      <td className="px-3 py-2 text-text-secondary">{SUPPLY_TYPE_LABEL[product.supplyType]}</td>
                      <td className="px-3 py-2 text-text-secondary">{SHIPPING_TYPE_LABEL[product.shippingType]}</td>
                      <td className="px-3 py-2 text-text-main">
                        {product.krPrice !== null ? formatCurrency(product.krPrice, "KRW") : "-"}
                      </td>
                      <td className="px-3 py-2 text-text-main">
                        {product.inPrice !== null ? formatCurrency(product.inPrice, "INR") : "-"}
                        {!product.hasUsdPrice && (
                          <span className="ml-1.5 border border-amber-400 bg-amber-50 px-1 py-0.5 text-[10px] font-bold text-amber-700">
                            USD 가격 미설정
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-text-main">
                        {product.stockType === "TRACKED" ? `${product.stockQuantity}개` : "재고 무제한"}
                      </td>
                      <td className="px-3 py-2">
                        {!product.isActive ? (
                          <StatusBadge label="판매중지" />
                        ) : soldOut ? (
                          <StatusBadge label="품절" tone="warning" />
                        ) : (
                          <StatusBadge label="판매중" tone="primary" />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Link href={`/admin/products/${product.id}`} className="text-primary underline">
                          수정
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
  );
}
