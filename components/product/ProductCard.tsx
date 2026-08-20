"use client";

import { Heart, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ProductImagePlaceholder } from "@/components/product/ProductImagePlaceholder";
import { ShippingBadge } from "@/components/product/ShippingBadge";
import { useMarket } from "@/contexts/MarketContext";
import { formatCurrency, getProductMarketPrice } from "@/lib/currency";
import { isProductAvailableInMarket } from "@/lib/shipping";
import { getMessages } from "@/messages";
import type { Product } from "@/types";

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const { market } = useMarket();
  const hasDiscount = Boolean(product.discountRate);
  const { salePrice, originalPrice } = getProductMarketPrice(product, market);
  const isAvailable = isProductAvailableInMarket(product, market.countryCode);
  const messages = getMessages(market.locale);

  return (
    <article className="relative w-full">
      <Link
        href={`/product/${product.id}`}
        aria-label={product.name}
        className="absolute inset-0 z-10"
      />

      <div className="relative aspect-square w-full overflow-hidden rounded-md border border-border">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(min-width: 768px) 20vw, 45vw"
            className="object-cover"
          />
        ) : (
          <ProductImagePlaceholder category={product.category} className="h-full w-full" />
        )}

        {hasDiscount && (
          <span className="absolute left-2 top-2 bg-primary px-1.5 py-0.5 font-mono text-[11px] font-bold text-white">
            {product.discountRate}%
          </span>
        )}

        {!isAvailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="border border-text-main bg-white px-2 py-1 font-mono text-[11px] font-bold text-text-main">
              {messages.product.outOfMarketShort}
            </span>
          </div>
        )}

        <button
          type="button"
          aria-label="찜하기"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          className="absolute right-2 top-2 z-20 flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-full bg-white/90 text-text-secondary"
        >
          <Heart size={15} />
        </button>
      </div>

      <div className="mt-2 flex flex-col gap-1">
        <p className="line-clamp-2 text-sm text-text-main">{product.name}</p>

        <div>
          <div className="flex items-baseline gap-1.5">
            {hasDiscount && (
              <span className="text-sm font-bold text-primary">
                {product.discountRate}%
              </span>
            )}
            <span className="text-base font-bold text-text-main">
              {formatCurrency(salePrice, market.currency)}
            </span>
          </div>
          {hasDiscount && (
            <span className="text-xs text-text-secondary line-through">
              {formatCurrency(originalPrice, market.currency)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs text-text-secondary">
          <Star size={12} className="fill-primary text-primary" />
          <span>{product.rating.toFixed(1)}</span>
          <span>({product.reviewCount.toLocaleString("ko-KR")})</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <ShippingBadge
            type={product.shippingType}
            label={product.shippingLabel}
            originCountry={product.originCountry}
          />
          {product.freeShipping && (
            <span className="text-[11px] font-medium text-primary">무료배송</span>
          )}
        </div>
      </div>
    </article>
  );
}
