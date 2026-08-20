/**
 * SEO locale groundwork (STEP 13 spec sections 32-33) — minimal, scoped to
 * what's useful before a real production domain exists: an env-based
 * canonical base URL for Next.js's `metadataBase`, and per-page
 * title/description via each page's own `generateMetadata`.
 *
 * Deliberately does NOT emit hreflang alternates: this app has no
 * locale-prefixed routing (/ko/..., /en/...) — every page is a single URL
 * whose language is a client-side preference (see
 * contexts/MarketContext.tsx), not a distinct route. Declaring hreflang
 * pairs that all resolve to the same URL would be misleading rather than
 * useful; real hreflang support belongs with the locale-routing rework
 * spec section 31 explicitly leaves out of this step's scope.
 */
const DEFAULT_SITE_URL = "http://localhost:3000";

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
}
