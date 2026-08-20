"use client";

import { categories } from "@/data/categories";
import { ORIGIN_COUNTRY } from "@/data/shippingInfo";
import { useMarket } from "@/contexts/MarketContext";
import { getLocalizedCategoryLabel, getLocalizedProductDescription, getLocalizedProductName } from "@/lib/productLocalization";
import { shippingTypeLabel } from "@/lib/shippingLabels";
import { getMessages, t } from "@/messages";
import type { Messages } from "@/messages";
import type { Product, ProductSpec } from "@/types";
import type { LocaleCode } from "@/types/market";

function getFallbackSpecs(product: Product, locale: LocaleCode, messages: Messages): ProductSpec[] {
  const matchedCategory = categories.find((item) => item.id === product.category);
  const categoryLabel = matchedCategory ? getLocalizedCategoryLabel(matchedCategory, locale) : messages.product.fallbackCategoryLabel;

  return [
    { label: messages.product.specCategory, value: categoryLabel },
    { label: messages.product.specShippingType, value: shippingTypeLabel(product.shippingType, locale) },
    { label: messages.product.specComposition, value: messages.product.specCompositionValue },
    { label: messages.product.specOrigin, value: ORIGIN_COUNTRY[product.shippingType][locale] },
  ];
}

export function ProductInfoTab({ product }: { product: Product }) {
  const { market } = useMarket();
  const messages = getMessages(market.locale);
  const description = getLocalizedProductDescription(product, market.locale) ?? t(messages.product.defaultDescription, { name: getLocalizedProductName(product, market.locale) });
  const specs = product.specifications ?? getFallbackSpecs(product, market.locale, messages);

  return (
    <div className="flex flex-col gap-8 py-5">
      <section>
        <h3 className="mb-2 text-sm font-bold text-text-main">{messages.product.descriptionHeading}</h3>
        <p className="text-sm leading-relaxed text-text-secondary">{description}</p>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-bold text-text-main">{messages.product.featuresHeading}</h3>
        <ul className="flex flex-col gap-2 text-sm text-text-secondary">
          <li>· {messages.product.feature1}</li>
          <li>· {messages.product.feature2}</li>
          <li>· {messages.product.feature3}</li>
        </ul>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-bold text-text-main">{messages.product.specsHeading}</h3>
        <dl className="flex flex-col">
          {specs.map((spec) => (
            <div
              key={spec.label}
              className="flex gap-4 border-t border-border py-2.5 text-sm first:border-t-0"
            >
              <dt className="w-24 flex-shrink-0 text-text-secondary">{spec.label}</dt>
              <dd className="text-text-main">{spec.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-bold text-text-main">{messages.product.noticeHeading}</h3>
        <p className="text-xs leading-relaxed text-text-secondary">{messages.product.noticeText}</p>
      </section>
    </div>
  );
}
