"use client";

import { FormField } from "@/components/common/FormField";
import { INDIA_STATES } from "@/data/indiaStates";
import { cn } from "@/lib/utils";
import { getMessages } from "@/messages";
import type { IndiaShippingAddress } from "@/types/order";
import type { LocaleCode } from "@/types/market";

type IndiaAddressFormProps = {
  value: IndiaShippingAddress;
  errors: Record<string, string>;
  onChange: (field: string, value: string) => void;
  locale: LocaleCode;
};

export function IndiaAddressForm({ value, errors, onChange, locale }: IndiaAddressFormProps) {
  const messages = getMessages(locale);
  const labels = messages.address.in;

  return (
    <div className="flex flex-col gap-3">
      <FormField
        label={labels.fullName}
        value={value.fullName}
        onChange={(v) => onChange("fullName", v)}
        error={errors.fullName}
      />
      <FormField
        label={labels.mobileNumber}
        value={value.mobileNumber}
        onChange={(v) => onChange("mobileNumber", v)}
        error={errors.mobileNumber}
        placeholder="98765 43210"
      />
      <FormField
        label={labels.addressLine1}
        value={value.addressLine1}
        onChange={(v) => onChange("addressLine1", v)}
        error={errors.addressLine1}
      />
      <FormField
        label={labels.addressLine2}
        value={value.addressLine2}
        onChange={(v) => onChange("addressLine2", v)}
        optionalTag={messages.address.optionalTag}
      />
      <FormField label={labels.city} value={value.city} onChange={(v) => onChange("city", v)} error={errors.city} />

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-xs font-medium text-text-secondary">{labels.state}</span>
        <select
          value={value.state}
          onChange={(event) => onChange("state", event.target.value)}
          className={cn(
            "border bg-white px-3 py-2.5 text-sm text-text-main outline-none",
            errors.state ? "border-red-500" : "border-border"
          )}
        >
          <option value="">{labels.selectState}</option>
          {INDIA_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
        {errors.state && <span className="text-xs text-red-600">{errors.state}</span>}
      </label>

      <FormField
        label={labels.pinCode}
        value={value.pinCode}
        onChange={(v) => onChange("pinCode", v)}
        error={errors.pinCode}
        placeholder="560001"
      />
      <FormField
        label={labels.deliveryInstructions}
        value={value.deliveryInstructions}
        onChange={(v) => onChange("deliveryInstructions", v)}
        optionalTag={messages.address.optionalTag}
      />
    </div>
  );
}
