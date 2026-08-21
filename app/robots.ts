import { getSiteUrl } from "@/lib/seo";
import type { MetadataRoute } from "next";

/**
 * STEP 14 production hardening (spec section 25). Admin, auth, and every
 * personal/transactional page (checkout, cart, mypage, order lookup/complete)
 * are excluded from indexing — none of them are content search engines
 * should ever surface, and several contain per-visitor state that would be
 * meaningless (or worse, look like duplicate/thin content) if crawled.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/", "/auth", "/checkout", "/cart", "/mypage", "/order/", "/api/"],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
