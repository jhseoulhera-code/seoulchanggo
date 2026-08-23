-- STEP 25: admin order fulfillment — shipped_at/delivered_at, a payment-
-- before-ship guard, carrier/tracking validation, an admin-only order note,
-- and a minimal status-change audit trail. Reuses STEP 09's
-- admin_update_shipping_group / is_valid_shipping_status_transition /
-- compute_order_status entirely (same transition graph, same rollup rule)
-- — this migration only extends that RPC's BODY (same 4-parameter
-- signature, no drop needed) and adds the columns/table it now writes to.

-- ---------------------------------------------------------------------------
-- shipping_groups — shipped_at/delivered_at didn't exist before; nothing
-- recorded WHEN a group actually reached SHIPPED/DELIVERED, only that it
-- currently sits in that status.
-- ---------------------------------------------------------------------------
alter table public.shipping_groups add column shipped_at timestamptz;
alter table public.shipping_groups add column delivered_at timestamptz;

-- ---------------------------------------------------------------------------
-- orders — an internal-only operations note (STEP 25 spec section 25).
-- Never selected by any customer-facing action (lib/actions/mypage.ts's
-- getMyOrderDetailAction maps named columns explicitly and simply never
-- reads this one) — RLS's orders_select_own policy still lets a customer's
-- own SELECT * touch the ROW, but no customer-facing code path ever forwards
-- this COLUMN into a response.
-- ---------------------------------------------------------------------------
alter table public.orders add column admin_note text;

-- ---------------------------------------------------------------------------
-- order_status_history — STEP 25 spec section 26/27: a minimal audit trail.
-- shipping_group_id is null for an order-level rollup entry, set for a
-- shipping-group-level entry. No PII in the payload — only status codes and
-- the acting admin's user id.
-- ---------------------------------------------------------------------------
create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  shipping_group_id uuid references public.shipping_groups (id) on delete set null,
  from_status text,
  to_status text not null,
  admin_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index order_status_history_order_idx on public.order_status_history (order_id, created_at desc);

alter table public.order_status_history enable row level security;

-- Admin-only visibility (STEP 25 spec section 32: audit info is never shown
-- to the customer) — no customer-facing select policy at all, and no direct
-- insert policy for anyone: every row is written by admin_update_shipping_group
-- (SECURITY DEFINER) below, never by a client insert.
create policy order_status_history_admin_read_all on public.order_status_history
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- admin_update_shipping_group — same signature as STEP 09/10's version
-- (p_shipping_group_id, p_status, p_carrier, p_tracking_number). Body now:
--   1. validates carrier/tracking (trim, length, no control characters —
--      lib/validation.ts's isValidTrackingNumber mirrored here since this
--      RPC is reachable by any authenticated caller who passes is_admin(),
--      never trusting the admin UI's own pre-check as the real boundary).
--   2. requires BOTH carrier and tracking number whenever the target status
--      is SHIPPED (STEP 25 spec section 19).
--   3. refuses to move a group to SHIPPED-or-later while the ORDER's own
--      payment_status isn't PAID (spec section 13) — PREPARING/PURCHASING/
--      READY_TO_SHIP remain reachable regardless, since a group is created
--      in PREPARING at order-creation time, before payment.
--   4. records shipped_at/delivered_at exactly once, the first time a group
--      actually reaches that status.
--   5. writes an order_status_history row for the shipping-group transition,
--      and a second one if the order-level rollup itself changes.
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_shipping_group(
  p_shipping_group_id uuid,
  p_status public.shipping_group_status_enum,
  p_carrier text,
  p_tracking_number text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_current_status public.shipping_group_status_enum;
  v_group_statuses public.shipping_group_status_enum[];
  v_old_order_status public.order_status_enum;
  v_new_order_status public.order_status_enum;
  v_payment_status public.payment_status_enum;
  v_carrier text;
  v_tracking text;
begin
  if not public.is_admin() then
    raise exception 'admin privilege required';
  end if;

  select order_id, status into v_order_id, v_current_status
  from public.shipping_groups
  where id = p_shipping_group_id;

  if v_order_id is null then
    raise exception 'shipping group not found';
  end if;

  if not public.is_valid_shipping_status_transition(v_current_status, p_status) then
    raise exception 'invalid status transition from % to %', v_current_status, p_status;
  end if;

  v_carrier := nullif(trim(p_carrier), '');
  v_tracking := nullif(trim(p_tracking_number), '');

  if v_tracking is not null then
    if length(v_tracking) > 40 then
      raise exception 'INVALID_TRACKING_NUMBER: too long';
    end if;
    if v_tracking ~ '[\x00-\x1f\x7f]' then
      raise exception 'INVALID_TRACKING_NUMBER: control characters not allowed';
    end if;
  end if;

  if p_status = 'SHIPPED' and (v_carrier is null or v_tracking is null) then
    raise exception 'SHIPPING_INFO_REQUIRED: carrier and tracking number are required to mark a group as shipped';
  end if;

  if p_status in ('SHIPPED', 'IN_TRANSIT', 'CUSTOMS', 'OUT_FOR_DELIVERY', 'DELIVERED') then
    select payment_status into v_payment_status from public.orders where id = v_order_id;
    if v_payment_status <> 'PAID' then
      raise exception 'ORDER_NOT_PAID: cannot move an unpaid order past shipping preparation';
    end if;
  end if;

  update public.shipping_groups
  set status = p_status,
      carrier = coalesce(v_carrier, carrier),
      tracking_number = coalesce(v_tracking, tracking_number),
      shipped_at = case when p_status = 'SHIPPED' and shipped_at is null then now() else shipped_at end,
      delivered_at = case when p_status = 'DELIVERED' and delivered_at is null then now() else delivered_at end
  where id = p_shipping_group_id;

  if v_current_status <> p_status then
    insert into public.order_status_history (order_id, shipping_group_id, from_status, to_status, admin_user_id)
    values (v_order_id, p_shipping_group_id, v_current_status::text, p_status::text, auth.uid());
  end if;

  select array_agg(status) into v_group_statuses
  from public.shipping_groups
  where order_id = v_order_id;

  select order_status into v_old_order_status from public.orders where id = v_order_id;
  v_new_order_status := public.compute_order_status(v_group_statuses);

  update public.orders
  set order_status = v_new_order_status
  where id = v_order_id;

  if v_old_order_status <> v_new_order_status then
    insert into public.order_status_history (order_id, shipping_group_id, from_status, to_status, admin_user_id)
    values (v_order_id, null, v_old_order_status::text, v_new_order_status::text, auth.uid());
  end if;
end;
$$;

grant execute on function public.admin_update_shipping_group to authenticated;

-- ---------------------------------------------------------------------------
-- admin_set_order_note — the only write path for orders.admin_note.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_order_note(p_order_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text;
begin
  if not public.is_admin() then
    raise exception 'admin privilege required';
  end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is not null and length(v_note) > 2000 then
    raise exception 'NOTE_TOO_LONG: admin note must be 2000 characters or fewer';
  end if;

  update public.orders
  set admin_note = v_note
  where id = p_order_id;

  if not found then
    raise exception 'order not found';
  end if;
end;
$$;

grant execute on function public.admin_set_order_note to authenticated;
