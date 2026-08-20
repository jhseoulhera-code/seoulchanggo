import type { Messages } from "@/messages";

export const en: Messages = {
  common: {
    continueShopping: "Continue shopping",
    backToHome: "Back to home",
  },
  market: {
    selectorTitle: "Select country",
    change: "Change",
  },
  toast: {
    addedToCart: "Added to your cart.",
    viewCart: "View cart",
    optionRequired: "Please select an option.",
    outOfStock: "Exceeds available stock.",
  },
  product: {
    outOfMarketShort: "Not shippable",
  },
  cart: {
    title: "Cart",
    empty: "Your cart is empty.",
    selectAll: "Select all",
    itemCount: "{count} items",
    groupDomestic: "Domestic",
    groupOverseasDirect: "Overseas direct",
    groupOverseasAgency: "Overseas agency",
    remove: "Remove",
    unavailableInMarket: "This item can't be shipped to {country}.",
    itemsTotal: "Items total",
    discountTotal: "Discount",
    shippingTotal: "Shipping",
    grandTotal: "Total",
    checkoutButton: "Buy selected ({count})",
    checkoutPlaceholder: "Checkout will be connected in a later step.",
  },
};
