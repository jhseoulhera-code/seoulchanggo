import { getMessages } from "@/messages";
import type { Messages } from "@/messages";
import type { PaymentMethodId } from "@/types/order";
import type { LocaleCode } from "@/types/market";

const METHOD_KEY: Record<PaymentMethodId, keyof Messages["payment"]["methods"]> = {
  card: "card",
  easy_pay: "easyPay",
  bank_transfer: "bankTransfer",
  upi: "upi",
  net_banking: "netBanking",
  wallet: "wallet",
};

/** Locale-aware payment method label — the customer-facing counterpart to lib/adminLabels.ts (admin stays Korean-only per STEP 13 spec section 3). */
export function paymentMethodLabel(id: PaymentMethodId, locale: LocaleCode): string {
  return getMessages(locale).payment.methods[METHOD_KEY[id]];
}
