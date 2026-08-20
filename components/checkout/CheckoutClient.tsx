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
import { clearBuyNowItem, getBuyNowItem } from "@/lib/buyNow";
import { generateOrderId, saveGuestOrder } from "@/lib/order";
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

  const checkoutItems = useMemo(() => {
    if (source === "buynow") {
      const buyNow = getBuyNowItem();
      if (!buyNow) return [];
      const item = buildCheckoutItemFromBuyNow(buyNow, products, market);
      return item ? [item] : [];
    }
    return buildCheckoutItemsFromCart(cart.items, products, market);
  }, [source, cart.items, products, market]);

  const unavailableItems = checkoutItems.filter((item) => !item.isAvailable);
  const availableItems = checkoutItems.filter((item) => item.isAvailable);
  const groups = useMemo(() => groupCheckoutItemsByShippingType(availableItems), [availableItems]);
  const totals = useMemo(() => calculateCheckoutSummary(checkoutItems), [checkoutItems]);
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

    if (!isNonEmpty(customer.name)) nextErrors.customerName = "이름을 입력해주세요.";
    const customerPhoneValid =
      market.countryCode === "KR" ? isValidKrPhone(customer.phone) : isValidInPhone(customer.phone);
    if (!customerPhoneValid) nextErrors.customerPhone = "휴대폰 번호 형식을 확인해주세요.";
    if (!isValidEmail(customer.email)) nextErrors.customerEmail = "이메일 형식을 확인해주세요.";

    if (address.country === "KR") {
      if (!isNonEmpty(address.recipientName)) nextErrors.recipientName = "수령인 이름을 입력해주세요.";
      if (!isValidKrPhone(address.phone)) nextErrors.phone = "휴대폰 번호 형식을 확인해주세요.";
      if (!isValidKrPostcode(address.postcode)) nextErrors.postcode = "우편번호 5자리를 입력해주세요.";
      if (!isNonEmpty(address.address)) nextErrors.address = "주소를 입력해주세요.";
      if (!isNonEmpty(address.addressDetail)) nextErrors.addressDetail = "상세주소를 입력해주세요.";
    } else {
      if (!isNonEmpty(address.fullName)) nextErrors.fullName = "Please enter your full name.";
      if (!isValidInPhone(address.mobileNumber)) nextErrors.mobileNumber = "Please check the mobile number.";
      if (!isNonEmpty(address.addressLine1)) nextErrors.addressLine1 = "Please enter address line 1.";
      if (!isNonEmpty(address.city)) nextErrors.city = "Please enter a city.";
      if (!isNonEmpty(address.state)) nextErrors.state = "Please select a state.";
      if (!isValidInPincode(address.pinCode)) nextErrors.pinCode = "Please check the PIN code.";
    }

    if (needsCustomsCode && !isValidCustomsCode(customsCode)) {
      nextErrors.customsCode = "개인통관고유부호 형식을 확인해주세요. (예: P123456789012)";
    }

    if (!paymentMethod) nextErrors.paymentMethod = "결제수단을 선택해주세요.";
    if (!agreed) nextErrors.agreement = "필수 약관에 동의해주세요.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit() {
    if (submitting) return;
    if (!validate()) {
      setToast({ message: messages.toast.optionRequired, tone: "error" });
      return;
    }

    setSubmitting(true);

    const orderId = generateOrderId();
    const order: Order = {
      orderId,
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

    // The DB (via the create_order RPC, called from a Server Action) is the source of
    // truth once Supabase is configured; saveGuestOrder still runs either way so the
    // confirmation/mypage pages — which read localStorage — can render this session's
    // order immediately without a separate authenticated re-fetch. See STEP 08 report.
    if (isSupabaseConfigured()) {
      const result = await createOrderAction({
        orderNumber: orderId,
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
            ? "쿠폰을 적용할 수 없습니다. 다시 확인해주세요."
            : result.error === "POINTS_INVALID"
              ? "포인트 사용 조건을 확인해주세요."
              : messages.checkout.orderFailed;
        setToast({ message, tone: "error" });
        return;
      }
    }

    saveGuestOrder(order);

    if (source === "cart") {
      availableItems.forEach((item) => {
        if (item.cartItemId) cart.removeItem(item.cartItemId);
      });
    } else {
      clearBuyNowItem();
    }

    router.push(`/order/complete/${orderId}`);
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

              <OrderAgreement market={market} checked={agreed} error={errors.agreement} onChange={setAgreed} />
            </div>

            <div className="hidden md:block md:w-80 md:shrink-0">
              <div className="sticky top-20">
                <CheckoutSummary
                  totals={summaryTotals}
                  market={market}
                  variant="card"
                  onSubmit={handleSubmit}
                  disabled={submitting}
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
      />

      <Toast toast={toast} />
    </>
  );
}
