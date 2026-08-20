"use client";

import { CheckCircle2, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageContainer } from "@/components/common/PageContainer";
import { ListHeader } from "@/components/layout/ListHeader";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import { lookupGuestOrder } from "@/lib/order";
import { useMarket } from "@/contexts/MarketContext";
import { getMessages } from "@/messages";
import type { Order } from "@/types/order";

export default function OrderLookupPage() {
  const { market } = useMarket();
  const messages = getMessages(market.locale);

  const [orderId, setOrderId] = useState("");
  const [contact, setContact] = useState("");
  const [result, setResult] = useState<Order | null | undefined>(undefined);

  function handleSubmit() {
    setResult(lookupGuestOrder(orderId, contact) ?? null);
  }

  return (
    <>
      <ListHeader title={messages.order.lookupTitle} hideCartIcon />
      <main className="pb-16">
        <PageContainer className="flex flex-col gap-6 pt-6">
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs font-medium text-text-secondary">{messages.order.lookupOrderId}</span>
              <input
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
                placeholder="ORD-20260101-AB12"
                className="border border-border px-3 py-2.5 text-sm text-text-main outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs font-medium text-text-secondary">{messages.order.lookupContact}</span>
              <input
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                className="border border-border px-3 py-2.5 text-sm text-text-main outline-none"
              />
            </label>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!orderId.trim() || !contact.trim()}
              className="mt-1 flex h-12 items-center justify-center gap-2 bg-primary text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-border"
            >
              <Search size={16} />
              {messages.order.lookupSubmit}
            </button>
          </div>

          {result === null && (
            <p className="text-center text-sm text-text-secondary">{messages.order.lookupNotFound}</p>
          )}

          {result && (
            <div className={cn("flex flex-col gap-3 border border-border p-4 text-sm")}>
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle2 size={18} />
                <span className="font-bold">{result.orderId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">{messages.order.orderDate}</span>
                <span className="text-text-main">
                  {new Date(result.createdAt).toLocaleString(market.locale === "ko" ? "ko-KR" : "en-IN")}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3 text-base font-bold">
                <span className="text-text-main">{messages.order.total}</span>
                <span className="text-text-main">{formatCurrency(result.total, result.currency)}</span>
              </div>
              <Link
                href={`/order/complete/${result.orderId}`}
                className="mt-1 flex h-11 items-center justify-center border border-primary text-sm font-bold text-primary"
              >
                {messages.order.viewOrders}
              </Link>
            </div>
          )}
        </PageContainer>
      </main>
    </>
  );
}
