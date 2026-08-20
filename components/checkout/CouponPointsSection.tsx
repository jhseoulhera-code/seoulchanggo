"use client";

import { useEffect, useState } from "react";
import { applyCouponAction, listAvailableCouponsAction, type AvailableCoupon } from "@/lib/actions/coupon";
import { getMyPointBalanceAction } from "@/lib/actions/points";
import { formatCurrency } from "@/lib/currency";
import { maxUsablePoints, POINTS_MIN_USE } from "@/lib/pointsPolicy";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getMessages } from "@/messages";
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
      setCouponError("쿠폰 코드를 입력해주세요.");
      return;
    }
    setCouponPending(true);
    setCouponError(null);
    const result = await applyCouponAction(code, market.countryCode, payableAmount, productSlugs);
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
      setPointsError(`최소 ${POINTS_MIN_USE.toLocaleString("ko-KR")}포인트부터 사용할 수 있습니다.`);
    } else if (numeric > pointBalance) {
      setPointsError("보유 포인트를 초과했습니다.");
    } else if (numeric > maxUsable) {
      setPointsError(`최대 ${maxUsable.toLocaleString("ko-KR")}포인트까지 사용할 수 있습니다.`);
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
              {appliedCoupon.code} 적용됨 (-{formatCurrency(appliedCoupon.discountAmount, market.currency)})
            </span>
            <button type="button" onClick={removeCoupon} className="text-xs text-text-secondary underline">
              해제
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                value={couponCodeInput}
                onChange={(e) => setCouponCodeInput(e.target.value)}
                placeholder="쿠폰 코드 입력"
                className="flex-1 border border-border px-2.5 py-1.5 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => applyCode(couponCodeInput)}
                disabled={couponPending}
                className="border border-primary px-3 py-1.5 text-xs font-bold text-primary disabled:opacity-50"
              >
                적용
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
                    <span>{coupon.discountType === "PERCENT" ? `${coupon.discountValue}%` : formatCurrency(coupon.discountValue, market.currency)}</span>
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
            <p className="text-xs text-text-secondary">보유 {pointBalance.toLocaleString("ko-KR")}P</p>
            <div className="flex gap-2">
              <input
                type="number"
                value={pointsInput}
                onChange={(e) => handlePointsChange(e.target.value)}
                placeholder="사용할 포인트"
                className="flex-1 border border-border px-2.5 py-1.5 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => handlePointsChange(String(maxUsable))}
                className="border border-border px-3 py-1.5 text-xs font-bold text-text-secondary"
              >
                전액사용
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
