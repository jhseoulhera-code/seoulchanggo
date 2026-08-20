import type { Product } from "@/types";
import type { CurrencyCode, Market } from "@/types/market";

/**
 * Development-only fixed conversion rates, relative to KRW = 1.
 * Replace with a real exchange-rate source when one is connected.
 */
export const DEV_EXCHANGE_RATES: Record<CurrencyCode, number> = {
  KRW: 1,
  INR: 0.06,
  USD: 0.00075,
};

export function convertFromKrw(amountKrw: number, currency: CurrencyCode): number {
  return amountKrw * DEV_EXCHANGE_RATES[currency];
}

export function formatCurrency(amount: number, currency: CurrencyCode): string {
  if (currency === "KRW") {
    return `${Math.round(amount).toLocaleString("ko-KR")}원`;
  }

  const locale = currency === "INR" ? "en-IN" : "en-US";
  const fractionDigits = currency === "INR" ? 0 : 2;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

/**
 * Resolves the display price for a base-KRW amount in the given market:
 * a market-specific override wins, otherwise falls back to a dev-rate conversion.
 */
export function resolveMarketAmount(
  amountKrw: number,
  market: Market,
  override?: number
): number {
  return typeof override === "number" ? override : convertFromKrw(amountKrw, market.currency);
}

export type ProductMarketPrice = {
  salePrice: number;
  originalPrice: number;
};

/** Resolves a product's price for the given market: a market override wins, else a dev-rate conversion of the base KRW price. */
export function getProductMarketPrice(product: Product, market: Market): ProductMarketPrice {
  const override = product.marketPrices?.[market.countryCode];
  return {
    salePrice: resolveMarketAmount(product.salePrice, market, override?.salePrice),
    originalPrice: resolveMarketAmount(product.originalPrice, market, override?.originalPrice),
  };
}
