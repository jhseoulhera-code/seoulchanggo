"use client";

import { AlertTriangle, PackageX } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/common/PageContainer";
import { ListHeader } from "@/components/layout/ListHeader";
import { ProductImagePlaceholder } from "@/components/product/ProductImagePlaceholder";
import { ShippingBadge } from "@/components/product/ShippingBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useMarket } from "@/contexts/MarketContext";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime, getMarketTimeZone } from "@/lib/intl";
import { paymentMethodLabel } from "@/lib/paymentLabels";
import { shippingTypeLabel } from "@/lib/shippingLabels";
import { getMyOrderDetailAction } from "@/lib/actions/mypage";
import type { MyOrderDetail } from "@/lib/actions/mypage";
import { getMessages } from "@/messages";
import type { ShippingType } from "@/types";
import type { ShippingAddress } from "@/types/order";
import type { ShippingTypeEnum } from "@/types/database";

/** Same DB-enum-to-TS-type map already used (in the other direction) by lib/actions/order.ts's SHIPPING_TYPE_TO_DB. */
const SHIPPING_TYPE_FROM_DB: Record<ShippingTypeEnum, ShippingType> = {
  DOMESTIC: "domestic",
  OVERSEAS_DIRECT: "overseas_direct",
  OVERSEAS_AGENCY: "overseas_agent",
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

  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace(`/auth?returnTo=${encodeURIComponent(`/mypage/orders/${params.orderId}`)}`);
    }
  }, [isReady, isAuthenticated, router, params.orderId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    getMyOrderDetailAction(params.orderId).then(setOrder);
  }, [isAuthenticated, params.orderId]);

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
              <span className="text-text-main">{paymentMethodLabel(order.paymentMethod, market.locale)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">{messages.payment.statusLabel}</span>
              <span className="text-text-main">{isPaid ? messages.payment.status.paid : messages.payment.status.pending}</span>
            </div>
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
              return (
                <section key={group.id} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ShippingBadge type={type} label={shippingTypeLabel(type, market.locale)} />
                    <span className="text-sm font-bold text-text-main">{messages.shippingStatus[group.status]}</span>
                    <span className="ml-auto text-xs text-text-secondary">
                      {messages.cart.shippingTotal}: {formatCurrency(group.shippingFee, order.currencyCode)}
                    </span>
                  </div>
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

          {!isPaid && (
            <p className="flex items-center gap-1.5 text-xs text-text-secondary">
              <AlertTriangle size={12} className="shrink-0" />
              결제가 완료되지 않은 주문입니다.
            </p>
          )}
        </PageContainer>
      </main>
    </>
  );
}
