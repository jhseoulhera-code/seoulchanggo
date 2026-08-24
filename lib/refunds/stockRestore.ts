// Pure — mirrors admin_finalize_refund's stock-restore eligibility check
// (supabase/migrations/20260906000700_step26_refunds.sql, extended by
// 20260906000900_step26_1_direct_pickup_logic.sql) so the same
// PREPARING/PURCHASING/READY_TO_SHIP/READY_FOR_PICKUP vs SHIPPED-or-
// later-or-PICKED_UP boundary can be unit tested directly, without needing a
// live DB. The SQL function is the real enforcement point; this is a
// testable mirror, not a second enforcement path.
import type { ShippingGroupStatusEnum } from "@/types/database";

const PRE_SHIPMENT_STATUSES: ReadonlySet<ShippingGroupStatusEnum> = new Set([
  "PREPARING",
  "PURCHASING",
  "READY_TO_SHIP",
  "READY_FOR_PICKUP",
]);

/**
 * STEP 26 spec section 18/20/21 — true only while the item's shipping group
 * has not yet progressed past preparation, i.e. the physical stock is still
 * in the warehouse/store. SHIPPED/IN_TRANSIT/CUSTOMS/OUT_FOR_DELIVERY/
 * DELIVERED/PICKED_UP (STEP 26.1) must never auto-restore stock — a real
 * return/receiving workflow is out of this STEP's scope.
 */
export function isPreShipmentStatus(status: ShippingGroupStatusEnum): boolean {
  return PRE_SHIPMENT_STATUSES.has(status);
}

/** A group is eligible for automatic stock restore only if NONE of its (normally exactly one) shipping groups have progressed past pre-shipment. */
export function canAutoRestoreStock(groupStatuses: ShippingGroupStatusEnum[]): boolean {
  return groupStatuses.every(isPreShipmentStatus);
}
