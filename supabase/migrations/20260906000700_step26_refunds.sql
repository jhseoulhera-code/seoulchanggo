-- STEP 26: order cancellation + full/partial refund + safe stock restore.
-- Reuses STEP 08~25's order/payment/shipping structure entirely — no past
-- migration is edited. payment_refunds already existed as a schema-only
-- placeholder since STEP 11 (never written to by any code path), so this
-- migration extends it in place rather than creating a parallel table.

-- ---------------------------------------------------------------------------
-- refund_status_enum — a refund's OWN lifecycle (PENDING while the provider
-- call is in flight, COMPLETED once both the provider and our own
-- amount/currency check agree, FAILED otherwise). Deliberately NOT reusing
-- payment_attempt_status_enum here: none of its values (CREATED/READY/
-- PENDING/AUTHORIZED/PAID/FAILED/CANCELLED/PARTIALLY_REFUNDED/REFUNDED) name
-- "this refund itself succeeded" without borrowing a payment-attempt word
-- ("PAID") that would read backwards on a refund row.
-- ---------------------------------------------------------------------------
create type public.refund_status_enum as enum ('PENDING', 'COMPLETED', 'FAILED');

-- Code/display-name separation (STEP 26 spec section 33), same pattern as
-- lib/shipping/carriers.ts's CarrierCode — the DB stores the code, the UI
-- maps it to a Korean label.
create type public.refund_reason_code_enum as enum (
  'CUSTOMER_REQUEST', 'OUT_OF_STOCK', 'DELIVERY_ISSUE', 'PRODUCT_ISSUE', 'OTHER'
);

-- ---------------------------------------------------------------------------
-- payment_refunds — extended in place. Every new column is NOT NULL where
-- the domain requires it; this is safe without a backfill/default because no
-- code anywhere has ever inserted into this table (STEP 11 spec section 27:
-- "schema/interface only this step" — still true immediately before this
-- migration).
-- ---------------------------------------------------------------------------
alter table public.payment_refunds add column order_id uuid not null references public.orders (id) on delete cascade;
alter table public.payment_refunds add column provider public.payment_provider_enum not null;
alter table public.payment_refunds add column currency public.currency_code_enum not null;

-- STEP 26 spec section 12 — the idempotency mechanism for a refund REQUEST:
-- a duplicate submission (double-click, network retry) with the same key
-- either short-circuits to the existing row (application-level pre-check) or
-- fails this UNIQUE constraint (the real, concurrency-safe guarantee) —
-- caught in admin_create_refund below and turned into the same "already
-- exists" result rather than a raw error.
alter table public.payment_refunds add column idempotency_key text not null;
alter table public.payment_refunds add constraint payment_refunds_idempotency_key_key unique (idempotency_key);

alter table public.payment_refunds add column completed_at timestamptz;

-- Audit minimum (STEP 26 spec section 32): who actually triggered this
-- refund. No PII beyond an auth.users id, same posture as
-- order_status_history.admin_user_id (STEP 25).
alter table public.payment_refunds add column admin_user_id uuid references auth.users (id) on delete set null;

alter table public.payment_refunds add column reason_code public.refund_reason_code_enum not null default 'OTHER';
alter table public.payment_refunds alter column reason drop not null; -- now an optional free-text memo alongside the required reason_code

-- STEP 26 spec section 26/27/28 — the shipping-fee-refund STRUCTURE only:
-- an admin-provided amount, validated against a remaining-refundable cap.
-- No proportional/automatic policy is computed anywhere in this migration.
alter table public.payment_refunds add column refund_shipping_amount numeric not null default 0 check (refund_shipping_amount >= 0);

alter table public.payment_refunds add column failure_code text;
alter table public.payment_refunds add column failure_message text;

-- Replace the borrowed payment_attempt_status_enum column with the refund's
-- own enum (STEP 26 spec section 16/17) — safe to drop/re-add since the
-- table has never held a row.
alter table public.payment_refunds drop column status;
alter table public.payment_refunds add column status public.refund_status_enum not null default 'PENDING';

create index payment_refunds_order_idx on public.payment_refunds (order_id);
create index payment_refunds_status_idx on public.payment_refunds (status);

-- ---------------------------------------------------------------------------
-- payment_refund_items — STEP 26 spec section 11: tracks exactly which
-- order_item, and how much quantity/amount, a given refund covers. This is
-- what makes "ordered quantity / already refunded quantity / remaining
-- refundable quantity" (spec section 8) computable, and is also where
-- per-item stock-restore idempotency lives (spec section 22).
-- ---------------------------------------------------------------------------
create table public.payment_refund_items (
  id uuid primary key default gen_random_uuid(),
  refund_id uuid not null references public.payment_refunds (id) on delete cascade,
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  amount numeric not null check (amount >= 0),
  -- STEP 26 spec section 22 — set exactly once, only for a pre-shipment
  -- restore; stays null forever for a post-shipment refund (spec section 18/19).
  stock_restored_at timestamptz,
  created_at timestamptz not null default now(),
  unique (refund_id, order_item_id)
);

create index payment_refund_items_order_item_idx on public.payment_refund_items (order_item_id);

alter table public.payment_refund_items enable row level security;

create policy payment_refund_items_select_own on public.payment_refund_items for select using (
  exists (
    select 1 from public.payment_refunds pr
    join public.orders o on o.id = pr.order_id
    where pr.id = payment_refund_items.refund_id and o.user_id = auth.uid()
  )
);
create policy payment_refund_items_admin_read_all on public.payment_refund_items for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- _cancel_unpaid_order_core — the actual cancel-an-unpaid-order logic,
-- extracted so both the existing admin path (cancel_unpaid_order, STEP 11)
-- and a new customer-facing path (cancel_own_unpaid_order) share one
-- implementation instead of duplicating the coupon/point reversal. Never
-- touches stock — STEP 23 never decremented it for an unpaid order in the
-- first place (spec section 3).
-- ---------------------------------------------------------------------------
create or replace function public._cancel_unpaid_order_core(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_balance integer;
begin
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

-- Same signature as STEP 11 (no drop needed) — body now delegates to the
-- shared core above; behavior for the admin caller is unchanged.
create or replace function public.cancel_unpaid_order(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin privilege required';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'reason is required to cancel an order';
  end if;

  perform public._cancel_unpaid_order_core(p_order_id, p_reason);
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_own_unpaid_order — STEP 26 spec section 3: "가능하면 고객 또는
-- 관리자가 취소 가능". Ownership is verified the same way prepare_payment/
-- confirm_payment already do (_check_order_access, STEP 11) — a member must
-- own the order, a guest must reproduce their own contact info. No PG
-- refund call here at all: an unpaid order was never charged.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_own_unpaid_order(p_order_id uuid, p_guest_contact text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._check_order_access(p_order_id, p_guest_contact) then
    raise exception 'order not found or access denied';
  end if;

  perform public._cancel_unpaid_order_core(p_order_id, '고객 요청으로 취소됨');
end;
$$;

grant execute on function public.cancel_own_unpaid_order to authenticated, anon;

-- ---------------------------------------------------------------------------
-- admin_create_refund — the "reserve" half of the refund flow (STEP 26 spec
-- sections 6-12), mirroring prepare_payment's own reserve/finalize split.
-- Computes the refund amount ENTIRELY from order_items snapshot fields
-- (never re-fetches a live product price, spec section 7), validates every
-- line against ordered-vs-already-refunded quantity (spec section 8/9), caps
-- the shipping-fee portion against orders.shipping_amount, and inserts a
-- PENDING payment_refunds + payment_refund_items row. No provider call
-- happens here — that only happens once this returns, from TypeScript
-- (lib/actions/refunds.ts), against the SAME provider that processed the
-- original payment (payments.provider, echoed back in this function's
-- result) and the SAME idempotency key.
-- ---------------------------------------------------------------------------
create or replace function public.admin_create_refund(
  p_payment_id uuid,
  p_lines jsonb,
  p_reason_code public.refund_reason_code_enum,
  p_reason_note text,
  p_refund_shipping_amount numeric default 0,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_existing public.payment_refunds%rowtype;
  v_refund_id uuid;
  v_line jsonb;
  v_order_item public.order_items%rowtype;
  v_qty integer;
  v_already_refunded_qty integer;
  v_remaining integer;
  v_total_items_amount numeric := 0;
  v_already_refunded_shipping numeric;
  v_already_refunded_total numeric;
  v_total_amount numeric;
  v_line_count integer;
  v_distinct_item_count integer;
begin
  if not public.is_admin() then
    raise exception 'admin privilege required';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency key is required';
  end if;
  if p_refund_shipping_amount < 0 then
    raise exception 'refund shipping amount must not be negative';
  end if;

  -- Fast-path idempotent replay — the unique constraint below is the real
  -- guarantee against a genuine concurrent race; this just avoids redoing
  -- the (potentially expensive) validation loop for an ordinary retry.
  select * into v_existing from public.payment_refunds where idempotency_key = p_idempotency_key;
  if v_existing.id is not null then
    if v_existing.payment_id <> p_payment_id then
      raise exception 'idempotency key already used for a different payment';
    end if;
    return jsonb_build_object(
      'refund_id', v_existing.id, 'amount', v_existing.amount, 'status', v_existing.status,
      'provider', v_existing.provider, 'currency', v_existing.currency
    );
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if v_payment.id is null then
    raise exception 'payment not found';
  end if;
  if v_payment.status not in ('PAID', 'PARTIALLY_REFUNDED') then
    raise exception 'PAYMENT_NOT_REFUNDABLE: only a PAID or PARTIALLY_REFUNDED payment can be refunded';
  end if;

  select * into v_order from public.orders where id = v_payment.order_id;

  v_line_count := coalesce(jsonb_array_length(p_lines), 0);
  select count(distinct (v->>'orderItemId')) into v_distinct_item_count from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) v;
  if v_line_count <> coalesce(v_distinct_item_count, 0) then
    raise exception 'duplicate order item in refund lines';
  end if;

  -- Pass 1: validate every line against the order_items SNAPSHOT (never the
  -- live product) and accumulate the total — no writes yet.
  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    select * into v_order_item from public.order_items
      where id = (v_line->>'orderItemId')::uuid and order_id = v_payment.order_id
      for update;
    if v_order_item.id is null then
      raise exception 'order item not found on this order';
    end if;

    v_qty := (v_line->>'quantity')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'refund quantity must be a positive integer';
    end if;

    select coalesce(sum(pri.quantity), 0) into v_already_refunded_qty
    from public.payment_refund_items pri
    join public.payment_refunds pr on pr.id = pri.refund_id
    where pri.order_item_id = v_order_item.id and pr.status in ('PENDING', 'COMPLETED');

    v_remaining := v_order_item.quantity - v_already_refunded_qty;
    if v_qty > v_remaining then
      raise exception 'OVER_REFUND_QUANTITY: requested % exceeds remaining refundable quantity % for order item %', v_qty, v_remaining, v_order_item.id;
    end if;

    v_total_items_amount := v_total_items_amount + (v_order_item.unit_price * v_qty);
  end loop;

  select coalesce(sum(refund_shipping_amount), 0) into v_already_refunded_shipping
  from public.payment_refunds
  where order_id = v_order.id and status in ('PENDING', 'COMPLETED');

  if v_already_refunded_shipping + p_refund_shipping_amount > v_order.shipping_amount then
    raise exception 'OVER_REFUND_SHIPPING_AMOUNT: requested % plus already-refunded % exceeds order shipping amount %',
      p_refund_shipping_amount, v_already_refunded_shipping, v_order.shipping_amount;
  end if;

  v_total_amount := v_total_items_amount + p_refund_shipping_amount;
  if v_total_amount <= 0 then
    raise exception 'REFUND_AMOUNT_MUST_BE_POSITIVE: a refund must cover at least one item or a shipping amount';
  end if;

  select coalesce(sum(amount), 0) into v_already_refunded_total
  from public.payment_refunds
  where payment_id = p_payment_id and status in ('PENDING', 'COMPLETED');

  if v_already_refunded_total + v_total_amount > v_payment.amount + 1 then
    raise exception 'OVER_REFUND_AMOUNT: total refunded (%) would exceed the payment amount (%)', v_already_refunded_total + v_total_amount, v_payment.amount;
  end if;

  begin
    insert into public.payment_refunds (
      payment_id, order_id, provider, currency, amount, refund_shipping_amount,
      reason_code, reason, status, idempotency_key, admin_user_id
    ) values (
      p_payment_id, v_order.id, v_payment.provider, v_payment.currency_code, v_total_amount, p_refund_shipping_amount,
      p_reason_code, nullif(trim(coalesce(p_reason_note, '')), ''), 'PENDING', p_idempotency_key, auth.uid()
    ) returning id into v_refund_id;
  exception when unique_violation then
    select * into v_existing from public.payment_refunds where idempotency_key = p_idempotency_key;
    if v_existing.payment_id <> p_payment_id then
      raise exception 'idempotency key already used for a different payment';
    end if;
    return jsonb_build_object(
      'refund_id', v_existing.id, 'amount', v_existing.amount, 'status', v_existing.status,
      'provider', v_existing.provider, 'currency', v_existing.currency
    );
  end;

  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    select * into v_order_item from public.order_items where id = (v_line->>'orderItemId')::uuid;
    v_qty := (v_line->>'quantity')::integer;
    insert into public.payment_refund_items (refund_id, order_item_id, quantity, amount)
    values (v_refund_id, v_order_item.id, v_qty, v_order_item.unit_price * v_qty);
  end loop;

  return jsonb_build_object(
    'refund_id', v_refund_id, 'amount', v_total_amount, 'status', 'PENDING',
    'provider', v_payment.provider, 'currency', v_payment.currency_code
  );
end;
$$;

grant execute on function public.admin_create_refund to authenticated;

-- ---------------------------------------------------------------------------
-- admin_finalize_refund — the "finalize" half (STEP 26 spec sections 15-25),
-- mirroring _apply_payment_result's own re-lock/terminal-status-short-circuit
-- idempotency pattern. Amount/currency returned by the provider are verified
-- against THIS refund's own reserved amount/currency before ever marking it
-- COMPLETED (fail-closed, same posture as payment finalization). Refund
-- succeeding and stock being restored are two separate, sequential steps
-- (spec section 19) — stock is only ever touched for a line whose shipping
-- group has not progressed past pre-shipment (spec section 18/20/21), and
-- only once per refund item (spec section 22, guarded by stock_restored_at).
-- ---------------------------------------------------------------------------
create or replace function public.admin_finalize_refund(
  p_refund_id uuid,
  p_success boolean,
  p_provider_refund_id text,
  p_provider_amount numeric,
  p_provider_currency public.currency_code_enum,
  p_failure_code text default null,
  p_failure_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund public.payment_refunds%rowtype;
  v_payment public.payments%rowtype;
  v_amount_tolerance constant numeric := 1;
  v_total_completed numeric;
  v_new_payment_status public.payment_attempt_status_enum;
  v_old_order_status public.order_status_enum;
  v_item record;
  v_eligible boolean;
begin
  if not public.is_admin() then
    raise exception 'admin privilege required';
  end if;

  select * into v_refund from public.payment_refunds where id = p_refund_id for update;
  if v_refund.id is null then
    raise exception 'refund not found';
  end if;

  if v_refund.status <> 'PENDING' then
    return jsonb_build_object('status', v_refund.status, 'already_processed', true);
  end if;

  select * into v_payment from public.payments where id = v_refund.payment_id for update;

  if not p_success then
    update public.payment_refunds
    set status = 'FAILED', failure_code = p_failure_code, failure_message = p_failure_message
    where id = p_refund_id;
    return jsonb_build_object('status', 'FAILED', 'already_processed', false);
  end if;

  if p_provider_amount is null or abs(p_provider_amount - v_refund.amount) > v_amount_tolerance then
    update public.payment_refunds
    set status = 'FAILED', failure_code = 'REFUND_AMOUNT_MISMATCH',
        failure_message = 'provider refund amount did not match the requested amount'
    where id = p_refund_id;
    return jsonb_build_object('status', 'FAILED', 'failure_code', 'REFUND_AMOUNT_MISMATCH', 'already_processed', false);
  end if;

  if p_provider_currency is null or p_provider_currency <> v_refund.currency then
    update public.payment_refunds
    set status = 'FAILED', failure_code = 'REFUND_CURRENCY_MISMATCH',
        failure_message = 'provider refund currency did not match the requested currency'
    where id = p_refund_id;
    return jsonb_build_object('status', 'FAILED', 'failure_code', 'REFUND_CURRENCY_MISMATCH', 'already_processed', false);
  end if;

  update public.payment_refunds
  set status = 'COMPLETED', provider_refund_id = p_provider_refund_id, completed_at = now()
  where id = p_refund_id;

  select coalesce(sum(amount), 0) into v_total_completed
  from public.payment_refunds
  where payment_id = v_refund.payment_id and status = 'COMPLETED';

  v_new_payment_status := case when v_total_completed >= v_payment.amount - v_amount_tolerance then 'REFUNDED' else 'PARTIALLY_REFUNDED' end;

  update public.payments set status = v_new_payment_status where id = v_refund.payment_id;

  -- orders.payment_status stays PAID regardless (STEP 25's established
  -- payment-status-vs-order-status non-confusion principle, extended here):
  -- the order WAS paid; refund granularity lives on payments.status and
  -- order_status only, never retroactively flips orders.payment_status back
  -- to UNPAID.
  if v_new_payment_status = 'REFUNDED' then
    select order_status into v_old_order_status from public.orders where id = v_refund.order_id;
    update public.orders set order_status = 'REFUNDED' where id = v_refund.order_id;
    if v_old_order_status is distinct from 'REFUNDED' then
      insert into public.order_status_history (order_id, shipping_group_id, from_status, to_status, admin_user_id)
      values (v_refund.order_id, null, v_old_order_status::text, 'REFUNDED', v_refund.admin_user_id);
    end if;
  end if;
  -- A PARTIALLY_REFUNDED payment leaves order_status untouched (spec section
  -- 17: "주문 전체를 CANCELLED로 만들지 마세요") — no enum value exists for
  -- "partially refunded" at the order level, and none is added here.

  for v_item in
    select pri.id as refund_item_id, pri.order_item_id, pri.quantity, oi.variant_id, oi.product_id, p.stock_type
    from public.payment_refund_items pri
    join public.order_items oi on oi.id = pri.order_item_id
    join public.products p on p.id = oi.product_id
    where pri.refund_id = p_refund_id and pri.stock_restored_at is null
  loop
    select not exists (
      select 1 from public.shipping_group_items sgi
      join public.shipping_groups sg on sg.id = sgi.shipping_group_id
      where sgi.order_item_id = v_item.order_item_id
        and sg.status not in ('PREPARING', 'PURCHASING', 'READY_TO_SHIP')
    ) into v_eligible;

    if v_eligible then
      if v_item.variant_id is not null then
        update public.product_variants set stock_quantity = stock_quantity + v_item.quantity where id = v_item.variant_id;
      elsif v_item.stock_type = 'TRACKED' then
        update public.products set stock_quantity = stock_quantity + v_item.quantity where id = v_item.product_id;
      end if;
      -- UNLIMITED stock_type: no stock_quantity to restore, but the item is
      -- still marked restored below so it never gets revisited.
      update public.payment_refund_items set stock_restored_at = now() where id = v_item.refund_item_id;
    end if;
  end loop;

  return jsonb_build_object('status', 'COMPLETED', 'payment_status', v_new_payment_status);
end;
$$;

grant execute on function public.admin_finalize_refund to authenticated;

-- ---------------------------------------------------------------------------
-- list_stale_pending_refunds — read-only diagnostic mirroring STEP 24's
-- list_stale_pending_payments: a refund stuck in PENDING past a threshold
-- means the provider call was made but admin_finalize_refund never
-- completed (a crash, a network failure between the two) — the provider may
-- have actually refunded the money already (STEP 26 spec section 24/25:
-- PROVIDER_REFUNDED_LOCAL_PENDING). Never auto-resolves anything.
-- ---------------------------------------------------------------------------
create or replace function public.list_stale_pending_refunds(p_threshold_minutes integer default 30)
returns table (
  refund_id uuid,
  payment_id uuid,
  order_id uuid,
  order_number text,
  refund_status public.refund_status_enum,
  amount numeric,
  currency public.currency_code_enum,
  provider public.payment_provider_enum,
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
  select pr.id, pr.payment_id, pr.order_id, o.order_number, pr.status, pr.amount, pr.currency, pr.provider, pr.created_at
  from public.payment_refunds pr
  join public.orders o on o.id = pr.order_id
  where pr.status = 'PENDING'
    and pr.created_at <= now() - (p_threshold_minutes || ' minutes')::interval
  order by pr.created_at asc;
end;
$$;

grant execute on function public.list_stale_pending_refunds to authenticated;
