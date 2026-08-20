"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { DEFAULT_MARKET_CODE, MARKETS } from "@/data/markets";
import type { CountryCode, Market } from "@/types/market";

const MARKET_STORAGE_KEY = "seoulchanggo:market";

function isCountryCode(value: string): value is CountryCode {
  return value in MARKETS;
}

let currentCountryCode: CountryCode = DEFAULT_MARKET_CODE;
let initialized = false;
const listeners = new Set<() => void>();

function ensureInitialized() {
  if (initialized || typeof window === "undefined") return;
  const stored = window.localStorage.getItem(MARKET_STORAGE_KEY);
  if (stored && isCountryCode(stored)) {
    currentCountryCode = stored;
  }
  initialized = true;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): CountryCode {
  ensureInitialized();
  return currentCountryCode;
}

function getServerSnapshot(): CountryCode {
  return DEFAULT_MARKET_CODE;
}

function setCountryCode(countryCode: CountryCode) {
  currentCountryCode = countryCode;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(MARKET_STORAGE_KEY, countryCode);
  }
  listeners.forEach((listener) => listener());
}

type MarketContextValue = {
  market: Market;
  setMarketByCountry: (countryCode: CountryCode) => void;
};

const MarketContext = createContext<MarketContextValue | null>(null);

export function MarketProvider({ children }: { children: ReactNode }) {
  const countryCode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const value = useMemo<MarketContextValue>(
    () => ({
      market: MARKETS[countryCode],
      setMarketByCountry: setCountryCode,
    }),
    [countryCode]
  );

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketContextValue {
  const context = useContext(MarketContext);
  if (!context) {
    throw new Error("useMarket must be used within a MarketProvider");
  }
  return context;
}
