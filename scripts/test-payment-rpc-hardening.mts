/**
 * STEP 26.6 — structural checks for the confirm_payment RPC hardening
 * corrective migration (20260906001100_step26_6_payment_hardening.sql) and
 * its accompanying route/component changes. No local Postgres is available
 * in this environment (same constraint as every prior STEP's security
 * checks), so these assertions verify the SQL/TS source text itself.
 *
 * Run with: node --experimental-strip-types scripts/test-payment-rpc-hardening.mts
 */
import { readFileSync, readdirSync } from "node:fs";

let failures = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures += 1;
  }
}

const MIGRATIONS_DIR = "supabase/migrations";
const FIX_FILE = `${MIGRATIONS_DIR}/20260906001100_step26_6_payment_hardening.sql`;
const fixSource = readFileSync(FIX_FILE, "utf8");
// Strip `--` comment lines before checking for actual SQL statements — the
// file's own prose extensively mentions "anon"/"authenticated"/"grant" while
// explaining the fix, which would false-positive against a naive substring
// check of the raw file (same convention as STEP 26.5's own test).
const fixSqlOnly = fixSource
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

const confirmRouteSource = readFileSync("app/api/payments/confirm/route.ts", "utf8");
const webhookRouteSource = readFileSync("app/api/webhooks/payments/[provider]/route.ts", "utf8");
const step23MigrationSource = readFileSync(`${MIGRATIONS_DIR}/20260906000400_step23_payment_finalization.sql`, "utf8");
const step26_5MigrationSource = readFileSync(`${MIGRATIONS_DIR}/20260906001000_step26_5_integration_audit_fixes.sql`, "utf8");
const panelSource = readFileSync("components/product/ProductPurchasePanel.tsx", "utf8");
const normalizeSource = readFileSync("lib/checkout/normalize.ts", "utf8");
const databaseTypesSource = readFileSync("types/database.ts", "utf8");

// --- 1. confirm_payment execute revoked from anon/authenticated/public (structural) ---
{
  assert(
    fixSqlOnly.includes("revoke execute on function public.confirm_payment(") &&
      /revoke execute on function public\.confirm_payment\([^)]*\)\s*from public, anon, authenticated;/.test(fixSqlOnly),
    "(structural) the corrective migration must revoke execute on confirm_payment from public, anon, authenticated"
  );
}

// --- 2. service_role/postgres never revoked (structural) ------------------------------
{
  assert(
    !/revoke execute[^;]*service_role/i.test(fixSqlOnly) && !/revoke execute[^;]*\bpostgres\b/i.test(fixSqlOnly),
    "(structural) the corrective migration must never revoke execute from service_role or postgres — that would break the confirm route itself"
  );
}

// --- 3. the browser-direct-call gap is real and pre-existing (structural) -------------
{
  // The step23 file is the one that originally opened this hole — confirm it
  // actually did grant to anon/authenticated (proving the finding is real,
  // not a false alarm), and that this project never edits old migrations.
  assert(
    step23MigrationSource.includes("grant execute on function public.confirm_payment to authenticated, anon;"),
    "(structural) STEP 23's original migration must still show the confirm_payment grant to authenticated/anon unedited — this fix must land as a NEW corrective migration, not a rewrite of history"
  );
  const step26_5SqlOnly = step26_5MigrationSource
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  assert(
    !step26_5SqlOnly.includes("confirm_payment"),
    "(structural) STEP 26.5's corrective migration never touched confirm_payment (its prose comments merely mention it in passing) — this is genuinely a separate, still-open finding this STEP closes, not a duplicate of 26.5's work"
  );
}

// --- 4. confirm_payment ownership check no longer depends on auth.uid() (structural) ---
{
  assert(
    fixSqlOnly.includes("p_caller_user_id uuid default null"),
    "(structural) confirm_payment must accept an explicit caller-identity parameter, since auth.uid() is unavailable once the route calls it via the service-role client"
  );
  assert(
    fixSqlOnly.includes("if p_caller_user_id is null or v_order.user_id <> p_caller_user_id then"),
    "(structural) a member order must be rejected unless the server-resolved caller id matches orders.user_id — never trusting an implicit auth context under service-role invocation"
  );
  assert(
    fixSqlOnly.includes("lower(v_order.guest_email) = lower(p_guest_contact)"),
    "(structural) guest-order ownership matching (email/phone) must be preserved for confirm_payment, unchanged in shape from the original _check_order_access"
  );
}

// --- 5. the route now uses the service-role client for confirm_payment (structural) ---
{
  const rpcCallIdx = confirmRouteSource.indexOf('.rpc("confirm_payment"');
  assert(rpcCallIdx !== -1, "(structural) the confirm route must still call confirm_payment via .rpc(...)");
  const beforeCall = confirmRouteSource.slice(0, rpcCallIdx);
  const lastSupabaseAssign = beforeCall.lastIndexOf("const supabase =");
  const supabaseAssignLine = beforeCall.slice(lastSupabaseAssign);
  assert(
    supabaseAssignLine.includes("createServiceRoleClient()"),
    "(structural) the confirm route must invoke confirm_payment through createServiceRoleClient(), not the anon-key session client — anon/authenticated no longer have EXECUTE on it"
  );
  assert(
    confirmRouteSource.includes('import { createServiceRoleClient } from "@/lib/supabase/serviceClient";'),
    "(structural) the confirm route must import the service-role client factory"
  );
}

// --- 6. caller identity is server-resolved, never client-supplied (structural) --------
{
  assert(
    confirmRouteSource.includes("sessionClient.auth.getUser()"),
    "(structural) the confirm route must resolve the caller's identity from the verified session (auth.getUser()), not from the request body"
  );
  assert(
    confirmRouteSource.includes("p_caller_user_id: user?.id ?? null"),
    "(structural) the resolved session user id (never a client-supplied field) must be threaded into confirm_payment as p_caller_user_id"
  );
  assert(
    !/p_caller_user_id:\s*body\./.test(confirmRouteSource),
    "(structural) p_caller_user_id must never be taken from the request body — that would let a client impersonate any order owner"
  );
}

// --- 7. client supplied success/amount/currency remain untrusted (structural) ---------
{
  assert(
    confirmRouteSource.includes("p_success: result.ok") && !/p_success:\s*body\./.test(confirmRouteSource),
    "(structural) p_success must come from the provider adapter's own verdict, never from body.success/body.ok"
  );
  assert(
    confirmRouteSource.includes("p_provider_amount: result.ok ? result.amount : null") && !/p_provider_amount:\s*body\.amount/.test(confirmRouteSource),
    "(structural) p_provider_amount must come from the adapter's confirmed result, never straight from body.amount"
  );
  assert(
    confirmRouteSource.includes("p_provider_currency: result.ok ? result.currencyCode : null") && !/p_provider_currency:\s*body\.currencyCode/.test(confirmRouteSource),
    "(structural) p_provider_currency must come from the adapter's confirmed result, never straight from body.currencyCode"
  );
}

// --- 8. webhook finalization path is unaffected by this STEP (structural) -------------
{
  assert(
    webhookRouteSource.includes('.rpc("process_webhook_payment_event"') && webhookRouteSource.includes("createServiceRoleClient()"),
    "(structural) the webhook route must be untouched: still service-role, still calling process_webhook_payment_event"
  );
  assert(
    !fixSqlOnly.includes("process_webhook_payment_event"),
    "(structural) this STEP's migration must not redefine process_webhook_payment_event — STEP 26.5 already locked it down, out of scope here"
  );
  assert(
    fixSqlOnly.includes("return public._apply_payment_result("),
    "(structural) confirm_payment must still funnel into the SAME _apply_payment_result the webhook path uses — no second, duplicated finalize implementation introduced"
  );
}

// --- 9. types/database.ts kept in sync with the new RPC signature (structural) --------
{
  const confirmArgsIdx = databaseTypesSource.indexOf("confirm_payment: {");
  const argsBlock = databaseTypesSource.slice(confirmArgsIdx, confirmArgsIdx + 600);
  assert(
    argsBlock.includes("p_caller_user_id?: string | null;"),
    "(structural) the generated-types file's confirm_payment Args must declare p_caller_user_id, matching the new RPC signature"
  );
}

// --- 10. ProductPurchasePanel now uses resolveSellPrice as its single price source ----
{
  assert(
    panelSource.includes('import { resolveSellPrice } from "@/lib/checkout/normalize";'),
    "(structural) ProductPurchasePanel must import the shared resolveSellPrice, not recompute variant pricing on its own"
  );
  assert(
    panelSource.includes("resolveSellPrice({ product, variant: matchedVariant, market })"),
    "(structural) ProductPurchasePanel's variant unit price must be resolved through resolveSellPrice, the same source cart/checkout/order use"
  );
  assert(
    !panelSource.includes("calculateVariantPrice(basePrice, additionalPriceInMarketCurrency)") && !panelSource.includes('import { convertFromKrw'),
    "(structural) the old hand-rolled variant price calculation (manual convertFromKrw + calculateVariantPrice) must be fully removed from ProductPurchasePanel, not left alongside the new call"
  );
}

// --- 11. resolveSellPrice itself is untouched by this STEP (regression guard) ---------
{
  assert(
    normalizeSource.includes("export function resolveSellPrice({ product, variant, market }: ResolveSellPriceInput): ResolvedSellPrice {"),
    "(structural) resolveSellPrice's signature must be unchanged — cart/checkout/order all depend on this exact shape, and this STEP must not touch it"
  );
}

// --- 12. dead code removed cleanly, no dangling references (structural) ---------------
{
  const DEAD_EXPORTS: Array<{ file: string; name: string }> = [
    { file: "lib/utils.ts", name: "formatPrice" },
    { file: "lib/pointsPolicy.ts", name: "POINTS_EARN_RATE" },
    { file: "lib/adminLabels.ts", name: "SHIPPING_GROUP_STATUS_ORDER" },
    { file: "lib/search/normalize.ts", name: "isValidSearchQuery" },
  ];
  for (const { file, name } of DEAD_EXPORTS) {
    const source = readFileSync(file, "utf8");
    assert(!source.includes(name), `(structural) ${name} must be fully removed from ${file}`);
  }

  // Confirm no other app/lib/components/scripts source file still references
  // any of the four removed names — a dangling import would only surface as
  // a build-time crash otherwise.
  const SEARCH_ROOTS = ["app", "components", "lib", "scripts", "contexts", "types", "data", "messages"];
  function collectFiles(dir: string): string[] {
    let out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out = out.concat(collectFiles(full));
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
    return out;
  }
  const allSourceFiles = SEARCH_ROOTS.flatMap((root) => {
    try {
      return collectFiles(root);
    } catch {
      return [];
    }
  });
  for (const { file, name } of DEAD_EXPORTS) {
    const referencingFiles = allSourceFiles.filter((f) => f !== file && readFileSync(f, "utf8").includes(name));
    assert(referencingFiles.length === 0, `(structural) no source file may still reference removed export "${name}" (found in: ${referencingFiles.join(", ")})`);
  }
}

// --- 13. MOCK payment path / production MOCK block untouched (regression guard) -------
{
  const registrySource = readFileSync("lib/payments/registry.ts", "utf8");
  assert(
    registrySource.includes('return "MOCK"') && registrySource.includes('if (process.env.NODE_ENV === "production") return null'),
    "(structural) this STEP must not touch the MOCK dev fallback or the production-blocks-MOCK rule from STEP 23"
  );
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log(
  "OK — confirm_payment is unreachable from anon/authenticated, ownership is re-established via a server-resolved caller id instead of auth.uid(), client-supplied success/amount/currency/caller-id remain untrusted, the webhook path is untouched, ProductPurchasePanel now shares resolveSellPrice, and dead-code removal left no dangling references."
);
