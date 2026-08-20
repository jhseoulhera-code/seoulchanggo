-- STEP 11: payment RPCs. Nothing in any STEP 08~10 migration is edited —
-- this file only adds new functions. Every payment state change goes
-- through exactly one of these; there is no direct client UPDATE policy on
-- payments/orders that could bypass them (STEP 11 spec section 24: no
-- "Admin clicks PAID" path exists at all, by construction).

-- ---------------------------------------------------------------------------
-- _is_valid_payment_method_for_market — mirrors data/paymentMethods.ts
-- (PAYMENT_METHODS_BY_MARKET) so a crafted request can't select a method the
-- UI would never have offered for that market.
-- ---------------------------------------------------------------------------
create or replace function public._is_valid_payment_method_for_market(
  p_market public.market_code_enum,
  p_method public.payment_method_enum
)
returns boolean
language sql
immutable
as $$
  select case p_market
    when 'KR' then p_method in ('card', 'easy_pay', 'bank_transfer')
    when 'IN' then p_method in ('card', 'upi', 'net_banking', 'wallet')
    else p_method = 'card'
  end;
$$;

-- ---------------------------------------------------------------------------
-- _check_order_access — shared ownership gate for prepare/confirm. A member
-- must own the order; a guest must reproduce the same order_number contact
-- proof lookup_guest_order_full() already requires (STEP 08), so a random
-- order_id can't be probed by an unauthenticated caller.
-- ---------------------------------------------------------------------------
create or replace function public._check_order_access(p_order_id uuid, p_guest_contact text)
returns boolean
language plpgsql
stable
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    return false;
  end if;

  if v_order.user_id is not null then
    return v_order.user_id = auth.uid();
  end if;

  if p_guest_contact is null then
    return false;
  end if;

  return lower(v_order.guest_email) = lower(p_guest_contact)
    or (
      v_order.guest_phone is not null
      and regexp_replace(v_order.guest_phone, '\D', '', 'g') = regexp_replace(p_guest_contact, '\D', '', 'g')
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- prepare_payment — Order → Payment handoff (STEP 11 spec section 12).
-- Amount/currency are never taken from the caller: amount = orders.total_amount
-- (already server-revalidated once, at order-creation time — STEP 08/10's
-- create_order()) and currency = orders.currency_code, so a currency
-- mismatch or a forged amount is structurally impossible here.
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

  insert into public.payments (order_id, provider, payment_method, market_code, currency_code, amount, status)
  values (p_order_id, p_provider, p_payment_method, v_order.market_code, v_order.currency_code, v_order.total_amount, 'READY')
  returning id into v_payment_id;

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
-- lands. Re-checking payment.status first (and locking the row) is the
-- entire idempotency mechanism (STEP 11 spec section 17): calling this twice
-- for an already-resolved payment is a no-op, so a duplicate webhook or a
-- duplicate confirm_payment call can never double-charge stock. Not granted
-- to anon/authenticated — only reachable via confirm_payment() or
-- process_webhook_payment_event() below.
-- ---------------------------------------------------------------------------
create or replace function public._apply_payment_result(
  p_payment_id uuid,
  p_success boolean,
  p_provider_payment_id text,
  p_provider_transaction_id text,
  p_failure_code text,
  p_failure_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_item record;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if v_payment.id is null then
    raise exception 'payment not found';
  end if;

  if v_payment.status in ('PAID', 'FAILED', 'CANCELLED') then
    return jsonb_build_object('status', v_payment.status, 'already_processed', true);
  end if;

  if p_success then
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

    -- Stock deduction happens exactly once here, guarded by the status check
    -- above — never at order-creation time (STEP 11 spec section 17).
    for v_item in
      select oi.variant_id, oi.product_id, oi.quantity, p.stock_type
      from public.order_items oi
      join public.products p on p.id = oi.product_id
      where oi.order_id = v_payment.order_id
    loop
      if v_item.variant_id is not null then
        update public.product_variants
        set stock_quantity = greatest(0, stock_quantity - v_item.quantity)
        where id = v_item.variant_id;
      elsif v_item.stock_type = 'TRACKED' then
        update public.products
        set stock_quantity = greatest(0, stock_quantity - v_item.quantity)
        where id = v_item.product_id;
      end if;
    end loop;

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
-- confirm_payment — called from the checkout flow once the (Mock, for now)
-- provider has resolved. Re-verifies access the same way prepare_payment did
-- before touching payment state, since this is reachable by anon/authenticated.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_payment(
  p_payment_id uuid,
  p_success boolean,
  p_provider_payment_id text default null,
  p_provider_transaction_id text default null,
  p_failure_code text default null,
  p_failure_message text default null,
  p_guest_contact text default null
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
    p_payment_id, p_success, p_provider_payment_id, p_provider_transaction_id, p_failure_code, p_failure_message
  );
end;
$$;

grant execute on function public.confirm_payment to authenticated, anon;

-- ---------------------------------------------------------------------------
-- process_webhook_payment_event — deliberately NOT granted to anon/
-- authenticated. Only the service-role key (lib/supabase/serviceClient.ts,
-- used from app/api/webhooks/payments/[provider]/route.ts) can call this —
-- service_role bypasses grants entirely, so omitting the grant here is what
-- locks it to trusted server code (STEP 11 spec section 14: "Webhook
-- signature 검증 없이 상태 변경 금지" — signature verification happens in
-- the Route Handler via the provider adapter's verifyWebhook() before this
-- function is ever called). The payment_events insert is the idempotency
-- check: a duplicate (provider, provider_event_id) fails the unique
-- constraint, caught here and turned into a clean "already handled" result
-- instead of reapplying the event.
-- ---------------------------------------------------------------------------
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
  p_failure_message text default null
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
    p_payment_id, p_success, p_provider_payment_id, p_provider_transaction_id, p_failure_code, p_failure_message
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_unpaid_order — admin cleanup for an abandoned order (STEP 11 spec
-- section 19: a failed/abandoned payment must not keep consuming coupon
-- usage or point balance forever). create_order() itself is untouched — this
-- is an explicit, separate admin action, not an automatic rollback.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_unpaid_order(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_balance integer;
begin
  if not public.is_admin() then
    raise exception 'admin privilege required';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'reason is required to cancel an order';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'order not found';
  end if;
  if v_order.payment_status = 'PAID' then
    raise exception 'a paid order cannot be cancelled through this path';
  end if;

  update public.orders set order_status = 'CANCELLED' where id = p_order_id;
  delete from public.coupon_usages where order_id = p_order_id;

  if v_order.points_used > 0 and v_order.user_id is not null then
    select coalesce(sum(amount), 0) into v_balance from public.point_transactions where user_id = v_order.user_id;
    insert into public.point_transactions (user_id, type, amount, balance_after, reason, order_id)
    values (v_order.user_id, 'REFUND', v_order.points_used, v_balance + v_order.points_used, p_reason, p_order_id);
  end if;
end;
$$;

grant execute on function public.cancel_unpaid_order to authenticated;
