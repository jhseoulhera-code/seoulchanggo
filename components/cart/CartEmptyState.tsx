import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import type { Messages } from "@/messages";

type CartEmptyStateProps = {
  messages: Messages;
};

export function CartEmptyState({ messages }: CartEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <ShoppingCart size={40} className="text-text-secondary" />
      <p className="text-sm text-text-secondary">{messages.cart.empty}</p>
      <Link href="/" className="border border-primary px-4 py-2 text-sm font-bold text-primary">
        {messages.common.continueShopping}
      </Link>
    </div>
  );
}
