import type { Category, Product } from "@/types";
import type { LocaleCode } from "@/types/market";

/**
 * Product content fallback policy (STEP 13 spec section 23): en → ko when
 * an English translation hasn't been entered, never a blank value. Korean
 * (name/description) is always the base field and is always populated, so
 * this can never return empty.
 */
export function getLocalizedProductName(product: Product, locale: LocaleCode): string {
  if (locale === "en" && product.nameEn) return product.nameEn;
  return product.name;
}

export function getLocalizedProductDescription(product: Product, locale: LocaleCode): string | undefined {
  if (locale === "en" && product.descriptionEn) return product.descriptionEn;
  return product.description;
}

/**
 * STEP 19 spec section 6 — the purchase panel's short summary. Falls back
 * ko-short -> en-short -> long description (either locale, via
 * getLocalizedProductDescription) -> undefined, so a product that was
 * registered before STEP 16 added short_description_ko/en (or simply
 * never had one filled in) still shows something reasonable instead of a
 * blank gap in the layout.
 */
export function getLocalizedProductShortDescription(product: Product, locale: LocaleCode): string | undefined {
  if (locale === "en" && product.shortDescriptionEn) return product.shortDescriptionEn;
  if (product.shortDescription) return product.shortDescription;
  return getLocalizedProductDescription(product, locale);
}

export function getLocalizedCategoryLabel(category: Pick<Category, "label" | "labelEn">, locale: LocaleCode): string {
  if (locale === "en" && category.labelEn) return category.labelEn;
  return category.label;
}
