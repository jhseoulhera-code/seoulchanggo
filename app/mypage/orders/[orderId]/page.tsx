"use client";

import { AlertTriangle, PackageX } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/common/PageContainer";
import { Toast } from "@/components/common/Toast";
import type { ToastState } from "@/components/common/Toast";
import { ListHeader } from "@/components/layout/ListHeader";
import { ProductImagePlaceholder } from "@/components/product/ProductImagePlaceholder";
import { ShippingBadge } from "@/components/product/ShippingBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useMarket } from "@/contexts/MarketContext";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime, getMarketTimeZone } from "@/lib/intl";
import { paymentMethodLabel } from "@/lib/paymentLabels";
import { attemptPayment } from "@/lib/paymentRetry";
import { carrierLabel } from "@/lib/shipping/carriers";
import { shippingTypeLabel } from "@/lib/shippingLabels";
import { cancelMyUnpaidOrderAction, getMyOrderDetailAction } from "@/lib/actions/mypage";
import type { MyOrderDetail } from "@/lib/actions/mypage";
import { getMessages } from "@/messages";
import type { ShippingType } from "@/types";
import type { ShippingAddress } from "@/types/order";
import type { PaymentAttemptStatusEnum, ShippingTypeEnum } from "@/types/database";

/** Same DB-enum-to-TS-type map already used (in the other direction) by lib/actions/order.ts's SHIPPING_TYPE_TO_DB. */
const SHIPPING_TYPE_FROM_DB: Record<ShippingTypeEnum, ShippingType> = {
  DOMESTIC: "domestic",
  OVERSEAS_DIRECT: "overseas_direct",
  OVERSEAS_AGENCY: "overseas_agent",
  DIRECT_PICKUP: "direct_pickup",
};

/**
 * STEP 23 — payment_attempt_status_enum (per-attempt, fine-grained: CREATED/
 * READY/PENDING/AUTHORIZED/PAID/FAILED/CANCELLED/PARTIALLY_REFUNDED/REFUNDED)
 * collapsed onto messages.payment.status's 5 customer-facing buckets. Never
 * shown as the raw enum value — a customer doesn't need to know the
 * difference between CREATED and READY, only "결제대기".
 */
const PAYMENT_ATTEMPT_STATUS_LABEL: Record<PaymentAttemptStatusEnum, "pending" | "paid" | "failed" | "cancelled" | "refunded"> = {
  CREATED: "pending",
  READY: "pending",
  PENDING: "pending",
  AUTHORIZED: "pending",
  PAID: "paid",
  FAILED: "failed",
  CANCELLED: "cancelled",
  PARTIALLY_REFUNDED: "refunded",
  REFUNDED: "refunded",
};

function AddressLines({ address }: { address: ShippingAddress }) {
  if (address.country === "KR") {
    return (
      <>
        <p className="text-sm font-medium text-text-main">
          {address.recipientName} · {address.phone}
        </p>
        <p className="text-sm text-text-secondary">
          ({address.postcode}) {address.address} {address.addressDetail}
        </p>
        {address.deliveryMemo && <p className="text-xs text-text-secondary">{address.deliveryMemo}</p>}
      </>
    );
  }
  return (
    <>
      <p className="text-sm font-medium text-text-main">
        {address.fullName} · {address.mobileNumber}
      </p>
      <p className="text-sm text-text-secondary">
        {address.addressLine1} {address.addressLine2}, {address.city}, {address.state} {address.pinCode}
      </p>
      {address.deliveryInstructions && <p className="text-xs text-text-secondary">{address.deliveryInstructions}</p>}
    </>
  );
}

export default function MyOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const { isReady, isAuthenticated } = useAuth();
  const { market } = useMarket();
  const router = useRouter();
  const messages = getMessages(market.locale);

  const [order, setOrder] = useState<MyOrderDetail | null | undefined>(undefined);
  const [retrying, setRetrying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace(`/auth?returnTo=${encodeURIComponent(`/mypage/orders/${params.orderId}`)}`);
    }
  }, [isReady, isAuthenticated, router, params.orderId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    getMyOrderDetailAction(params.orderId).then(setOrder);
  }, [isAuthenticated, params.orderId]);

  /**
   * STEP 24 spec section 23/24 — reuses the exact same prepare/confirm
   * pipeline as Checkout (lib/paymentRetry.ts), against THIS existing
   * order's id — never creates a new order. On success, re-fetches the
   * order detail from the server (the actual source of truth) rather than
   * optimistically flipping local state, since finalize happened entirely
   * server-side.
   */
  async function handleRetryPayment() {
    if (!order || retrying) return;
    setRetrying(true);
    setToast(null);

    const result = await attemptPayment({
      orderId: order.id,
      paymentMethod: order.latestPayment?.paymentMethod ?? order.paymentMethod,
      marketCode: order.marketCode,
    });

    if (!result.ok) {
      const message =
        result.stage === "prepare"
          ? (result.error ?? messages.payment.prepareFailed)
          : result.failureCode === "PAYMENT_AMOUNT_MISMATCH" || result.failureCode === "PAYMENT_CURRENCY_MISMATCH"
            ? messages.payment.amountMismatch
            : result.failureCode === "STOCK_CHANGED"
              ? messages.payment.stockChangedAtPayment
              : (result.failureMessage ?? result.error ?? messages.payment.confirmFailed);
      setToast({ message, tone: "error" });
      setRetrying(false);
      const refreshed = await getMyOrderDetailAction(params.orderId);
      setOrder(refreshed);
      return;
    }

    setRetrying(false);
    const refreshed = await getMyOrderDetailAction(params.orderId);
    setOrder(refreshed);
    setToast({ message: "결제가 완료되었습니다.", tone: "success" });
  }

  /** STEP 26 spec section 3/37 — an unpaid order only; never calls anything refund-related (nothing was ever charged). */
  async function handleCancelOrder() {
    if (!order || cancelling) return;
    if (!window.confirm("주문을 취소하시겠습니까?")) return;

    setCancelling(true);
    const result = await cancelMyUnpaidOrderAction(order.id);
    setCancelling(false);

    if (!result.ok) {
      setToast({ message: result.error, tone: "error" });
      return;
    }
    const refreshed = await getMyOrderDetailAction(params.orderId);
    setOrder(refreshed);
    setToast({ message: "주문이 취소되었습니다.", tone: "success" });
  }

  if (order === undefined) {
    return (
      <>
        <ListHeader title={messages.mypage.orderHistory} hideCartIcon />
        <main className="pb-16" />
      </>
    );
  }

  if (order === null) {
    return (
      <>
        <ListHeader title={messages.mypage.orderHistory} hideCartIcon />
        <main className="pb-16">
          <PageContainer>
            <div className="flex flex-col items-center gap-4 py-24 text-center">
              <PackageX size={40} className="text-text-secondary" />
              <p className="text-sm text-text-secondary">{messages.order.lookupNotFound}</p>
            </div>
          </PageContainer>
        </main>
      </>
    );
  }

  const address = order.shippingAddress as unknown as ShippingAddress;
  const isPaid = order.paymentStatus === "PAID";
  const attemptStatusLabel = order.latestPayment ? PAYMENT_ATTEMPT_STATUS_LABEL[order.latestPayment.status] : "pending";

  return (
    <>
      <ListHeader title={order.orderNumber} hideCartIcon />
      <main className="pb-16">
        <PageContainer className="flex flex-col gap-6 pt-6">
          <div className="flex flex-col gap-3 border border-border p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">{messages.order.orderNumber}</span>
              <span className="font-bold text-text-main">{order.orderNumber}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">{messages.order.orderDate}</span>
              <span className="text-text-main">{formatDateTime(order.createdAt, market.locale, getMarketTimeZone(order.marketCode))}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">주문상태</span>
              <span className="border border-primary px-2 py-0.5 text-xs font-bold text-primary">{messages.orderStatus[order.orderStatus]}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">{messages.payment.methodLabel}</span>
              <span className="text-text-main">{paymentMethodLabel(order.latestPayment?.paymentMethod ?? order.paymentMethod, market.locale)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">{messages.payment.statusLabel}</span>
              <span className="text-text-main">{messages.payment.status[attemptStatusLabel]}</span>
            </div>
            {isPaid && order.latestPayment?.paidAt && (
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">결제완료 시각</span>
                <span className="text-text-main">{formatDateTime(order.latestPayment.paidAt, market.locale, getMarketTimeZone(order.marketCode))}</span>
              </div>
            )}
            {order.refundStatus !== "NONE" && (
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">환불상태</span>
                <span className="text-text-main">
                  {order.refundStatus === "PENDING" && messages.payment.refundStatus.pending}
                  {order.refundStatus === "PARTIAL" && messages.payment.refundStatus.partial}
                  {order.refundStatus === "COMPLETED" && messages.payment.refundStatus.completed}
                </span>
              </div>
            )}
            {order.refundedAmount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">환불금액</span>
                <span className="text-text-main">{formatCurrency(order.refundedAmount, order.currencyCode)}</span>
              </div>
            )}
            {!isPaid && order.canRetryPayment && (
              <button
                type="button"
                onClick={handleRetryPayment}
                disabled={retrying}
                className="mt-1 h-11 w-full bg-primary text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {retrying ? messages.common.loading : "다시 결제하기"}
              </button>
            )}
            {!isPaid && order.canCancel && (
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={cancelling}
                className="h-11 w-full border border-border text-sm font-bold text-text-main disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cancelling ? messages.common.loading : "주문 취소"}
              </button>
            )}
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-bold text-text-main">{messages.checkout.addressSection}</h2>
            <div className="border border-border p-4">
              <AddressLines address={address} />
            </div>
          </section>

          <div className="flex flex-col gap-4">
            {order.shippingGroups.map((group) => {
              const groupItems = order.items.filter((item) => group.itemIds.includes(item.id));
              const type = SHIPPING_TYPE_FROM_DB[group.shippingType];
              const isPickup = type === "direct_pickup";
              return (
                <section key={group.id} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ShippingBadge type={type} label={shippingTypeLabel(type, market.locale)} />
                    <span className="text-sm font-bold text-text-main">{messages.shippingStatus[group.status]}</span>
                    <span className="ml-auto text-xs text-text-secondary">
                      {messages.cart.shippingTotal}: {formatCurrency(group.shippingFee, order.currencyCode)}
                    </span>
                  </div>
                  {/* STEP 26.1 spec section 6 — a pickup group never shows carrier/tracking
                      (there is none), only its own 수령 준비/완료 timestamps; shipped_at/
                      delivered_at are reused generically for those two milestones. */}
                  {isPickup
                    ? (group.shippedAt || group.deliveredAt) && (
                        <div className="mt-2 flex flex-col gap-0.5 text-xs text-text-secondary">
                          {group.shippedAt && (
                            <span>수령 준비일시: {formatDateTime(group.shippedAt, market.locale, getMarketTimeZone(order.marketCode))}</span>
                          )}
                          {group.deliveredAt && (
                            <span>수령완료일시: {formatDateTime(group.deliveredAt, market.locale, getMarketTimeZone(order.marketCode))}</span>
                          )}
                        </div>
                      )
                    : (group.carrier || group.trackingNumber) && (
                        <div className="mt-2 flex flex-col gap-0.5 text-xs text-text-secondary">
                          {group.carrier && <span>운송사: {carrierLabel(group.carrier)}</span>}
                          {group.trackingNumber && <span>송장번호: {group.trackingNumber}</span>}
                          {group.shippedAt && (
                            <span>발송일시: {formatDateTime(group.shippedAt, market.locale, getMarketTimeZone(order.marketCode))}</span>
                          )}
                          {group.deliveredAt && (
                            <span>배송완료일시: {formatDateTime(group.deliveredAt, market.locale, getMarketTimeZone(order.marketCode))}</span>
                          )}
                        </div>
                      )}
                  <div className="mt-3 flex flex-col gap-3">
                    {groupItems.map((item) => (
                      <div key={item.id} className="flex gap-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden border border-border">
                          <ProductImagePlaceholder category="" className="h-full w-full" />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <p className="line-clamp-2 text-sm text-text-main">{item.productNameSnapshot}</p>
                          {Object.keys(item.optionSnapshot).length > 0 && (
                            <p className="text-xs text-text-secondary">
                              {messages.checkout.optionSectionLabel}: {Object.values(item.optionSnapshot).join(" / ")}
                            </p>
                          )}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-text-secondary">
                              {formatCurrency(item.unitPrice, order.currencyCode)} × {item.quantity}
                            </span>
                            <span className="font-bold text-text-main">{formatCurrency(item.subtotal, order.currencyCode)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 border border-border p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">{messages.cart.itemsTotal}</span>
              <span className="text-text-main">{formatCurrency(order.itemsSubtotal, order.currencyCode)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">{messages.cart.discountTotal}</span>
              <span className="text-primary">-{formatCurrency(order.discountTotal, order.currencyCode)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">{messages.cart.shippingTotal}</span>
              <span className="text-text-main">{formatCurrency(order.shippingTotal, order.currencyCode)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3 text-base font-bold">
              <span className="text-text-main">{messages.order.total}</span>
              <span className="text-text-main">{formatCurrency(order.grandTotal, order.currencyCode)}</span>
            </div>
          </div>

          {!isPaid && !order.canRetryPayment && (
            <p className="flex items-center gap-1.5 text-xs text-text-secondary">
              <AlertTriangle size={12} className="shrink-0" />
              결제가 완료되지 않은 주문입니다.
            </p>
          )}
        </PageContainer>
      </main>
      <Toast toast={toast} />
    </>
  );
}
