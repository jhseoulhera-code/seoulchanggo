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
  checkout: {
    pageTitle: string;
    itemsSection: string;
    customerSection: string;
    addressSection: string;
    customsSection: string;
    customsNotice: string;
    customsCodeLabel: string;
    paymentSection: string;
    agreementText: string;
    submitButton: string;
    total: string;
    blockedTitle: string;
    backToCart: string;
    marketChangedNotice: string;
    emptyTitle: string;
    couponLabel: string;
    couponEmpty: string;
    pointsLabel: string;
    pointsLoginRequired: string;
    optionalTag: string;
  };
  order: {
    completeTitle: string;
    completeMessage: string;
    orderNumber: string;
    orderDate: string;
    total: string;
    viewOrders: string;
    lookupTitle: string;
    lookupOrderId: string;
    lookupContact: string;
    lookupSubmit: string;
    lookupNotFound: string;
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
