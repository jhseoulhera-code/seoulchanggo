/**
 * Shared query normalization (STEP 12 spec section 5) — used by the search
 * repository, header autocomplete, and search-event logging so "  Tumbler  "
 * and "tumbler" are treated as the same query everywhere.
 */
const MAX_QUERY_LENGTH = 100;

export function normalizeSearchQuery(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .slice(0, MAX_QUERY_LENGTH);
}

export function isValidSearchQuery(raw: string): boolean {
  return normalizeSearchQuery(raw).length > 0;
}

/** Escapes PostgREST ilike wildcards (%, _) in user input before building an ilike pattern. */
export function escapeIlikePattern(value: string): string {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

/**
 * STEP 14 security audit finding — a raw `.or("col.ilike.PATTERN,col2...")`
 * string is built by hand wherever this is used (lib/repositories/products.ts,
 * lib/repositories/admin/orders.ts): `,` separates OR conditions and `(`/`)`
 * group them in PostgREST's filter-list syntax, so a search term containing
 * those characters could prematurely close the intended clause and append an
 * attacker-controlled condition. escapeIlikePattern only escapes ILIKE's own
 * wildcards (%, _), which is a different layer — this strips PostgREST's
 * filter-list metacharacters instead of trying to quote/escape them, since a
 * product-name search has no legitimate need for literal commas/parens.
 */
export function sanitizeForOrFilter(value: string): string {
  return value.replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();
}
