import type { CountryCode, LocaleCode } from "@/types/market";

/**
 * Common Intl formatting (STEP 13 spec sections 10-12, 34) — the single
 * place every number/date/time display goes through, replacing scattered
 * hardcoded `.toLocaleString("ko-KR")` calls that ignored the viewer's
 * actual locale.
 */
const INTL_LOCALE: Record<LocaleCode, string> = { ko: "ko-KR", en: "en-US" };

/**
 * DB timestamps are always stored as UTC (Postgres timestamptz — see
 * supabase/migrations). Display converts to the shipping Market's own
 * timezone rather than the visitor's device timezone, so an order's date
 * reads consistently regardless of where the customer happens to be when
 * they look at it. KR/IN are the only two Markets today; extend this map
 * alongside data/markets.ts when a new one is added.
 */
const MARKET_TIME_ZONE: Record<CountryCode, string> = {
  KR: "Asia/Seoul",
  IN: "Asia/Kolkata",
};

export function getMarketTimeZone(countryCode: CountryCode): string {
  return MARKET_TIME_ZONE[countryCode];
}

export function formatNumber(value: number, locale: LocaleCode): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

export function formatDate(iso: string, locale: LocaleCode, timeZone?: string): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    year: "numeric",
    month: locale === "ko" ? "numeric" : "short",
    day: "numeric",
    timeZone,
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, locale: LocaleCode, timeZone?: string): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    year: "numeric",
    month: locale === "ko" ? "numeric" : "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}
