import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ProductVariantRow } from "@/types/database";
import type { AdminInventoryItem } from "@/types/admin";

function fail(context: string, error: { message: string }): never {
  console.error(`[admin/inventory] ${context} failed:`, error.message);
  throw new Error("재고 데이터를 처리하지 못했습니다.");
}

const LOW_STOCK_THRESHOLD = 5;

function statusFor(stockQuantity: number): AdminInventoryItem["status"] {
  if (stockQuantity <= 0) return "OUT";
  if (stockQuantity <= LOW_STOCK_THRESHOLD) return "LOW";
  return "OK";
}

type InventoryProductRow = {
  id: string;
  sku: string;
  name_ko: string;
  stock_quantity: number;
  product_variants: Pick<ProductVariantRow, "id" | "sku" | "stock_quantity" | "option_values">[];
};

export async function listAdminInventory(): Promise<AdminInventoryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, sku, name_ko, stock_quantity, product_variants(id, sku, stock_quantity, option_values)")
    .eq("stock_type", "TRACKED")
    .order("name_ko", { ascending: true });
  if (error) fail("listAdminInventory", error);

  const rows = (data ?? []) as unknown as InventoryProductRow[];

  return rows.flatMap((row): AdminInventoryItem[] => {
    if (row.product_variants.length === 0) {
      return [
        {
          productId: row.id,
          variantId: null,
          productNameKo: row.name_ko,
          variantLabel: null,
          sku: row.sku,
          stockQuantity: row.stock_quantity,
          status: statusFor(row.stock_quantity),
        },
      ];
    }

    return row.product_variants.map((variant) => {
      const optionLabel = Object.values((variant.option_values as unknown as Record<string, string>) ?? {}).join(" / ");
      return {
        productId: row.id,
        variantId: variant.id,
        productNameKo: row.name_ko,
        variantLabel: optionLabel || null,
        sku: variant.sku,
        stockQuantity: variant.stock_quantity,
        status: statusFor(variant.stock_quantity),
      };
    });
  });
}

export async function updateAdminProductStock(productId: string, stockQuantity: number): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ stock_quantity: stockQuantity } as never)
    .eq("id", productId);
  if (error) fail("updateAdminProductStock", error);
}
