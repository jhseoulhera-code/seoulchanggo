import type { CountryCode } from "@/types/market";
import type { PaymentMethodId } from "@/types/order";

/**
 * Which payment method ids are offered per Market. Display labels are
 * resolved separately via messages.payment.methods so they follow the
 * viewer's locale rather than being baked in here (STEP 13 spec section 19).
 */
export const PAYMENT_METHODS_BY_MARKET: Record<CountryCode, PaymentMethodId[]> = {
  KR: ["card", "easy_pay", "bank_transfer"],
  IN: ["card", "upi", "net_banking", "wallet"],
};
