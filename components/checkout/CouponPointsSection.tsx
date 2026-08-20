"use client";

import { useEffect, useState } from "react";
import { applyCouponAction, listAvailableCouponsAction, type AvailableCoupon } from "@/lib/actions/coupon";
import { getMyPointBalanceAction } from "@/lib/actions/points";
import { formatCurrency } from "@/lib/currency";
import { formatNumber } from "@/lib/intl";
import { maxUsablePoints, POINTS_MIN_USE } from "@/lib/pointsPolicy";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { MARKETS } from "@/data/markets";
import { getMessages, t } from "@/messages";
import type { Market } from "@/types/market";

type AppliedCoupon = { id: string; code: string; discountAmount: number };

export type CouponPointsState = {
  couponId: string | null;
  couponCode: string | null;
  couponDiscount: number;
  pointsUsed: number;
};

type CouponPointsSectionProps = {
  market: Market;
  isAuthenticated: boolean;
  payableAmount: number;
  productSlugs: string[];
  onChange: (state: CouponPointsState) => void;
};

export function CouponPointsSection({ market, isAuthenticated, payableAmount, productSlugs, onChange }: CouponPointsSectionProps) {
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponPending, setCouponPending] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<AvailableCoupon[]>([]);

  const [pointBalance, setPointBalance] = useState(0);
  const [pointsInput, setPointsInput] = useState("");
  const [pointsError, setPointsError] = useState<string | null>(null);

  const configured = isSupabaseConfigured();
  const messages = getMessages(market.locale);

  useEffect(() => {
    if (!configured || !isAuthenticated) return;
    listAvailableCouponsAction(market.countryCode).then(setAvailableCoupons);
    getMyPointBalanceAction().then(setPointBalance);
  }, [configured, isAuthenticated, market.countryCode]);

  const pointsUsed = Number(pointsInput) || 0;
  const remainingAfterCoupon = Math.max(0, payableAmount - (appliedCoupon?.discountAmount ?? 0));
  const maxUsable = maxUsablePoints(remainingAfterCoupon, pointBalance);

  useEffect(() => {
    onChange({
      couponId: appliedCoupon?.id ?? null,
      couponCode: appliedCoupon?.code ?? null,
      couponDiscount: appliedCoupon?.discountAmount ?? 0,
      pointsUsed,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedCoupon, pointsUsed]);

  async function applyCode(code: string) {
    if (!code.trim()) {
      setCouponError(messages.coupon.codeRequired);
      return;
    }
    setCouponPending(true);
    setCouponError(null);
    const result = await applyCouponAction(code, market.countryCode, market.currency, payableAmount, productSlugs);
    setCouponPending(false);
    if (!result.ok) {
      setCouponError(result.error);
      return;
    }
    setAppliedCoupon({ id: result.couponId, code: code.trim().toUpperCase(), discountAmount: result.discountAmount });
    setCouponCodeInput("");
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponError(null);
  }

  function handlePointsChange(value: string) {
    setPointsInput(value);
    const numeric = Number(value) || 0;
    if (numeric === 0) {
      setPointsError(null);
      return;
    }
    if (numeric < POINTS_MIN_USE) {
      setPointsError(t(messages.points.minUse, { min: formatNumber(POINTS_MIN_USE, market.locale) }));
    } else if (numeric > pointBalance) {
      setPointsError(messages.points.exceedsBalance);
    } else if (numeric > maxUsable) {
      setPointsError(t(messages.points.maxUse, { max: formatNumber(maxUsable, market.locale) }));
    } else {
      setPointsError(null);
    }
  }

  if (!configured) {
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

  return (
    <section className="flex flex-col gap-3 text-sm">
      <div className="flex flex-col gap-2 border border-border p-3.5">
        <span className="font-bold text-text-main">{messages.checkout.couponLabel}</span>
        {appliedCoupon ? (
          <div className="flex items-center justify-between">
            <span className="text-primary">
              {appliedCoupon.code} {messages.coupon.applied} (-{formatCurrency(appliedCoupon.discountAmount, market.currency)})
            </span>
            <button type="button" onClick={removeCoupon} className="text-xs text-text-secondary underline">
              {messages.coupon.remove}
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                value={couponCodeInput}
                onChange={(e) => setCouponCodeInput(e.target.value)}
                placeholder={messages.coupon.codePlaceholder}
                className="flex-1 border border-border px-2.5 py-1.5 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => applyCode(couponCodeInput)}
                disabled={couponPending}
                className="border border-primary px-3 py-1.5 text-xs font-bold text-primary disabled:opacity-50"
              >
                {messages.coupon.apply}
              </button>
            </div>
            {isAuthenticated && availableCoupons.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {availableCoupons.map((coupon) => (
                  <button
                    key={coupon.id}
                    type="button"
                    onClick={() => applyCode(coupon.code)}
                    className="flex items-center justify-between border border-border px-2.5 py-1.5 text-left text-xs text-text-secondary hover:border-primary hover:text-primary"
                  >
                    <span>{coupon.name}</span>
                    <span>
                      {coupon.discountType === "PERCENT"
                        ? `${coupon.discountValue}%`
                        : formatCurrency(coupon.discountValue, MARKETS[market.countryCode].currency)}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {couponError && <p className="text-xs text-red-600">{couponError}</p>}
          </>
        )}
      </div>

      <div className="flex flex-col gap-2 border border-border p-3.5">
        <span className="font-bold text-text-main">{messages.checkout.pointsLabel}</span>
        {isAuthenticated ? (
          <>
            <p className="text-xs text-text-secondary">{messages.points.balance} {formatNumber(pointBalance, market.locale)}P</p>
            <div className="flex gap-2">
              <input
                type="number"
                value={pointsInput}
                onChange={(e) => handlePointsChange(e.target.value)}
                placeholder={messages.points.usePlaceholder}
                className="flex-1 border border-border px-2.5 py-1.5 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => handlePointsChange(String(maxUsable))}
                className="border border-border px-3 py-1.5 text-xs font-bold text-text-secondary"
              >
                {messages.points.useAll}
              </button>
            </div>
            {pointsError && <p className="text-xs text-red-600">{pointsError}</p>}
          </>
        ) : (
          <span className="text-xs text-text-secondary">{messages.checkout.pointsLoginRequired}</span>
        )}
      </div>
    </section>
  );
}
