"use client";

import Link from "next/link";
import { useMarket } from "@/contexts/MarketContext";
import { getMessages } from "@/messages";

/**
 * STEP 14 spec section 41 — minimum customer-site footer links. Business
 * registration info is a placeholder string, never a fabricated number: a
 * fake business ID is worse than none, since it looks real.
 */
export function Footer() {
  const { market } = useMarket();
  const messages = getMessages(market.locale);

  const links = [
    { href: "/terms", label: messages.footer.terms },
    { href: "/privacy", label: messages.footer.privacy },
    { href: "/shipping-policy", label: messages.footer.shippingPolicy },
    { href: "/return-policy", label: messages.footer.returnPolicy },
    { href: "/notices", label: messages.notice.title },
    { href: "/faq", label: messages.faq.title },
  ];

  return (
    <footer className="mt-4 border-t border-border px-4 py-6 text-xs text-text-secondary">
      <nav className="flex flex-wrap gap-x-4 gap-y-1.5">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="hover:text-text-main hover:underline">
            {link.label}
          </Link>
        ))}
      </nav>
      <p className="mt-4 leading-relaxed">{messages.footer.businessInfoPlaceholder}</p>
    </footer>
  );
}
