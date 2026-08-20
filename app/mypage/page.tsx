"use client";

import { ChevronRight, FileText, Heart, LogOut, MapPinned, MessageSquare, Package, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PageContainer } from "@/components/common/PageContainer";
import { ListHeader } from "@/components/layout/ListHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useMarket } from "@/contexts/MarketContext";
import { formatCurrency } from "@/lib/currency";
import { getGuestOrders } from "@/lib/order";
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

  useEffect(() => {
    if (auth.isReady && !auth.isAuthenticated) {
      router.replace("/auth?returnTo=/mypage");
    }
  }, [auth.isReady, auth.isAuthenticated, router]);

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

  const myOrders = getGuestOrders().filter((order) => order.customer.email.toLowerCase() === user.email.toLowerCase());

  async function handleSignOut() {
    await auth.logout();
    router.push("/");
  }

  const disabledMenuItems = [
    { label: messages.mypage.trackShipment, icon: MapPinned },
    { label: messages.mypage.wishlist, icon: Heart },
    { label: messages.mypage.reviews, icon: MessageSquare },
    { label: messages.mypage.inquiries, icon: FileText },
    { label: messages.mypage.profile, icon: UserRound },
  ];

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

          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-text-main">
              <Package size={16} />
              {messages.mypage.orderHistory}
            </h2>
            {myOrders.length === 0 ? (
              <p className="text-sm text-text-secondary">{messages.mypage.noOrders}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {myOrders.map((order) => (
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

          <section className="flex flex-col border border-border">
            {disabledMenuItems.map(({ label, icon: Icon }) => (
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
