"use client";

import { ProductDetailBlocks } from "@/components/product/ProductDetailBlocks";
import { categories } from "@/data/categories";
import { ORIGIN_COUNTRY_CODE_LABEL, pickLocale } from "@/data/shippingInfo";
import { useMarket } from "@/contexts/MarketContext";
import { getLocalizedCategoryLabel } from "@/lib/productLocalization";
import { getMessages } from "@/messages";
import type { Messages } from "@/messages";
import type { Product, ProductSpec } from "@/types";
import type { LocaleCode } from "@/types/market";

/**
 * STEP 26.7 — every row here is a REAL field already on Product (category,
 * brand, sku, originCountry — all DB-sourced by lib/repositories/products.ts's
 * mapProductRow). No row is fabricated and none is included when the
 * underlying value is unset — an admin who never entered a brand or origin
 * country simply doesn't get that row, instead of a "-" placeholder. Rows
 * that already appear elsewhere on the page (shipping method/fee — the
 * purchase panel's ShippingBadge/ShippingInfoPanel, and the "배송/교환"
 * section) are deliberately NOT duplicated here.
 *
 * Category-specific notice fields (용량/전성분/제조업자 for cosmetics,
 * 모델명/정격전압 for electronics, etc. — spec section 8) are NOT rendered:
 * there is no DB column or admin input for any of them today (see the
 * STEP 26.7 report). Adding fake rows would violate spec section 15's data
 * integrity rule, so this table only ever shows what's real.
 */
function getRealSpecs(product: Product, locale: LocaleCode, messages: Messages): ProductSpec[] {
  const matchedCategory = categories.find((item) => item.id === product.category);
  const categoryLabel = matchedCategory ? getLocalizedCategoryLabel(matchedCategory, locale) : messages.product.fallbackCategoryLabel;

  const rows: ProductSpec[] = [{ label: messages.product.specCategory, value: categoryLabel }];
  if (product.brand) rows.push({ label: messages.product.specBrand, value: product.brand });
  if (product.sku) rows.push({ label: messages.product.specSku, value: product.sku });
  if (product.originCountry) {
    rows.push({ label: messages.product.specOrigin, value: pickLocale(ORIGIN_COUNTRY_CODE_LABEL[product.originCountry], locale) });
  }
  return rows;
}

export function ProductSpecTable({ product }: { product: Product }) {
  const { market } = useMarket();
  const messages = getMessages(market.locale);
  const specs = product.specifications ?? getRealSpecs(product, market.locale, messages);

  if (specs.length === 0) return null;

  return (
    <div className="py-5">
      <h3 className="mb-3 text-sm font-bold text-text-main">{messages.product.specsHeading}</h3>
      <ProductDetailBlocks blocks={[{ type: "specTable", rows: specs }]} />
    </div>
  );
}
