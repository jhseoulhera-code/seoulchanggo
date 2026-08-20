/**
 * Recent-search history (STEP 12 spec section 8) — client-only, localStorage-backed,
 * max 10 entries, most-recent-first, deduped so re-searching an existing term
 * moves it to the top instead of creating a duplicate row.
 *
 * Exposed as a useSyncExternalStore-compatible store (subscribe/snapshot)
 * rather than component state: localStorage is genuinely external state, and
 * this avoids both an SSR/client hydration mismatch and a synchronous
 * setState-on-mount effect.
 */
const STORAGE_KEY = "seoulchanggo:recentSearches";
const MAX_ENTRIES = 10;

let cachedRaw: string | null = null;
let cachedSnapshot: string[] = [];
let listeners: (() => void)[] = [];

function readSnapshot(): string[] {
  if (typeof window === "undefined") return cachedSnapshot;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedSnapshot = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    cachedSnapshot = [];
  }
  return cachedSnapshot;
}

function persist(entries: string[]): void {
  cachedSnapshot = entries;
  cachedRaw = JSON.stringify(entries);
  window.localStorage.setItem(STORAGE_KEY, cachedRaw);
  listeners.forEach((listener) => listener());
}

export function subscribeRecentSearches(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((entry) => entry !== listener);
  };
}

export function getRecentSearchesSnapshot(): string[] {
  return readSnapshot();
}

const EMPTY_SNAPSHOT: string[] = [];

export function getRecentSearchesServerSnapshot(): string[] {
  return EMPTY_SNAPSHOT;
}

export function addRecentSearch(query: string): void {
  if (typeof window === "undefined") return;
  const normalized = query.trim();
  if (!normalized) return;
  persist([normalized, ...readSnapshot().filter((entry) => entry !== normalized)].slice(0, MAX_ENTRIES));
}

export function removeRecentSearch(query: string): void {
  if (typeof window === "undefined") return;
  persist(readSnapshot().filter((entry) => entry !== query));
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  persist([]);
}
