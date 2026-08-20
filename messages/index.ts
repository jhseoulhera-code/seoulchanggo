import { en } from "@/messages/en";
import { ko } from "@/messages/ko";
import type { LocaleCode } from "@/types/market";

export type Messages = {
  common: {
    continueShopping: string;
    backToHome: string;
  };
  market: {
    selectorTitle: string;
    change: string;
  };
  toast: {
    addedToCart: string;
    viewCart: string;
    optionRequired: string;
    outOfStock: string;
  };
  product: {
    outOfMarketShort: string;
  };
  cart: {
    title: string;
    empty: string;
    selectAll: string;
    itemCount: string;
    groupDomestic: string;
    groupOverseasDirect: string;
    groupOverseasAgency: string;
    remove: string;
    unavailableInMarket: string;
    itemsTotal: string;
    discountTotal: string;
    shippingTotal: string;
    grandTotal: string;
    checkoutButton: string;
    checkoutPlaceholder: string;
  };
};

const MESSAGES: Record<LocaleCode, Messages> = { ko, en };

export function getMessages(locale: LocaleCode): Messages {
  return MESSAGES[locale];
}

export function t(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template
  );
}
