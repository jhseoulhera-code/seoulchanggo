import { AdminErrorScreen } from "@/components/admin/AdminBlockerScreen";
import { InventoryTable } from "@/components/admin/inventory/InventoryTable";
import { listAdminInventory } from "@/lib/repositories/admin/inventory";

export default async function AdminInventoryPage() {
  let items: Awaited<ReturnType<typeof listAdminInventory>> | null = null;
  let errorMessage: string | null = null;
  try {
    items = await listAdminInventory();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "재고 목록을 불러오지 못했습니다.";
  }

  if (errorMessage || !items) {
    return <AdminErrorScreen message={errorMessage ?? "재고 목록을 불러오지 못했습니다."} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold text-text-main">재고관리</h1>
        <p className="mt-1 text-xs text-text-secondary">총 {items.length}건 · 수량 입력 후 포커스를 벗어나면 자동 저장됩니다.</p>
      </div>

      {items.length === 0 ? (
        <p className="border border-border p-6 text-center text-sm text-text-secondary">재고 추적 대상 상품이 없습니다.</p>
      ) : (
        <InventoryTable items={items} />
      )}
    </div>
  );
}
