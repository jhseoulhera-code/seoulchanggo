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
// it):
//   STEP15_5_ADMIN_EMAIL, STEP15_5_ADMIN_PASSWORD
//     — login for the account you already promoted to ADMIN. Without
//     these, every ADMIN-dependent check reports BLOCKED (never assumed).
//   STEP15_5_MEMBER_A_EMAIL, STEP15_5_MEMBER_A_PASSWORD
//   STEP15_5_MEMBER_B_EMAIL, STEP15_5_MEMBER_B_PASSWORD
//     — two existing, already-confirmed real accounts on this project, used
//     to sign in instead of signing up a fresh one. Use this if your
//     project's email provider rejects throwaway domains (e.g. example.com)
//     — Supabase's own address validation varies by project setting, so
//     this script never assumes a fabricated address will be accepted.
//     If EITHER member's pair is omitted, this script instead tries to
//     derive a fresh test address by "+"-tagging the ADMIN email's own
//     domain (e.g. you+step1555-a-<random>@yourdomain.com) — a domain
//     you've already proven this project accepts, since it's the one your
//     admin account itself signed up with. If no admin email is available
//     either, that member's checks are reported BLOCKED with the reason —
//     never silently attempted with a guessed domain.
//
// "Confirm email" must be OFF for the project (Authentication -> Providers
// -> Email) for freshly signed-up accounts to return a session immediately;
// pre-existing MEMBER_A/B accounts must already be confirmed.
//
// Nothing here is fabricated: every row below prints PASS, FAIL, or BLOCKED
// (with the reason) from an actual API response — never assumed. No real
// email address or password is ever printed, including inside error text.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ADMIN_EMAIL = process.env.STEP15_5_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.STEP15_5_ADMIN_PASSWORD;
const MEMBER_A_EMAIL = process.env.STEP15_5_MEMBER_A_EMAIL;
const MEMBER_A_PASSWORD = process.env.STEP15_5_MEMBER_A_PASSWORD;
const MEMBER_B_EMAIL = process.env.STEP15_5_MEMBER_B_EMAIL;
const MEMBER_B_PASSWORD = process.env.STEP15_5_MEMBER_B_PASSWORD;

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

// Never let a real email/password reach stdout, including inside a
// Supabase error message (some validation errors echo the input back).
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
function redact(text) {
  if (typeof text !== "string") return text;
  return text.replace(EMAIL_PATTERN, "[redacted-email]");
}

const results = [];
function record(section, name, status, detail) {
  results.push({ section, name, status, detail });
  console.log(`[${status}] ${section} — ${name}${detail ? `: ${redact(String(detail))}` : ""}`);
}

/** Runs one check; an unexpected throw becomes a FAIL instead of crashing the whole script. */
async function check(section, name, fn) {
  try {
    const result = await fn();
    if (result && typeof result === "object" && "status" in result) {
      record(section, name, result.status, result.detail);
    } else if (result === false) {
      record(section, name, "FAIL");
    } else {
      record(section, name, "PASS");
    }
  } catch (err) {
    record(section, name, "FAIL", `unexpected error: ${err?.message ?? String(err)}`);
  }
}

function blocked(section, name, reason) {
  record(section, name, "BLOCKED", reason);
}

function client() {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

function shipping(name, country) {
  return { fullName: name, phone: "010-0000-0000", country, zipCode: "00000", address1: "테스트 주소", address2: "" };
}

/**
 * Never prints the credential itself — only whether each var was present
 * and how long it was — so a login failure can be diagnosed (blank var,
 * stray CRLF from an env file saved on Windows, wrong var name reaching
 * this call) without the credential ever hitting stdout.
 */
function credentialDebug(email, password) {
  return `email_present=${Boolean(email)} email_len=${email?.length ?? 0} password_present=${Boolean(password)} password_len=${password?.length ?? 0}`;
}

/**
 * Resolves one test member: prefers an existing account (env email+password,
 * signed in), else derives a "+"-tagged address on the ADMIN email's own
 * domain and signs up fresh, else reports why it can't proceed.
 *
 * The env branch below returns unconditionally (success or failure) the
 * moment both env vars are present — the derived-account fallback further
 * down is structurally unreachable whenever explicit credentials were
 * given, on purpose, so a typo'd password can never silently fall through
 * to a freshly created account instead of surfacing as a login failure.
 *
 * Only the email is trimmed (a stray trailing newline from an env file is
 * never a meaningful part of an address); the password is used exactly as
 * read, since leading/trailing whitespace could be part of the real value.
 */
async function resolveMember(label, envEmail, envPassword) {
  const c = client();
  if (envEmail && envPassword) {
    const email = envEmail.trim();
    console.log(`[setup] member ${label.toUpperCase()}: signing in with STEP15_5_MEMBER_${label.toUpperCase()}_EMAIL/PASSWORD (${credentialDebug(email, envPassword)})`);
    const { data, error } = await c.auth.signInWithPassword({ email, password: envPassword });
    if (error) return { client: c, id: null, error: `sign-in failed (${credentialDebug(email, envPassword)}): ${error.message}` };
    return { client: c, id: data.user.id };
  }

  console.log(`[setup] member ${label.toUpperCase()}: no STEP15_5_MEMBER_${label.toUpperCase()}_EMAIL/PASSWORD set, falling back to a derived account`);
  if (!ADMIN_EMAIL || !ADMIN_EMAIL.includes("@")) {
    return {
      client: c,
      id: null,
      error: `no STEP15_5_MEMBER_${label.toUpperCase()}_EMAIL/PASSWORD and no STEP15_5_ADMIN_EMAIL to derive a domain from — cannot safely construct a test address`,
    };
  }
  const [localPart, domain] = ADMIN_EMAIL.trim().split("@");
  const derivedEmail = `${localPart}+step1555-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@${domain}`;
  const password = `TestPass!${randomUUID().slice(0, 8)}`;
  const { data, error } = await c.auth.signUp({ email: derivedEmail, password });
  if (error) return { client: c, id: null, error: `sign-up on derived address failed: ${error.message}` };
  if (!data.session) {
    return { client: c, id: null, error: "sign-up succeeded but returned NO_SESSION — turn off 'Confirm email' for this project" };
  }
  return { client: c, id: data.user.id };
}

/**
 * Deletes only this script's own known probe rows — scoped to member A's
 * own account (RLS-enforced regardless) and the exact seed product IDs +
 * option signatures this script itself writes — so repeat runs start from
 * the same state instead of accumulating (merge_guest_cart adds to an
 * UNLIMITED product's existing quantity rather than replacing it, so a
 * stale row from a prior run silently inflates the expected total).
 * Never touches any other product, option signature, or account.
 */
async function cleanupMemberACartProbes(a) {
  if (!a?.id) return;
  await a.client.from("cart_items").delete()
    .eq("user_id", a.id).eq("product_id", P.best1.id).eq("selected_options", JSON.stringify({ probe: "rls-a" }));
  await a.client.from("cart_items").delete()
    .eq("user_id", a.id).eq("product_id", P.best1.id).eq("selected_options", JSON.stringify({ merge: "probe" }));
  await a.client.from("cart_items").delete()
    .eq("user_id", a.id).eq("product_id", P.best3.id).eq("selected_options", "{}");
}

async function main() {
  console.log("=== STEP 15.5 real Cloud Supabase E2E verification ===\n");

  // ---------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------
  const anon = client();
  const a = await resolveMember("a", MEMBER_A_EMAIL, MEMBER_A_PASSWORD);
  const b = await resolveMember("b", MEMBER_B_EMAIL, MEMBER_B_PASSWORD);
  const memberAOk = Boolean(a.id);
  const memberBOk = Boolean(b.id);
  record("setup", "member A ready", memberAOk ? "PASS" : "BLOCKED", memberAOk ? a.id : a.error);
  record("setup", "member B ready", memberBOk ? "PASS" : "BLOCKED", memberBOk ? b.id : b.error);

  let admin = null;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const c = client();
    const email = ADMIN_EMAIL.trim();
    const { data, error } = await c.auth.signInWithPassword({ email, password: ADMIN_PASSWORD });
    if (error) {
      record("setup", "admin sign-in", "FAIL", `${error.message} (${credentialDebug(email, ADMIN_PASSWORD)})`);
    } else {
      admin = { client: c, id: data.user.id };
      record("setup", "admin sign-in", "PASS", data.user.id);
    }
  } else {
    blocked("setup", "admin credentials", "STEP15_5_ADMIN_EMAIL/PASSWORD not set");
  }

  // Clean up this script's own leftover probe rows from any previous run
  // before anything else touches member A's cart, so every check below
  // starts from the same known state regardless of how many times this
  // has run before.
  await cleanupMemberACartProbes(a);

  // ---------------------------------------------------------------------
  // Section: 일반회원 RLS
  // ---------------------------------------------------------------------
  await check("RLS-general", "anon can read products", async () => {
    const { data, error } = await anon.from("products").select("id").limit(1);
    if (error) return { status: "FAIL", detail: error.message };
    return { status: data?.length > 0 ? "PASS" : "FAIL", detail: `rows=${data?.length}` };
  });

  await check("RLS-general", "anon select cart_items returns none (not an error)", async () => {
    const { data, error } = await anon.from("cart_items").select("id");
    if (error) return { status: "FAIL", detail: error.message };
    return { status: data?.length === 0 ? "PASS" : "FAIL", detail: `rows=${data?.length}` };
  });

  if (memberAOk) {
    await check("RLS-general", "member A can insert own cart_items", async () => {
      const { error } = await a.client.from("cart_items").insert({
        user_id: a.id, product_id: P.best1.id, selected_options: { probe: "rls-a" }, quantity: 1,
      });
      return { status: error ? "FAIL" : "PASS", detail: error?.message };
    });
  } else {
    blocked("RLS-general", "member A can insert own cart_items", "member A not available");
  }

  if (memberAOk && memberBOk) {
    await check("RLS-general", "member B cannot insert cart_items as member A", async () => {
      const { error } = await b.client.from("cart_items").insert({
        user_id: a.id, product_id: P.best1.id, selected_options: { probe: "rls-b-spoof" }, quantity: 1,
      });
      return { status: error ? "PASS" : "FAIL", detail: error ? error.message : "insert succeeded — SECURITY HOLE" };
    });
  } else {
    blocked("RLS-general", "member B cannot insert cart_items as member A", "needs both member A and member B");
  }

  if (memberAOk) {
    await check("RLS-general", "member A cart_items select returns only own rows", async () => {
      const { data } = await a.client.from("cart_items").select("id, user_id");
      const onlyOwn = (data ?? []).every((row) => row.user_id === a.id);
      return { status: onlyOwn ? "PASS" : "FAIL", detail: `rows=${data?.length}` };
    });

    await check("RLS-general", "member A cannot self-promote to ADMIN", async () => {
      const { data, error } = await a.client.from("profiles").update({ role: "ADMIN" }).eq("id", a.id).select();
      const isBlocked = Boolean(error) || (data ?? []).length === 0;
      return { status: isBlocked ? "PASS" : "FAIL", detail: error ? error.message : JSON.stringify(data) };
    });

    await check("RLS-general", "member A cannot insert fake point_transactions", async () => {
      const { data, error } = await a.client.from("point_transactions").insert({
        user_id: a.id, type: "ADMIN_ADJUST", amount: 999999, balance_after: 999999, reason: "forged",
      }).select();
      const isBlocked = Boolean(error) || (data ?? []).length === 0;
      return { status: isBlocked ? "PASS" : "FAIL", detail: error ? error.message : JSON.stringify(data) };
    });

    await check("RLS-general", "member A cannot see coupons table directly", async () => {
      const { data, error } = await a.client.from("coupons").select("id");
      if (error) return { status: "FAIL", detail: error.message };
      return { status: data?.length === 0 ? "PASS" : "FAIL", detail: `rows=${data?.length}` };
    });
  } else {
    for (const name of [
      "member A cart_items select returns only own rows",
      "member A cannot self-promote to ADMIN",
      "member A cannot insert fake point_transactions",
      "member A cannot see coupons table directly",
    ]) {
      blocked("RLS-general", name, "member A not available");
    }
  }

  // ---------------------------------------------------------------------
  // Section: ADMIN RLS / Admin CRUD
  // ---------------------------------------------------------------------
  let testCouponCode = null;
  if (admin) {
    await check("RLS-admin", "admin can read all profiles", async () => {
      const { data, error } = await admin.client.from("profiles").select("id");
      if (error) return { status: "FAIL", detail: error.message };
      return { status: data?.length >= 2 ? "PASS" : "FAIL", detail: `rows=${data?.length}` };
    });

    testCouponCode = `E2E-${Date.now()}`;
    await check("Admin-CRUD", "admin can create a coupon", async () => {
      const { error } = await admin.client.from("coupons").insert({
        code: testCouponCode, name: "STEP15.5 E2E test coupon", discount_type: "FIXED", discount_value: 1000,
        market_code: "KR", per_user_limit: 1, valid_until: new Date(Date.now() + 3600_000).toISOString(),
      }).select().maybeSingle();
      if (error) testCouponCode = null;
      return { status: error ? "FAIL" : "PASS", detail: error?.message };
    });

    if (memberAOk) {
      await check("RLS-admin", "non-admin cannot create a coupon", async () => {
        const { data, error } = await a.client.from("coupons").insert({
          code: `SHOULD-FAIL-${Date.now()}`, name: "x", discount_type: "PERCENT", discount_value: 10,
          per_user_limit: 1, valid_until: new Date(Date.now() + 3600_000).toISOString(),
        }).select();
        const isBlocked = Boolean(error) || (data ?? []).length === 0;
        return { status: isBlocked ? "PASS" : "FAIL", detail: error ? error.message : "insert succeeded — SECURITY HOLE" };
      });

      await check("Admin-CRUD", "admin_adjust_points grants member A 5000 points", async () => {
        const { error } = await admin.client.rpc("admin_adjust_points", {
          p_user_id: a.id, p_amount: 5000, p_reason: "STEP 15.5 E2E grant",
        });
        return { status: error ? "FAIL" : "PASS", detail: error?.message };
      });
    } else {
      blocked("RLS-admin", "non-admin cannot create a coupon", "member A not available");
      blocked("Admin-CRUD", "admin_adjust_points grants member A 5000 points", "member A not available");
    }
  } else {
    blocked("RLS-admin", "admin can read all profiles", "no admin session");
    blocked("RLS-admin", "non-admin cannot create a coupon", "no admin session");
    blocked("Admin-CRUD", "admin can create a coupon", "no admin session");
    blocked("Admin-CRUD", "admin_adjust_points grants member A 5000 points", "no admin session");
  }

  // ---------------------------------------------------------------------
  // Section: Product DB 조회
  // ---------------------------------------------------------------------
  await check("Product-DB", "best-1 KRW price matches seed (29900/38900)", async () => {
    const { data, error } = await anon
      .from("products")
      .select("id, product_prices(currency_code, sale_price, original_price), product_shipping_markets(country_code, shipping_fee)")
      .eq("id", P.best1.id)
      .maybeSingle();
    if (error) return { status: "FAIL", detail: error.message };
    const priceRow = data?.product_prices?.find((p) => p.currency_code === "KRW");
    const ok = priceRow?.sale_price === P.best1.krwSale && priceRow?.original_price === P.best1.krwOrig;
    return { status: ok ? "PASS" : "FAIL", detail: JSON.stringify(priceRow) };
  });

  // ---------------------------------------------------------------------
  // Section: Guest -> Member Cart Merge
  // ---------------------------------------------------------------------
  if (memberAOk) {
    await check("Cart-Merge", "merge_guest_cart call", async () => {
      const { error } = await a.client.rpc("merge_guest_cart", {
        p_items: [
          { product_id: "best-3", quantity: 5, selected_options: {} },
          { product_id: "best-1", quantity: 999, selected_options: { merge: "probe" } },
        ],
      });
      return { status: error ? "FAIL" : "PASS", detail: error?.message };
    });

    await check("Cart-Merge", "UNLIMITED product (best-3) merge NOT capped to 1", async () => {
      const { data } = await a.client
        .from("cart_items").select("quantity").eq("user_id", a.id).eq("product_id", P.best3.id)
        .eq("selected_options", "{}").maybeSingle();
      return { status: data?.quantity === 5 ? "PASS" : "FAIL", detail: `quantity=${data?.quantity}` };
    });

    await check("Cart-Merge", "TRACKED product (best-1, stock=8) merge capped at stock", async () => {
      const { data } = await a.client
        .from("cart_items").select("quantity").eq("user_id", a.id).eq("product_id", P.best1.id)
        .eq("selected_options", JSON.stringify({ merge: "probe" })).maybeSingle();
      return { status: data?.quantity === P.best1.stock ? "PASS" : "FAIL", detail: `quantity=${data?.quantity}` };
    });
  } else {
    blocked("Cart-Merge", "merge_guest_cart call", "member A not available");
    blocked("Cart-Merge", "UNLIMITED product (best-3) merge NOT capped to 1", "member A not available");
    blocked("Cart-Merge", "TRACKED product (best-1, stock=8) merge capped at stock", "member A not available");
  }

  // ---------------------------------------------------------------------
  // Section: create_order RPC — legitimate order + price/shipping/discount
  // manipulation attacks. THIS IS THE MOST CRITICAL SECTION.
  // ---------------------------------------------------------------------
  let legitOrderId = null;
  if (memberAOk) {
    await check("create_order", "legitimate KR order totals match server price (29900/0/29900)", async () => {
      const { data: orderId, error } = await a.client.rpc("create_order", {
        p_order_number: `E2E-KR-${Date.now()}`, p_user_id: a.id, p_guest_email: null, p_guest_phone: null,
        p_market_code: "KR", p_currency_code: "KRW", p_payment_method: "card",
        p_shipping_address: shipping("Member A", "KR"), p_customs_info: null,
        p_items: [{ product_id: P.best1.id, variant_id: null, quantity: 1, option_snapshot: {} }],
        p_coupon_code: null, p_points_used: 0,
      });
      if (error) return { status: "FAIL", detail: error.message };
      legitOrderId = orderId;
      const { data: order } = await a.client.from("orders").select("subtotal, shipping_amount, total_amount").eq("id", orderId).maybeSingle();
      const ok = order?.subtotal === P.best1.krwSale && order?.shipping_amount === 0 && order?.total_amount === P.best1.krwSale;
      return { status: ok ? "PASS" : "FAIL", detail: JSON.stringify(order) };
    });

    await check("create_order-ATTACK", "forged item.unit_price=1 / original_price=999999 IGNORED, real price charged", async () => {
      const { data: orderId, error } = await a.client.rpc("create_order", {
        p_order_number: `E2E-ATTACK-PRICE-${Date.now()}`, p_user_id: a.id, p_guest_email: null, p_guest_phone: null,
        p_market_code: "KR", p_currency_code: "KRW", p_payment_method: "card",
        p_shipping_address: shipping("Member A", "KR"), p_customs_info: null,
        p_items: [{ product_id: P.best1.id, variant_id: null, quantity: 1, unit_price: 1, original_price: 999999, option_snapshot: {} }],
        p_coupon_code: null, p_points_used: 0,
      });
      if (error) return { status: "FAIL", detail: `RPC errored instead of ignoring the forged fields: ${error.message}` };
      const { data: item } = await a.client.from("order_items").select("unit_price, original_price").eq("order_id", orderId).maybeSingle();
      const ok = item?.unit_price === P.best1.krwSale && item?.original_price === P.best1.krwOrig;
      return { status: ok ? "PASS" : "FAIL", detail: JSON.stringify(item) };
    });

    await check("create_order-ATTACK", "legacy p_subtotal/p_total_amount call shape is rejected (function not found)", async () => {
      const { error } = await a.client.rpc("create_order", {
        p_order_number: `E2E-ATTACK-LEGACY-${Date.now()}`, p_user_id: a.id, p_guest_email: null, p_guest_phone: null,
        p_market_code: "KR", p_currency_code: "KRW",
        p_subtotal: 1, p_discount_amount: 999999, p_shipping_amount: 0, p_total_amount: 1,
        p_payment_method: "card", p_shipping_address: shipping("x", "KR"), p_customs_info: null,
        p_items: [{ product_id: P.best1.id, quantity: 1 }],
      });
      return { status: error ? "PASS" : "FAIL", detail: error ? error.message : "RPC accepted the legacy shape — SECURITY HOLE" };
    });

    await check("create_order-ATTACK", "forged p_is_production param is rejected (parameter no longer exists)", async () => {
      const { error } = await a.client.rpc("create_order", {
        p_order_number: `E2E-ATTACK-ISPROD-${Date.now()}`, p_user_id: a.id, p_guest_email: null, p_guest_phone: null,
        p_market_code: "KR", p_currency_code: "KRW", p_payment_method: "card",
        p_shipping_address: shipping("x", "KR"), p_customs_info: null,
        p_items: [{ product_id: P.best1.id, quantity: 1 }], p_is_production: false,
      });
      return { status: error ? "PASS" : "FAIL", detail: error ? error.message : "RPC accepted p_is_production from the client — SECURITY HOLE" };
    });

    await check("create_order-ATTACK", "nonexistent coupon code is rejected", async () => {
      const { error } = await a.client.rpc("create_order", {
        p_order_number: `E2E-ATTACK-COUPON-${Date.now()}`, p_user_id: a.id, p_guest_email: null, p_guest_phone: null,
        p_market_code: "KR", p_currency_code: "KRW", p_payment_method: "card",
        p_shipping_address: shipping("Member A", "KR"), p_customs_info: null,
        p_items: [{ product_id: P.best1.id, quantity: 1 }], p_coupon_code: "DOES-NOT-EXIST-XYZ",
      });
      return { status: error ? "PASS" : "FAIL", detail: error ? error.message : "order was created — SECURITY HOLE" };
    });
  } else {
    for (const name of [
      "legitimate KR order totals match server price (29900/0/29900)",
      "forged item.unit_price=1 / original_price=999999 IGNORED, real price charged",
      "legacy p_subtotal/p_total_amount call shape is rejected (function not found)",
      "forged p_is_production param is rejected (parameter no longer exists)",
      "nonexistent coupon code is rejected",
    ]) {
      blocked(name.includes("legitimate") ? "create_order" : "create_order-ATTACK", name, "member A not available");
    }
  }

  if (memberBOk) {
    await check("create_order-ATTACK", "points_used=999999 with 0 balance is rejected", async () => {
      const { error } = await b.client.rpc("create_order", {
        p_order_number: `E2E-ATTACK-POINTS-${Date.now()}`, p_user_id: b.id, p_guest_email: null, p_guest_phone: null,
        p_market_code: "KR", p_currency_code: "KRW", p_payment_method: "card",
        p_shipping_address: shipping("Member B", "KR"), p_customs_info: null,
        p_items: [{ product_id: P.best1.id, quantity: 1 }], p_points_used: 999999,
      });
      return { status: error ? "PASS" : "FAIL", detail: error ? error.message : "order was created — SECURITY HOLE" };
    });
  } else {
    blocked("create_order-ATTACK", "points_used=999999 with 0 balance is rejected", "member B not available");
  }

  // ---------------------------------------------------------------------
  // Section: Coupon / Point real usage
  // ---------------------------------------------------------------------
  let couponPointOrderOk = false;
  if (memberAOk && testCouponCode) {
    await check("Coupon-Point", "coupon(-1000) + points(-1000) real order", async () => {
      const { data: orderId, error } = await a.client.rpc("create_order", {
        p_order_number: `E2E-COUPON-POINT-${Date.now()}`, p_user_id: a.id, p_guest_email: null, p_guest_phone: null,
        p_market_code: "KR", p_currency_code: "KRW", p_payment_method: "card",
        p_shipping_address: shipping("Member A", "KR"), p_customs_info: null,
        p_items: [{ product_id: P.best1.id, quantity: 1 }],
        p_coupon_code: testCouponCode, p_points_used: 1000,
      });
      if (error) return { status: "FAIL", detail: error.message };
      couponPointOrderOk = true;
      const { data: order } = await a.client.from("orders")
        .select("subtotal, coupon_discount_amount, points_used, total_amount").eq("id", orderId).maybeSingle();
      const expectedTotal = P.best1.krwSale - 1000 - 1000;
      const ok = order?.coupon_discount_amount === 1000 && order?.points_used === 1000 && order?.total_amount === expectedTotal;
      return { status: ok ? "PASS" : "FAIL", detail: JSON.stringify(order) };
    });

    if (couponPointOrderOk) {
      await check("Coupon-Point", "per-user coupon reuse beyond limit is rejected", async () => {
        const { error } = await a.client.rpc("create_order", {
          p_order_number: `E2E-COUPON-REUSE-${Date.now()}`, p_user_id: a.id, p_guest_email: null, p_guest_phone: null,
          p_market_code: "KR", p_currency_code: "KRW", p_payment_method: "card",
          p_shipping_address: shipping("Member A", "KR"), p_customs_info: null,
          p_items: [{ product_id: P.best1.id, quantity: 1 }], p_coupon_code: testCouponCode,
        });
        return { status: error ? "PASS" : "FAIL", detail: error ? error.message : "second use succeeded — SECURITY HOLE" };
      });
    } else {
      blocked("Coupon-Point", "per-user coupon reuse beyond limit is rejected", "first coupon+points order did not succeed — cannot test reuse");
    }
  } else {
    blocked("Coupon-Point", "coupon(-1000) + points(-1000) real order", "needs admin (coupon create) and member A");
    blocked("Coupon-Point", "per-user coupon reuse beyond limit is rejected", "needs admin (coupon create) and member A");
  }

  if (memberAOk) {
    await check("Coupon-Point", "points_used on a non-KRW (INR) order is rejected", async () => {
      const { error } = await a.client.rpc("create_order", {
        p_order_number: `E2E-POINTS-CURRENCY-${Date.now()}`, p_user_id: a.id, p_guest_email: null, p_guest_phone: null,
        p_market_code: "IN", p_currency_code: "INR", p_payment_method: "upi",
        p_shipping_address: shipping("Member A", "IN"), p_customs_info: null,
        p_items: [{ product_id: P.best2.id, quantity: 1 }], p_points_used: 100,
      });
      return { status: error ? "PASS" : "FAIL", detail: error ? error.message : "order was created — SECURITY HOLE" };
    });
  } else {
    blocked("Coupon-Point", "points_used on a non-KRW (INR) order is rejected", "member A not available");
  }

  // ---------------------------------------------------------------------
  // Section: KR / IN / USD orders
  // ---------------------------------------------------------------------
  if (memberAOk) {
    await check("Multi-currency", "IN/INR order total matches seeded INR price (6499)", async () => {
      const { data: orderId, error } = await a.client.rpc("create_order", {
        p_order_number: `E2E-IN-${Date.now()}`, p_user_id: a.id, p_guest_email: null, p_guest_phone: null,
        p_market_code: "IN", p_currency_code: "INR", p_payment_method: "upi",
        p_shipping_address: shipping("Member A", "IN"), p_customs_info: null,
        p_items: [{ product_id: P.best2.id, quantity: 1 }],
      });
      if (error) return { status: "FAIL", detail: error.message };
      const { data: order } = await a.client.from("orders").select("subtotal, currency_code").eq("id", orderId).maybeSingle();
      return { status: order?.subtotal === P.best2.inrSale ? "PASS" : "FAIL", detail: JSON.stringify(order) };
    });

    await check("Multi-currency", "USD order with no seeded USD price is refused (PRICE_NOT_READY, fail-closed default)", async () => {
      const { error } = await a.client.rpc("create_order", {
        p_order_number: `E2E-USD-${Date.now()}`, p_user_id: a.id, p_guest_email: null, p_guest_phone: null,
        p_market_code: "KR", p_currency_code: "USD", p_payment_method: "card",
        p_shipping_address: shipping("Member A", "KR"), p_customs_info: null,
        p_items: [{ product_id: P.best1.id, quantity: 1 }],
      });
      const isPriceNotReady = error?.message?.includes("PRICE_NOT_READY");
      return {
        status: isPriceNotReady ? "PASS" : "FAIL",
        detail: error ? error.message : "USD order was created with an unverified dev-rate price — should have been refused by default",
      };
    });
  } else {
    blocked("Multi-currency", "IN/INR order total matches seeded INR price (6499)", "member A not available");
    blocked("Multi-currency", "USD order with no seeded USD price is refused (PRICE_NOT_READY, fail-closed default)", "member A not available");
  }

  // ---------------------------------------------------------------------
  // Section: Shipping Groups (mixed shipping types in one order)
  // ---------------------------------------------------------------------
  if (memberAOk) {
    await check("Shipping-Groups", "2 groups created, DOMESTIC=PREPARING, OVERSEAS_AGENCY=PURCHASING", async () => {
      const { data: orderId, error } = await a.client.rpc("create_order", {
        p_order_number: `E2E-SHIPGROUPS-${Date.now()}`, p_user_id: a.id, p_guest_email: null, p_guest_phone: null,
        p_market_code: "KR", p_currency_code: "KRW", p_payment_method: "card",
        p_shipping_address: shipping("Member A", "KR"), p_customs_info: null,
        p_items: [{ product_id: P.best1.id, quantity: 1 }, { product_id: P.extra20.id, quantity: 1 }],
      });
      if (error) return { status: "FAIL", detail: error.message };
      const { data: groups } = await a.client.from("shipping_groups").select("shipping_type, status, shipping_fee").eq("order_id", orderId);
      const domestic = groups?.find((g) => g.shipping_type === "DOMESTIC");
      const agency = groups?.find((g) => g.shipping_type === "OVERSEAS_AGENCY");
      const ok = groups?.length === 2 && domestic?.status === "PREPARING" && agency?.status === "PURCHASING" && agency?.shipping_fee === P.extra20.krShipFee;
      return { status: ok ? "PASS" : "FAIL", detail: JSON.stringify(groups) };
    });
  } else {
    blocked("Shipping-Groups", "2 groups created, DOMESTIC=PREPARING, OVERSEAS_AGENCY=PURCHASING", "member A not available");
  }

  // ---------------------------------------------------------------------
  // Section: Storage 권한
  // ---------------------------------------------------------------------
  const probeFile = () => new Blob(["step15-5 probe"], { type: "text/plain" });
  // Uploads that succeed are removed again at the end of this run (best
  // effort) so repeat runs don't pile up test files in either bucket.
  const reviewImageProbesToClean = [];
  const productImageProbesToClean = [];

  if (memberAOk) {
    await check("Storage", "member A cannot upload to product-images (admin-only bucket)", async () => {
      const { error } = await a.client.storage.from("product-images").upload(`probe-${Date.now()}.txt`, probeFile());
      return { status: error ? "PASS" : "FAIL", detail: error ? error.message : "upload succeeded — SECURITY HOLE" };
    });

    await check("Storage", "member A can upload a review-image under their own uid folder", async () => {
      const path = `${a.id}/probe-${Date.now()}.txt`;
      const { error } = await a.client.storage.from("review-images").upload(path, probeFile());
      if (!error) reviewImageProbesToClean.push(path);
      return { status: error ? "FAIL" : "PASS", detail: error?.message };
    });
  } else {
    blocked("Storage", "member A cannot upload to product-images (admin-only bucket)", "member A not available");
    blocked("Storage", "member A can upload a review-image under their own uid folder", "member A not available");
  }

  if (memberAOk && memberBOk) {
    await check("Storage", "member A cannot upload a review-image under member B's uid folder", async () => {
      const { error } = await a.client.storage.from("review-images").upload(`${b.id}/probe-${Date.now()}.txt`, probeFile());
      return { status: error ? "PASS" : "FAIL", detail: error ? error.message : "cross-user upload succeeded — SECURITY HOLE" };
    });
  } else {
    blocked("Storage", "member A cannot upload a review-image under member B's uid folder", "needs both member A and member B");
  }

  if (admin) {
    await check("Storage", "admin can upload to product-images", async () => {
      const path = `step15-5-probe-${Date.now()}.txt`;
      const { error } = await admin.client.storage.from("product-images").upload(path, probeFile());
      if (!error) productImageProbesToClean.push(path);
      return { status: error ? "FAIL" : "PASS", detail: error?.message };
    });
  } else {
    blocked("Storage", "admin can upload to product-images", "no admin session");
  }

  // ---------------------------------------------------------------------
  // Section: Search (real PostgREST, no mock fallback)
  // ---------------------------------------------------------------------
  await check("Search", "ilike search for '텀블러' finds best-1 via real DB", async () => {
    const { data, error } = await anon
      .from("products").select("id, name_ko").eq("is_active", true)
      .or("name_ko.ilike.%텀블러%,name_en.ilike.%텀블러%,brand.ilike.%텀블러%,sku.ilike.%텀블러%");
    if (error) return { status: "FAIL", detail: error.message };
    const found = (data ?? []).some((p) => p.id === P.best1.id);
    return { status: found ? "PASS" : "FAIL", detail: `rows=${data?.length}` };
  });

  await check("Search", "anon can log a search_event (own or anonymous row)", async () => {
    const { error } = await anon.from("search_events").insert({
      query: "step15.5-probe", normalized_query: "step15.5-probe", user_id: null, market_code: "KR", locale: "ko", result_count: 0,
    });
    return { status: error ? "FAIL" : "PASS", detail: error?.message };
  });

  // ---------------------------------------------------------------------
  // Section: MyPage (underlying data scoping — not the rendered page itself)
  // ---------------------------------------------------------------------
  if (memberAOk) {
    await check("MyPage-data", "member A's own orders query returns their orders", async () => {
      if (!legitOrderId) return { status: "BLOCKED", detail: "no order was successfully created for member A earlier in this run" };
      const { data } = await a.client.from("orders").select("id");
      return { status: (data?.length ?? 0) > 0 ? "PASS" : "FAIL", detail: `rows=${data?.length}` };
    });
  } else {
    blocked("MyPage-data", "member A's own orders query returns their orders", "member A not available");
  }

  if (memberAOk && memberBOk) {
    await check("MyPage-data", "member B cannot see member A's orders", async () => {
      if (!legitOrderId) return { status: "BLOCKED", detail: "no order exists for member A to check leakage against" };
      const { data } = await b.client.from("orders").select("id");
      const leaksA = (data ?? []).some((o) => o.id === legitOrderId);
      return { status: leaksA ? "FAIL" : "PASS", detail: `rows=${data?.length}` };
    });
  } else {
    blocked("MyPage-data", "member B cannot see member A's orders", "needs both member A and member B");
  }
  blocked("MyPage-UI", "actual /mypage page rendering", "this script only checks the underlying DB queries — needs a manual browser check against the running app");

  // ---------------------------------------------------------------------
  // Section: Payment Prepare
  // ---------------------------------------------------------------------
  blocked("Payment-Prepare", "/api/payments/prepare route", "this is a Next.js Route Handler, not Supabase — verify separately with `npm run dev` running locally and a curl/browser check (see report)");

  // ---------------------------------------------------------------------
  // Cleanup — best effort, never affects whether a check above already
  // recorded PASS/FAIL/BLOCKED. Removes only the exact probe rows/files
  // this run itself created or could have left from a prior run.
  // ---------------------------------------------------------------------
  await cleanupMemberACartProbes(a);
  if (memberAOk && reviewImageProbesToClean.length > 0) {
    await a.client.storage.from("review-images").remove(reviewImageProbesToClean).catch(() => {});
  }
  if (admin && productImageProbesToClean.length > 0) {
    await admin.client.storage.from("product-images").remove(productImageProbesToClean).catch(() => {});
  }

  // ---------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------
  console.log("\n=== SUMMARY ===");
  const bySection = {};
  for (const r of results) {
    bySection[r.section] ??= { PASS: 0, FAIL: 0, BLOCKED: 0 };
    bySection[r.section][r.status] = (bySection[r.section][r.status] ?? 0) + 1;
  }
  for (const [section, counts] of Object.entries(bySection)) {
    console.log(`${section}: PASS=${counts.PASS ?? 0} FAIL=${counts.FAIL ?? 0} BLOCKED=${counts.BLOCKED ?? 0}`);
  }
  const totalFail = results.filter((r) => r.status === "FAIL").length;
  console.log(`\nTotal: ${results.length} checks, ${totalFail} FAILED.`);
  console.log("\nCopy this entire output (including each [PASS]/[FAIL]/[BLOCKED] line above) back to continue the STEP 15.5 report.");
}

main().catch((err) => {
  console.error("Script crashed:", redact(err?.message ?? String(err)));
  process.exit(1);
});
