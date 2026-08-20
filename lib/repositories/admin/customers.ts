import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { OrderRow, ProfileRow } from "@/types/database";
import type { AdminCustomerDetail, AdminCustomerListItem, AdminOrderListItem } from "@/types/admin";

function fail(context: string, error: { message: string }): never {
  console.error(`[admin/customers] ${context} failed:`, error.message);
  throw new Error("회원 데이터를 처리하지 못했습니다.");
}

/** Order aggregates are computed in application code rather than a DB view — the admin scale in this step doesn't need one, and it keeps the read path to plain RLS-scoped selects. */
export async function listAdminCustomers(): Promise<AdminCustomerListItem[]> {
  const supabase = await createClient();

  const [{ data: profiles, error: profilesError }, { data: orders, error: ordersError }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("orders").select("user_id, total_amount, currency_code").not("user_id", "is", null),
  ]);

  if (profilesError) fail("listAdminCustomers (profiles)", profilesError);
  if (ordersError) fail("listAdminCustomers (orders)", ordersError);

  const orderStats = new Map<string, { count: number; totalsByCurrency: Map<string, number> }>();
  ((orders ?? []) as unknown as Pick<OrderRow, "user_id" | "total_amount" | "currency_code">[]).forEach((order) => {
    if (!order.user_id) return;
    const existing = orderStats.get(order.user_id) ?? { count: 0, totalsByCurrency: new Map<string, number>() };
    existing.count += 1;
    // Grouped by currency, never summed together — mixing KRW and INR totals would be meaningless.
    existing.totalsByCurrency.set(order.currency_code, (existing.totalsByCurrency.get(order.currency_code) ?? 0) + order.total_amount);
    orderStats.set(order.user_id, existing);
  });

  return ((profiles ?? []) as unknown as ProfileRow[]).map((profile) => {
    const stats = orderStats.get(profile.id) ?? { count: 0, totalsByCurrency: new Map<string, number>() };
    return {
      id: profile.id,
      displayName: profile.display_name,
      email: profile.email,
      authProvider: profile.auth_provider,
      marketCode: profile.preferred_market,
      createdAt: profile.created_at,
      orderCount: stats.count,
      totalSpentByCurrency: Array.from(stats.totalsByCurrency.entries()).map(([currencyCode, amount]) => ({
        currencyCode: currencyCode as AdminCustomerListItem["totalSpentByCurrency"][number]["currencyCode"],
        amount,
      })),
    };
  });
}

export async function getAdminCustomerDetail(id: string): Promise<AdminCustomerDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) fail("getAdminCustomerDetail", error);
  if (!data) return null;

  const profile = data as unknown as ProfileRow;

  const { data: orderRows, error: ordersError } = await supabase
    .from("orders")
    .select("*, profiles(display_name, email), order_items(id), shipping_groups(destination_country)")
    .eq("user_id", id)
    .order("created_at", { ascending: false });
  if (ordersError) fail("getAdminCustomerDetail (orders)", ordersError);

  type OrderListRow = OrderRow & {
    profiles: { display_name: string; email: string } | null;
    order_items: { id: string }[];
    shipping_groups: { destination_country: AdminOrderListItem["marketCode"] }[];
  };
  const orders: AdminOrderListItem[] = ((orderRows ?? []) as unknown as OrderListRow[]).map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    createdAt: row.created_at,
    isGuest: false,
    customerName: row.profiles?.display_name ?? profile.display_name,
    customerEmail: row.profiles?.email ?? profile.email,
    marketCode: row.market_code,
    currencyCode: row.currency_code,
    destinationCountries: [...new Set(row.shipping_groups.map((group) => group.destination_country))],
    itemCount: row.order_items.length,
    totalAmount: row.total_amount,
    paymentStatus: row.payment_status,
    orderStatus: row.order_status,
  }));

  const totalsByCurrency = new Map<string, number>();
  orders.forEach((order) => {
    totalsByCurrency.set(order.currencyCode, (totalsByCurrency.get(order.currencyCode) ?? 0) + order.totalAmount);
  });

  return {
    id: profile.id,
    displayName: profile.display_name,
    email: profile.email,
    authProvider: profile.auth_provider,
    marketCode: profile.preferred_market,
    localeCode: profile.preferred_locale,
    marketingOptIn: profile.marketing_opt_in,
    role: profile.role,
    createdAt: profile.created_at,
    orderCount: orders.length,
    totalSpentByCurrency: Array.from(totalsByCurrency.entries()).map(([currencyCode, amount]) => ({
      currencyCode: currencyCode as AdminCustomerListItem["totalSpentByCurrency"][number]["currencyCode"],
      amount,
    })),
    orders,
  };
}
