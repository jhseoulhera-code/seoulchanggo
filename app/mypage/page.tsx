"use client";

import { ChevronRight, FileText, Heart, LogOut, MapPinned, MessageSquare, Package, Star, Ticket, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/common/PageContainer";
import { ListHeader } from "@/components/layout/ListHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useMarket } from "@/contexts/MarketContext";
import { formatCurrency } from "@/lib/currency";
import { getGuestOrders } from "@/lib/order";
import { listAvailableCouponsAction } from "@/lib/actions/coupon";
import { getMyInquiriesAction, getMyOrdersAction, getMyReviewsAction } from "@/lib/actions/mypage";
import type { MyInquirySummary, MyOrderSummary, MyReviewSummary } from "@/lib/actions/mypage";
import { getMyPointBalanceAction } from "@/lib/actions/points";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getMessages, t } from "@/messages";
import type { AuthProvider } from "@/types/auth";

const PROVIDER_DISPLAY_NAME: Record<Exclude<AuthProvider, "EMAIL">, string> = {
  GOOGLE: "Google",
  KAKAO: "카카오",
  NAVER: "네이버",
};

export default function MyPage() {
  const { market } = useMarket();
  const auth = useAuth();
  const router = useRouter();
  const messages = getMessages(market.locale);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (auth.isReady && !auth.isAuthenticated) {
      router.replace("/auth?returnTo=/mypage");
    }
  }, [auth.isReady, auth.isAuthenticated, router]);

  const [dbOrders, setDbOrders] = useState<MyOrderSummary[]>([]);
  const [pointBalance, setPointBalance] = useState(0);
  const [couponCount, setCouponCount] = useState(0);
  const [myReviews, setMyReviews] = useState<MyReviewSummary[]>([]);
  const [myInquiries, setMyInquiries] = useState<MyInquirySummary[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    if (!configured || !auth.isAuthenticated) return;
    Promise.all([
      getMyOrdersAction(),
      getMyPointBalanceAction(),
      listAvailableCouponsAction(market.countryCode),
      getMyReviewsAction(),
      getMyInquiriesAction(),
    ]).then(([orders, balance, coupons, reviews, inquiries]) => {
      setDbOrders(orders);
      setPointBalance(balance);
      setCouponCount(coupons.length);
      setMyReviews(reviews);
      setMyInquiries(inquiries);
      setDataLoaded(true);
    });
  }, [configured, auth.isAuthenticated, market.countryCode]);

  if (!auth.currentUser) {
    return (
      <>
        <ListHeader title={messages.mypage.pageTitle} hideCartIcon />
        <main className="pb-16" />
      </>
    );
  }

  const user = auth.currentUser;
  const providerLabel =
    user.authProvider === "EMAIL" ? messages.auth.providerEmail : PROVIDER_DISPLAY_NAME[user.authProvider];

  const guestOrders = getGuestOrders().filter((order) => order.customer.email.toLowerCase() === user.email.toLowerCase());

  async function handleSignOut() {
    await auth.logout();
    router.push("/");
  }

  return (
    <>
      <ListHeader title={messages.mypage.pageTitle} hideCartIcon />
      <main className="pb-16">
        <PageContainer className="flex flex-col gap-6 pt-6">
          <div className="flex flex-col gap-1 border border-border p-4">
            <p className="text-base font-bold text-text-main">{user.displayName}</p>
            <p className="text-sm text-text-secondary">{user.email}</p>
            <p className="mt-1 text-xs text-text-secondary">{t(messages.mypage.signedUpWith, { provider: providerLabel })}</p>
          </div>

          {configured && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1 border border-border p-4">
                <span className="text-xs text-text-secondary">보유 포인트</span>
                <span className="text-lg font-bold text-primary">{pointBalance.toLocaleString("ko-KR")}P</span>
              </div>
              <div className="flex flex-col gap-1 border border-border p-4">
                <span className="text-xs text-text-secondary">사용 가능 쿠폰</span>
                <span className="text-lg font-bold text-primary">{couponCount}장</span>
              </div>
            </div>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-text-main">
              <Package size={16} />
              {messages.mypage.orderHistory}
            </h2>
            {configured ? (
              dbOrders.length === 0 ? (
                <p className="text-sm text-text-secondary">{dataLoaded ? messages.mypage.noOrders : "불러오는 중..."}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {dbOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between border border-border px-3.5 py-3 text-sm">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-text-main">{order.orderNumber}</span>
                        <span className="text-xs text-text-secondary">
                          {new Date(order.createdAt).toLocaleDateString(market.locale === "ko" ? "ko-KR" : "en-IN")}
                        </span>
                      </div>
                      <span className="text-text-main">{formatCurrency(order.totalAmount, order.currencyCode)}</span>
                    </div>
                  ))}
                </div>
              )
            ) : guestOrders.length === 0 ? (
              <p className="text-sm text-text-secondary">{messages.mypage.noOrders}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {guestOrders.map((order) => (
                  <Link
                    key={order.orderId}
                    href={`/order/complete/${order.orderId}`}
                    className="flex items-center justify-between border border-border px-3.5 py-3 text-sm"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-text-main">{order.orderId}</span>
                      <span className="text-xs text-text-secondary">
                        {new Date(order.createdAt).toLocaleDateString(market.locale === "ko" ? "ko-KR" : "en-IN")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-text-main">
                      {formatCurrency(order.total, order.currency)}
                      <ChevronRight size={16} className="text-text-secondary" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {configured && (
            <>
              <section className="flex flex-col gap-3">
                <h2 className="flex items-center gap-2 text-sm font-bold text-text-main">
                  <MessageSquare size={16} />
                  내가 쓴 리뷰
                </h2>
                {myReviews.length === 0 ? (
                  <p className="text-sm text-text-secondary">{dataLoaded ? "작성한 리뷰가 없습니다." : "불러오는 중..."}</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {myReviews.map((review) => (
                      <div key={review.id} className="flex flex-col gap-1 border border-border px-3.5 py-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-text-main">{review.productNameKo}</span>
                          <span className="flex items-center gap-0.5 text-xs text-primary">
                            <Star size={12} className="fill-primary text-primary" />
                            {review.rating}
                          </span>
                        </div>
                        <p className="line-clamp-1 text-xs text-text-secondary">{review.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="flex flex-col gap-3">
                <h2 className="flex items-center gap-2 text-sm font-bold text-text-main">
                  <FileText size={16} />
                  내가 쓴 문의
                </h2>
                {myInquiries.length === 0 ? (
                  <p className="text-sm text-text-secondary">{dataLoaded ? "작성한 문의가 없습니다." : "불러오는 중..."}</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {myInquiries.map((inquiry) => (
                      <div key={inquiry.id} className="flex flex-col gap-1 border border-border px-3.5 py-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-text-main">{inquiry.productNameKo}</span>
                          <span className="text-xs text-text-secondary">{inquiry.status === "ANSWERED" ? "답변완료" : "답변대기"}</span>
                        </div>
                        <p className="line-clamp-1 text-xs text-text-secondary">{inquiry.question}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          <section className="flex flex-col border border-border">
            {[
              { label: messages.mypage.trackShipment, icon: MapPinned },
              { label: messages.mypage.wishlist, icon: Heart },
              { label: "쿠폰함", icon: Ticket },
              { label: messages.mypage.profile, icon: UserRound },
            ].map(({ label, icon: Icon }) => (
              <div
                key={label}
                className="flex cursor-not-allowed items-center justify-between border-b border-border px-3.5 py-3 text-sm text-text-secondary last:border-b-0"
              >
                <span className="flex items-center gap-2.5">
                  <Icon size={16} />
                  {label}
                </span>
                <span className="text-xs">{messages.mypage.comingSoon}</span>
              </div>
            ))}
          </section>

          <button
            type="button"
            onClick={handleSignOut}
            className="flex h-12 items-center justify-center gap-2 border border-border text-sm font-bold text-text-main"
          >
            <LogOut size={16} />
            {messages.auth.signOut}
          </button>
        </PageContainer>
      </main>
    </>
  );
}
