-- STEP 24: webhook finalize path + reconciliation groundwork.
--
-- STEP 11 built the whole payment domain; STEP 23 fixed atomic stock
-- deduction and made confirm_payment fail-closed on amount/currency. This
-- migration closes STEP 23's own documented limitation (process_webhook_
-- payment_event always passed null/null for provider amount/currency, so a
-- real PAID webhook could never actually finalize anything) and adds the
-- minimum DB-side support for reconciliation/recovery:
--
-- 1. process_webhook_payment_event now takes p_normalized_status text
--    ('PAID'/'FAILED'/'CANCELLED'/'REFUNDED'/'UNKNOWN') instead of a bare
--    boolean, and real p_provider_amount/p_provider_currency — PAID/FAILED
--    route into the SAME _apply_payment_result the browser confirm path
--    already uses (no second stock-decrement implementation).
--    CANCELLED/REFUNDED/UNKNOWN are recorded in payment_events (the
--    existing idempotency ledger) but never auto-applied to payments/orders
--    — full refund/cancel automation is explicitly out of this STEP's scope
--    (spec sections 25-28), and _apply_payment_result's own terminal-status
--    guard (PAID/FAILED/CANCELLED) means a late webhook can never downgrade
--    an already-resolved payment regardless.
-- 2. payments gains a (provider, provider_payment_id) unique index — the
--    webhook route looks a payment up BY this value, so it must be
--    unambiguous; this also makes "the same provider payment reported via
--    two different event ids" structurally safe, since both events resolve
--    to the exact same internal payment row before _apply_payment_result's
--    own row-lock + terminal-status idempotency guard ever runs.
-- 3. _apply_payment_result now records provider_payment_id/
--    provider_transaction_id as soon as the provider reports success — even
--    on a path that still ends in FAILED (amount/currency mismatch, or a
--    stock shortfall). A stock shortfall after the provider already
--    reported success ("money received, fulfillment failed") must never
--    lose the provider reference that would let a human reconcile it later.
-- 4. list_stale_pending_payments() — an admin-only, read-only diagnostic
--    RPC: payments stuck in a non-terminal status past a threshold. It
--    NEVER changes anything — STEP 24 spec section 21 explicitly forbids
--    auto-cancelling a stale-pending payment, since the provider may have
--    actually completed it.
--
-- create_order() is untouched again this step, same as STEP 23.

-- ---------------------------------------------------------------------------
-- payments — provider_payment_id must uniquely identify a payment ROW once
-- set (partial: many rows may still have it null, e.g. never-confirmed
-- attempts). STEP 11's schema never added this; nothing before now needed
-- provider_payment_id to be an unambiguous lookup key.
-- ---------------------------------------------------------------------------
create unique index payments_provider_payment_id_key
  on public.payments (provider, provider_payment_id)
  where provider_payment_id is not null;

-- ---------------------------------------------------------------------------
-- _apply_payment_result — same 8-param signature as STEP 23 (no drop
-- needed). Two changes to the p_success branch's body only:
--   a) provider_payment_id/provider_transaction_id are now saved as soon as
--      the provider reports success, before the amount/currency/stock
--      checks — so even a payment that ends up FAILED here still keeps its
--      provider reference for reconciliation (spec section 37).
--   b) stock-shortfall failures also record failure_message with the
--      concrete sqlerrm (already true in STEP 23; unchanged, called out
--      here only because it's what a reconciliation reader depends on).
-- ---------------------------------------------------------------------------
create or replace function public._apply_payment_result(
  p_payment_id uuid,
  p_success boolean,
  p_provider_payment_id text,
  p_provider_transaction_id text,
  p_failure_code text,
  p_failure_message text,
  p_provider_amount numeric default null,
  p_provider_currency public.currency_code_enum default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_item record;
  v_amount_tolerance constant numeric := 1;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if v_payment.id is null then
    raise exception 'payment not found';
  end if;

  if v_payment.status in ('PAID', 'FAILED', 'CANCELLED') then
    return jsonb_build_object('status', v_payment.status, 'already_processed', true);
  end if;

  if p_success then
    -- STEP 24 — record the provider's reference immediately, regardless of
    -- what the amount/currency/stock checks below decide. A provider that
    -- reported success handed us a real reference; losing it because we
    -- later reject the payment would erase the one thing reconciliation
    -- needs to go look the real charge up.
    if p_provider_payment_id is not null or p_provider_transaction_id is not null then
      update public.payments
      set provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
          provider_transaction_id = coalesce(p_provider_transaction_id, provider_transaction_id)
      where id = p_payment_id;
    end if;

    if p_provider_amount is null or abs(p_provider_amount - v_payment.amount) > v_amount_tolerance then
      update public.payments
      set status = 'FAILED', failure_code = 'PAYMENT_AMOUNT_MISMATCH',
          failure_message = 'provider-confirmed amount does not match the order amount'
      where id = p_payment_id;
      return jsonb_build_object('status', 'FAILED', 'already_processed', false, 'failure_code', 'PAYMENT_AMOUNT_MISMATCH');
    end if;

    if p_provider_currency is null or p_provider_currency <> v_payment.currency_code then
      update public.payments
      set status = 'FAILED', failure_code = 'PAYMENT_CURRENCY_MISMATCH',
          failure_message = 'provider-confirmed currency does not match the order currency'
      where id = p_payment_id;
      return jsonb_build_object('status', 'FAILED', 'already_processed', false, 'failure_code', 'PAYMENT_CURRENCY_MISMATCH');
    end if;

    begin
      for v_item in
        select oi.variant_id, oi.product_id, oi.quantity, p.stock_type
        from public.order_items oi
        join public.products p on p.id = oi.product_id
        where oi.order_id = v_payment.order_id
      loop
        if v_item.variant_id is not null then
          update public.product_variants
          set stock_quantity = stock_quantity - v_item.quantity
          where id = v_item.variant_id and stock_quantity >= v_item.quantity;
          if not found then
            raise exception 'STOCK_CHANGED: insufficient stock for variant %', v_item.variant_id;
          end if;
        elsif v_item.stock_type = 'TRACKED' then
          update public.products
          set stock_quantity = stock_quantity - v_item.quantity
          where id = v_item.product_id and stock_quantity >= v_item.quantity;
          if not found then
            raise exception 'STOCK_CHANGED: insufficient stock for product %', v_item.product_id;
          end if;
        end if;
      end loop;
    exception when others then
      -- provider_payment_id/transaction_id set above survive this rollback
      -- (they were committed by a separate UPDATE outside this sub-block) —
      -- STEP 24 spec section 36/37's "payment received but fulfillment
      -- requires attention" stays reconcilable via that reference.
      update public.payments
      set status = 'FAILED', failure_code = 'STOCK_CHANGED', failure_message = sqlerrm
      where id = p_payment_id;
      return jsonb_build_object('status', 'FAILED', 'already_processed', false, 'failure_code', 'STOCK_CHANGED');
    end;

    update public.payments
    set status = 'PAID',
        paid_at = now()
    where id = p_payment_id;

    update public.orders
    set payment_status = 'PAID',
        order_status = case when order_status in ('ORDER_CREATED', 'PAYMENT_PENDING') then 'PREPARING' else order_status end
    where id = v_payment.order_id;

    return jsonb_build_object('status', 'PAID', 'already_processed', false);
  else
    update public.payments
    set status = 'FAILED', failure_code = p_failure_code, failure_message = p_failure_message
    where id = p_payment_id;

    update public.orders
    set order_status = 'PAYMENT_PENDING'
    where id = v_payment.order_id and order_status = 'ORDER_CREATED';

    return jsonb_build_object('status', 'FAILED', 'already_processed', false);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- process_webhook_payment_event — signature change from STEP 23:
-- p_success boolean -> p_normalized_status text, so a webhook can also
-- report CANCELLED/REFUNDED/UNKNOWN distinctly from PAID/FAILED (STEP 24
-- spec section 4) without overloading a boolean. The payment_events insert
-- (the entire idempotency mechanism — unique(provider, provider_event_id))
-- is unconditional, same as STEP 11/23: EVERY event type gets ledgered
-- before any decision about what to do with it.
-- ---------------------------------------------------------------------------
drop function if exists public.process_webhook_payment_event(
  public.payment_provider_enum, text, uuid, text, jsonb, boolean, text, text, text, text, numeric, public.currency_code_enum
);

create or replace function public.process_webhook_payment_event(
  p_provider public.payment_provider_enum,
  p_provider_event_id text,
  p_payment_id uuid,
  p_event_type text,
  p_payload jsonb,
  p_normalized_status text,
  p_provider_payment_id text default null,
  p_provider_transaction_id text default null,
  p_failure_code text default null,
  p_failure_message text default null,
  p_provider_amount numeric default null,
  p_provider_currency public.currency_code_enum default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.payment_events (provider, provider_event_id, payment_id, event_type, payload)
    values (p_provider, p_provider_event_id, p_payment_id, p_event_type, p_payload);
  exception when unique_violation then
    return jsonb_build_object('status', 'duplicate_event', 'already_processed', true);
  end;

  if p_normalized_status = 'PAID' then
    return public._apply_payment_result(
      p_payment_id, true, p_provider_payment_id, p_provider_transaction_id, p_failure_code, p_failure_message,
      p_provider_amount, p_provider_currency
    );
  elsif p_normalized_status = 'FAILED' then
    return public._apply_payment_result(
      p_payment_id, false, p_provider_payment_id, p_provider_transaction_id, p_failure_code, p_failure_message,
      p_provider_amount, p_provider_currency
    );
  else
    -- CANCELLED / REFUNDED / UNKNOWN — logged above (payment_events) for a
    -- human/future reconciliation step to act on; deliberately no
    -- payments/orders mutation here this STEP (spec sections 25-28: refund/
    -- cancel automation, and refund-implies-stock-restore, are both out of
    -- scope). The event is still "successfully received" from the
    -- provider's point of view, so the caller returns 2xx regardless.
    return jsonb_build_object('status', 'LOGGED_FOR_REVIEW', 'already_processed', false, 'normalized_status', p_normalized_status);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- list_stale_pending_payments — read-only diagnostic (STEP 24 spec sections
-- 19/20/21): payments/orders stuck in a non-terminal status past a
-- threshold, surfaced so a human/future cron can decide what to do — NEVER
-- auto-cancelled or auto-anything by this function itself. Admin-only.
-- ---------------------------------------------------------------------------
create or replace function public.list_stale_pending_payments(p_threshold_minutes integer default 30)
returns table (
  payment_id uuid,
  order_id uuid,
  order_number text,
  payment_status public.payment_attempt_status_enum,
  order_status public.order_status_enum,
  amount numeric,
  currency_code public.currency_code_enum,
  provider public.payment_provider_enum,
  provider_payment_id text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin privilege required';
  end if;

  return query
  select p.id, p.order_id, o.order_number, p.status, o.order_status, p.amount, p.currency_code,
         p.provider, p.provider_payment_id, p.created_at
  from public.payments p
  join public.orders o on o.id = p.order_id
  where p.status in ('CREATED', 'READY', 'PENDING', 'AUTHORIZED')
    and p.created_at <= now() - (p_threshold_minutes || ' minutes')::interval
  order by p.created_at asc;
end;
$$;

grant execute on function public.list_stale_pending_payments to authenticated;
