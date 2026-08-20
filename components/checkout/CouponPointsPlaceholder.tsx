import { getMessages } from "@/messages";
import type { Market } from "@/types/market";

type CouponPointsPlaceholderProps = {
  market: Market;
};

export function CouponPointsPlaceholder({ market }: CouponPointsPlaceholderProps) {
  const messages = getMessages(market.locale);

  return (
    <section className="flex flex-col gap-2 text-sm">
      <div className="flex items-center justify-between border border-border px-3.5 py-3">
        <span className="text-text-main">{messages.checkout.couponLabel}</span>
        <span className="text-text-secondary">{messages.checkout.couponEmpty}</span>
      </div>
      <div className="flex items-center justify-between border border-border px-3.5 py-3">
        <span className="text-text-main">{messages.checkout.pointsLabel}</span>
        <span className="text-text-secondary">{messages.checkout.pointsLoginRequired}</span>
      </div>
    </section>
  );
}
