"use client";

import { useState } from "react";
import { InquiryTab } from "@/components/product/InquiryTab";
import { ProductInfoTab } from "@/components/product/ProductInfoTab";
import { ReviewsTab } from "@/components/product/ReviewsTab";
import { ShippingExchangeTab } from "@/components/product/ShippingExchangeTab";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

type DetailTabsProps = {
  product: Product;
};

const TABS = [
  { id: "info", label: "상품정보" },
  { id: "review", label: "리뷰" },
  { id: "inquiry", label: "문의" },
  { id: "shipping", label: "배송/교환" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function DetailTabs({ product }: DetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("info");

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
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "info" && <ProductInfoTab product={product} />}
      {activeTab === "review" && <ReviewsTab product={product} />}
      {activeTab === "inquiry" && <InquiryTab />}
      {activeTab === "shipping" && <ShippingExchangeTab product={product} />}
    </div>
  );
}
