-- STEP 23: payment finalization hardening.
--
-- STEP 11 already built the entire payment domain (payments/payment_events/
-- payment_refunds schema, prepare_payment/confirm_payment/
-- process_webhook_payment_event RPCs, the Provider Adapter interface +
-- registry + Mock/stub adapters, the Route Handlers) — this migration does
-- NOT create a parallel payment system. It closes three real gaps found by
-- re-reading _apply_payment_result (000300 = STEP 11's payment RPC file)
-- against this STEP's spec:
--
-- 1. Stock deduction there was `greatest(0, stock_quantity - qty)` with NO
--    condition on the UPDATE at all — it never failed, it just silently
--    floored at 0. Two concurrent PAID confirmations for the last unit of
--    stock would BOTH "succeed" (overselling) instead of the second one
--    being rejected. Fixed to a real atomic conditional UPDATE
--    (`where stock_quantity >= qty`), checked via `if not found`.
-- 2. confirm_payment/process_webhook_payment_event never received or
--    checked ANY provider-reported amount/currency at all — a payment could
--    be marked PAID purely because the Route Handler's own adapter call
--    returned `ok: true`, with no comparison against payments.amount/
--    currency_code (the actual source of truth, itself copied from
--    orders.total_amount/currency_code by prepare_payment). Fixed by
--    threading p_provider_amount/p_provider_currency through both RPCs into
--    _apply_payment_result, which now rejects (PAYMENT_AMOUNT_MISMATCH /
--    PAYMENT_CURRENCY_MISMATCH) rather than ever trusting p_success alone.
-- 3. prepare_payment always INSERTed a new payments row, so calling it
--    twice for the same still-pending order (double-click, retry) created
--    two independent payment attempts instead of reusing the one already
--    in flight. Fixed to reuse an existing non-terminal attempt.
--
-- create_order() itself is NOT touched this step — payment finalization
-- doesn't require changing it, and the spec explicitly asks not to make
-- unrelated changes to it; the STEP 22 report's known order_number-collision
-- limitation stands unchanged.

-- ---------------------------------------------------------------------------
-- prepare_payment — same signature, idempotent body: reuse an existing
-- attempt that hasn't reached a terminal status yet, rather than always
-- inserting. A payment already FAILED/CANCELLED/PAID/(PARTIALLY_)REFUNDED is
-- never reused — that's exactly when a fresh attempt (retry, or blocked if
-- already PAID via the payable-state check above it) is correct.
-- ---------------------------------------------------------------------------
create or replace function public.prepare_payment(
  p_order_id uuid,
  p_payment_method public.payment_method_enum,
  p_provider public.payment_provider_enum,
  p_guest_contact text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_payment_id uuid;
begin
  if not public._check_order_access(p_order_id, p_guest_contact) then
    raise exception 'order not found or access denied';
  end if;

  select * into v_order from public.orders where id = p_order_id;

  if v_order.payment_status <> 'UNPAID' or v_order.order_status not in ('ORDER_CREATED', 'PAYMENT_PENDING') then
    raise exception 'order is not payable in its current state';
  end if;

  if not public._is_valid_payment_method_for_market(v_order.market_code, p_payment_method) then
    raise exception 'payment method not supported for this market';
  end if;

  select id into v_payment_id from public.payments
  where order_id = p_order_id and status in ('CREATED', 'READY', 'PENDING', 'AUTHORIZED')
  order by created_at desc
  limit 1;

  if v_payment_id is not null then
    -- STEP 23 — reuse the in-flight attempt rather than creating a second
    -- one, but keep it current: the caller may have switched payment method
    -- between two prepare calls for the same order (e.g. picked UPI, backed
    -- out, picked Card) before either attempt was ever confirmed.
    update public.payments
    set provider = p_provider, payment_method = p_payment_method,
        market_code = v_order.market_code, currency_code = v_order.currency_code, amount = v_order.total_amount
    where id = v_payment_id;
  else
    insert into public.payments (order_id, provider, payment_method, market_code, currency_code, amount, status)
    values (p_order_id, p_provider, p_payment_method, v_order.market_code, v_order.currency_code, v_order.total_amount, 'READY')
    returning id into v_payment_id;
  end if;

  if v_order.order_status = 'ORDER_CREATED' then
    update public.orders set order_status = 'PAYMENT_PENDING' where id = p_order_id;
  end if;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'amount', v_order.total_amount,
    'currency_code', v_order.currency_code,
    'market_code', v_order.market_code
  );
end;
$$;

grant execute on function public.prepare_payment to authenticated, anon;

-- ---------------------------------------------------------------------------
-- _apply_payment_result — the one place payment success/failure actually
-- lands (unchanged principle from STEP 11). New signature: p_provider_amount/
-- p_provider_currency are what the PROVIDER claims it charged, checked
-- against payments.amount/currency_code (itself always sourced from
-- orders.total_amount/currency_code, never client-declared) before a
-- payment is ever allowed to become PAID. Stock deduction is now a real
-- atomic conditional UPDATE per item, wrapped in its own sub-block so a
-- shortfall on ANY item rolls back every stock decrement already applied by
-- earlier items in the SAME order (a Postgres BEGIN/EXCEPTION block is an
-- implicit savepoint) without aborting the payment/order rows this function
-- itself already touched before the loop — the payment cleanly resolves to
-- FAILED/STOCK_CHANGED instead of a half-applied order.
-- ---------------------------------------------------------------------------
drop function if exists public._apply_payment_result(uuid, boolean, text, text, text, text);

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

  -- STEP 11's original idempotency guarantee, unchanged: a payment already
  -- in a terminal status is a no-op on any further call — the row lock
  -- above (`for update`) is what makes two near-simultaneous calls for the
  -- same payment_id serialize instead of racing each other here.
  if v_payment.status in ('PAID', 'FAILED', 'CANCELLED') then
    return jsonb_build_object('status', v_payment.status, 'already_processed', true);
  end if;

  if p_success then
    -- STEP 23 section 7/11/12 — fail CLOSED: a caller that omits the
    -- provider amount/currency (or that a real adapter never resolved one
    -- for) is treated as a mismatch, never as "skip the check". This also
    -- means calling confirm_payment directly with p_success=true and no
    -- amount proof — bypassing the Route Handler entirely — can never mark
    -- a payment PAID.
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
        -- UNLIMITED (stock_type <> 'TRACKED') option-less products are
        -- deliberately never touched here — same convention as create_order.
      end loop;
    exception when others then
      -- Rolls back every stock UPDATE this sub-block itself made (implicit
      -- savepoint) without aborting the whole confirm_payment()/
      -- process_webhook_payment_event() transaction — the payment can still
      -- cleanly resolve to FAILED right below instead of left half-applied.
      update public.payments
      set status = 'FAILED', failure_code = 'STOCK_CHANGED', failure_message = sqlerrm
      where id = p_payment_id;
      return jsonb_build_object('status', 'FAILED', 'already_processed', false, 'failure_code', 'STOCK_CHANGED');
    end;

    update public.payments
    set status = 'PAID',
        provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
        provider_transaction_id = coalesce(p_provider_transaction_id, provider_transaction_id),
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

    -- A failed/abandoned attempt keeps the ORDER itself retry-friendly —
    -- never CANCELLED here (STEP 23 section 22): the customer can prepare a
    -- new payment attempt against the same order.
    update public.orders
    set order_status = 'PAYMENT_PENDING'
    where id = v_payment.order_id and order_status = 'ORDER_CREATED';

    return jsonb_build_object('status', 'FAILED', 'already_processed', false);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- confirm_payment — same access-check shape as STEP 11, now also accepts
-- and forwards the provider's claimed amount/currency.
-- ---------------------------------------------------------------------------
drop function if exists public.confirm_payment(uuid, boolean, text, text, text, text, text);

create or replace function public.confirm_payment(
  p_payment_id uuid,
  p_success boolean,
  p_provider_payment_id text default null,
  p_provider_transaction_id text default null,
  p_failure_code text default null,
  p_failure_message text default null,
  p_guest_contact text default null,
  p_provider_amount numeric default null,
  p_provider_currency public.currency_code_enum default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
begin
  select order_id into v_order_id from public.payments where id = p_payment_id;
  if v_order_id is null then
    raise exception 'payment not found';
  end if;
  if not public._check_order_access(v_order_id, p_guest_contact) then
    raise exception 'order not found or access denied';
  end if;

  return public._apply_payment_result(
    p_payment_id, p_success, p_provider_payment_id, p_provider_transaction_id, p_failure_code, p_failure_message,
    p_provider_amount, p_provider_currency
  );
end;
$$;

grant execute on function public.confirm_payment to authenticated, anon;

-- ---------------------------------------------------------------------------
-- process_webhook_payment_event — same idempotency ledger as STEP 11
-- (payment_events unique (provider, provider_event_id)). p_provider_amount/
-- p_provider_currency are accepted for forward-compatibility with
-- _apply_payment_result's new signature, but no real adapter parses an
-- amount out of a webhook payload yet (ParsedWebhookEvent doesn't carry one
-- — MOCK never sends real webhooks, and the real KOREA_PG/INDIA_PG/GLOBAL_PG
-- stubs have no implementation at all). Passing null here means a
-- webhook-driven success currently always resolves to
-- PAYMENT_AMOUNT_MISMATCH via _apply_payment_result's fail-closed check —
-- correct and safe (this path is dormant until a real adapter exists), but
-- extending ParsedWebhookEvent to carry a real provider amount is left to
-- the STEP that actually implements a real webhook, per this STEP's scope.
-- ---------------------------------------------------------------------------
drop function if exists public.process_webhook_payment_event(
  public.payment_provider_enum, text, uuid, text, jsonb, boolean, text, text, text, text
);

create or replace function public.process_webhook_payment_event(
  p_provider public.payment_provider_enum,
  p_provider_event_id text,
  p_payment_id uuid,
  p_event_type text,
  p_payload jsonb,
  p_success boolean,
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

  return public._apply_payment_result(
    p_payment_id, p_success, p_provider_payment_id, p_provider_transaction_id, p_failure_code, p_failure_message,
    p_provider_amount, p_provider_currency
  );
end;
$$;
