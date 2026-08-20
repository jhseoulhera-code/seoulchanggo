"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { DEFAULT_MARKET_CODE, MARKETS } from "@/data/markets";
import type { CountryCode, CurrencyCode, LocaleCode, Market } from "@/types/market";

const MARKET_STORAGE_KEY = "seoulchanggo:market";
const LOCALE_STORAGE_KEY = "seoulchanggo:localeOverride";
const CURRENCY_STORAGE_KEY = "seoulchanggo:currencyOverride";

const LOCALE_CODES: LocaleCode[] = ["ko", "en"];
const CURRENCY_CODES: CurrencyCode[] = ["KRW", "INR", "USD"];

function isCountryCode(value: string): value is CountryCode {
  return value in MARKETS;
}

function isLocaleCode(value: string): value is LocaleCode {
  return (LOCALE_CODES as string[]).includes(value);
}

function isCurrencyCode(value: string): value is CurrencyCode {
  return (CURRENCY_CODES as string[]).includes(value);
}

type StoreSnapshot = {
  countryCode: CountryCode;
  localeOverride: LocaleCode | null;
  currencyOverride: CurrencyCode | null;
};

let currentCountryCode: CountryCode = DEFAULT_MARKET_CODE;
let currentLocaleOverride: LocaleCode | null = null;
let currentCurrencyOverride: CurrencyCode | null = null;
let initialized = false;
const listeners = new Set<() => void>();

/**
 * A user-picked locale/currency is a deliberate, durable choice (STEP 13
 * spec sections 1, 30: "Market과 Locale/Currency를 완전히 동일 개념으로 묶지
 * 않는다", "사용자가 수동 선택한 locale을 무조건 덮어쓰지 않도록") — so it is
 * never reset when the country Market changes. Each override starts null
 * ("follow the Market's default") and only becomes non-null via an explicit
 * setLocale/setCurrency call.
 */
let cachedSnapshot: StoreSnapshot = {
  countryCode: currentCountryCode,
  localeOverride: currentLocaleOverride,
  currencyOverride: currentCurrencyOverride,
};

function refreshSnapshot() {
  cachedSnapshot = {
    countryCode: currentCountryCode,
    localeOverride: currentLocaleOverride,
    currencyOverride: currentCurrencyOverride,
  };
}

function ensureInitialized() {
  if (initialized || typeof window === "undefined") return;
  const storedCountry = window.localStorage.getItem(MARKET_STORAGE_KEY);
  if (storedCountry && isCountryCode(storedCountry)) currentCountryCode = storedCountry;
  const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (storedLocale && isLocaleCode(storedLocale)) currentLocaleOverride = storedLocale;
  const storedCurrency = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
  if (storedCurrency && isCurrencyCode(storedCurrency)) currentCurrencyOverride = storedCurrency;
  refreshSnapshot();
  initialized = true;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): StoreSnapshot {
  ensureInitialized();
  return cachedSnapshot;
}

const SERVER_SNAPSHOT: StoreSnapshot = { countryCode: DEFAULT_MARKET_CODE, localeOverride: null, currencyOverride: null };

function getServerSnapshot(): StoreSnapshot {
  return SERVER_SNAPSHOT;
}

function notify() {
  refreshSnapshot();
  listeners.forEach((listener) => listener());
}

function setCountryCode(countryCode: CountryCode) {
  currentCountryCode = countryCode;
  if (typeof window !== "undefined") window.localStorage.setItem(MARKET_STORAGE_KEY, countryCode);
  notify();
}

function setLocaleOverride(locale: LocaleCode | null) {
  currentLocaleOverride = locale;
  if (typeof window !== "undefined") {
    if (locale) window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    else window.localStorage.removeItem(LOCALE_STORAGE_KEY);
  }
  notify();
}

function setCurrencyOverride(currency: CurrencyCode | null) {
  currentCurrencyOverride = currency;
  if (typeof window !== "undefined") {
    if (currency) window.localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
    else window.localStorage.removeItem(CURRENCY_STORAGE_KEY);
  }
  notify();
}

type MarketContextValue = {
  /**
   * market.locale / market.currency are the EFFECTIVE values (Market default,
   * overridden by localeOverride/currencyOverride when set) — every existing
   * `market.locale`/`market.currency` read across the app keeps working
   * unchanged and automatically respects a user's manual override.
   */
  market: Market;
  setMarketByCountry: (countryCode: CountryCode) => void;
  localeOverride: LocaleCode | null;
  setLocale: (locale: LocaleCode | null) => void;
  currencyOverride: CurrencyCode | null;
  setCurrency: (currency: CurrencyCode | null) => void;
};

const MarketContext = createContext<MarketContextValue | null>(null);

export function MarketProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const value = useMemo<MarketContextValue>(() => {
    const base = MARKETS[snapshot.countryCode];
    const market: Market = {
      ...base,
      locale: snapshot.localeOverride ?? base.locale,
      currency: snapshot.currencyOverride ?? base.currency,
    };
    return {
      market,
      setMarketByCountry: setCountryCode,
      localeOverride: snapshot.localeOverride,
      setLocale: setLocaleOverride,
      currencyOverride: snapshot.currencyOverride,
      setCurrency: setCurrencyOverride,
    };
  }, [snapshot]);

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketContextValue {
  const context = useContext(MarketContext);
  if (!context) {
    throw new Error("useMarket must be used within a MarketProvider");
  }
  return context;
}
