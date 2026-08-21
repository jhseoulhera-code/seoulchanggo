import type { NextConfig } from "next";

/**
 * STEP 14 production hardening. Deliberately conservative: no CSP here —
 * the exact set of origins this app needs to allow (Supabase project
 * domain, whichever real PG providers get contracted, their redirect/iframe
 * requirements) isn't known until those are actually connected, and a wrong
 * CSP breaks the app rather than protecting it. These headers are safe
 * defaults that don't depend on knowing that yet.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // This storefront is never meant to be framed by another site.
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage public bucket URLs (product/review images once a
      // real project is connected) — every Supabase project's storage
      // domain follows this pattern.
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
