import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ProductRow, ProductVariantRow } from "@/types/database";
import type { AdminDashboardStats, AdminLowStockItem, AdminOrderListItem } from "@/types/admin";

function fail(context: string, error: { message: string }): never {
  console.error(`[admin/dashboard] ${context} failed:`, error.message);
  throw new Error("대시보드 데이터를 불러오지 못했습니다.");
}

const LOW_STOCK_THRESHOLD = 5;

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const supabase = await createClient();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [
    { data: todayOrders, error: todayError },
    { count: paymentPendingCount, error: pendingError },
    { count: preparingCount, error: preparingError },
    { count: shippingCount, error: shippingError },
    { count: cancelReturnCount, error: cancelError },
    { count: lowStockProductCount, error: stockError },
    { count: lowStockVariantCount, error: variantStockError },
  ] = await Promise.all([
    supabase.from("orders").select("total_amount, currency_code").gte("created_at", todayStart.toISOString()),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("payment_status", "UNPAID"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("order_status", "PREPARING"),
    supabase.from("orders").select("id", { count: "exact", head: true }).in("order_status", ["PARTIALLY_SHIPPED", "SHIPPED"]),
    supabase.from("orders").select("id", { count: "exact", head: true }).in("order_status", ["CANCELLED", "RETURN_REQUESTED"]),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("stock_type", "TRACKED")
      .lte("stock_quantity", LOW_STOCK_THRESHOLD),
    supabase.from("product_variants").select("id", { count: "exact", head: true }).lte("stock_quantity", LOW_STOCK_THRESHOLD),
  ]);

  if (todayError) fail("getAdminDashboardStats (today orders)", todayError);
  if (pendingError) fail("getAdminDashboardStats (pending)", pendingError);
  if (preparingError) fail("getAdminDashboardStats (preparing)", preparingError);
  if (shippingError) fail("getAdminDashboardStats (shipping)", shippingError);
  if (cancelError) fail("getAdminDashboardStats (cancel)", cancelError);
  if (stockError) fail("getAdminDashboardStats (stock)", stockError);
  if (variantStockError) fail("getAdminDashboardStats (variant stock)", variantStockError);

  const todayRows = (todayOrders ?? []) as unknown as { total_amount: number; currency_code: string }[];
  const revenueByCurrency = new Map<string, number>();
  todayRows.forEach((row) => {
    revenueByCurrency.set(row.currency_code, (revenueByCurrency.get(row.currency_code) ?? 0) + row.total_amount);
  });

  return {
    todayOrderCount: todayRows.length,
    // Grouped by currency, never summed together — mixing KRW and INR totals would be meaningless.
    todayRevenueByCurrency: Array.from(revenueByCurrency.entries()).map(([currencyCode, amount]) => ({
      currencyCode: currencyCode as AdminDashboardStats["todayRevenueByCurrency"][number]["currencyCode"],
      amount,
    })),
    paymentPendingCount: paymentPendingCount ?? 0,
    preparingCount: preparingCount ?? 0,
    shippingCount: shippingCount ?? 0,
    cancelReturnRequestCount: cancelReturnCount ?? 0,
    lowStockCount: (lowStockProductCount ?? 0) + (lowStockVariantCount ?? 0),
  };
}

export async function getAdminLowStockItems(limit = 20): Promise<AdminLowStockItem[]> {
  const supabase = await createClient();

  const [{ data: products, error: productsError }, { data: variants, error: variantsError }] = await Promise.all([
    supabase
      .from("products")
      .select("id, sku, name_ko, stock_quantity")
      .eq("stock_type", "TRACKED")
      .lte("stock_quantity", LOW_STOCK_THRESHOLD)
      .order("stock_quantity", { ascending: true })
      .limit(limit),
    supabase
      .from("product_variants")
      .select("id, product_id, sku, stock_quantity, option_values, products(name_ko)")
      .lte("stock_quantity", LOW_STOCK_THRESHOLD)
      .order("stock_quantity", { ascending: true })
      .limit(limit),
  ]);

  if (productsError) fail("getAdminLowStockItems (products)", productsError);
  if (variantsError) fail("getAdminLowStockItems (variants)", variantsError);

  const productItems: AdminLowStockItem[] = (
    (products ?? []) as unknown as Pick<ProductRow, "id" | "sku" | "name_ko" | "stock_quantity">[]
  ).map((row) => ({
    productId: row.id,
    variantId: null,
    label: row.name_ko,
    sku: row.sku,
    stockQuantity: row.stock_quantity,
    status: row.stock_quantity === 0 ? "OUT" : "LOW",
  }));

  type VariantRow = ProductVariantRow & { products: { name_ko: string } | null };
  const variantItems: AdminLowStockItem[] = ((variants ?? []) as unknown as VariantRow[]).map((row) => {
    const optionLabel = Object.values((row.option_values as unknown as Record<string, string>) ?? {}).join(" / ");
    return {
      productId: row.product_id,
      variantId: row.id,
      label: `${row.products?.name_ko ?? "-"}${optionLabel ? ` (${optionLabel})` : ""}`,
      sku: row.sku,
      stockQuantity: row.stock_quantity,
      status: row.stock_quantity === 0 ? "OUT" : "LOW",
    };
  });

  return [...productItems, ...variantItems].sort((a, b) => a.stockQuantity - b.stockQuantity).slice(0, limit);
}

export async function getAdminRecentOrders(limit = 10): Promise<AdminOrderListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, profiles(display_name, email), order_items(id), shipping_groups(destination_country)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("getAdminRecentOrders", error);

  type OrderListRow = {
    id: string;
    order_number: string;
    created_at: string;
    user_id: string | null;
    guest_email: string | null;
    market_code: AdminOrderListItem["marketCode"];
    currency_code: AdminOrderListItem["currencyCode"];
    total_amount: number;
    payment_status: AdminOrderListItem["paymentStatus"];
    order_status: AdminOrderListItem["orderStatus"];
    profiles: { display_name: string; email: string } | null;
    order_items: { id: string }[];
    shipping_groups: { destination_country: AdminOrderListItem["marketCode"] }[];
  };

  return ((data ?? []) as unknown as OrderListRow[]).map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    createdAt: row.created_at,
    isGuest: row.user_id === null,
    customerName: row.profiles?.display_name ?? "비회원",
    customerEmail: row.profiles?.email ?? row.guest_email ?? "-",
    marketCode: row.market_code,
    currencyCode: row.currency_code,
    destinationCountries: [...new Set(row.shipping_groups.map((group) => group.destination_country))],
    itemCount: row.order_items.length,
    totalAmount: row.total_amount,
    paymentStatus: row.payment_status,
    orderStatus: row.order_status,
  }));
}
