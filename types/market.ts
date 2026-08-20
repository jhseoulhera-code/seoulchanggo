/** Countries this storefront currently operates as a Market (destination country). */
export type CountryCode = "KR" | "IN";

/** Broader set of real-world countries goods may physically ship from. */
export type OriginCountryCode = "KR" | "CN" | "US" | "JP" | "IN" | "VN" | "TH" | "DE";

export type LocaleCode = "ko" | "en";

export type CurrencyCode = "KRW" | "INR" | "USD";

export type InternationalShippingMethod = "SEA" | "AIR";

export type Market = {
  countryCode: CountryCode;
  countryName: string;
  locale: LocaleCode;
  currency: CurrencyCode;
};
