/**
 * STEP 26.1 spec section 11 — framework-free test script (same convention as
 * every prior scripts/test-*.mts in this project). lib/shipping.ts,
 * lib/checkout.ts, lib/cart.ts, lib/refunds/stockRestore.ts,
 * lib/admin/csvImport.ts, and lib/repositories/products.ts are plain,
 * Node-testable modules (no "server-only" import), so their real logic is
 * exercised directly; the migration SQL and the admin/customer UI
 * components are verified structurally (readFileSync + regex/substring),
 * exactly like every prior STEP's shipping/status-transition checks in this
 * session.
 *
 * Run with: node --experimental-strip-types scripts/test-direct-pickup.mts
 */
import { readFileSync } from "node:fs";
import { getBaseShippingFeeKrw } from "../lib/shipping.ts";
import { groupLinesByShippingType } from "../lib/cart.ts";
import { canAutoRestoreStock, isPreShipmentStatus } from "../lib/refunds/stockRestore.ts";
import { validateCsvRows } from "../lib/admin/csvImport.ts";
import type { Product } from "../types/index.ts";
import type { CartLineView } from "../types/cart.ts";

let failures = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures += 1;
  }
}

function makeProduct(overrides: Record<string, unknown> = {}): Product {
  return {
    id: "p1",
    name: "테스트 상품",
    category: "misc",
    image: "",
    salePrice: 10000,
    originalPrice: 10000,
    rating: 0,
    reviewCount: 0,
    shippingType: "domestic",
    shippingLabel: "국내출고",
    freeShipping: false,
    ...overrides,
  } as unknown as Product;
}

const migrationEnumSource = readFileSync(new URL("../supabase/migrations/20260906000800_step26_1_direct_pickup.sql", import.meta.url), "utf8");
const migrationLogicSource = readFileSync(
  new URL("../supabase/migrations/20260906000900_step26_1_direct_pickup_logic.sql", import.meta.url),
  "utf8"
);
const step09MigrationSource = readFileSync(new URL("../supabase/migrations/20260822000200_admin_shipping_status.sql", import.meta.url), "utf8");
const step22MigrationSource = readFileSync(new URL("../supabase/migrations/20260906000300_step22_order_snapshot.sql", import.meta.url), "utf8");
const wizardStepSource = readFileSync(
  new URL("../components/admin/products/wizard/steps/StepSupplyShipping.tsx", import.meta.url),
  "utf8"
);
const shippingGroupEditorSource = readFileSync(new URL("../components/admin/orders/ShippingGroupEditor.tsx", import.meta.url), "utf8");
const mypageOrderDetailPageSource = readFileSync(new URL("../app/mypage/orders/[orderId]/page.tsx", import.meta.url), "utf8");
const checkoutClientSource = readFileSync(new URL("../components/checkout/CheckoutClient.tsx", import.meta.url), "utf8");
const adminLabelsSource = readFileSync(new URL("../lib/adminLabels.ts", import.meta.url), "utf8");

// --- 1. 직접수령 상품 등록 (structural: wizard + CSV both support it) ------------------------
{
  assert(wizardStepSource.includes('<option value="DIRECT_PICKUP">직접수령</option>'), "(structural) the product wizard's 배송방식 select must offer DIRECT_PICKUP");
  const categories = new Map([["kitchen", "cat-1"]]);
  const header = ["sku", "name_ko", "name_en", "category", "supply_type", "shipping_method", "price_krw", "price_inr", "price_usd", "stock_mode", "stock_quantity"];
  const row = ["SKU-1", "테스트", "Test", "kitchen", "DOMESTIC_STOCK", "DIRECT_PICKUP", "10000", "", "", "TRACKED", "5"];
  const [result] = validateCsvRows(header, [row], categories);
  assert(result.errors.length === 0 && result.parsed?.shipping.shippingType === "DIRECT_PICKUP", "CSV import must accept shipping_method=DIRECT_PICKUP and resolve it to shippingType DIRECT_PICKUP");
}

// --- 2. DIRECT_PICKUP 배송비 0 (real) --------------------------------------------------------
{
  const pickupProduct = makeProduct({ shippingType: "direct_pickup" });
  assert(getBaseShippingFeeKrw(pickupProduct, "KR") === 0, "a direct_pickup product's base shipping fee must be 0 in KR");
  assert(getBaseShippingFeeKrw(pickupProduct, "IN") === 0, "a direct_pickup product's base shipping fee must be 0 in IN");
}

// --- 2b. 클라이언트/관리자 입력을 신뢰하지 않음 — per-market override도 0으로 강제 (real) -----------
{
  const pickupWithOverride = makeProduct({
    shippingType: "direct_pickup",
    shippingFees: { KR: 5000, IN: 3000 },
  });
  assert(
    getBaseShippingFeeKrw(pickupWithOverride, "KR") === 0,
    "a direct_pickup product must ignore a stray non-zero per-market shipping fee override — never trusted, always 0"
  );
}

// --- 3. 다른 배송방법과 mixed cart (real) -----------------------------------------------------
{
  const domesticLine = { product: makeProduct({ id: "p1", shippingType: "domestic" }) } as unknown as CartLineView;
  const pickupLine = { product: makeProduct({ id: "p2", shippingType: "direct_pickup" }) } as unknown as CartLineView;
  const groups = groupLinesByShippingType([domesticLine, pickupLine]);
  assert(groups.length === 2, `a mixed domestic+direct_pickup cart must split into 2 groups, got ${groups.length}`);
  assert(groups.some((g) => g.shippingType === "direct_pickup" && g.lines.length === 1), "the direct_pickup group must contain exactly the pickup line");
  assert(groups.some((g) => g.shippingType === "domestic" && g.lines.length === 1), "the domestic group must still contain exactly the domestic line, unaffected by the pickup group");
}

// --- 4. 직접수령 shipping group 생성 (structural — create_order's grouping key is generic) --------
{
  assert(migrationLogicSource.includes("v_group_key := v_product.shipping_type::text;"), "(structural) create_order must still key shipping groups by shipping_type generically — no special-case branch needed for DIRECT_PICKUP to get its own group");
  assert(
    migrationLogicSource.includes("if v_product.shipping_type = 'DIRECT_PICKUP' then") && migrationLogicSource.includes("v_base_shipping_fee_krw := 0;"),
    "(structural) create_order must force a DIRECT_PICKUP item's fee to 0 BEFORE checking free_shipping/the per-market override"
  );
  assert(
    migrationLogicSource.indexOf("if v_product.shipping_type = 'DIRECT_PICKUP' then") <
      migrationLogicSource.indexOf("elsif v_product.free_shipping then"),
    "(structural) the DIRECT_PICKUP fee guard must run before the free_shipping/override branches, not after"
  );
}

// --- 5. 관리자 화면에서 carrier/tracking 불필요 (structural) --------------------------------------
{
  assert(shippingGroupEditorSource.includes('const isPickup = group.shippingType === "DIRECT_PICKUP";'), "(structural) ShippingGroupEditor must detect a DIRECT_PICKUP group");
  assert(shippingGroupEditorSource.includes("{!isPickup && (") , "(structural) the carrier/tracking inputs must be conditionally hidden for a pickup group");
}

// --- 6. 고객 화면에서 배송조회 대신 직접수령 표시 (structural) -------------------------------------
{
  assert(mypageOrderDetailPageSource.includes('const isPickup = type === "direct_pickup";'), "(structural) the customer order detail page must branch on direct_pickup");
  assert(mypageOrderDetailPageSource.includes("수령 준비일시") && mypageOrderDetailPageSource.includes("수령완료일시"), "(structural) a pickup group must show 수령 준비/완료 wording, never 발송/배송완료 courier wording");
  assert(!/isPickup[\s\S]{0,300}운송사/.test(mypageOrderDetailPageSource), "(structural) the pickup branch must never render a 운송사(carrier) label");
}

// --- 7. 수령 전 환불 재고복원 (real) -----------------------------------------------------------
{
  assert(isPreShipmentStatus("READY_FOR_PICKUP"), "READY_FOR_PICKUP must be eligible for automatic stock restore — the item is still in the store");
  assert(canAutoRestoreStock(["PREPARING", "READY_FOR_PICKUP"]), "a pickup order with only pre-pickup groups must be fully restore-eligible");
}

// --- 8. 수령 후 환불 자동 재고복원 금지 (real) --------------------------------------------------
{
  assert(!isPreShipmentStatus("PICKED_UP"), "PICKED_UP must never be eligible for automatic stock restore — the customer already has the item");
  assert(!canAutoRestoreStock(["READY_FOR_PICKUP", "PICKED_UP"]), "a mix including a PICKED_UP group must disqualify the whole set from automatic restore");
  assert(
    migrationLogicSource.includes("sg.status not in ('PREPARING', 'PURCHASING', 'READY_TO_SHIP', 'READY_FOR_PICKUP')"),
    "(structural) admin_finalize_refund's stock-restore eligibility check must include READY_FOR_PICKUP in the pre-fulfillment allow-list, and exclude PICKED_UP by omission"
  );
}

// --- 9. 기존 배송방법 회귀 없음 (real + structural) -----------------------------------------------
{
  const domesticProduct = makeProduct({ shippingType: "domestic" });
  const overseasDirect = makeProduct({ shippingType: "overseas_direct" });
  const overseasAgent = makeProduct({ shippingType: "overseas_agent" });
  assert(getBaseShippingFeeKrw(domesticProduct, "KR") === 3000, "domestic shipping fee default must remain 3000 KRW");
  assert(getBaseShippingFeeKrw(overseasDirect, "KR") === 5000, "overseas_direct shipping fee default must remain 5000 KRW");
  assert(getBaseShippingFeeKrw(overseasAgent, "KR") === 6000, "overseas_agent shipping fee default must remain 6000 KRW");
  assert(isPreShipmentStatus("PREPARING") && isPreShipmentStatus("PURCHASING") && isPreShipmentStatus("READY_TO_SHIP"), "the original three pre-shipment statuses must remain restore-eligible, unchanged");
  assert(!isPreShipmentStatus("SHIPPED") && !isPreShipmentStatus("DELIVERED"), "the original post-shipment statuses must remain non-restore-eligible, unchanged");
}

// --- 10. 배송그룹 상태 전이 그래프 (structural) ------------------------------------------------------
{
  assert(
    migrationLogicSource.includes("when p_current = 'PREPARING' and p_next in ('READY_TO_SHIP', 'PURCHASING', 'READY_FOR_PICKUP') then true"),
    "(structural) PREPARING must gain a new edge to READY_FOR_PICKUP, alongside its existing courier/agency edges"
  );
  assert(
    migrationLogicSource.includes("when p_current = 'READY_FOR_PICKUP' and p_next = 'PICKED_UP' then true"),
    "(structural) READY_FOR_PICKUP must have exactly one forward edge, to PICKED_UP"
  );
  assert(
    step09MigrationSource.includes("when p_current = 'READY_TO_SHIP' and p_next = 'SHIPPED' then true"),
    "(structural) the original courier transition graph in the STEP 09 migration file itself must remain completely untouched (past migrations are never edited)"
  );
  assert(
    !migrationLogicSource.includes("when p_current = 'PICKED_UP' and p_next"),
    "(structural) PICKED_UP must have no outgoing edge other than the generic same-status no-op — a terminal state, just like DELIVERED"
  );
}

// --- 11. 결제 전 수령완료 금지 — payment gate (structural) -----------------------------------------
{
  assert(
    migrationLogicSource.includes("if p_status in ('SHIPPED', 'IN_TRANSIT', 'CUSTOMS', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PICKED_UP') then"),
    "(structural) admin_update_shipping_group's payment-before-ship gate must also cover PICKED_UP — releasing pickup goods requires payment"
  );
  assert(
    !migrationLogicSource.match(/if p_status in \([^)]*READY_FOR_PICKUP[^)]*\) then\s*\n\s*select payment_status/),
    "(structural) READY_FOR_PICKUP itself must stay ungated — a group can reach it before payment, same as READY_TO_SHIP"
  );
}

// --- 12. 발송/수령 타임스탬프 재사용 (structural) --------------------------------------------------
{
  assert(
    migrationLogicSource.includes("shipped_at = case when p_status in ('SHIPPED', 'READY_FOR_PICKUP') and shipped_at is null then now() else shipped_at end"),
    "(structural) shipped_at must be reused generically for a pickup group's own READY_FOR_PICKUP milestone"
  );
  assert(
    migrationLogicSource.includes("delivered_at = case when p_status in ('DELIVERED', 'PICKED_UP') and delivered_at is null then now() else delivered_at end"),
    "(structural) delivered_at must be reused generically for a pickup group's own PICKED_UP milestone"
  );
}

// --- 13. 주문 전체 상태 롤업 — compute_order_status (structural) -----------------------------------
{
  assert(
    migrationLogicSource.includes("select count(*) into v_delivered from unnest(p_group_statuses) s where s in ('DELIVERED', 'PICKED_UP');"),
    "(structural) compute_order_status must count PICKED_UP toward the fully-delivered bucket, alongside DELIVERED"
  );
  assert(
    migrationLogicSource.includes(
      "where s in ('SHIPPED', 'IN_TRANSIT', 'CUSTOMS', 'OUT_FOR_DELIVERY', 'DELIVERED', 'READY_FOR_PICKUP', 'PICKED_UP');"
    ),
    "(structural) compute_order_status must count READY_FOR_PICKUP/PICKED_UP toward the shipped-or-later bucket, so a mixed order doesn't misreport PREPARING"
  );
}

// --- 14. 고객 체크아웃 — 직접수령이 해외/통관 취급되지 않음 (structural, real bug fix) -----------------
{
  assert(
    checkoutClientSource.includes(
      'const hasOverseasItem = availableItems.some((item) => item.shippingType === "overseas_direct" || item.shippingType === "overseas_agent");'
    ),
    "(structural) hasOverseasItem must be an ALLOWLIST (overseas_direct/overseas_agent only), never a '!== domestic' denylist that would misclassify direct_pickup as needing a customs code"
  );
}

// --- 15. checkout 그룹핑에 direct_pickup 포함 (structural — lib/checkout.ts uses @/-aliased
//     imports Node can't resolve directly, same limitation test-checkout-shipping.mts already
//     works around by testing lib/cart.ts's identical GROUP_ORDER pattern instead; verified here
//     structurally since it's the one other place the same grouping array is duplicated) --------
{
  const checkoutSource = readFileSync(new URL("../lib/checkout.ts", import.meta.url), "utf8");
  assert(
    checkoutSource.includes('const GROUP_ORDER: ShippingType[] = ["domestic", "overseas_direct", "overseas_agent", "direct_pickup"];'),
    "(structural) lib/checkout.ts's GROUP_ORDER must include direct_pickup so a pickup-only checkout group is never silently dropped"
  );
}

// --- 16. enum 추가가 분리된 migration에 있음 — 안전한 ALTER TYPE 패턴 (structural) -----------------------
{
  assert(migrationEnumSource.includes("alter type public.shipping_type_enum add value 'DIRECT_PICKUP';"), "(structural) DIRECT_PICKUP must be added via ALTER TYPE ... ADD VALUE in its own migration file");
  assert(
    migrationEnumSource.includes("alter type public.shipping_group_status_enum add value 'READY_FOR_PICKUP';") &&
      migrationEnumSource.includes("alter type public.shipping_group_status_enum add value 'PICKED_UP';"),
    "(structural) READY_FOR_PICKUP/PICKED_UP must both be added via ALTER TYPE ... ADD VALUE"
  );
  assert(
    !/create or replace function|create table/.test(migrationEnumSource),
    "(structural) the enum-only migration must contain NO function/table definitions that could reference the not-yet-committed enum values in the same transaction"
  );
}

// --- 17. adminLabels 라벨/전이 맵 갱신 (structural) --------------------------------------------------
{
  assert(adminLabelsSource.includes('READY_FOR_PICKUP: "수령대기"') && adminLabelsSource.includes('PICKED_UP: "수령완료"'), "(structural) SHIPPING_GROUP_STATUS_LABEL must carry Korean labels for the two new pickup statuses");
  assert(adminLabelsSource.includes('PREPARING: ["READY_TO_SHIP", "PURCHASING", "READY_FOR_PICKUP"]'), "(structural) NEXT_SHIPPING_STATUSES must mirror the RPC's new PREPARING→READY_FOR_PICKUP edge");
  assert(adminLabelsSource.includes('READY_FOR_PICKUP: ["PICKED_UP"]'), "(structural) NEXT_SHIPPING_STATUSES must mirror the RPC's READY_FOR_PICKUP→PICKED_UP edge");
  assert(adminLabelsSource.includes('DIRECT_PICKUP: "직접수령"'), "(structural) SHIPPING_TYPE_LABEL must carry a Korean label for DIRECT_PICKUP");
}

// --- 18. 과거 migration 미수정 (structural) -----------------------------------------------------------
{
  assert(
    step22MigrationSource.includes("when 'OVERSEAS_AGENCY' then 6000\n      end;") || step22MigrationSource.includes("when 'OVERSEAS_AGENCY' then 6000\n        end;"),
    "(structural) the ORIGINAL STEP 22 create_order migration file must remain exactly as it was (no DIRECT_PICKUP branch) — the fix lives only in the new STEP 26.1 migration that replaces the function"
  );
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log(
  "OK — DIRECT_PICKUP product registration (wizard + CSV), guaranteed-zero shipping fee (client input and stored per-market overrides both ignored), mixed-cart grouping, shipping-group creation reuse, admin UI carrier/tracking hiding, customer UI pickup wording, pre-/post-pickup stock-restore eligibility, forward-only READY_FOR_PICKUP/PICKED_UP transitions, payment-before-pickup gate, shipped_at/delivered_at milestone reuse, order-status rollup, the overseas/customs-code misclassification fix, safe two-file enum migration split, and existing shipping-type non-regression checks passed."
);
