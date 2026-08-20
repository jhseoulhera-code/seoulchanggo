import { getMessages } from "@/messages";
import type { ShippingType } from "@/types";
import type { LocaleCode } from "@/types/market";

/**
 * Locale-aware shipping type label (STEP 13 spec section 13) — replaces
 * reading the pre-localized `product.shippingLabel`/`shippingGroup` label
 * strings that were always Korean regardless of the viewer's locale (those
 * fields are computed once at data-fetch time, before locale is known).
 */
export function shippingTypeLabel(type: ShippingType, locale: LocaleCode): string {
  const messages = getMessages(locale);
  switch (type) {
    case "domestic":
      return messages.shipping.domestic;
    case "overseas_direct":
      return messages.shipping.overseasDirect;
    case "overseas_agent":
      return messages.shipping.overseasAgency;
  }
}
