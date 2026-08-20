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

export function getLocalizedCategoryLabel(category: Pick<Category, "label" | "labelEn">, locale: LocaleCode): string {
  if (locale === "en" && category.labelEn) return category.labelEn;
  return category.label;
}
