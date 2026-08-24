"use client";

import { useState } from "react";
import { updateShippingGroupAction } from "@/lib/actions/adminOrders";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { NEXT_SHIPPING_STATUSES, SHIPPING_GROUP_STATUS_LABEL, SHIPPING_TYPE_LABEL } from "@/lib/adminLabels";
import { carrierLabel, DOMESTIC_CARRIERS, INTERNATIONAL_CARRIERS } from "@/lib/shipping/carriers";
import { isValidTrackingNumber } from "@/lib/validation";
import type { AdminShippingGroup } from "@/types/admin";

export function ShippingGroupEditor({ orderId, group, orderPaid }: { orderId: string; group: AdminShippingGroup; orderPaid: boolean }) {
  const [status, setStatus] = useState(group.status);
  const [nextStatus, setNextStatus] = useState("");
  const [carrier, setCarrier] = useState(group.carrier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(group.trackingNumber ?? "");
  const [shippedAt, setShippedAt] = useState(group.shippedAt);
  const [deliveredAt, setDeliveredAt] = useState(group.deliveredAt);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // STEP 26.1 — a DIRECT_PICKUP group only ever offers its own
  // READY_FOR_PICKUP/PICKED_UP branch, never the courier statuses (and vice
  // versa) — the RPC's is_valid_shipping_status_transition remains the real
  // boundary regardless; this filter only avoids presenting a confusing menu.
  const isPickup = group.shippingType === "DIRECT_PICKUP";
  const options = NEXT_SHIPPING_STATUSES[status].filter((next) =>
    isPickup ? next === "READY_FOR_PICKUP" || next === "PICKED_UP" : next !== "READY_FOR_PICKUP" && next !== "PICKED_UP"
  );
  const carrierOptions = group.shippingType === "DOMESTIC" ? DOMESTIC_CARRIERS : INTERNATIONAL_CARRIERS;
  const targetStatus = nextStatus || status;
  const requiresShippingInfo = targetStatus === "SHIPPED";
  const requiresPayment = ["SHIPPED", "IN_TRANSIT", "CUSTOMS", "OUT_FOR_DELIVERY", "DELIVERED", "PICKED_UP"].includes(targetStatus);

  async function handleSave() {
    setError(null);
    setSaved(false);

    // Client-side pre-check only (fail-fast UX) — admin_update_shipping_group
    // itself re-validates all of this server-side and is the real boundary.
    if (requiresShippingInfo && (!carrier.trim() || !trackingNumber.trim())) {
      setError("발송 처리하려면 운송사와 송장번호를 입력해야 합니다.");
      return;
    }
    if (trackingNumber.trim() && !isValidTrackingNumber(trackingNumber)) {
      setError("송장번호 형식이 올바르지 않습니다.");
      return;
    }
    if (requiresPayment && !orderPaid) {
      setError(isPickup ? "결제가 완료되지 않은 주문은 수령 완료 처리할 수 없습니다." : "결제가 완료되지 않은 주문은 발송 처리할 수 없습니다.");
      return;
    }

    setPending(true);
    const result = await updateShippingGroupAction(orderId, {
      shippingGroupId: group.id,
      status: targetStatus,
      carrier: carrier || null,
      trackingNumber: trackingNumber || null,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (nextStatus) {
      setStatus(nextStatus as typeof status);
      setNextStatus("");
      if ((nextStatus === "SHIPPED" || nextStatus === "READY_FOR_PICKUP") && !shippedAt) setShippedAt(new Date().toISOString());
      if ((nextStatus === "DELIVERED" || nextStatus === "PICKED_UP") && !deliveredAt) setDeliveredAt(new Date().toISOString());
    }
    setSaved(true);
  }

  return (
    <div className="border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-text-main">
            {group.destinationCountry} | {SHIPPING_TYPE_LABEL[group.shippingType] ?? group.shippingType}
          </p>
          <p className="text-xs text-text-secondary">{group.itemIds.length}개 상품</p>
        </div>
        <StatusBadge label={SHIPPING_GROUP_STATUS_LABEL[status]} tone="primary" />
      </div>

      {!orderPaid && (
        <p className="mt-2 text-xs text-red-600">
          {isPickup ? "결제 완료 전에는 수령 완료(PICKED_UP) 처리할 수 없습니다." : "결제 완료 전에는 발송 처리(SHIPPED 이상)로 변경할 수 없습니다."}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          {isPickup ? "수령상태 변경" : "배송상태 변경"}
          <select
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value)}
            disabled={options.length === 0}
            className="w-40 border border-border px-2 py-1.5 text-sm outline-none"
          >
            <option value="">{options.length === 0 ? "변경 불가(최종 상태)" : "선택"}</option>
            {options.map((value) => (
              <option key={value} value={value}>
                {SHIPPING_GROUP_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        {/* STEP 26.1 spec section 5 — a DIRECT_PICKUP group never shows carrier/tracking inputs: there is no courier. */}
        {!isPickup && (
          <>
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              운송사
              <select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="w-36 border border-border px-2 py-1.5 text-sm outline-none"
              >
                <option value="">선택</option>
                {carrierOptions.map((code) => (
                  <option key={code} value={code}>
                    {carrierLabel(code)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              송장번호
              <input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                maxLength={40}
                className="w-40 border border-border px-2 py-1.5 text-sm outline-none"
              />
            </label>
          </>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="h-[34px] bg-primary px-4 text-sm font-bold text-white disabled:bg-border"
        >
          {pending ? "저장 중..." : "저장"}
        </button>
      </div>

      {(shippedAt || deliveredAt) && (
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-text-secondary">
          {shippedAt && <span>{isPickup ? "수령준비일시" : "발송일시"}: {new Date(shippedAt).toLocaleString("ko-KR")}</span>}
          {deliveredAt && <span>{isPickup ? "수령완료일시" : "배송완료일시"}: {new Date(deliveredAt).toLocaleString("ko-KR")}</span>}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {saved && !error && <p className="mt-2 text-xs text-primary">저장되었습니다.</p>}
    </div>
  );
}
