/**
 * STEP 19 spec section 12 — option/variant selection logic kept as pure
 * utilities (no React/Supabase import) rather than embedded inside the
 * purchase panel component, so it's directly unit-testable
 * (scripts/test-storefront-product-detail.mts) and currency-agnostic:
 * callers pass basePrice/additionalPrice already resolved to the same
 * unit (see calculateVariantPrice's own comment on why currency
 * conversion deliberately does NOT happen in here).
 */
import type { ProductOptionGroup, ProductVariant } from "@/types";
import type { PurchaseSelection } from "@/types/purchase";

function matchesSelection(variant: ProductVariant, selected: Record<string, string>): boolean {
  return Object.entries(selected).every(([group, value]) => variant.optionValues[group] === value);
}

/** Only active variants are ever purchasable — STEP 19 spec section 18 (an inactive variant, matches STEP 18's "노출" toggle, must never be offered even if it has stock). */
function activeVariants(variants: ProductVariant[]): ProductVariant[] {
  return variants.filter((v) => v.isActive);
}

/**
 * The variant matching a FULLY specified selection (every group in
 * groupNames must have a value), or null if the selection is incomplete or
 * doesn't correspond to any real, active variant — STEP 19 spec section 10:
 * a combination that was never registered as a variant is never
 * "matched", regardless of what the customer clicked.
 */
export function findMatchingVariant(
  variants: ProductVariant[],
  selected: Record<string, string>,
  groupNames: string[]
): ProductVariant | null {
  if (groupNames.length === 0) return null;
  if (groupNames.some((name) => !selected[name])) return null;
  return activeVariants(variants).find((v) => matchesSelection(v, selected)) ?? null;
}

export type OptionValueStatus = "available" | "soldOut" | "unavailable";

/**
 * Whether one choice within one option group can be selected given the
 * OTHER groups' current selections — STEP 19 spec section 10/11's worked
 * example: with variants 블랙/S, 블랙/M, 화이트/M only, after picking
 * 화이트, 사이즈=S must resolve "unavailable" (no such variant exists at
 * all) while 사이즈=M resolves "available". A choice that does exist as an
 * active variant for the current partial selection but has zero stock
 * resolves "soldOut" — shown, not hidden, per section 11's explicit
 * "다른 옵션 조합에서는 판매 가능한 경우 전체 옵션 그룹을 품절시키면 안 된다".
 */
export function getOptionValueStatus(
  variants: ProductVariant[],
  groupName: string,
  choice: string,
  selectedOthers: Record<string, string>
): OptionValueStatus {
  const candidate = { ...selectedOthers, [groupName]: choice };
  const matches = activeVariants(variants).filter((v) => matchesSelection(v, candidate));
  if (matches.length === 0) return "unavailable";
  return matches.some((v) => v.stockQuantity > 0) ? "available" : "soldOut";
}

/** The subset of a group's choices that are selectable at all (existing as at least one active variant given the other current selections) — excludes only truly nonexistent combinations, not sold-out ones. */
export function getAvailableOptionValues(
  variants: ProductVariant[],
  group: ProductOptionGroup,
  selectedOthers: Record<string, string>
): string[] {
  return group.choices.filter((choice) => getOptionValueStatus(variants, group.name, choice, selectedOthers) !== "unavailable");
}

/**
 * Whether a fully-specified selection is actually purchasable right now:
 * a real, active, in-stock variant exists for it. Section 10 (combination
 * must exist) and section 11 (combination must not be sold out) collapse
 * into this one check for gating the purchase buttons.
 */
export function isOptionCombinationAvailable(variants: ProductVariant[], selected: Record<string, string>, groupNames: string[]): boolean {
  const match = findMatchingVariant(variants, selected, groupNames);
  return Boolean(match) && match!.stockQuantity > 0;
}

/**
 * STEP 19 spec section 17 — an option-less product is sold out purely by
 * its own stock; an option-having product is sold out only when every
 * active variant is out of stock (or there are no active variants at
 * all) — never by the parent product's own stock_quantity, which STEP 18
 * leaves at whatever it was before options were introduced and is not
 * authoritative once variants exist.
 *
 * productStockQuantity is `number | undefined` because Product.stock
 * (lib/repositories/products.ts's mapProductRow) is undefined for an
 * UNLIMITED stock_type product, not 0 — coercing that to 0 would make an
 * unlimited-stock, option-less product look permanently sold out.
 * undefined always means "not tracked, never sold out here".
 */
export function isProductSoldOut(hasOptions: boolean, variants: ProductVariant[], productStockQuantity: number | undefined): boolean {
  if (!hasOptions) return typeof productStockQuantity === "number" && productStockQuantity <= 0;
  return !activeVariants(variants).some((v) => v.stockQuantity > 0);
}

/**
 * base price + variant.additionalPrice, floored at 0. Deliberately takes
 * both already resolved to the SAME currency/unit — STEP 18 documented
 * additional_price as a raw KRW delta with no per-market override, so a
 * non-KRW market must convert additionalPrice with the exact same
 * dev-rate lib/currency.ts's getProductMarketPrice uses for the base
 * price BEFORE calling this, not inside it (keeps this module currency-
 * agnostic and independently testable without importing lib/currency.ts).
 */
export function calculateVariantPrice(basePrice: number, additionalPrice: number): number {
  return Math.max(0, basePrice + additionalPrice);
}

/**
 * How many units of the current selection the customer could actually
 * buy — the matched variant's own stock for an option-having product, or
 * the product's own stock otherwise. `undefined` (UNLIMITED stock_type,
 * see isProductSoldOut's comment) means no cap, represented as
 * Number.POSITIVE_INFINITY so `quantity > effectiveStock` checks and
 * QuantitySelector's `max` prop both behave the same way an actual
 * unbounded quantity should.
 */
export function getEffectiveStock(hasOptions: boolean, matchedVariant: ProductVariant | null, productStockQuantity: number | undefined): number {
  if (!hasOptions) return typeof productStockQuantity === "number" ? Math.max(0, productStockQuantity) : Number.POSITIVE_INFINITY;
  return matchedVariant ? Math.max(0, matchedVariant.stockQuantity) : 0;
}

export type NormalizeSelectionInput = {
  productId: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  variant: ProductVariant | null;
  /** Stock ceiling for whichever unit is being purchased (the matched variant's stock, or the product's own stock for an option-less product) — STEP 19 spec section 13's "재고보다 많이 선택할 수 없다", enforced here too so this function is the single source of truth for "is this selection actually buyable". */
  maxStock: number;
};

/**
 * STEP 19 spec section 16 — builds the exact PurchaseSelection payload
 * STEP 20 will need, from whatever the customer currently has selected.
 * Returns null when the selection isn't actually purchasable yet (bad
 * quantity, quantity exceeding available stock, or an option-having
 * product with no matched variant) so the caller never has to duplicate
 * that validation.
 */
export function normalizePurchaseSelection(input: NormalizeSelectionInput): PurchaseSelection | null {
  if (!Number.isFinite(input.quantity) || input.quantity < 1) return null;
  if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) return null;
  if (input.quantity > input.maxStock) return null;

  return {
    productId: input.productId,
    variantId: input.variant?.id,
    sku: input.variant?.sku ?? input.productSku,
    quantity: Math.floor(input.quantity),
    unitPrice: input.unitPrice,
  };
}
