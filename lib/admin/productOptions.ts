import type { AdminProductVariant } from "@/types/admin";

/**
 * STEP 18 spec section 9/10 — pure option-combination logic, kept dependency
 * free (no Supabase/React/server-only import, same convention as
 * lib/admin/productPricing.ts) so it's directly unit-testable by
 * scripts/test-admin-product-variants.mts under plain Node and safely
 * importable from client components (ProductOptionEditor.tsx runs in the
 * browser to preview combinations before saving).
 */

export type OptionGroupInput = { name: string; choices: string[] };

/** Safety cap so a typo (e.g. 20 choices in 5 groups) can't try to generate millions of rows. */
export const MAX_GENERATED_VARIANTS = 200;

/**
 * Stable combination key — STEP 18 spec section 9 explicitly warns against
 * using the display string ("블랙 / S") as a key, since renaming a group's
 * *label* (not its values) would then look like a brand new combination.
 * Keys on the option VALUES only, group-name-independent, sorted so key
 * order in the source object never matters (mirrors the DB's own jsonb
 * equality semantics for product_variants.option_values).
 */
export function buildCombinationKey(optionValues: Record<string, string>): string {
  return Object.entries(optionValues)
    .map(([group, value]) => [group.trim().toLowerCase(), value.trim().toLowerCase()] as const)
    .filter(([group, value]) => group.length > 0 && value.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, value]) => `${group}:${value}`)
    .join("|");
}

function cartesianProduct(groups: { name: string; choices: string[] }[]): Record<string, string>[] {
  return groups.reduce<Record<string, string>[]>(
    (combinations, group) =>
      combinations.flatMap((combo) => group.choices.map((choice) => ({ ...combo, [group.name]: choice }))),
    [{}]
  );
}

export type GenerateCombinationsResult =
  | { ok: true; combinations: Record<string, string>[] }
  | { ok: false; error: string };

/**
 * Cartesian product of every option group's choices — STEP 18 spec section 9's
 * worked example (색상 x 사이즈 -> 6 rows). Groups with no name or no choices
 * are ignored rather than rejected, since the editor UI allows an
 * in-progress empty row while the admin is still typing.
 */
export function generateCombinations(optionGroups: OptionGroupInput[]): GenerateCombinationsResult {
  const usable = optionGroups
    .map((g) => ({ name: g.name.trim(), choices: [...new Set(g.choices.map((c) => c.trim()).filter(Boolean))] }))
    .filter((g) => g.name.length > 0 && g.choices.length > 0);

  if (usable.length === 0) return { ok: true, combinations: [] };

  const total = usable.reduce((acc, g) => acc * g.choices.length, 1);
  if (total > MAX_GENERATED_VARIANTS) {
    return { ok: false, error: `옵션 조합이 ${total}개로 너무 많습니다 (최대 ${MAX_GENERATED_VARIANTS}개). 옵션 값을 줄여주세요.` };
  }

  return { ok: true, combinations: cartesianProduct(usable) };
}

let skuSuffixCounter = 0;

function slugForSku(text: string): string {
  const cleaned = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "OPT";
}

/** STEP 18 spec section 15's optional "SKU 자동생성" — deterministic from the base product SKU + option values, with a counter fallback if two combinations happen to slugify identically. */
export function suggestSkuForCombination(baseSku: string, optionValues: Record<string, string>, existingSkus: Set<string>): string {
  const suffix = Object.values(optionValues).map(slugForSku).join("-");
  const base = `${slugForSku(baseSku)}${suffix ? `-${suffix}` : ""}`;
  let candidate = base;
  while (existingSkus.has(candidate)) {
    skuSuffixCounter += 1;
    candidate = `${base}-${skuSuffixCounter}`;
  }
  return candidate;
}

/**
 * STEP 18 spec section 9 — reconciles a freshly generated combination list
 * against the variants already in Wizard state, so editing an unrelated
 * option group (or just re-clicking "조합 생성") doesn't wipe out SKU/price/
 * stock the admin already entered for combinations that still exist.
 * Matches purely on buildCombinationKey (option VALUES), never on the old
 * display order or array index.
 */
export function reconcileVariants(
  existing: AdminProductVariant[],
  combinations: Record<string, string>[],
  baseSku: string
): AdminProductVariant[] {
  const byKey = new Map(existing.map((v) => [buildCombinationKey(v.optionValues), v]));
  const usedSkus = new Set(existing.map((v) => v.sku));

  return combinations.map((optionValues) => {
    const key = buildCombinationKey(optionValues);
    const prior = byKey.get(key);
    if (prior) return prior;

    const sku = suggestSkuForCombination(baseSku, optionValues, usedSkus);
    usedSkus.add(sku);
    return {
      id: "",
      sku,
      optionValues,
      additionalPrice: 0,
      stockQuantity: 0,
      isActive: true,
    };
  });
}

export function hasDuplicateSkus(variants: { sku: string }[]): boolean {
  const seen = new Set<string>();
  for (const v of variants) {
    const sku = v.sku.trim();
    if (!sku) continue;
    if (seen.has(sku)) return true;
    seen.add(sku);
  }
  return false;
}

/** STEP 18 spec section 13 — derived, not stored (matches lib/repositories/admin/inventory.ts's existing statusFor() convention: no separate operator-settable flag exists today). */
export function isVariantSoldOut(stockQuantity: number): boolean {
  return stockQuantity <= 0;
}

/**
 * STEP 18 spec section 20 — best-effort reconstruction for products that
 * already have product_variants rows but an empty/legacy option_groups
 * value (e.g. rows created before this step, or via the free-text
 * WizardVariantManager this step replaces). Never throws; an empty/odd
 * variant list just yields no groups, same as a genuinely option-less
 * product would.
 */
export function reconstructOptionGroupsFromVariants(variants: AdminProductVariant[]): OptionGroupInput[] {
  const order: string[] = [];
  const choicesByGroup = new Map<string, Set<string>>();

  for (const variant of variants) {
    for (const [group, value] of Object.entries(variant.optionValues)) {
      const trimmedGroup = group.trim();
      const trimmedValue = value.trim();
      if (!trimmedGroup || !trimmedValue) continue;
      if (!choicesByGroup.has(trimmedGroup)) {
        choicesByGroup.set(trimmedGroup, new Set());
        order.push(trimmedGroup);
      }
      choicesByGroup.get(trimmedGroup)!.add(trimmedValue);
    }
  }

  return order.map((name) => ({ name, choices: [...choicesByGroup.get(name)!] }));
}
