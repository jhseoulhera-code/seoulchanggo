import type { CountryCode } from "@/types/market";
import type { PaymentMethodOption } from "@/types/order";

export const PAYMENT_METHODS_BY_MARKET: Record<CountryCode, PaymentMethodOption[]> = {
  KR: [
    { id: "card", label: "신용/체크카드" },
    { id: "easy_pay", label: "간편결제" },
    { id: "bank_transfer", label: "계좌이체" },
  ],
  IN: [
    { id: "card", label: "Card" },
    { id: "upi", label: "UPI" },
    { id: "net_banking", label: "Net Banking" },
    { id: "wallet", label: "Wallet" },
  ],
};
