"use client";

import { IndiaAddressForm } from "@/components/checkout/IndiaAddressForm";
import { KoreaAddressForm } from "@/components/checkout/KoreaAddressForm";
import { getMessages } from "@/messages";
import type { Market } from "@/types/market";
import type { ShippingAddress } from "@/types/order";

type AddressFormProps = {
  market: Market;
  address: ShippingAddress;
  errors: Record<string, string>;
  onChange: (field: string, value: string) => void;
};

/**
 * Dispatches to a market-specific address form. Add a new market's form here
 * (e.g. UsAddressForm) and widen ShippingAddress instead of branching deeper.
 */
export function AddressForm({ market, address, errors, onChange }: AddressFormProps) {
  const messages = getMessages(market.locale);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-text-main">{messages.checkout.addressSection}</h2>
      {address.country === "KR" ? (
        <KoreaAddressForm value={address} errors={errors} onChange={onChange} locale={market.locale} />
      ) : (
        <IndiaAddressForm value={address} errors={errors} onChange={onChange} locale={market.locale} />
      )}
    </section>
  );
}
