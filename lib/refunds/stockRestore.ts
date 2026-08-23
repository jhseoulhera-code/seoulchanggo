// Pure — mirrors admin_finalize_refund's stock-restore eligibility check
// (supabase/migrations/20260906000700_step26_refunds.sql) so the same
// PREPARING/PURCHASING/READY_TO_SHIP vs SHIPPED-or-later boundary can be unit
// tested directly, without needing a live DB. The SQL function is the real
// enforcement point; this is a testable mirror, not a second enforcement path.
import type { ShippingGroupStatusEnum } from "@/types/database";

const PRE_SHIPMENT_STATUSES: ReadonlySet<ShippingGroupStatusEnum> = new Set(["PREPARING", "PURCHASING", "READY_TO_SHIP"]);

/**
 * STEP 26 spec section 18/20/21 — true only while the item's shipping group
 * has not yet progressed past preparation, i.e. the physical stock is still
 * in the warehouse. SHIPPED/IN_TRANSIT/CUSTOMS/OUT_FOR_DELIVERY/DELIVERED
 * must never auto-restore stock — a real return/receiving workflow is out
 * of this STEP's scope.
 */
export function isPreShipmentStatus(status: ShippingGroupStatusEnum): boolean {
  return PRE_SHIPMENT_STATUSES.has(status);
}

/** A group is eligible for automatic stock restore only if NONE of its (normally exactly one) shipping groups have progressed past pre-shipment. */
export function canAutoRestoreStock(groupStatuses: ShippingGroupStatusEnum[]): boolean {
  return groupStatuses.every(isPreShipmentStatus);
}
