-- STEP 11: Payment domain schema. Purely additive — no STEP 01~10 table,
-- column, or migration is edited. Order and Payment are deliberately
-- separate: an order can accumulate multiple payment attempts (retry after
-- failure), so payment state never lives on the orders row itself beyond the
-- existing coarse orders.payment_status ('UNPAID'/'PAID', STEP 08) which
-- payments keeps in sync via _apply_payment_result (000200 migration).

-- Distinct from STEP 08's payment_status_enum (orders.payment_status stays
-- UNPAID/PAID — unchanged). This one is the fine-grained per-attempt status.
create type public.payment_attempt_status_enum as enum (
  'CREATED', 'READY', 'PENDING', 'AUTHORIZED', 'PAID', 'FAILED',
  'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED'
);

-- Real provider names aren't decided yet — generic per-market buckets so the
-- adapter registry (lib/payments/registry.ts) can swap in a real SDK later
-- without a schema change. MOCK is the only one with a working adapter today.
create type public.payment_provider_enum as enum ('KOREA_PG', 'INDIA_PG', 'GLOBAL_PG', 'MOCK');

-- ---------------------------------------------------------------------------
-- payments — one row per payment attempt. No card number/CVV/full account
-- number ever stored (STEP 11 spec section 2); raw_metadata is for
-- non-sensitive provider response fields only (e.g. a receipt URL).
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider public.payment_provider_enum not null,
  payment_method public.payment_method_enum not null,
  market_code public.market_code_enum not null,
  currency_code public.currency_code_enum not null,
  amount numeric not null check (amount >= 0),
  status public.payment_attempt_status_enum not null default 'CREATED',
  provider_payment_id text,
  provider_transaction_id text,
  failure_code text,
  failure_message text,
  raw_metadata jsonb,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_order_idx on public.payments (order_id, created_at desc);
create index payments_status_idx on public.payments (status);

create trigger set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- payment_events — webhook idempotency ledger (STEP 11 spec section 15).
-- The unique constraint is the entire idempotency mechanism: a duplicate
-- (provider, provider_event_id) insert fails, and the webhook route treats
-- that as "already processed" rather than reapplying the event.
-- ---------------------------------------------------------------------------
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider public.payment_provider_enum not null,
  provider_event_id text not null,
  payment_id uuid references public.payments (id) on delete set null,
  event_type text not null,
  payload jsonb,
  received_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index payment_events_payment_idx on public.payment_events (payment_id);

-- ---------------------------------------------------------------------------
-- payment_refunds — schema/interface only this step (STEP 11 spec section
-- 26/27): no refund RPC or admin UI ships yet, but the shape is ready for a
-- future partial-refund flow (one row can cover part of a payment's amount).
-- ---------------------------------------------------------------------------
create table public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  amount numeric not null check (amount > 0),
  reason text not null,
  status public.payment_attempt_status_enum not null default 'CREATED',
  provider_refund_id text,
  created_at timestamptz not null default now()
);

create index payment_refunds_payment_idx on public.payment_refunds (payment_id);
