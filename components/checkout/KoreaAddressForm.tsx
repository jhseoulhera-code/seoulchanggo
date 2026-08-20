"use client";

import { FormField } from "@/components/common/FormField";
import { getMessages } from "@/messages";
import type { KoreaShippingAddress } from "@/types/order";
import type { LocaleCode } from "@/types/market";

type KoreaAddressFormProps = {
  value: KoreaShippingAddress;
  errors: Record<string, string>;
  onChange: (field: string, value: string) => void;
  locale: LocaleCode;
};

export function KoreaAddressForm({ value, errors, onChange, locale }: KoreaAddressFormProps) {
  const messages = getMessages(locale);
  const labels = messages.address.kr;

  return (
    <div className="flex flex-col gap-3">
      <FormField
        label={labels.recipientName}
        value={value.recipientName}
        onChange={(v) => onChange("recipientName", v)}
        error={errors.recipientName}
      />
      <FormField
        label={labels.phone}
        value={value.phone}
        onChange={(v) => onChange("phone", v)}
        error={errors.phone}
        placeholder="010-1234-5678"
      />
      <FormField
        label={labels.postcode}
        value={value.postcode}
        onChange={(v) => onChange("postcode", v)}
        error={errors.postcode}
        placeholder="12345"
      />
      <FormField
        label={labels.address}
        value={value.address}
        onChange={(v) => onChange("address", v)}
        error={errors.address}
      />
      <FormField
        label={labels.addressDetail}
        value={value.addressDetail}
        onChange={(v) => onChange("addressDetail", v)}
        error={errors.addressDetail}
      />
      <FormField
        label={labels.deliveryMemo}
        value={value.deliveryMemo}
        onChange={(v) => onChange("deliveryMemo", v)}
        optionalTag={messages.address.optionalTag}
      />
    </div>
  );
}
