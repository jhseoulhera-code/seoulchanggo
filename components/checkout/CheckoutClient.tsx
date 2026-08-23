"use client";

import { AlertTriangle, PackageSearch } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PageContainer } from "@/components/common/PageContainer";
import { Toast } from "@/components/common/Toast";
import type { ToastState } from "@/components/common/Toast";
import { ListHeader } from "@/components/layout/ListHeader";
import { AddressForm } from "@/components/checkout/AddressForm";
import { CheckoutItemGroup } from "@/components/checkout/CheckoutItemGroup";
import { CheckoutSummary } from "@/components/checkout/CheckoutSummary";
import { CouponPointsSection } from "@/components/checkout/CouponPointsSection";
import type { CouponPointsState } from "@/components/checkout/CouponPointsSection";
import { CustomerForm } from "@/components/checkout/CustomerForm";
import { CustomsInfoSection } from "@/components/checkout/CustomsInfoSection";
import { OrderAgreement } from "@/components/checkout/OrderAgreement";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useMarket } from "@/contexts/MarketContext";
import { PAYMENT_METHODS_BY_MARKET } from "@/data/paymentMethods";
import {
  buildCheckoutItemFromBuyNow,
  buildCheckoutItemsFromCart,
  buildOrderShippingGroups,
  calculateCheckoutSummary,
  groupCheckoutItemsByShippingType,
} from "@/lib/checkout";
import { computeGroupShippingQuote, isGrandTotalDetermined } from "@/lib/shipping/quote";
import { clearBuyNowItem, getBuyNowItem } from "@/lib/buyNow";
import { clearCheckoutIdempotencyKey, generateOrderId, getOrCreateCheckoutIdempotencyKey, saveGuestOrder } from "@/lib/order";
import { attemptPayment as runAttemptPayment } from "@/lib/paymentRetry";
import { createOrderAction } from "@/lib/actions/order";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  isNonEmpty,
  isValidCustomsCode,
  isValidEmail,
  isValidInPhone,
  isValidInPincode,
  isValidKrPhone,
  isValidKrPostcode,
} from "@/lib/validation";
import { getMessages } from "@/messages";
import type { Product } from "@/types";
import type { CountryCode } from "@/types/market";
import type { GuestCustomer, Order, PaymentMethodId, ShippingAddress } from "@/types/order";

function createEmptyAddress(countryCode: CountryCode): ShippingAddress {
  if (countryCode === "KR") {
    return {
      country: "KR",
      recipientName: "",
      phone: "",
      postcode: "",
      address: "",
      addressDetail: "",
      deliveryMemo: "",
    };
  }
  return {
    country: "IN",
    fullName: "",
    mobileNumber: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pinCode: "",
    deliveryInstructions: "",
  };
}

type CheckoutClientProps = {
  products: Product[];
};

export function CheckoutClient({ products }: CheckoutClientProps) {
  const { market } = useMarket();
  const cart = useCart();
  const { currentUser, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get("source") === "buynow" ? "buynow" : "cart";
  const messages = getMessages(market.locale);
  const checkoutReturnTo = source === "buynow" ? "/checkout?source=buynow" : "/checkout";

  // STEP 22 — one key per checkout attempt, kept in sessionStorage (not just
  // this component's state) so a page reload mid-attempt reuses it too; see
  // lib/order.ts's own doc comment for why it's only cleared on success.
  const idempotencyKey = useMemo(() => getOrCreateCheckoutIdempotencyKey(source), [source]);

  const checkoutItems = useMemo(() => {
    if (source === "buynow") {
      const buyNow = getBuyNowItem();
      if (!buyNow) return [];
      const item = buildCheckoutItemFromBuyNow(buyNow, products, market);
      return item ? [item] : [];
    }
    return buildCheckoutItemsFromCart(cart.items, products, market);
  }, [source, cart.items, products, market]);

  // STEP 21 — an item that's sold out or lost its variant/active status
  // (isPurchasable false) is exactly as much a blocker as one that isn't
  // shippable to this market (isAvailable false): both make the whole
  // checkout attempt unsafe to submit, same all-or-nothing gate as before.
  const unavailableItems = checkoutItems.filter((item) => !item.isAvailable || !item.isPurchasable);
  const availableItems = checkoutItems.filter((item) => item.isAvailable && item.isPurchasable);
  const groups = useMemo(() => groupCheckoutItemsByShippingType(availableItems), [availableItems]);
  const totals = useMemo(() => calculateCheckoutSummary(checkoutItems), [checkoutItems]);
  // STEP 21 — each shipping group (domestic/overseas_direct/overseas_agent) gets its own
  // independent quote instead of one shared shipping fee, so a mixed cart's three
  // fulfillment paths never collapse into a single number. Every item reaching this point
  // already passed the isAvailable gate above, so isShippable is trivially true here — the
  // false branch exists for honesty/forward-compatibility (see computeGroupShippingQuote).
  const shippingQuotes = useMemo(
    () =>
      new Map(
        groups.map((group) => [
          group.shippingType,
          computeGroupShippingQuote(group.shippingType, group.items, market.currency, true),
        ])
      ),
    [groups, market.currency]
  );
  const isTotalPending = !isGrandTotalDetermined(Array.from(shippingQuotes.values()));
  const hasOverseasItem = availableItems.some((item) => item.shippingType !== "domestic");
  const needsCustomsCode = market.countryCode === "KR" && hasOverseasItem;
  const paymentOptions = PAYMENT_METHODS_BY_MARKET[market.countryCode];

  const [couponPoints, setCouponPoints] = useState<CouponPointsState>({
    couponId: null,
    couponCode: null,
    couponDiscount: 0,
    pointsUsed: 0,
  });
  const finalTotal = Math.max(0, totals.grandTotal - couponPoints.couponDiscount - couponPoints.pointsUsed);
  // Coupon/points aren't a separate row in CheckoutSummary — folded into discountTotal so
  // the existing summary card needs no changes, with the breakdown already visible above
  // in CouponPointsSection itself.
  const summaryTotals = {
    ...totals,
    discountTotal: totals.discountTotal + couponPoints.couponDiscount + couponPoints.pointsUsed,
    grandTotal: finalTotal,
  };

  const [customer, setCustomer] = useState<GuestCustomer>({ name: "", phone: "", email: "" });
  const [address, setAddress] = useState<ShippingAddress>(() => createEmptyAddress(market.countryCode));
  const [customsCode, setCustomsCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentFailure, setPaymentFailure] = useState<{ orderId: string; orderNumber: string; message: string } | null>(null);
  const [simulateMockFailure, setSimulateMockFailure] = useState(false);

  const [prevMarketCode, setPrevMarketCode] = useState(market.countryCode);
  if (market.countryCode !== prevMarketCode) {
    setPrevMarketCode(market.countryCode);
    setAddress(createEmptyAddress(market.countryCode));
    setErrors({});
    setToast({ message: messages.checkout.marketChangedNotice, tone: "success" });
  }

  // Prefills name/email once when a session becomes available post-hydration; never overwrites a field the user already typed.
  const [autoFilledFromUser, setAutoFilledFromUser] = useState(false);
  if (isAuthenticated && currentUser && !autoFilledFromUser) {
    setAutoFilledFromUser(true);
    setCustomer((prev) => ({
      ...prev,
      name: prev.name || currentUser.displayName,
      email: prev.email || currentUser.email,
    }));
  }

  function handleAddressChange(field: string, value: string) {
    setAddress((prev) => ({ ...prev, [field]: value }) as ShippingAddress);
  }

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};

    if (!isNonEmpty(customer.name)) nextErrors.customerName = messages.validation.required;
    const customerPhoneValid =
      market.countryCode === "KR" ? isValidKrPhone(customer.phone) : isValidInPhone(customer.phone);
    if (!customerPhoneValid) nextErrors.customerPhone = messages.validation.invalidPhone;
    if (!isValidEmail(customer.email)) nextErrors.customerEmail = messages.auth.invalidEmail;

    if (address.country === "KR") {
      if (!isNonEmpty(address.recipientName)) nextErrors.recipientName = messages.validation.required;
      if (!isValidKrPhone(address.phone)) nextErrors.phone = messages.validation.invalidPhone;
      if (!isValidKrPostcode(address.postcode)) nextErrors.postcode = messages.validation.invalidPostcode;
      if (!isNonEmpty(address.address)) nextErrors.address = messages.validation.required;
      if (!isNonEmpty(address.addressDetail)) nextErrors.addressDetail = messages.validation.required;
    } else {
      if (!isNonEmpty(address.fullName)) nextErrors.fullName = messages.validation.required;
      if (!isValidInPhone(address.mobileNumber)) nextErrors.mobileNumber = messages.validation.invalidPhone;
      if (!isNonEmpty(address.addressLine1)) nextErrors.addressLine1 = messages.validation.required;
      if (!isNonEmpty(address.city)) nextErrors.city = messages.validation.required;
      if (!isNonEmpty(address.state)) nextErrors.state = messages.validation.required;
      if (!isValidInPincode(address.pinCode)) nextErrors.pinCode = messages.validation.invalidPostcode;
    }

    if (needsCustomsCode && !isValidCustomsCode(customsCode)) {
      nextErrors.customsCode = messages.validation.customsCodeInvalid;
    }

    if (!paymentMethod) nextErrors.paymentMethod = messages.validation.paymentMethodRequired;
    if (!agreed) nextErrors.agreement = messages.auth.termsRequired;

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function buildLocalOrder(orderNumber: string): Order {
    return {
      orderId: orderNumber,
      createdAt: new Date().toISOString(),
      market: market.countryCode,
      currency: market.currency,
      customer,
      shippingAddress: address,
      customsInfo: needsCustomsCode ? { personalCustomsCode: customsCode } : undefined,
      items: availableItems,
      shippingGroups: buildOrderShippingGroups(availableItems),
      subtotal: totals.itemsTotal,
      discount: totals.discountTotal,
      shippingFee: totals.shippingTotal,
      total: finalTotal,
      paymentMethod: paymentMethod as PaymentMethodId,
      status: "ORDER_CREATED",
    };
  }

  function finalizeOrder(orderNumber: string) {
    saveGuestOrder(buildLocalOrder(orderNumber));
    // STEP 22 — this checkout attempt is truly done now (paid, or the
    // no-Supabase local fallback ran); the NEXT checkout starts a fresh key.
    clearCheckoutIdempotencyKey(source);

    if (source === "cart") {
      availableItems.forEach((item) => {
        if (item.cartItemId) cart.removeItem(item.cartItemId);
      });
    } else {
      clearBuyNowItem();
    }

    router.push(`/order/complete/${orderNumber}`);
  }

  /**
   * Order → Payment handoff (STEP 11 spec section 9). The order row already
   * exists (ORDER_CREATED/UNPAID) by the time this runs — a failed payment
   * here never re-creates or re-validates the order, only attempts a new
   * Payment against it, so retrying never double-charges coupon/point usage.
   */
  async function attemptPayment(dbOrderId: string, orderNumber: string) {
    const result = await runAttemptPayment({
      orderId: dbOrderId,
      paymentMethod: paymentMethod as PaymentMethodId,
      marketCode: market.countryCode,
      guestContact: customer.email,
      simulateFailure: simulateMockFailure,
    });

    if (!result.ok) {
      setSubmitting(false);
      if (result.stage === "prepare") {
        setPaymentFailure({ orderId: dbOrderId, orderNumber, message: result.error ?? messages.payment.prepareFailed });
        return;
      }
      // STEP 23 — PAYMENT_AMOUNT_MISMATCH/PAYMENT_CURRENCY_MISMATCH/STOCK_CHANGED are
      // raised by _apply_payment_result itself (internal, English) — never shown
      // to the customer as-is; everything else falls back to the adapter's own
      // (already localized, e.g. MOCK_SIMULATED_FAILURE) failureMessage.
      const localizedMessage =
        result.failureCode === "PAYMENT_AMOUNT_MISMATCH" || result.failureCode === "PAYMENT_CURRENCY_MISMATCH"
          ? messages.payment.amountMismatch
          : result.failureCode === "STOCK_CHANGED"
            ? messages.payment.stockChangedAtPayment
            : (result.failureMessage ?? result.error ?? messages.payment.confirmFailed);
      setPaymentFailure({ orderId: dbOrderId, orderNumber, message: localizedMessage });
      return;
    }

    setPaymentFailure(null);
    finalizeOrder(orderNumber);
  }

  async function handleSubmit() {
    if (submitting) return;
    if (!validate()) {
      setToast({ message: messages.toast.optionRequired, tone: "error" });
      return;
    }

    setSubmitting(true);
    setPaymentFailure(null);

    const orderNumber = generateOrderId();

    // The DB (via the create_order RPC, called from a Server Action) is the source of
    // truth once Supabase is configured; saveGuestOrder still runs either way so the
    // confirmation/mypage pages — which read localStorage — can render this session's
    // order immediately without a separate authenticated re-fetch. See STEP 08 report.
    if (isSupabaseConfigured()) {
      const result = await createOrderAction({
        orderNumber,
        source,
        idempotencyKey,
        customer,
        shippingAddress: address,
        customsInfo: needsCustomsCode ? { personalCustomsCode: customsCode } : undefined,
        market: market.countryCode,
        currency: market.currency,
        paymentMethod: paymentMethod as PaymentMethodId,
        items: availableItems,
        subtotal: totals.itemsTotal,
        discount: totals.discountTotal,
        shippingFee: totals.shippingTotal,
        total: finalTotal,
        couponCode: couponPoints.couponCode ?? undefined,
        pointsUsed: couponPoints.pointsUsed || undefined,
      });

      if (!result.ok) {
        setSubmitting(false);
        const message =
          result.error === "COUPON_INVALID"
            ? messages.coupon.applyFailed
            : result.error === "POINTS_INVALID"
              ? messages.points.conditionError
              : result.error === "PRICE_NOT_READY"
                ? messages.checkout.priceNotReady
                : result.error === "STOCK_CHANGED"
                  ? messages.checkout.stockChanged
                  : result.error === "PRICE_MISMATCH"
                    ? messages.checkout.priceMismatch
                    : result.error === "SHIPPING_UNAVAILABLE"
                      ? messages.checkout.orderShippingUnavailable
                      : result.error === "SHIPPING_PENDING"
                        ? messages.checkout.orderShippingPending
                        : result.error === "INVALID_ADDRESS"
                          ? messages.checkout.invalidAddress
                          : result.error === "CART_CHANGED"
                            ? messages.checkout.cartChanged
                            : result.error === "UNAUTHORIZED"
                              ? messages.checkout.unauthorizedOrder
                              : messages.checkout.orderFailed;
        setToast({ message, tone: "error" });
        return;
      }

      await attemptPayment(result.orderId, orderNumber);
      return;
    }

    finalizeOrder(orderNumber);
  }

  async function handleRetryPayment() {
    if (!paymentFailure || submitting) return;
    setSubmitting(true);
    await attemptPayment(paymentFailure.orderId, paymentFailure.orderNumber);
  }

  if (checkoutItems.length === 0) {
    return (
      <>
        <ListHeader title={messages.checkout.pageTitle} hideCartIcon />
        <main className="pb-16">
          <PageContainer>
            <div className="flex flex-col items-center gap-4 py-24 text-center">
              <PackageSearch size={40} className="text-text-secondary" />
              <p className="text-sm text-text-secondary">{messages.checkout.emptyTitle}</p>
              <Link href="/cart" className="border border-primary px-4 py-2 text-sm font-bold text-primary">
                {messages.checkout.backToCart}
              </Link>
            </div>
          </PageContainer>
        </main>
      </>
    );
  }

  if (unavailableItems.length > 0) {
    return (
      <>
        <ListHeader title={messages.checkout.pageTitle} hideCartIcon />
        <main className="pb-16">
          <PageContainer className="flex flex-col gap-4 pt-4">
            <div className="flex items-start gap-2.5 border border-red-500 bg-red-50 p-3.5 text-sm text-red-700">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <span>{messages.checkout.blockedTitle}</span>
            </div>

            <div className="flex flex-col gap-4">
              {groupCheckoutItemsByShippingType(checkoutItems).map((group) => (
                <CheckoutItemGroup
                  key={group.shippingType}
                  shippingType={group.shippingType}
                  items={group.items}
                  market={market}
                />
              ))}
            </div>

            <Link
              href="/cart"
              className="mt-2 flex h-12 items-center justify-center border border-primary text-sm font-bold text-primary"
            >
              {messages.checkout.backToCart}
            </Link>
          </PageContainer>
        </main>
      </>
    );
  }

  return (
    <>
      <ListHeader title={messages.checkout.pageTitle} hideCartIcon />
      <main className="pb-40 md:pb-12">
        <PageContainer className="pt-4">
          <div className="flex flex-col gap-8 md:flex-row md:items-start">
            <div className="flex flex-1 flex-col gap-8">
              <section>
                <h2 className="mb-3 text-sm font-bold text-text-main">{messages.checkout.itemsSection}</h2>
                <div className="flex flex-col gap-4">
                  {groups.map((group) => (
                    <CheckoutItemGroup
                      key={group.shippingType}
                      shippingType={group.shippingType}
                      items={group.items}
                      market={market}
                      quote={shippingQuotes.get(group.shippingType)}
                    />
                  ))}
                </div>
              </section>

              {!isAuthenticated && (
                <p className="-mb-4 text-xs text-text-secondary">
                  {messages.checkout.loginHint}{" "}
                  <Link
                    href={`/auth?returnTo=${encodeURIComponent(checkoutReturnTo)}`}
                    className="font-bold text-primary underline"
                  >
                    {messages.checkout.loginLink}
                  </Link>
                </p>
              )}

              <CustomerForm
                market={market}
                customer={customer}
                errors={{
                  name: errors.customerName,
                  phone: errors.customerPhone,
                  email: errors.customerEmail,
                }}
                onChange={(field, value) => setCustomer((prev) => ({ ...prev, [field]: value }))}
              />

              <AddressForm market={market} address={address} errors={errors} onChange={handleAddressChange} />

              {needsCustomsCode && (
                <CustomsInfoSection
                  market={market}
                  value={customsCode}
                  error={errors.customsCode}
                  onChange={setCustomsCode}
                />
              )}

              <CouponPointsSection
                market={market}
                isAuthenticated={isAuthenticated}
                payableAmount={totals.grandTotal}
                productSlugs={availableItems.map((item) => item.productId)}
                onChange={setCouponPoints}
              />

              <PaymentMethodSelector
                market={market}
                options={paymentOptions}
                selected={paymentMethod}
                error={errors.paymentMethod}
                onChange={setPaymentMethod}
              />

              {process.env.NODE_ENV !== "production" && isSupabaseConfigured() && (
                <label className="-mt-4 flex items-center gap-2 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={simulateMockFailure}
                    onChange={(e) => setSimulateMockFailure(e.target.checked)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  [개발모드] Mock 결제 실패 시뮬레이션
                </label>
              )}

              {paymentFailure && (
                <div className="flex flex-col gap-2 border border-red-500 bg-red-50 p-3.5 text-sm text-red-700">
                  <span className="flex items-center gap-2">
                    <AlertTriangle size={16} className="shrink-0" />
                    결제에 실패했습니다: {paymentFailure.message}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleRetryPayment}
                      disabled={submitting}
                      className="h-9 border border-red-600 px-3 text-xs font-bold text-red-700 disabled:opacity-50"
                    >
                      다시 결제
                    </button>
                    <span className="self-center text-xs text-red-600">다른 결제수단을 선택한 뒤 다시 시도할 수도 있습니다.</span>
                  </div>
                </div>
              )}

              <OrderAgreement market={market} checked={agreed} error={errors.agreement} onChange={setAgreed} />
            </div>

            <div className="hidden md:block md:w-80 md:shrink-0">
              <div className="sticky top-20">
                <CheckoutSummary
                  totals={summaryTotals}
                  market={market}
                  variant="card"
                  onSubmit={handleSubmit}
                  disabled={submitting || isTotalPending}
                  isTotalPending={isTotalPending}
                />
              </div>
            </div>
          </div>
        </PageContainer>
      </main>

      <CheckoutSummary
        totals={summaryTotals}
        market={market}
        variant="fixed"
        onSubmit={handleSubmit}
        disabled={submitting}
        isTotalPending={isTotalPending}
      />

      <Toast toast={toast} />
    </>
  );
}
