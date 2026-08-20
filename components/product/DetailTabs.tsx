"use client";

import { useState } from "react";
import { InquiryTab } from "@/components/product/InquiryTab";
import { ProductInfoTab } from "@/components/product/ProductInfoTab";
import { ReviewsTab } from "@/components/product/ReviewsTab";
import { ShippingExchangeTab } from "@/components/product/ShippingExchangeTab";
import { useMarket } from "@/contexts/MarketContext";
import { cn } from "@/lib/utils";
import { getMessages } from "@/messages";
import type { Messages } from "@/messages";
import type { Product } from "@/types";

type DetailTabsProps = {
  product: Product;
};

const TABS = [
  { id: "info", messageKey: "tabInfo" },
  { id: "review", messageKey: "tabReview" },
  { id: "inquiry", messageKey: "tabInquiry" },
  { id: "shipping", messageKey: "tabShipping" },
] as const satisfies { id: string; messageKey: keyof Messages["product"] }[];

type TabId = (typeof TABS)[number]["id"];

export function DetailTabs({ product }: DetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("info");
  const { market } = useMarket();
  const messages = getMessages(market.locale);

  return (
    <div>
      <div className="sticky top-14 z-30 border-b border-border bg-background md:static">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 border-b-2 py-3 text-sm font-medium",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-text-secondary"
              )}
            >
              {messages.product[tab.messageKey]}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "info" && <ProductInfoTab product={product} />}
      {activeTab === "review" && <ReviewsTab product={product} />}
      {activeTab === "inquiry" && <InquiryTab product={product} />}
      {activeTab === "shipping" && <ShippingExchangeTab product={product} />}
    </div>
  );
}
