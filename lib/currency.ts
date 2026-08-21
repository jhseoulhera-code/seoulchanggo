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

export type ProductMarketPrice = {
  salePrice: number;
  originalPrice: number;
  /**
   * True when this price came from an admin-entered row for the selected
   * CURRENCY (product_prices with currency_code = market.currency), false
   * when it's a dev-rate conversion from the KRW base price. STEP 14
   * production policy: real order creation must refuse an inexplicit price
   * in production — see lib/actions/order.ts.
   */
  isExplicit: boolean;
};

/**
 * Resolves a product's price for the given market's CURRENCY — never its
 * country. STEP 13 decoupled Currency from Market ("Market과 Currency를
 * 완전히 동일 개념으로 묶지 않는다"), so a KR customer can pick INR and an IN
 * customer can pick KRW; a price row entered for the IN market is always
 * INR-denominated regardless of which country the viewer is shipping to, so
 * this must key off market.currency, never market.countryCode (keying by
 * country previously meant an IN customer who switched their display
 * currency to KRW would get product.marketPrices.IN's raw INR number
 * treated as if it were already a KRW amount — a ~15x underprice).
 */
export function getProductMarketPrice(product: Product, market: Market): ProductMarketPrice {
  if (market.currency === "USD") {
    if (product.globalPrice && product.globalPrice.salePrice > 0) {
      return { salePrice: product.globalPrice.salePrice, originalPrice: product.globalPrice.originalPrice, isExplicit: true };
    }
    return {
      salePrice: convertFromKrw(product.salePrice, "USD"),
      originalPrice: convertFromKrw(product.originalPrice, "USD"),
      isExplicit: false,
    };
  }

  if (market.currency === "INR") {
    // IN is the only market whose product_prices row is INR-denominated today.
    const override = product.marketPrices?.IN;
    if (override) {
      return { salePrice: override.salePrice, originalPrice: override.originalPrice, isExplicit: true };
    }
    return {
      salePrice: convertFromKrw(product.salePrice, "INR"),
      originalPrice: convertFromKrw(product.originalPrice, "INR"),
      isExplicit: false,
    };
  }

  // KRW is always the base price entered for the KR market — never a dev-rate conversion.
  return { salePrice: product.salePrice, originalPrice: product.originalPrice, isExplicit: product.salePrice > 0 };
}
