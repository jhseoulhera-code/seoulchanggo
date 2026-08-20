"use client";

import { CheckCircle2, PackageX } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useRef, useSyncExternalStore } from "react";
import { PageContainer } from "@/components/common/PageContainer";
import { ListHeader } from "@/components/layout/ListHeader";
import { ProductImagePlaceholder } from "@/components/product/ProductImagePlaceholder";
import { ShippingBadge } from "@/components/product/ShippingBadge";
import { useAuth } from "@/contexts/AuthContext";
import { MARKETS } from "@/data/markets";
import { PAYMENT_METHODS_BY_MARKET } from "@/data/paymentMethods";
import { formatCurrency } from "@/lib/currency";
import { findGuestOrder } from "@/lib/order";
import { getMessages } from "@/messages";
import type { Order } from "@/types/order";

function noopSubscribe() {
  return () => {};
}

/** Reads a localStorage-backed guest order safely across SSR/hydration, mirroring the Cart/Market external-store pattern. */
function useGuestOrder(orderId: string): Order | null {
  const cacheRef = useRef<{ orderId: string; order: Order | null } | null>(null);

  const getSnapshot = useCallback(() => {
    if (cacheRef.current && cacheRef.current.orderId === orderId) {
      return cacheRef.current.order;
    }
    const order = findGuestOrder(orderId);
    cacheRef.current = { orderId, order };
    return order;
  }, [orderId]);

  const getServerSnapshot = useCallback(() => null, []);
  return useSyncExternalStore(noopSubscribe, getSnapshot, getServerSnapshot);
}

export default function OrderCompletePage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;
  const order = useGuestOrder(orderId);
  const { isAuthenticated } = useAuth();

  const market = order ? MARKETS[order.market] : MARKETS.KR;
  const messages = getMessages(market.locale);

  if (!order) {
    return (
      <>
        <ListHeader title={messages.order.completeTitle} hideCartIcon />
        <main className="pb-16">
          <PageContainer>
            <div className="flex flex-col items-center gap-4 py-24 text-center">
              <PackageX size={40} className="text-text-secondary" />
              <p className="text-sm text-text-secondary">{messages.order.lookupNotFound}</p>
              <Link href="/" className="border border-primary px-4 py-2 text-sm font-bold text-primary">
                {messages.common.backToHome}
              </Link>
            </div>
          </PageContainer>
        </main>
      </>
    );
  }

  return (
    <>
      <ListHeader title={messages.order.completeTitle} hideCartIcon />
      <main className="pb-16">
        <PageContainer className="flex flex-col gap-6 pt-6">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 size={44} className="text-primary" />
            <h1 className="text-lg font-bold text-text-main">{messages.order.completeTitle}</h1>
            <p className="text-sm text-text-secondary">{messages.order.completeMessage}</p>
          </div>

          <div className="flex flex-col gap-3 border border-border p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">{messages.order.orderNumber}</span>
              <span className="font-bold text-text-main">{order.orderId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">{messages.order.orderDate}</span>
              <span className="text-text-main">{new Date(order.createdAt).toLocaleString(market.locale === "ko" ? "ko-KR" : "en-IN")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">결제수단</span>
              <span className="text-text-main">
                {PAYMENT_METHODS_BY_MARKET[order.market].find((m) => m.id === order.paymentMethod)?.label ?? order.paymentMethod}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">결제상태</span>
              <span className="border border-primary px-2 py-0.5 text-xs font-bold text-primary">결제완료</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3 text-base font-bold">
              <span className="text-text-main">{messages.order.total}</span>
              <span className="text-text-main">{formatCurrency(order.total, order.currency)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {order.shippingGroups.map((group) => (
              <section key={group.shippingType} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <ShippingBadge type={group.shippingType} label={group.items[0]?.shippingLabel ?? ""} />
                  <span className="text-sm font-bold text-text-main">{group.status}</span>
                </div>
                <div className="mt-3 flex flex-col gap-3">
                  {group.items.map((item) => (
                    <div key={`${item.productId}-${item.optionLabel}`} className="flex gap-3">
                      <div className="h-16 w-16 shrink-0 overflow-hidden border border-border">
                        <ProductImagePlaceholder category={item.category} className="h-full w-full" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="line-clamp-2 text-sm text-text-main">{item.productName}</p>
                        {item.optionLabel && <p className="text-xs text-text-secondary">{item.optionLabel}</p>}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-text-secondary">
                            {formatCurrency(item.unitPrice, order.currency)} × {item.quantity}
                          </span>
                          <span className="font-bold text-text-main">
                            {formatCurrency(item.subtotal, order.currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {!isAuthenticated && (
            <Link
              href={`/auth?returnTo=${encodeURIComponent(`/order/complete/${order.orderId}`)}`}
              className="flex h-12 items-center justify-center border border-primary text-sm font-bold text-primary"
            >
              {messages.order.claimOrdersCta}
            </Link>
          )}

          <div className="flex flex-col gap-2 md:flex-row">
            <Link
              href="/order/lookup"
              className="flex h-12 flex-1 items-center justify-center border border-border text-sm font-bold text-text-main"
            >
              {messages.order.viewOrders}
            </Link>
            <Link
              href="/"
              className="flex h-12 flex-1 items-center justify-center bg-primary text-sm font-bold text-white"
            >
              {messages.common.continueShopping}
            </Link>
          </div>
        </PageContainer>
      </main>
    </>
  );
}
