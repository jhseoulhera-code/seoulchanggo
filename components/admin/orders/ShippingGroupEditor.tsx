"use client";

import { useState } from "react";
import { updateShippingGroupAction } from "@/lib/actions/adminOrders";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { NEXT_SHIPPING_STATUSES, SHIPPING_GROUP_STATUS_LABEL, SHIPPING_TYPE_LABEL } from "@/lib/adminLabels";
import type { AdminShippingGroup } from "@/types/admin";

export function ShippingGroupEditor({ orderId, group }: { orderId: string; group: AdminShippingGroup }) {
  const [status, setStatus] = useState(group.status);
  const [nextStatus, setNextStatus] = useState("");
  const [carrier, setCarrier] = useState(group.carrier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(group.trackingNumber ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const options = NEXT_SHIPPING_STATUSES[status];

  async function handleSave() {
    setPending(true);
    setError(null);
    setSaved(false);
    const result = await updateShippingGroupAction(orderId, {
      shippingGroupId: group.id,
      status: nextStatus || status,
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

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          배송상태 변경
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
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          운송사
          <input
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className="w-36 border border-border px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          송장번호
          <input
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            className="w-40 border border-border px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="h-[34px] bg-primary px-4 text-sm font-bold text-white disabled:bg-border"
        >
          {pending ? "저장 중..." : "저장"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {saved && !error && <p className="mt-2 text-xs text-primary">저장되었습니다.</p>}
    </div>
  );
}
