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
