"use client";

import { InquiryTab } from "@/components/product/InquiryTab";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ProductInfoTab } from "@/components/product/ProductInfoTab";
import { ReviewsTab } from "@/components/product/ReviewsTab";
import { ShippingExchangeTab } from "@/components/product/ShippingExchangeTab";
import { useMarket } from "@/contexts/MarketContext";
import { getMessages } from "@/messages";
import type { Messages } from "@/messages";
import type { Product } from "@/types";

type ProductDetailSectionsProps = {
  product: Product;
  /** Same-category listing (lib/repositories/products.ts's getProductsByCategory), already excluding this product — never fetched here. */
  relatedProducts: Product[];
};

const SECTIONS = [
  { id: "info", messageKey: "tabInfo" },
  { id: "review", messageKey: "tabReview" },
  { id: "shipping", messageKey: "tabShipping" },
  { id: "inquiry", messageKey: "tabInquiry" },
] as const satisfies { id: string; messageKey: keyof Messages["product"] }[];

/**
 * STEP 26.7 — replaces the old click-to-swap DetailTabs. Every section now
 * renders continuously in normal document flow (MUJI-style "keep scrolling
 * to learn more") instead of only one panel being mounted at a time; the nav
 * below jumps to a section via a real #anchor rather than toggling
 * visibility. The four content components themselves (ProductInfoTab/
 * ReviewsTab/ShippingExchangeTab/InquiryTab) are unchanged — only how
 * they're arranged on the page changed.
 */
export function ProductDetailSections({ product, relatedProducts }: ProductDetailSectionsProps) {
  const { market } = useMarket();
  const messages = getMessages(market.locale);

  return (
    <div>
      <nav
        aria-label={messages.a11y.productDetailNav}
        className="sticky top-14 z-30 border-b border-border bg-background md:static"
      >
        <div className="flex">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="flex-1 border-b-2 border-transparent py-3 text-center text-sm font-medium text-text-secondary hover:text-text-main"
            >
              {messages.product[section.messageKey]}
            </a>
          ))}
        </div>
      </nav>

      <section id="info" className="scroll-mt-28 border-t border-border md:scroll-mt-20">
        <ProductInfoTab product={product} />
      </section>
      <section id="review" className="scroll-mt-28 border-t border-border md:scroll-mt-20">
        <ReviewsTab product={product} />
      </section>
      <section id="shipping" className="scroll-mt-28 border-t border-border md:scroll-mt-20">
        <ShippingExchangeTab product={product} />
      </section>
      <section id="inquiry" className="scroll-mt-28 border-t border-border md:scroll-mt-20">
        <InquiryTab product={product} />
      </section>

      {relatedProducts.length > 0 && (
        <section className="mt-4 border-t border-border pt-8">
          <h2 className="mb-4 text-base font-bold text-text-main">{messages.product.relatedProductsHeading}</h2>
          <ProductGrid products={relatedProducts} />
        </section>
      )}
    </div>
  );
}
