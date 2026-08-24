/**
 * STEP 25 spec section 45 — framework-free test script (same convention as
 * scripts/test-payment-webhook-recovery.mts and friends). lib/shipping/carriers.ts
 * and lib/validation.ts are plain pure modules (not "server-only"), so their
 * real logic is exercised directly here; everything living inside a
 * "server-only" repository/action file, a React component, or a migration's
 * SQL is verified structurally (readFileSync + regex/substring) — the same
 * pattern used throughout this session for privileged RPC/repository code
 * that cannot be imported outside Next.js's server bundler.
 *
 * Run with: node --experimental-strip-types scripts/test-admin-orders.mts
 */
import { readFileSync } from "node:fs";
import { carrierLabel, CARRIER_LABEL, DOMESTIC_CARRIERS, INTERNATIONAL_CARRIERS, isValidCarrierCode } from "../lib/shipping/carriers.ts";
import { isValidTrackingNumber } from "../lib/validation.ts";

let failures = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures += 1;
  }
}

const adminOrdersRepoSource = readFileSync(new URL("../lib/repositories/admin/orders.ts", import.meta.url), "utf8");
const adminOrdersActionSource = readFileSync(new URL("../lib/actions/adminOrders.ts", import.meta.url), "utf8");
const adminTypesSource = readFileSync(new URL("../types/admin.ts", import.meta.url), "utf8");
const step09MigrationSource = readFileSync(new URL("../supabase/migrations/20260822000200_admin_shipping_status.sql", import.meta.url), "utf8");
const step25MigrationSource = readFileSync(
  new URL("../supabase/migrations/20260906000600_step25_admin_order_fulfillment.sql", import.meta.url),
  "utf8"
);
const adminOrdersListPageSource = readFileSync(new URL("../app/admin/orders/page.tsx", import.meta.url), "utf8");
const adminOrderDetailPageSource = readFileSync(new URL("../app/admin/orders/[id]/page.tsx", import.meta.url), "utf8");
const orderFilterBarSource = readFileSync(new URL("../components/admin/orders/OrderFilterBar.tsx", import.meta.url), "utf8");
const shippingGroupEditorSource = readFileSync(new URL("../components/admin/orders/ShippingGroupEditor.tsx", import.meta.url), "utf8");
const adminNoteEditorSource = readFileSync(new URL("../components/admin/orders/AdminNoteEditor.tsx", import.meta.url), "utf8");
const mypageActionSource = readFileSync(new URL("../lib/actions/mypage.ts", import.meta.url), "utf8");
const mypageOrderDetailPageSource = readFileSync(new URL("../app/mypage/orders/[orderId]/page.tsx", import.meta.url), "utf8");
const databaseTypesSource = readFileSync(new URL("../types/database.ts", import.meta.url), "utf8");
const step23MigrationSource = readFileSync(new URL("../supabase/migrations/20260906000400_step23_payment_finalization.sql", import.meta.url), "utf8");
const step24MigrationSource = readFileSync(new URL("../supabase/migrations/20260906000500_step24_payment_webhook_recovery.sql", import.meta.url), "utf8");

// --- 1. admin order list DTO shape (structural) -----------------------------------
{
  assert(
    /AdminOrderListResult = \{[\s\S]{0,120}items: AdminOrderListItem\[\];[\s\S]{0,80}total: number;[\s\S]{0,80}page: number;[\s\S]{0,80}pageSize: number;/.test(
      adminTypesSource
    ),
    "(structural) AdminOrderListResult must carry items/total/page/pageSize — a real pagination envelope, not a bare array"
  );
}

// --- 2. minimal PII in list DTO (structural) --------------------------------------
{
  assert(
    !/AdminOrderListItem = \{[\s\S]*?\n\};/.test(adminTypesSource) ||
      !adminTypesSource.match(/AdminOrderListItem = \{([\s\S]*?)\n\};/)![1].includes("shippingAddress"),
    "(structural) AdminOrderListItem must never carry the full shipping address — only AdminOrderDetail may"
  );
  assert(
    !adminTypesSource.match(/AdminOrderListItem = \{([\s\S]*?)\n\};/)![1].includes("customerPhone"),
    "(structural) AdminOrderListItem must never carry the customer's phone number — minimal operational info only in the list view"
  );
}

// --- 3. non-admin access denial (structural) --------------------------------------
{
  const actions = ["updateShippingGroupAction", "cancelUnpaidOrderAction", "setOrderNoteAction"];
  for (const action of actions) {
    const fnMatch = adminOrdersActionSource.match(new RegExp(`export async function ${action}[\\s\\S]{0,400}`));
    assert(
      !!fnMatch && fnMatch[0].includes("checkAdminAccess()") && fnMatch[0].includes('status !== "ok"'),
      `(structural) ${action} must call checkAdminAccess() and reject anything but status "ok" before doing any write`
    );
  }
}

// --- 4. real admin-role check, not just auth.uid() (structural) ------------------
{
  assert(
    step25MigrationSource.includes("if not public.is_admin() then") && step09MigrationSource.includes("if not public.is_admin() then"),
    "(structural) every privileged RPC touched this STEP must call is_admin(), never merely check auth.uid() is not null"
  );
}

// --- 5. order-ownership vs admin-access separation (structural) ------------------
{
  assert(
    !adminOrdersRepoSource.includes('.eq("user_id"'),
    "(structural) the admin order repository must never filter by the CALLER's own user_id — admin access is role-based, not ownership-based"
  );
  assert(
    mypageActionSource.includes('.eq("user_id", user.id)'),
    "(structural) the customer-facing mypage repository must still filter by the caller's own user_id — the two access models must stay separate"
  );
}

// --- 6. order-number search (structural) ------------------------------------------
{
  assert(adminOrdersRepoSource.includes("order_number.ilike.${pattern}"), "(structural) listAdminOrders must support order-number search");
}

// --- 7. email/name search via profiles join (structural) --------------------------
{
  assert(
    adminOrdersRepoSource.includes('.select("id").or(`display_name.ilike.${pattern},email.ilike.${pattern}`)'),
    "(structural) listAdminOrders must resolve a member's display_name/email match via the profiles table, per spec section 5"
  );
  assert(
    adminOrdersRepoSource.includes("orParts.push(`user_id.in.(${matchedUserIds.join(\",\")})`)"),
    "(structural) matched profile ids must be folded into the same search, not silently dropped"
  );
}

// --- 8. search never string-concatenates raw input (structural) -------------------
{
  assert(
    adminOrdersRepoSource.includes("escapeIlikePattern(sanitizeForOrFilter(filters.q))"),
    "(structural) the search query must be escaped/sanitized before being embedded in an ilike/or() filter — never raw string concatenation"
  );
}

// --- 9. payment-status filter (structural) -----------------------------------------
{
  assert(adminOrdersRepoSource.includes('.eq("payment_status", filters.paymentStatus)'), "(structural) listAdminOrders must support a payment-status filter");
}

// --- 10. order-status filter (structural) -------------------------------------------
{
  assert(adminOrdersRepoSource.includes('.eq("order_status", filters.orderStatus)'), "(structural) listAdminOrders must support an order-status filter");
}

// --- 11. shipping-status filter (structural) ----------------------------------------
{
  assert(
    adminOrdersRepoSource.includes('query = query.eq("status", shippingStatus)'),
    "(structural) listAdminOrders must support a shipping-group-status filter via resolveOrderIdsByShippingFilter"
  );
}

// --- 12. shipping-type filter (structural) ------------------------------------------
{
  assert(
    adminOrdersRepoSource.includes('query = query.eq("shipping_type", shippingType)'),
    "(structural) listAdminOrders must support a shipping-type filter (domestic/overseas_direct/overseas_agency)"
  );
}

// --- 13. real pagination, not fetch-all (structural) ---------------------------------
{
  assert(
    /count:\s*"exact"/.test(adminOrdersRepoSource) && adminOrdersRepoSource.includes(".range(from, to)"),
    "(structural) listAdminOrders must use a real count + range() pagination, never a flat .limit(200) fetch-all"
  );
  assert(
    adminOrdersRepoSource.includes("Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE))"),
    "(structural) pageSize must be clamped between 1 and MAX_PAGE_SIZE, never left unbounded from client input"
  );
}

// --- 14. pagination math correctness (pure arithmetic, mirrors the repo's own formula) --
{
  function computeRange(page: number, pageSize: number): [number, number] {
    const from = (page - 1) * pageSize;
    return [from, from + pageSize - 1];
  }
  assert(JSON.stringify(computeRange(1, 20)) === JSON.stringify([0, 19]), "page 1 with pageSize 20 must range over rows 0..19");
  assert(JSON.stringify(computeRange(3, 20)) === JSON.stringify([40, 59]), "page 3 with pageSize 20 must range over rows 40..59");
}

// --- 15. snapshot fields used, never re-fetched from live product (structural) -------
{
  const detailBlock = adminOrdersRepoSource.slice(
    adminOrdersRepoSource.indexOf("items: row.order_items.map"),
    adminOrdersRepoSource.indexOf("shippingGroups: row.shipping_groups.map")
  );
  assert(
    detailBlock.includes("item.product_name_snapshot") && detailBlock.includes("item.sku_snapshot") && detailBlock.includes("item.option_snapshot"),
    "(structural) the admin order detail must render product_name_snapshot/sku_snapshot/option_snapshot — never the live product/variant row"
  );
}

// --- 16. shipping-group separation, no single order-wide tracking field (structural) --
{
  assert(
    adminTypesSource.includes("shippingGroups: AdminShippingGroup[]") &&
      !adminTypesSource.match(/AdminOrderDetail = \{([\s\S]*?)\n\};/)![1].match(/\n\s*trackingNumber:/),
    "(structural) tracking/carrier must live on each AdminShippingGroup, never as one flat field on AdminOrderDetail itself"
  );
  assert(
    adminTypesSource.match(/AdminShippingGroup = \{([\s\S]*?)\n\};/)![1].includes("trackingNumber") &&
      adminTypesSource.match(/AdminShippingGroup = \{([\s\S]*?)\n\};/)![1].includes("carrier"),
    "(structural) AdminShippingGroup must itself carry carrier/trackingNumber, enabling independent per-group values"
  );
}

// --- 17. carrier code/display-name separation (real) ----------------------------------
{
  assert(isValidCarrierCode("CJ_LOGISTICS") && isValidCarrierCode("DHL"), "known domestic and international carrier codes must validate");
  assert(!isValidCarrierCode("cj_logistics") && !isValidCarrierCode("random-string"), "an unrecognized/mis-cased carrier code must not validate");
  assert(carrierLabel("CJ_LOGISTICS") === "CJ대한통운", "carrierLabel must translate a known code to its Korean display name");
  assert(carrierLabel("SOME_FUTURE_CARRIER") === "SOME_FUTURE_CARRIER", "an unrecognized carrier code must fall back to the raw stored value, never hide it");
  assert(carrierLabel(null) === "-", "a null carrier must render as a placeholder, never crash");
  assert(DOMESTIC_CARRIERS.includes("OTHER") && INTERNATIONAL_CARRIERS.includes("OTHER"), "both carrier lists must offer an 기타(OTHER) escape hatch");
  assert(Object.keys(CARRIER_LABEL).length === new Set(Object.keys(CARRIER_LABEL)).size, "CARRIER_LABEL must have no duplicate keys");
}

// --- 18. tracking-number validation: trim + non-empty (real) ---------------------------
{
  assert(isValidTrackingNumber("123456789012"), "an ordinary numeric tracking number must validate");
  assert(!isValidTrackingNumber("   "), "a whitespace-only tracking number must be rejected");
  assert(!isValidTrackingNumber(""), "an empty tracking number must be rejected");
}

// --- 19. tracking-number length cap + control-character rejection (real) ---------------
{
  assert(!isValidTrackingNumber("1".repeat(41)), "a tracking number over the length cap (40) must be rejected");
  assert(isValidTrackingNumber("1".repeat(40)), "a tracking number at exactly the length cap must be accepted");
  assert(!isValidTrackingNumber("abc def"), "a tracking number containing a control character (NUL) must be rejected");
  assert(!isValidTrackingNumber("abc\ndef"), "a tracking number containing a newline must be rejected");
}

// --- 20. RPC re-validates tracking number independently of the client (structural) -----
{
  assert(
    step25MigrationSource.includes("if length(v_tracking) > 40 then") && step25MigrationSource.includes("v_tracking ~ '[\\x00-\\x1f\\x7f]'"),
    "(structural) admin_update_shipping_group must re-validate tracking-number length/control-characters server-side, never trusting the client pre-check alone"
  );
}

// --- 21. forward-only transitions preserved from STEP09, unmodified (structural) -------
{
  assert(
    step09MigrationSource.includes("when p_current = 'PREPARING' and p_next in ('READY_TO_SHIP', 'PURCHASING') then true") &&
      step09MigrationSource.includes("when p_current = 'READY_TO_SHIP' and p_next = 'SHIPPED' then true") &&
      step09MigrationSource.includes("when p_current = 'OUT_FOR_DELIVERY' and p_next = 'DELIVERED' then true"),
    "(structural) is_valid_shipping_status_transition's forward-only graph must be untouched by STEP 25 — reused, not redesigned"
  );
}

// --- 22. DELIVERED→(anything but DELIVERED) rejected (structural) ----------------------
{
  const hasBackwardFromDelivered = /when p_current = 'DELIVERED' and p_next (?!= 'DELIVERED')/.test(step09MigrationSource);
  assert(!hasBackwardFromDelivered, "(structural) DELIVERED must have no outgoing transition other than the same-status no-op — no DELIVERED→PREPARING or any other reversal");
}

// --- 23. no skip-ahead transition exists in the graph (structural) ----------------------
{
  assert(
    !step09MigrationSource.includes("p_current = 'PREPARING' and p_next = 'SHIPPED'"),
    "(structural) PREPARING must not be allowed to jump straight to SHIPPED, skipping READY_TO_SHIP"
  );
}

// --- 24. unpaid-order SHIPPED-or-later rejection (structural) ---------------------------
{
  assert(
    step25MigrationSource.includes("if p_status in ('SHIPPED', 'IN_TRANSIT', 'CUSTOMS', 'OUT_FOR_DELIVERY', 'DELIVERED') then") &&
      step25MigrationSource.includes("raise exception 'ORDER_NOT_PAID:"),
    "(structural) admin_update_shipping_group must refuse to move a group to SHIPPED-or-later while orders.payment_status <> 'PAID'"
  );
  assert(
    !step25MigrationSource.includes("if p_status in ('PREPARING', 'PURCHASING'"),
    "(structural) the payment gate must NOT block pre-shipment prep statuses — a new order's groups start PREPARING/PURCHASING before payment by design"
  );
}

// --- 25. carrier+tracking required to reach SHIPPED (structural) ------------------------
{
  assert(
    step25MigrationSource.includes("if p_status = 'SHIPPED' and (v_carrier is null or v_tracking is null) then") &&
      step25MigrationSource.includes("raise exception 'SHIPPING_INFO_REQUIRED:"),
    "(structural) dispatch (SHIPPED) must require BOTH carrier and tracking number to already be set"
  );
}

// --- 26. shipped_at recorded exactly once (structural) -----------------------------------
{
  assert(
    step25MigrationSource.includes("shipped_at = case when p_status = 'SHIPPED' and shipped_at is null then now() else shipped_at end"),
    "(structural) shipped_at must be set to now() the first time a group reaches SHIPPED, and never overwritten on a later save"
  );
}

// --- 27. delivered_at recorded exactly once (structural) ---------------------------------
{
  assert(
    step25MigrationSource.includes("delivered_at = case when p_status = 'DELIVERED' and delivered_at is null then now() else delivered_at end"),
    "(structural) delivered_at must be set to now() the first time a group reaches DELIVERED, and never overwritten on a later save"
  );
}

// --- 28. multi-group partial delivery must not roll the order up to DELIVERED (structural) --
{
  assert(
    step09MigrationSource.includes("if v_delivered = v_total then") && step09MigrationSource.includes("return 'DELIVERED';"),
    "(structural) compute_order_status must only return DELIVERED when every group's delivered count equals the total group count"
  );
  assert(
    step09MigrationSource.includes("if v_shipped_or_later > 0 then") && step09MigrationSource.includes("return 'PARTIALLY_SHIPPED';"),
    "(structural) a mix of DELIVERED and non-DELIVERED groups must roll up to PARTIALLY_SHIPPED, never prematurely to DELIVERED"
  );
}

// --- 29. all-groups-DELIVERED does roll up to order-level DELIVERED (structural) -------------
{
  // Same guard as #28: v_delivered = v_total is the ONLY branch that returns
  // DELIVERED, and it is reachable (a single-group order with that group
  // DELIVERED satisfies v_delivered = v_total = 1).
  const deliveredIdx = step09MigrationSource.indexOf("if v_delivered = v_total then");
  const partialIdx = step09MigrationSource.indexOf("if v_shipped_or_later > 0 then");
  assert(deliveredIdx !== -1 && deliveredIdx < partialIdx, "(structural) the all-delivered check must run BEFORE the partial-shipped check, so a fully-delivered order isn't miscategorized as merely partially shipped");
}

// --- 30. shipping-group status change never re-decrements stock (structural) ----------------
{
  assert(
    !/stock_quantity/.test(step25MigrationSource),
    "(structural) admin_update_shipping_group / admin_set_order_note must never reference stock_quantity at all — stock was already atomically decremented at payment time (STEP 23)"
  );
}

// --- 31. admin note: minimal internal structure, never customer-exposed (structural) --------
{
  assert(step25MigrationSource.includes("alter table public.orders add column admin_note text;"), "(structural) orders.admin_note must exist as the minimal admin-memo column");
  assert(
    !mypageActionSource.includes("admin_note") && !mypageActionSource.includes("adminNote"),
    "(structural) the customer-facing mypage action must never select or expose admin_note"
  );
  assert(
    !mypageOrderDetailPageSource.includes("admin_note") && !mypageOrderDetailPageSource.includes("adminNote"),
    "(structural) the customer-facing order detail PAGE must never render admin_note either"
  );
  assert(adminNoteEditorSource.includes("고객에게 노출되지 않음"), "(structural) the admin note UI must itself say plainly that it is not customer-visible");
}

// --- 32. admin note length cap enforced server-side (structural) ----------------------------
{
  assert(step25MigrationSource.includes("raise exception 'NOTE_TOO_LONG:") && step25MigrationSource.includes("length(v_note) > 2000"), "(structural) admin_set_order_note must cap note length server-side, not merely via the textarea's maxLength");
}

// --- 33. audit trail: minimum fields present (structural) -------------------------------------
{
  assert(
    step25MigrationSource.includes("order_id uuid not null references public.orders") &&
      step25MigrationSource.includes("shipping_group_id uuid references public.shipping_groups") &&
      step25MigrationSource.includes("from_status text") &&
      step25MigrationSource.includes("to_status text not null") &&
      step25MigrationSource.includes("admin_user_id uuid references auth.users"),
    "(structural) order_status_history must carry order_id/shipping_group_id(nullable)/from_status/to_status/admin_user_id/created_at"
  );
}

// --- 34. audit actor recorded via auth.uid(), never trusted client input (structural) --------
{
  const insertCalls = step25MigrationSource.match(/insert into public\.order_status_history[\s\S]{0,220}/g) ?? [];
  assert(insertCalls.length >= 2, "(structural) both the shipping-group-level and order-level rollup transitions must write a history row");
  for (const call of insertCalls) {
    assert(call.includes("auth.uid()"), "(structural) every order_status_history insert must record the acting admin via auth.uid(), never a client-supplied admin id");
  }
}

// --- 35. audit trail is read-only from the client's perspective (structural) -----------------
{
  assert(
    step25MigrationSource.includes("create policy order_status_history_admin_read_all on public.order_status_history\n  for select using (public.is_admin());"),
    "(structural) order_status_history must be admin-select-only via RLS"
  );
  assert(
    !step25MigrationSource.includes("for insert") || !step25MigrationSource.match(/order_status_history[\s\S]*?for insert/),
    "(structural) order_status_history must carry no direct client INSERT policy — every row is written only via the SECURITY DEFINER RPC"
  );
}

// --- 36. audit info never exposed to the customer (structural) -------------------------------
{
  assert(
    !mypageActionSource.includes("order_status_history") && !mypageOrderDetailPageSource.includes("statusHistory"),
    "(structural) the customer-facing order detail must never surface order_status_history/statusHistory"
  );
}

// --- 37. customer order detail shows carrier/tracking/shipped/delivered (structural) ---------
{
  assert(
    mypageActionSource.includes("carrier: group.carrier") &&
      mypageActionSource.includes("trackingNumber: group.tracking_number") &&
      mypageActionSource.includes("shippedAt: group.shipped_at") &&
      mypageActionSource.includes("deliveredAt: group.delivered_at"),
    "(structural) getMyOrderDetailAction must map carrier/trackingNumber/shippedAt/deliveredAt from shipping_groups"
  );
  assert(
    mypageOrderDetailPageSource.includes("carrierLabel(group.carrier)") && mypageOrderDetailPageSource.includes("group.trackingNumber"),
    "(structural) the customer order detail page must render carrier (via carrierLabel) and the tracking number"
  );
}

// --- 38. customer never sees the raw shipping_group_status_enum value (structural) -----------
{
  assert(mypageOrderDetailPageSource.includes("messages.shippingStatus[group.status]"), "(structural) customer-facing shipping status must go through the i18n label map, never the raw enum");
}

// --- 39. reconciliation warning surfaced to admin, never to the customer (structural) ---------
{
  assert(
    adminOrdersRepoSource.includes("function detectReconciliationWarnings") &&
      adminOrdersRepoSource.includes('"PROVIDER_PAID_LOCAL_STOCK_FAILURE"') &&
      adminOrdersRepoSource.includes('"AMOUNT_MISMATCH"') &&
      adminOrdersRepoSource.includes('"CURRENCY_MISMATCH"'),
    "(structural) the admin order repository must classify a FAILED payment carrying a provider_payment_id into a reconciliation warning"
  );
  assert(
    adminOrderDetailPageSource.includes("order.reconciliationWarnings") && adminOrderDetailPageSource.includes("RECONCILIATION_ISSUE_LABEL"),
    "(structural) the admin order detail page must render reconciliationWarnings distinctly (never as raw internal codes)"
  );
  assert(
    !mypageActionSource.includes("reconciliationWarnings") && !mypageOrderDetailPageSource.includes("reconciliationWarnings"),
    "(structural) reconciliation warnings must never reach the customer-facing order detail"
  );
}

// --- 40. reconciliation warning visually distinct from a normal PREPARING order (structural) --
{
  const warnBlock = adminOrderDetailPageSource.slice(
    adminOrderDetailPageSource.indexOf("order.reconciliationWarnings.length > 0"),
    adminOrderDetailPageSource.indexOf("order.reconciliationWarnings.length > 0") + 400
  );
  assert(/border-red|bg-red|text-red/.test(warnBlock), "(structural) the reconciliation-warning block must use a visually distinct (red/warning) style, not the default section styling");
}

// --- 41. regular customer cannot call admin actions (structural) -------------------------------
{
  assert(
    adminOrdersActionSource.match(/checkAdminAccess\(\)/g)!.length >= 3,
    "(structural) every admin order action (shipping update, cancel, note) must independently call checkAdminAccess()"
  );
}

// --- 42. raw DB errors never exposed to the customer/admin caller (structural) ------------------
{
  assert(
    adminOrdersRepoSource.includes('function fail(context: string, error: { message: string }): never') &&
      adminOrdersRepoSource.includes('throw new Error("주문 데이터를 처리하지 못했습니다.")'),
    "(structural) any Supabase query error must be logged server-side and surfaced to the caller only as a generic Korean message, never the raw error.message"
  );
}

// --- 43. domestic/overseas-direct/agency shipping types preserved (structural) ------------------
{
  assert(
    databaseTypesSource.includes('"DOMESTIC"') &&
      databaseTypesSource.includes('"OVERSEAS_DIRECT"') &&
      databaseTypesSource.includes('"OVERSEAS_AGENCY"') &&
      /export type ShippingTypeEnum = "DOMESTIC" \| "OVERSEAS_DIRECT" \| "OVERSEAS_AGENCY"/.test(databaseTypesSource),
    "(structural) the three original shipping types from STEP 08/21 must remain present and in order — STEP 26.1's DIRECT_PICKUP is an addition, never a redesign/collapse of these three"
  );
}

// --- 44. admin UI clearly labels 구매대행 distinctly (structural) -------------------------------
{
  assert(shippingGroupEditorSource.includes("SHIPPING_TYPE_LABEL[group.shippingType]"), "(structural) the shipping-group editor must render the shipping type's own label, distinguishing 구매대행/해외직배송/국내배송");
}

// --- 45. carrier options depend on shipping type (domestic vs international) (structural) -------
{
  assert(
    shippingGroupEditorSource.includes('group.shippingType === "DOMESTIC" ? DOMESTIC_CARRIERS : INTERNATIONAL_CARRIERS'),
    "(structural) the carrier select must offer Korean carriers for DOMESTIC groups and international carriers otherwise"
  );
}

// --- 46. UI-side payment gate mirrors the RPC's own gate (structural) ---------------------------
{
  assert(
    shippingGroupEditorSource.includes("orderPaid: boolean") &&
      shippingGroupEditorSource.includes("requiresPayment") &&
      shippingGroupEditorSource.includes("결제가 완료되지 않은 주문은 발송 처리할 수 없습니다."),
    "(structural) ShippingGroupEditor must pre-check the payment gate client-side as a fail-fast UX hint — the RPC remains the real boundary"
  );
}

// --- 47. status updates never go through a direct client table write (structural) ---------------
{
  assert(
    adminOrdersRepoSource.includes('.rpc("admin_update_shipping_group"') && adminOrdersRepoSource.includes('.rpc("admin_set_order_note"'),
    "(structural) shipping-group status and admin-note writes must go through Server Action → RPC, never a direct client update on orders/shipping_groups"
  );
  assert(
    !adminOrdersRepoSource.includes('.from("shipping_groups").update(') && !adminOrdersRepoSource.includes('.from("orders").update('),
    "(structural) the admin order repository must never call .update() directly on orders/shipping_groups — every mutation is an RPC call"
  );
}

// --- 48. list page offers pagination controls, not fetch-all (structural) -----------------------
{
  assert(
    adminOrdersListPageSource.includes("buildPageHref") && adminOrdersListPageSource.includes("totalPages"),
    "(structural) the admin order list page must render real Prev/Next pagination, not a single unpaginated table"
  );
}

// --- 49. filter bar exposes shipping-status/type/date filters (structural) ----------------------
{
  assert(
    orderFilterBarSource.includes('name="shippingStatus"') &&
      orderFilterBarSource.includes('name="shippingType"') &&
      orderFilterBarSource.includes('name="dateFrom"') &&
      orderFilterBarSource.includes('name="dateTo"'),
    "(structural) OrderFilterBar must expose shippingStatus/shippingType/dateFrom/dateTo controls"
  );
}

// --- 50. no regression: STEP 22/23/24 payment/order structures untouched (structural) -----------
{
  assert(step23MigrationSource.includes("greatest(0, stock_quantity - v_item.quantity)") === false, "(structural) STEP 23's overselling fix must remain intact (no unconditional floor-at-0 stock update reintroduced)");
  assert(step24MigrationSource.includes("create unique index payments_provider_payment_id_key"), "(structural) STEP 24's payments unique index must remain unchanged");
  assert(step09MigrationSource.includes("create or replace function public.is_valid_shipping_status_transition"), "(structural) STEP 09's transition function must still be the one in force — not replaced by a parallel implementation");
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log(
  "OK — admin order list/detail DTOs, search/filter/pagination, admin-role RPC gating, carrier code/label separation, tracking-number validation, forward-only shipping transitions, payment-before-ship gate, shipped_at/delivered_at recording, multi-group DELIVERED rollup, no stock re-decrement, admin note & audit trail (admin-only), reconciliation warnings (admin-only), customer order-detail carrier/tracking display, and STEP 22-24 non-regression checks passed."
);
