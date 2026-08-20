"use client";

import { FormField } from "@/components/common/FormField";
import { getMessages } from "@/messages";
import type { GuestCustomer } from "@/types/order";
import type { Market } from "@/types/market";

type CustomerFormProps = {
  market: Market;
  customer: GuestCustomer;
  errors: { name?: string; phone?: string; email?: string };
  onChange: (field: keyof GuestCustomer, value: string) => void;
};

export function CustomerForm({ market, customer, errors, onChange }: CustomerFormProps) {
  const isKr = market.countryCode === "KR";
  const messages = getMessages(market.locale);
  const labels = isKr
    ? { name: "이름", phone: "휴대폰 번호", email: "이메일" }
    : { name: "Full Name", phone: "Mobile Number", email: "Email" };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-text-main">{messages.checkout.customerSection}</h2>
      <FormField label={labels.name} value={customer.name} onChange={(v) => onChange("name", v)} error={errors.name} />
      <FormField
        label={labels.phone}
        value={customer.phone}
        onChange={(v) => onChange("phone", v)}
        error={errors.phone}
        placeholder={isKr ? "010-1234-5678" : "98765 43210"}
      />
      <FormField
        label={labels.email}
        value={customer.email}
        onChange={(v) => onChange("email", v)}
        error={errors.email}
        type="email"
      />
    </section>
  );
}
