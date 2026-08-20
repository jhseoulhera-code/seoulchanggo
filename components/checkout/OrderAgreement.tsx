import { getMessages } from "@/messages";
import type { Market } from "@/types/market";

type OrderAgreementProps = {
  market: Market;
  checked: boolean;
  error?: string;
  onChange: (checked: boolean) => void;
};

export function OrderAgreement({ market, checked, error, onChange }: OrderAgreementProps) {
  const messages = getMessages(market.locale);

  return (
    <div className="border-t border-border pt-4">
      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
        />
        <span className="text-text-main">{messages.checkout.agreementText}</span>
      </label>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </div>
  );
}
