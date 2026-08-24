import type {
  OrderStatusEnum,
  PaymentAttemptStatusEnum,
  PaymentProviderEnum,
  PaymentStatusEnum,
  ShippingGroupStatusEnum,
  SupplyTypeEnum,
} from "@/types/database";

export const ORDER_STATUS_LABEL: Record<OrderStatusEnum, string> = {
  ORDER_CREATED: "주문접수",
  PAYMENT_PENDING: "결제대기",
  PAID: "결제완료",
  PREPARING: "상품준비중",
  PARTIALLY_SHIPPED: "부분배송",
  SHIPPED: "배송중",
  DELIVERED: "배송완료",
  CANCELLED: "취소",
  RETURN_REQUESTED: "반품요청",
  RETURNED: "반품완료",
  REFUNDED: "환불완료",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatusEnum, string> = {
  UNPAID: "결제대기",
  PAID: "결제완료",
};

export const SHIPPING_GROUP_STATUS_LABEL: Record<ShippingGroupStatusEnum, string> = {
  PREPARING: "준비중",
  PURCHASING: "구매대행 진행중",
  READY_TO_SHIP: "출고대기",
  SHIPPED: "발송완료",
  IN_TRANSIT: "이동중",
  CUSTOMS: "통관중",
  OUT_FOR_DELIVERY: "배송출발",
  DELIVERED: "배송완료",
  /** STEP 26.1 — DIRECT_PICKUP-only branch; a courier-based group never reaches either. */
  READY_FOR_PICKUP: "수령대기",
  PICKED_UP: "수령완료",
};

/** Ordered by the STEP 09 spec's default transition path (item 30); shown to admins picking a next status. READY_FOR_PICKUP/PICKED_UP are the separate DIRECT_PICKUP branch, appended rather than interleaved. */
export const SHIPPING_GROUP_STATUS_ORDER: ShippingGroupStatusEnum[] = [
  "PREPARING",
  "PURCHASING",
  "READY_TO_SHIP",
  "SHIPPED",
  "IN_TRANSIT",
  "CUSTOMS",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "READY_FOR_PICKUP",
  "PICKED_UP",
];

/** Mirrors is_valid_shipping_status_transition() in 20260822000200_admin_shipping_status.sql (extended by 20260906000900_step26_1_direct_pickup_logic.sql) — kept in sync so the UI only offers transitions the RPC will actually accept. */
export const NEXT_SHIPPING_STATUSES: Record<ShippingGroupStatusEnum, ShippingGroupStatusEnum[]> = {
  PREPARING: ["READY_TO_SHIP", "PURCHASING", "READY_FOR_PICKUP"],
  PURCHASING: ["READY_TO_SHIP"],
  READY_TO_SHIP: ["SHIPPED"],
  SHIPPED: ["IN_TRANSIT"],
  IN_TRANSIT: ["CUSTOMS", "OUT_FOR_DELIVERY"],
  CUSTOMS: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  READY_FOR_PICKUP: ["PICKED_UP"],
  PICKED_UP: [],
};

export const SUPPLY_TYPE_LABEL: Record<SupplyTypeEnum, string> = {
  DOMESTIC_STOCK: "국내 재고",
  OVERSEAS_DIRECT: "해외 직배송",
  OVERSEAS_AGENCY: "해외 구매대행",
};

export const SHIPPING_TYPE_LABEL: Record<string, string> = {
  DOMESTIC: "국내배송",
  OVERSEAS_DIRECT: "해외직배송",
  OVERSEAS_AGENCY: "해외구매대행",
  DIRECT_PICKUP: "직접수령",
};

export const PAYMENT_PROVIDER_LABEL: Record<PaymentProviderEnum, string> = {
  KOREA_PG: "국내 PG",
  INDIA_PG: "인도 PG",
  GLOBAL_PG: "글로벌 PG",
  MOCK: "Mock(개발용)",
};

export const PAYMENT_ATTEMPT_STATUS_LABEL: Record<PaymentAttemptStatusEnum, string> = {
  CREATED: "생성됨",
  READY: "결제대기",
  PENDING: "처리중",
  AUTHORIZED: "승인됨",
  PAID: "결제완료",
  FAILED: "실패",
  CANCELLED: "취소됨",
  PARTIALLY_REFUNDED: "부분환불",
  REFUNDED: "환불완료",
};
