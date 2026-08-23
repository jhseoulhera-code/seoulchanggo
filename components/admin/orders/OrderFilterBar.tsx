import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, SHIPPING_GROUP_STATUS_LABEL, SHIPPING_TYPE_LABEL } from "@/lib/adminLabels";

type OrderFilterBarProps = {
  current: {
    q?: string;
    marketCode?: string;
    paymentStatus?: string;
    orderStatus?: string;
    shippingStatus?: string;
    shippingType?: string;
    dateFrom?: string;
    dateTo?: string;
  };
};

/** Plain GET form — no client JS needed; submitting just reloads the page with new searchParams (page resets to 1 via the absence of a page field). */
export function OrderFilterBar({ current }: OrderFilterBarProps) {
  return (
    <form method="GET" className="flex flex-wrap items-end gap-2 border border-border p-3">
      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        검색(주문번호/이메일/전화번호/고객명)
        <input
          type="text"
          name="q"
          defaultValue={current.q}
          className="w-56 border border-border px-2 py-1.5 text-sm text-text-main outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        Market
        <select name="marketCode" defaultValue={current.marketCode ?? ""} className="border border-border px-2 py-1.5 text-sm text-text-main">
          <option value="">전체</option>
          <option value="KR">KR</option>
          <option value="IN">IN</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        결제상태
        <select
          name="paymentStatus"
          defaultValue={current.paymentStatus ?? ""}
          className="border border-border px-2 py-1.5 text-sm text-text-main"
        >
          <option value="">전체</option>
          {Object.entries(PAYMENT_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        주문상태
        <select
          name="orderStatus"
          defaultValue={current.orderStatus ?? ""}
          className="border border-border px-2 py-1.5 text-sm text-text-main"
        >
          <option value="">전체</option>
          {Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        배송상태
        <select
          name="shippingStatus"
          defaultValue={current.shippingStatus ?? ""}
          className="border border-border px-2 py-1.5 text-sm text-text-main"
        >
          <option value="">전체</option>
          {Object.entries(SHIPPING_GROUP_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        배송유형
        <select
          name="shippingType"
          defaultValue={current.shippingType ?? ""}
          className="border border-border px-2 py-1.5 text-sm text-text-main"
        >
          <option value="">전체</option>
          {Object.entries(SHIPPING_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        기간(시작)
        <input
          type="date"
          name="dateFrom"
          defaultValue={current.dateFrom}
          className="border border-border px-2 py-1.5 text-sm text-text-main outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        기간(종료)
        <input
          type="date"
          name="dateTo"
          defaultValue={current.dateTo}
          className="border border-border px-2 py-1.5 text-sm text-text-main outline-none"
        />
      </label>
      <button type="submit" className="h-[34px] bg-primary px-4 text-sm font-bold text-white">
        검색
      </button>
    </form>
  );
}
