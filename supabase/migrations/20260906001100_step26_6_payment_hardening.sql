-- STEP 26.6 — confirm_payment RPC hardening.
--
-- Finding (MAJOR, carried over from the STEP 26.5 integration audit): STEP
-- 26.5's corrective migration (20260906001000) revoked EXECUTE from
-- anon/authenticated on process_webhook_payment_event, _apply_payment_result
-- and several internal helpers, but never touched confirm_payment itself —
-- it is still explicitly `grant execute on function public.confirm_payment
-- to authenticated, anon;` (20260906000400_step23_payment_finalization.sql).
--
-- _apply_payment_result's amount/currency check (STEP 23) already prevents a
-- caller from FORGING an arbitrary amount/currency — but it only compares
-- the claimed provider amount/currency against payments.amount/currency_code,
-- which are copied from the order's own total_amount/currency_code at
-- prepare_payment time. Those are not secret: they are the customer's own
-- order total, visible to that same customer in the checkout UI. So any
-- member or guest who can already call prepare_payment for their own order
-- (both are anon/authenticated-grantable by design) can, without this fix,
-- also call:
--
--   supabase.rpc('confirm_payment', {
--     p_payment_id: <their own payment id>,
--     p_success: true,
--     p_provider_amount: <their own order's total_amount>,
--     p_provider_currency: <their own order's currency_code>,
--   })
--
-- directly from the browser — skipping app/api/payments/confirm/route.ts and
-- the provider adapter entirely — and mark their own order PAID without any
-- real payment ever happening. _check_order_access's ownership gate does NOT
-- stop this: the attacker owns the very order they're forging payment for.
--
-- Fix: confirm_payment becomes reachable only through a trusted server
-- context (this project's Route Handler, using the service-role client),
-- exactly like process_webhook_payment_event already is. Since the
-- service-role key carries no `sub` JWT claim, auth.uid() is NOT available
-- inside a service-role-invoked call — the original confirm_payment's
-- ownership check (_check_order_access, which reads auth.uid() for a member
-- order) would then fail closed for every legitimate member payment. So
-- confirm_payment is recreated here with an added p_caller_user_id
-- parameter: the Route Handler resolves the caller's identity itself from
-- the verified session cookie (never from the request body) and passes it
-- in, and this function's ownership check compares THAT against
-- orders.user_id instead of an unavailable auth.uid(). Guest orders are
-- unaffected — the existing p_guest_contact matching is unchanged.
--
-- _check_order_access itself is left untouched (still used, unchanged, by
-- prepare_payment and the refund RPCs, both of which run in a normal
-- anon/authenticated session context where auth.uid() is meaningful).
-- _apply_payment_result is untouched — this migration only changes how
-- confirm_payment establishes ownership before calling it.
--
-- No existing migration is edited.

drop function if exists public.confirm_payment(
  uuid, boolean, text, text, text, text, text, numeric, public.currency_code_enum
);

create or replace function public.confirm_payment(
  p_payment_id uuid,
  p_success boolean,
  p_provider_payment_id text default null,
  p_provider_transaction_id text default null,
  p_failure_code text default null,
  p_failure_message text default null,
  p_guest_contact text default null,
  p_provider_amount numeric default null,
  p_provider_currency public.currency_code_enum default null,
  p_caller_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select o.* into v_order
  from public.orders o
  join public.payments p on p.order_id = o.id
  where p.id = p_payment_id;

  if v_order.id is null then
    raise exception 'payment not found';
  end if;

  -- STEP 26.6 — same ownership shape as _check_order_access (member: exact
  -- id match; guest: email or phone-digits match), but against the caller
  -- identity the Route Handler already resolved server-side from the
  -- session, since auth.uid() is not populated for a service-role call.
  if v_order.user_id is not null then
    if p_caller_user_id is null or v_order.user_id <> p_caller_user_id then
      raise exception 'order not found or access denied';
    end if;
  else
    if p_guest_contact is null or not (
      lower(v_order.guest_email) = lower(p_guest_contact)
      or (
        v_order.guest_phone is not null
        and regexp_replace(v_order.guest_phone, '\D', '', 'g') = regexp_replace(p_guest_contact, '\D', '', 'g')
      )
    ) then
      raise exception 'order not found or access denied';
    end if;
  end if;

  return public._apply_payment_result(
    p_payment_id, p_success, p_provider_payment_id, p_provider_transaction_id, p_failure_code, p_failure_message,
    p_provider_amount, p_provider_currency
  );
end;
$$;

-- Closes the browser-direct-call gap: anon/authenticated (and PUBLIC) can no
-- longer invoke confirm_payment at all, regardless of what they claim as
-- p_success/p_provider_amount/p_provider_currency. service_role keeps its
-- own default grant, untouched by this migration — the confirm route
-- (updated alongside this migration) is now the only caller.
revoke execute on function public.confirm_payment(
  uuid, boolean, text, text, text, text, text, numeric, public.currency_code_enum, uuid
) from public, anon, authenticated;
