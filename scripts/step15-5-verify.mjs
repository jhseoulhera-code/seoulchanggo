// STEP 15.5: real Cloud Supabase E2E verification.
//
// This talks to the REAL Supabase project directly over the anon key —
// exactly the same PostgREST/GoTrue surface the deployed app uses, with no
// Next.js in between — so a pass here means the RLS policies, RPCs, and
// Storage policies actually behave this way in the real backend, not just
// in code review. It cannot be run inside the sandboxed session that wrote
// it (outbound network to *.supabase.co is blocked there); run it locally.
//
// Usage:
//   node --env-file=.env.local --env-file=.env.step15-5.local scripts/step15-5-verify.mjs
//
// Required env (from .env.local, already present):
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
//
// Optional env (put in a NEW, gitignored .env.step15-5.local — never commit
// it — so the Admin RLS / Admin CRUD sections can run too):
//   STEP15_5_ADMIN_EMAIL, STEP15_5_ADMIN_PASSWORD
//     — login for the account you already promoted to ADMIN.
//   Without these, every ADMIN-dependent check is reported BLOCKED, never
//   silently skipped or assumed to pass.
//
// Two fresh member accounts are created automatically on each run via real
// signUp (random e2e-*@example.com addresses) — "Confirm email" must be OFF
// for the project (Authentication -> Providers -> Email) or signUp won't
// return a session and every member-dependent check reports BLOCKED.
//
// Nothing here is fabricated: every row below prints PASS, FAIL, or BLOCKED
// (with the reason) from an actual API response — never assumed.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ADMIN_EMAIL = process.env.STEP15_5_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.STEP15_5_ADMIN_PASSWORD;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Run with --env-file=.env.local.");
  process.exit(1);
}

// Known seed products (supabase/seed.sql) — used to compute the exact
// server-side totals this script then asserts against.
const P = {
  best1: { id: "1d7d1224-1d58-5623-b304-f1fc7aab7466", krwSale: 29900, krwOrig: 38900, freeShip: true, stock: 8 },
  best2: { id: "3bf24c6c-bb13-5091-8685-216a134b8107", krwSale: 79000, inrSale: 6499, freeShip: true },
  best3: { id: "0aafd6ed-fcc8-544a-8419-8fb6645940ba", freeShip: true }, // UNLIMITED
  best5: { id: "7f79b78f-42bd-5b2a-ab25-e2966a8b6a85", krwSale: 45900, krShipFee: 5000, freeShip: false },
  extra20: { id: "170e0a5b-1441-5145-ae37-075fc25163bd", krwSale: 15900, krShipFee: 6000, shippingType: "OVERSEAS_AGENCY" },
};

const results = [];
function record(section, name, status, detail) {
  results.push({ section, name, status, detail });
  const tag = status === "PASS" ? "PASS" : status === "BLOCKED" ? "BLOCKED" : "FAIL";
  console.log(`[${tag}] ${section} — ${name}${detail ? `: ${detail}` : ""}`);
}

function client() {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

function shipping(name, market, country) {
  return {
    fullName: name,
    phone: "010-0000-0000",
    country,
    zipCode: "00000",
    address1: "테스트 주소",
    address2: "",
    _market: market,
  };
}

async function signUpMember(label) {
  const c = client();
  const email = `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = `TestPass!${randomUUID().slice(0, 8)}`;
  const { data, error } = await c.auth.signUp({ email, password });
  if (error) return { client: c, id: null, error: error.message };
  if (!data.session) {
    return { client: c, id: null, error: "NO_SESSION (project requires email confirmation — turn it off for this test run)" };
  }
  return { client: c, id: data.user.id, email };
}

async function main() {
  console.log("=== STEP 15.5 real Cloud Supabase E2E verification ===\n");

  // ---------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------
  const anon = client();
  const a = await signUpMember("a");
  const b = await signUpMember("b");
  let admin = null;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const c = client();
    const { data, error } = await c.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    if (error) {
      record("setup", "admin sign-in", "FAIL", error.message);
    } else {
      admin = { client: c, id: data.user.id };
      record("setup", "admin sign-in", "PASS", data.user.id);
    }
  } else {
    record("setup", "admin credentials", "BLOCKED", "STEP15_5_ADMIN_EMAIL/PASSWORD not set — all Admin checks below are BLOCKED, not passed");
  }

  const memberAOk = Boolean(a.id);
  const memberBOk = Boolean(b.id);
  record("setup", "member A sign-up", memberAOk ? "PASS" : "BLOCKED", memberAOk ? a.id : a.error);
  record("setup", "member B sign-up", memberBOk ? "PASS" : "BLOCKED", memberBOk ? b.id : b.error);

  // ---------------------------------------------------------------------
  // Section: 일반회원 RLS
  // ---------------------------------------------------------------------
  {
    const { data, error } = await anon.from("products").select("id").limit(1);
    record("RLS-general", "anon can read products", !error && data?.length > 0 ? "PASS" : "FAIL", error?.message ?? `rows=${data?.length}`);
  }
  {
    const { data, error } = await anon.from("cart_items").select("id");
    record("RLS-general", "anon select cart_items returns none (not an error)", !error && data?.length === 0 ? "PASS" : "FAIL", error?.message ?? `rows=${data?.length}`);
  }

  if (memberAOk) {
    const { error } = await a.client.from("cart_items").insert({
      user_id: a.id, product_id: P.best1.id, selected_options: { probe: "rls-a" }, quantity: 1,
    });
    record("RLS-general", "member A can insert own cart_items", !error ? "PASS" : "FAIL", error?.message);
  }
  if (memberAOk && memberBOk) {
    const { error } = await b.client.from("cart_items").insert({
      user_id: a.id, product_id: P.best1.id, selected_options: { probe: "rls-b-spoof" }, quantity: 1,
    });
    record("RLS-general", "member B cannot insert cart_items as member A", error ? "PASS" : "FAIL", error ? error.message : "insert succeeded — SECURITY HOLE");
  }
  if (memberAOk) {
    const { data } = await a.client.from("cart_items").select("id, user_id");
    const onlyOwn = (data ?? []).every((row) => row.user_id === a.id);
    record("RLS-general", "member A cart_items select returns only own rows", onlyOwn ? "PASS" : "FAIL", `rows=${data?.length}`);
  }
  if (memberAOk) {
    const { data, error } = await a.client
      .from("profiles")
      .update({ role: "ADMIN" })
      .eq("id", a.id)
      .select();
    const blocked = Boolean(error) || (data ?? []).length === 0;
    record("RLS-general", "member A cannot self-promote to ADMIN", blocked ? "PASS" : "FAIL", error ? error.message : JSON.stringify(data));
  }
  if (memberAOk) {
    const { data, error } = await a.client.from("point_transactions").insert({
      user_id: a.id, type: "ADMIN_ADJUST", amount: 999999, balance_after: 999999, reason: "forged",
    }).select();
    const blocked = Boolean(error) || (data ?? []).length === 0;
    record("RLS-general", "member A cannot insert fake point_transactions", blocked ? "PASS" : "FAIL", error ? error.message : JSON.stringify(data));
  }
  if (memberAOk) {
    const { data, error } = await a.client.from("coupons").select("id");
    record("RLS-general", "member A cannot see coupons table directly", !error && data?.length === 0 ? "PASS" : "FAIL", error?.message ?? `rows=${data?.length}`);
  }

  // ---------------------------------------------------------------------
  // Section: ADMIN RLS / Admin CRUD
  // ---------------------------------------------------------------------
  let testCouponCode = null;
  if (admin) {
    const { data, error } = await admin.client.from("profiles").select("id");
    record("RLS-admin", "admin can read all profiles", !error && data?.length >= 2 ? "PASS" : "FAIL", error?.message ?? `rows=${data?.length}`);

    testCouponCode = `E2E-${Date.now()}`;
    const couponInsert = await admin.client.from("coupons").insert({
      code: testCouponCode, name: "STEP15.5 E2E test coupon", discount_type: "FIXED", discount_value: 1000,
      market_code: "KR", per_user_limit: 1, valid_until: new Date(Date.now() + 3600_000).toISOString(),
    }).select().maybeSingle();
    record("Admin-CRUD", "admin can create a coupon", !couponInsert.error ? "PASS" : "FAIL", couponInsert.error?.message);

    if (memberAOk) {
      const { data: d2, error: e2 } = await a.client.from("coupons").insert({
        code: `SHOULD-FAIL-${Date.now()}`, name: "x", discount_type: "PERCENT", discount_value: 10,
        per_user_limit: 1, valid_until: new Date(Date.now() + 3600_000).toISOString(),
      }).select();
      const blocked = Boolean(e2) || (d2 ?? []).length === 0;
      record("RLS-admin", "non-admin cannot create a coupon", blocked ? "PASS" : "FAIL", e2 ? e2.message : "insert succeeded — SECURITY HOLE");
    }

    if (memberAOk) {
      const { error } = await admin.client.rpc("admin_adjust_points", {
        p_user_id: a.id, p_amount: 5000, p_reason: "STEP 15.5 E2E grant",
      });
      record("Admin-CRUD", "admin_adjust_points grants member A 5000 points", !error ? "PASS" : "FAIL", error?.message);
    }
  } else {
    record("RLS-admin", "admin RLS + Admin CRUD", "BLOCKED", "no admin session");
  }

  // ---------------------------------------------------------------------
  // Section: Product DB 조회
  // ---------------------------------------------------------------------
  {
    const { data, error } = await anon
      .from("products")
      .select("id, product_prices(currency_code, sale_price, original_price), product_shipping_markets(country_code, shipping_fee)")
      .eq("id", P.best1.id)
      .maybeSingle();
    const priceRow = data?.product_prices?.find((p) => p.currency_code === "KRW");
    const ok = !error && priceRow?.sale_price === P.best1.krwSale && priceRow?.original_price === P.best1.krwOrig;
    record("Product-DB", "best-1 KRW price matches seed (29900/38900)", ok ? "PASS" : "FAIL", error?.message ?? JSON.stringify(priceRow));
  }

  // ---------------------------------------------------------------------
  // Section: Guest -> Member Cart Merge
  // ---------------------------------------------------------------------
  if (memberAOk) {
    const { error } = await a.client.rpc("merge_guest_cart", {
      p_items: [
        { product_id: "best-3", quantity: 5, selected_options: {} },
        { product_id: "best-1", quantity: 999, selected_options: { merge: "probe" } },
      ],
    });
    if (error) {
      record("Cart-Merge", "merge_guest_cart call", "FAIL", error.message);
    } else {
      const { data: unlimitedRow } = await a.client
        .from("cart_items").select("quantity").eq("user_id", a.id).eq("product_id", P.best3.id)
        .eq("selected_options", "{}").maybeSingle();
      record("Cart-Merge", "UNLIMITED product (best-3) merge NOT capped to 1", unlimitedRow?.quantity === 5 ? "PASS" : "FAIL", `quantity=${unlimitedRow?.quantity}`);

      const { data: trackedRow } = await a.client
        .from("cart_items").select("quantity").eq("user_id", a.id).eq("product_id", P.best1.id)
        .eq("selected_options", JSON.stringify({ merge: "probe" })).maybeSingle();
      record("Cart-Merge", "TRACKED product (best-1, stock=8) merge capped at stock", trackedRow?.quantity === P.best1.stock ? "PASS" : "FAIL", `quantity=${trackedRow?.quantity}`);
    }
  } else {
    record("Cart-Merge", "merge_guest_cart", "BLOCKED", "member A not signed in");
  }

  // ---------------------------------------------------------------------
  // Section: create_order RPC — legitimate order + price/shipping/discount
  // manipulation attacks. THIS IS THE MOST CRITICAL SECTION.
  // ---------------------------------------------------------------------
  let legitOrderId = null;
  if (memberAOk) {
    const orderNumber = `E2E-KR-${Date.now()}`;
    const { data: orderId, error } = await a.client.rpc("create_order", {
      p_order_number: orderNumber,
      p_user_id: a.id,
      p_guest_email: null,
      p_guest_phone: null,
      p_market_code: "KR",
      p_currency_code: "KRW",
      p_payment_method: "card",
      p_shipping_address: shipping("Member A", "KR", "KR"),
      p_customs_info: null,
      p_items: [{ product_id: P.best1.id, variant_id: null, quantity: 1, option_snapshot: {} }],
      p_coupon_code: null,
      p_points_used: 0,
    });
    if (error) {
      record("create_order", "legitimate KR order", "FAIL", error.message);
    } else {
      legitOrderId = orderId;
      const { data: order } = await a.client.from("orders").select("subtotal, shipping_amount, total_amount").eq("id", orderId).maybeSingle();
      const ok = order?.subtotal === P.best1.krwSale && order?.shipping_amount === 0 && order?.total_amount === P.best1.krwSale;
      record("create_order", "legitimate KR order totals match server price (29900/0/29900)", ok ? "PASS" : "FAIL", JSON.stringify(order));
    }
  } else {
    record("create_order", "legitimate KR order", "BLOCKED", "member A not signed in");
  }

  if (memberAOk) {
    // Attack 1: forge unit_price=1 / original_price=999999 in the item itself.
    const orderNumber = `E2E-ATTACK-PRICE-${Date.now()}`;
    const { data: orderId, error } = await a.client.rpc("create_order", {
      p_order_number: orderNumber, p_user_id: a.id, p_guest_email: null, p_guest_phone: null,
      p_market_code: "KR", p_currency_code: "KRW", p_payment_method: "card",
      p_shipping_address: shipping("Member A", "KR", "KR"), p_customs_info: null,
      p_items: [{ product_id: P.best1.id, variant_id: null, quantity: 1, unit_price: 1, original_price: 999999, option_snapshot: {} }],
      p_coupon_code: null, p_points_used: 0,
    });
    if (error) {
      record("create_order-ATTACK", "forged item.unit_price=1 is rejected or ignored", "FAIL", `RPC errored instead of ignoring: ${error.message}`);
    } else {
      const { data: item } = await a.client.from("order_items").select("unit_price, original_price").eq("order_id", orderId).maybeSingle();
      const ok = item?.unit_price === P.best1.krwSale && item?.original_price === P.best1.krwOrig;
      record("create_order-ATTACK", "forged item.unit_price=1 / original_price=999999 IGNORED, real price charged", ok ? "PASS" : "FAIL", JSON.stringify(item));
    }
  }

  {
    // Attack 2: call with the OLD pre-STEP15 param shape (p_subtotal etc.) — must not resolve to any function.
    const { error } = await a.client.rpc("create_order", {
      p_order_number: `E2E-ATTACK-LEGACY-${Date.now()}`, p_user_id: a.id, p_guest_email: null, p_guest_phone: null,
      p_market_code: "KR", p_currency_code: "KRW",
      p_subtotal: 1, p_discount_amount: 999999, p_shipping_amount: 0, p_total_amount: 1,
      p_payment_method: "card", p_shipping_address: shipping("x", "KR", "KR"), p_customs_info: null,
      p_items: [{ product_id: P.best1.id, quantity: 1 }],
    });
    record("create_order-ATTACK", "legacy p_subtotal/p_total_amount call shape is rejected (function not found)", error ? "PASS" : "FAIL", error ? error.message : "RPC accepted the legacy shape — SECURITY HOLE");
  }

  {
    // Attack 3: forged p_is_production=false direct call — must be rejected outright post-fix
    // (the whole point of this parameter no longer existing on the RPC).
    const { error } = await a.client.rpc("create_order", {
      p_order_number: `E2E-ATTACK-ISPROD-${Date.now()}`, p_user_id: a.id, p_guest_email: null, p_guest_phone: null,
      p_market_code: "KR", p_currency_code: "KRW", p_payment_method: "card",
      p_shipping_address: shipping("x", "KR", "KR"), p_customs_info: null,
      p_items: [{ product_id: P.best1.id, quantity: 1 }], p_is_production: false,
    });
    record("create_order-ATTACK", "forged p_is_production param is rejected (parameter no longer exists)", error ? "PASS" : "FAIL", error ? error.message : "RPC accepted p_is_production from the client — SECURITY HOLE");
  }

  if (memberBOk) {
    // Attack 4: points_used far beyond balance (member B has 0 points).
    const { error } = await b.client.rpc("create_order", {
      p_order_number: `E2E-ATTACK-POINTS-${Date.now()}`, p_user_id: b.id, p_guest_email: null, p_guest_phone: null,
      p_market_code: "KR", p_currency_code: "KRW", p_payment_method: "card",
      p_shipping_address: shipping("Member B", "KR", "KR"), p_customs_info: null,
      p_items: [{ product_id: P.best1.id, quantity: 1 }], p_points_used: 999999,
    });
    record("create_order-ATTACK", "points_used=999999 with 0 balance is rejected", error ? "PASS" : "FAIL", error ? error.message : "order was created — SECURITY HOLE");
  }

  if (memberAOk) {
    // Attack 5: nonexistent coupon code.
    const { error } = await a.client.rpc("create_order", {
      p_order_number: `E2E-ATTACK-COUPON-${Date.now()}`, p_user_id: a.id, p_guest_email: null, p_guest_phone: null,
      p_market_code: "KR", p_currency_code: "KRW", p_payment_method: "card",
      p_shipping_address: shipping("Member A", "KR", "KR"), p_customs_info: null,
      p_items: [{ product_id: P.best1.id, quantity: 1 }], p_coupon_code: "DOES-NOT-EXIST-XYZ",
    });
    record("create_order-ATTACK", "nonexistent coupon code is rejected", error ? "PASS" : "FAIL", error ? error.message : "order was created — SECURITY HOLE");
  }

  // ---------------------------------------------------------------------
  // Section: Coupon / Point real usage
  // ---------------------------------------------------------------------
  if (memberAOk && testCouponCode) {
    const orderNumber = `E2E-COUPON-POINT-${Date.now()}`;
    const { data: orderId, error } = await a.client.rpc("create_order", {
      p_order_number: orderNumber, p_user_id: a.id, p_guest_email: null, p_guest_phone: null,
      p_market_code: "KR", p_currency_code: "KRW", p_payment_method: "card",
      p_shipping_address: shipping("Member A", "KR", "KR"), p_customs_info: null,
      p_items: [{ product_id: P.best1.id, quantity: 1 }],
      p_coupon_code: testCouponCode, p_points_used: 1000,
    });
    if (error) {
      record("Coupon-Point", "real order with coupon + points", "FAIL", error.message);
    } else {
      const { data: order } = await a.client.from("orders")
        .select("subtotal, coupon_discount_amount, points_used, total_amount").eq("id", orderId).maybeSingle();
      const expectedTotal = P.best1.krwSale - 1000 /* fixed coupon */ - 1000 /* points */;
      const ok = order?.coupon_discount_amount === 1000 && order?.points_used === 1000 && order?.total_amount === expectedTotal;
      record("Coupon-Point", `coupon(-1000) + points(-1000) => total ${expectedTotal}`, ok ? "PASS" : "FAIL", JSON.stringify(order));

      const { error: reuseError } = await a.client.rpc("create_order", {
        p_order_number: `E2E-COUPON-REUSE-${Date.now()}`, p_user_id: a.id, p_guest_email: null, p_guest_phone: null,
        p_market_code: "KR", p_currency_code: "KRW", p_payment_method: "card",
        p_shipping_address: shipping("Member A", "KR", "KR"), p_customs_info: null,
        p_items: [{ product_id: P.best1.id, quantity: 1 }], p_coupon_code: testCouponCode,
      });
      record("Coupon-Point", "per-user coupon reuse beyond limit is rejected", reuseError ? "PASS" : "FAIL", reuseError ? reuseError.message : "second use succeeded — SECURITY HOLE");
    }
  } else {
    record("Coupon-Point", "coupon + point real usage", "BLOCKED", "needs admin (coupon create + point grant) and member A");
  }

  if (memberAOk) {
    // Points on a non-KRW order must be rejected even though member A now has a balance.
    const { error } = await a.client.rpc("create_order", {
      p_order_number: `E2E-POINTS-CURRENCY-${Date.now()}`, p_user_id: a.id, p_guest_email: null, p_guest_phone: null,
      p_market_code: "IN", p_currency_code: "INR", p_payment_method: "upi",
      p_shipping_address: shipping("Member A", "IN", "IN"), p_customs_info: null,
      p_items: [{ product_id: P.best2.id, quantity: 1 }], p_points_used: 100,
    });
    record("Coupon-Point", "points_used on a non-KRW (INR) order is rejected", error ? "PASS" : "FAIL", error ? error.message : "order was created — SECURITY HOLE");
  }

  // ---------------------------------------------------------------------
  // Section: KR / IN / USD orders
  // ---------------------------------------------------------------------
  if (memberAOk) {
    const { data: orderId, error } = await a.client.rpc("create_order", {
      p_order_number: `E2E-IN-${Date.now()}`, p_user_id: a.id, p_guest_email: null, p_guest_phone: null,
      p_market_code: "IN", p_currency_code: "INR", p_payment_method: "upi",
      p_shipping_address: shipping("Member A", "IN", "IN"), p_customs_info: null,
      p_items: [{ product_id: P.best2.id, quantity: 1 }],
    });
    if (error) {
      record("Multi-currency", "IN/INR order (best-2, explicit INR price)", "FAIL", error.message);
    } else {
      const { data: order } = await a.client.from("orders").select("subtotal, currency_code").eq("id", orderId).maybeSingle();
      record("Multi-currency", "IN/INR order total matches seeded INR price (6499)", order?.subtotal === P.best2.inrSale ? "PASS" : "FAIL", JSON.stringify(order));
    }

    const { error: usdError } = await a.client.rpc("create_order", {
      p_order_number: `E2E-USD-${Date.now()}`, p_user_id: a.id, p_guest_email: null, p_guest_phone: null,
      p_market_code: "KR", p_currency_code: "USD", p_payment_method: "card",
      p_shipping_address: shipping("Member A", "KR", "KR"), p_customs_info: null,
      p_items: [{ product_id: P.best1.id, quantity: 1 }],
    });
    const isPriceNotReady = usdError?.message?.includes("PRICE_NOT_READY");
    record(
      "Multi-currency",
      "USD order with no seeded USD price is refused (PRICE_NOT_READY, fail-closed default)",
      isPriceNotReady ? "PASS" : "FAIL",
      usdError ? usdError.message : "USD order was created with an unverified dev-rate price — should have been refused by default"
    );
  }

  // ---------------------------------------------------------------------
  // Section: Shipping Groups (mixed shipping types in one order)
  // ---------------------------------------------------------------------
  if (memberAOk) {
    const orderNumber = `E2E-SHIPGROUPS-${Date.now()}`;
    const { data: orderId, error } = await a.client.rpc("create_order", {
      p_order_number: orderNumber, p_user_id: a.id, p_guest_email: null, p_guest_phone: null,
      p_market_code: "KR", p_currency_code: "KRW", p_payment_method: "card",
      p_shipping_address: shipping("Member A", "KR", "KR"), p_customs_info: null,
      p_items: [
        { product_id: P.best1.id, quantity: 1 }, // DOMESTIC
        { product_id: P.extra20.id, quantity: 1 }, // OVERSEAS_AGENCY
      ],
    });
    if (error) {
      record("Shipping-Groups", "mixed DOMESTIC + OVERSEAS_AGENCY order", "FAIL", error.message);
    } else {
      const { data: groups } = await a.client.from("shipping_groups").select("shipping_type, status, shipping_fee").eq("order_id", orderId);
      const domestic = groups?.find((g) => g.shipping_type === "DOMESTIC");
      const agency = groups?.find((g) => g.shipping_type === "OVERSEAS_AGENCY");
      const ok = groups?.length === 2 && domestic?.status === "PREPARING" && agency?.status === "PURCHASING" && agency?.shipping_fee === P.extra20.krShipFee;
      record("Shipping-Groups", "2 groups created, DOMESTIC=PREPARING, OVERSEAS_AGENCY=PURCHASING", ok ? "PASS" : "FAIL", JSON.stringify(groups));
    }
  }

  // ---------------------------------------------------------------------
  // Section: Storage 권한
  // ---------------------------------------------------------------------
  const probeFile = new Blob(["step15-5 probe"], { type: "text/plain" });
  if (memberAOk) {
    const { error } = await a.client.storage.from("product-images").upload(`probe-${Date.now()}.txt`, probeFile);
    record("Storage", "member A cannot upload to product-images (admin-only bucket)", error ? "PASS" : "FAIL", error ? error.message : "upload succeeded — SECURITY HOLE");
  }
  if (admin) {
    const path = `step15-5-probe-${Date.now()}.txt`;
    const { error } = await admin.client.storage.from("product-images").upload(path, probeFile);
    record("Storage", "admin can upload to product-images", !error ? "PASS" : "FAIL", error?.message);
    if (!error) {
      const { data: pub } = admin.client.storage.from("product-images").getPublicUrl(path);
      record("Storage", "uploaded file has a public URL (anon-readable bucket)", pub?.publicUrl ? "PASS" : "FAIL", pub?.publicUrl);
    }
  } else {
    record("Storage", "admin upload to product-images", "BLOCKED", "no admin session");
  }
  record("Storage", "customer review-image upload boundary", "N/A", "review_images.image_url is a plain text column, not Storage-backed in this codebase — no bucket exists to test");

  // ---------------------------------------------------------------------
  // Section: Search (real PostgREST, no mock fallback)
  // ---------------------------------------------------------------------
  {
    const { data, error } = await anon
      .from("products")
      .select("id, name_ko")
      .eq("is_active", true)
      .or("name_ko.ilike.%텀블러%,name_en.ilike.%텀블러%,brand.ilike.%텀블러%,sku.ilike.%텀블러%");
    const found = (data ?? []).some((p) => p.id === P.best1.id);
    record("Search", "ilike search for '텀블러' finds best-1 via real DB", found ? "PASS" : "FAIL", error?.message ?? `rows=${data?.length}`);
  }
  {
    const { error } = await anon.from("search_events").insert({
      query: "step15.5-probe", normalized_query: "step15.5-probe", user_id: null, market_code: "KR", locale: "ko", result_count: 0,
    });
    record("Search", "anon can log a search_event (own or anonymous row)", !error ? "PASS" : "FAIL", error?.message);
  }

  // ---------------------------------------------------------------------
  // Section: MyPage (underlying data scoping — not the rendered page itself)
  // ---------------------------------------------------------------------
  if (memberAOk) {
    const { data } = await a.client.from("orders").select("id");
    record("MyPage-data", "member A's own orders query returns their orders", (data?.length ?? 0) > 0 ? "PASS" : "FAIL", `rows=${data?.length}`);
  }
  if (memberAOk && memberBOk) {
    const { data } = await b.client.from("orders").select("id");
    const leaksA = legitOrderId && (data ?? []).some((o) => o.id === legitOrderId);
    record("MyPage-data", "member B cannot see member A's orders", !leaksA ? "PASS" : "FAIL", `rows=${data?.length}`);
  }
  record("MyPage-UI", "actual /mypage page rendering", "BLOCKED", "this script only checks the underlying DB queries — needs a manual browser check against the running app");

  // ---------------------------------------------------------------------
  // Section: Payment Prepare
  // ---------------------------------------------------------------------
  record("Payment-Prepare", "/api/payments/prepare route", "BLOCKED", "this is a Next.js Route Handler, not Supabase — verify separately with `npm run dev` running locally and a curl/browser check (see report)");

  // ---------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------
  console.log("\n=== SUMMARY ===");
  const bySection = {};
  for (const r of results) {
    bySection[r.section] ??= { PASS: 0, FAIL: 0, BLOCKED: 0, "N/A": 0 };
    bySection[r.section][r.status] += 1;
  }
  for (const [section, counts] of Object.entries(bySection)) {
    console.log(`${section}: PASS=${counts.PASS} FAIL=${counts.FAIL} BLOCKED=${counts.BLOCKED} N/A=${counts["N/A"]}`);
  }
  const totalFail = results.filter((r) => r.status === "FAIL").length;
  console.log(`\nTotal: ${results.length} checks, ${totalFail} FAILED.`);
  console.log("\nCopy this entire output (including each [PASS]/[FAIL]/[BLOCKED] line above) back to continue the STEP 15.5 report.");
}

main().catch((err) => {
  console.error("Script crashed:", err);
  process.exit(1);
});
