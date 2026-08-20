"use client";

import { FormField } from "@/components/common/FormField";
import { INDIA_STATES } from "@/data/indiaStates";
import { cn } from "@/lib/utils";
import type { IndiaShippingAddress } from "@/types/order";

type IndiaAddressFormProps = {
  value: IndiaShippingAddress;
  errors: Record<string, string>;
  onChange: (field: string, value: string) => void;
};

export function IndiaAddressForm({ value, errors, onChange }: IndiaAddressFormProps) {
  return (
    <div className="flex flex-col gap-3">
      <FormField
        label="Full Name"
        value={value.fullName}
        onChange={(v) => onChange("fullName", v)}
        error={errors.fullName}
      />
      <FormField
        label="Mobile Number"
        value={value.mobileNumber}
        onChange={(v) => onChange("mobileNumber", v)}
        error={errors.mobileNumber}
        placeholder="98765 43210"
      />
      <FormField
        label="Address Line 1"
        value={value.addressLine1}
        onChange={(v) => onChange("addressLine1", v)}
        error={errors.addressLine1}
      />
      <FormField
        label="Address Line 2"
        value={value.addressLine2}
        onChange={(v) => onChange("addressLine2", v)}
        optionalTag="(optional)"
      />
      <FormField label="City" value={value.city} onChange={(v) => onChange("city", v)} error={errors.city} />

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-xs font-medium text-text-secondary">State</span>
        <select
          value={value.state}
          onChange={(event) => onChange("state", event.target.value)}
          className={cn(
            "border bg-white px-3 py-2.5 text-sm text-text-main outline-none",
            errors.state ? "border-red-500" : "border-border"
          )}
        >
          <option value="">Select state</option>
          {INDIA_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
        {errors.state && <span className="text-xs text-red-600">{errors.state}</span>}
      </label>

      <FormField
        label="PIN Code"
        value={value.pinCode}
        onChange={(v) => onChange("pinCode", v)}
        error={errors.pinCode}
        placeholder="560001"
      />
      <FormField
        label="Delivery Instructions"
        value={value.deliveryInstructions}
        onChange={(v) => onChange("deliveryInstructions", v)}
        optionalTag="(optional)"
      />
    </div>
  );
}
