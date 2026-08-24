-- STEP 26.5 — integration audit corrective migration.
--
-- Finding (CRITICAL, verified during the STEP 26.5 audit): several functions
-- across STEP 11/13/15/23/24 carry comments claiming they are "not granted
-- to anon/authenticated" and therefore locked to trusted server code (see
-- e.g. 20260825000300_step11_payment_rpcs.sql's process_webhook_payment_event
-- comment, and 20260901000100's auto_cancel_stale_orders comment). That
-- assumption is false on Supabase: a brand-new Supabase project's bootstrap
-- applies `alter default privileges ... grant execute on functions to
-- anon, authenticated, service_role` for the public schema, so EVERY new
-- `create function public.foo(...)` is automatically executable by anon and
-- authenticated the moment it is created — omitting an explicit `grant`
-- statement does NOT withhold access, it only skips granting it a SECOND
-- time. No migration in this project ever issued a `revoke`, so this gap has
-- been present since the functions below were first created.
--
-- Concretely, without this migration, any client holding only the public
-- anon key can call `supabase.rpc('process_webhook_payment_event', {...})`
-- directly — entirely bypassing this route's webhook-signature verification
-- (app/api/webhooks/payments/[provider]/route.ts) — and mark an arbitrary
-- payment PAID (as long as it can guess/know that payment's amount and
-- currency, which for `_apply_payment_result`'s check equal the order's own
-- total — not a secret). The same gap applies to `auto_cancel_stale_orders`
-- (meant to be cron-only) and to several internal `_`-prefixed helper
-- functions never intended to be called directly via RPC at all.
--
-- Fix: explicitly revoke EXECUTE from public/anon/authenticated on each of
-- these. This does NOT affect:
--   - the webhook route or the internal cron route, both of which already
--     use the service-role client (createServiceRoleClient()), never the
--     anon/authenticated client — service_role keeps its own default grant,
--     untouched by this migration;
--   - callers of these functions FROM WITHIN other SECURITY DEFINER
--     functions (e.g. confirm_payment calling _apply_payment_result), since
--     a function's owner always has implicit EXECUTE on its own objects
--     regardless of grants to other roles, and every function in this
--     project is owned by the same migration-applying role.
--   - grep-confirmed (2026-08 audit): no `supabase.rpc(...)` call anywhere
--     in app/ or lib/ references any of the underscore-prefixed helpers
--     below, or auto_cancel_stale_orders, except via the two service-role
--     routes named above.
--
-- No existing migration is edited; no RLS policy, table, or business logic
-- changes. This is an access-control tightening only.

revoke execute on function public.process_webhook_payment_event from public, anon, authenticated;
revoke execute on function public._apply_payment_result from public, anon, authenticated;
revoke execute on function public._check_order_access from public, anon, authenticated;
revoke execute on function public._compute_coupon_discount from public, anon, authenticated;
revoke execute on function public._is_valid_payment_method_for_market from public, anon, authenticated;
revoke execute on function public._cancel_unpaid_order_core from public, anon, authenticated;
revoke execute on function public.cart_owner_key from public, anon, authenticated;
revoke execute on function public.auto_cancel_stale_orders from public, anon, authenticated;
