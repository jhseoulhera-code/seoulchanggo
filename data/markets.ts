import type { CountryCode, Market } from "@/types/market";

export const MARKETS: Record<CountryCode, Market> = {
  KR: {
    countryCode: "KR",
    countryName: "대한민국",
    locale: "ko",
    currency: "KRW",
  },
  IN: {
    countryCode: "IN",
    countryName: "India",
    locale: "en",
    currency: "INR",
  },
};

export const MARKET_LIST: Market[] = Object.values(MARKETS);

export const DEFAULT_MARKET_CODE: CountryCode = "KR";
