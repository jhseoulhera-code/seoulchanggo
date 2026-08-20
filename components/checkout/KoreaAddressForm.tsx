"use client";

import { FormField } from "@/components/checkout/FormField";
import type { KoreaShippingAddress } from "@/types/order";

type KoreaAddressFormProps = {
  value: KoreaShippingAddress;
  errors: Record<string, string>;
  onChange: (field: string, value: string) => void;
};

export function KoreaAddressForm({ value, errors, onChange }: KoreaAddressFormProps) {
  return (
    <div className="flex flex-col gap-3">
      <FormField
        label="수령인 이름"
        value={value.recipientName}
        onChange={(v) => onChange("recipientName", v)}
        error={errors.recipientName}
      />
      <FormField
        label="휴대폰 번호"
        value={value.phone}
        onChange={(v) => onChange("phone", v)}
        error={errors.phone}
        placeholder="010-1234-5678"
      />
      <FormField
        label="우편번호"
        value={value.postcode}
        onChange={(v) => onChange("postcode", v)}
        error={errors.postcode}
        placeholder="12345"
      />
      <FormField
        label="주소"
        value={value.address}
        onChange={(v) => onChange("address", v)}
        error={errors.address}
      />
      <FormField
        label="상세주소"
        value={value.addressDetail}
        onChange={(v) => onChange("addressDetail", v)}
        error={errors.addressDetail}
      />
      <FormField
        label="배송 메모"
        value={value.deliveryMemo}
        onChange={(v) => onChange("deliveryMemo", v)}
        optionalTag="(선택)"
      />
    </div>
  );
}
