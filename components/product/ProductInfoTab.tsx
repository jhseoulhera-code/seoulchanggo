"use client";

import { ProductDetailBlocks } from "@/components/product/ProductDetailBlocks";
import { useMarket } from "@/contexts/MarketContext";
import { getLocalizedProductDescription, getLocalizedProductName } from "@/lib/productLocalization";
import { getMessages, t } from "@/messages";
import type { ProductDetailBlock } from "@/types";
import type { Product } from "@/types";

/**
 * STEP 26.7 — the "rich product detail" section (spec section 6): free-form
 * description/feature content, rendered through ProductDetailBlocks so a
 * future admin block editor can hand this component real authored blocks
 * instead of this synthesized array, with no change to ProductDetailBlocks
 * itself. Structured spec data lives in the separate ProductSpecTable
 * (spec section 7) — kept apart so the two can be reordered/anchored
 * independently, matching the detail-nav's own "상품정보 | 상세정보" split.
 */
export function ProductInfoTab({ product }: { product: Product }) {
  const { market } = useMarket();
  const messages = getMessages(market.locale);
  const description = getLocalizedProductDescription(product, market.locale) ?? t(messages.product.defaultDescription, { name: getLocalizedProductName(product, market.locale) });

  const detailBlocks: ProductDetailBlock[] = [
    { type: "heading", text: messages.product.descriptionHeading },
    { type: "paragraph", text: description },
    { type: "divider" },
    { type: "heading", text: messages.product.featuresHeading },
    { type: "featureList", items: [messages.product.feature1, messages.product.feature2, messages.product.feature3] },
    { type: "divider" },
    { type: "heading", text: messages.product.noticeHeading },
    { type: "paragraph", text: messages.product.noticeText },
  ];

  return (
    <div className="py-5">
      <ProductDetailBlocks blocks={detailBlocks} />
    </div>
  );
}
