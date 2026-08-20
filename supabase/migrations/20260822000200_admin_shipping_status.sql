-- STEP 09: shipping-group status transitions + order-level status rollup
-- (spec sections 29-32). Every status write goes through the one RPC below —
-- there is no direct admin UPDATE policy on shipping_groups — so the
-- allowed-transition check and the order-status recompute can never be
-- skipped by calling the table directly.

create or replace function public.is_valid_shipping_status_transition(
  p_current public.shipping_group_status_enum,
  p_next public.shipping_group_status_enum
)
returns boolean
language sql
immutable
as $$
  select case
    when p_current = p_next then true -- re-saving carrier/tracking without changing status
    when p_current = 'PREPARING' and p_next in ('READY_TO_SHIP', 'PURCHASING') then true
    when p_current = 'PURCHASING' and p_next = 'READY_TO_SHIP' then true
    when p_current = 'READY_TO_SHIP' and p_next = 'SHIPPED' then true
    when p_current = 'SHIPPED' and p_next = 'IN_TRANSIT' then true
    when p_current = 'IN_TRANSIT' and p_next in ('CUSTOMS', 'OUT_FOR_DELIVERY') then true
    when p_current = 'CUSTOMS' and p_next = 'OUT_FOR_DELIVERY' then true
    when p_current = 'OUT_FOR_DELIVERY' and p_next = 'DELIVERED' then true
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- compute_order_status — rolls up an order's shipping_groups into one
-- order_status. Deliberately only ever returns ORDER_CREATED/PREPARING/
-- PARTIALLY_SHIPPED/SHIPPED/DELIVERED: PAID/CANCELLED/RETURNED etc. are not
-- shipping-derived (payment_status and cancellation are separate concerns —
-- see STEP 09 spec section 33) and this function never overwrites those.
-- ---------------------------------------------------------------------------
create or replace function public.compute_order_status(p_group_statuses public.shipping_group_status_enum[])
returns public.order_status_enum
language plpgsql
immutable
as $$
declare
  v_total integer := coalesce(array_length(p_group_statuses, 1), 0);
  v_delivered integer;
  v_shipped_or_later integer;
  v_preparing_or_earlier integer;
begin
  if v_total = 0 then
    return 'ORDER_CREATED';
  end if;

  select count(*) into v_delivered from unnest(p_group_statuses) s where s = 'DELIVERED';
  select count(*) into v_shipped_or_later from unnest(p_group_statuses) s
    where s in ('SHIPPED', 'IN_TRANSIT', 'CUSTOMS', 'OUT_FOR_DELIVERY', 'DELIVERED');
  select count(*) into v_preparing_or_earlier from unnest(p_group_statuses) s
    where s in ('PREPARING', 'PURCHASING', 'READY_TO_SHIP');

  if v_delivered = v_total then
    return 'DELIVERED';
  end if;

  if v_shipped_or_later > 0 then
    return 'PARTIALLY_SHIPPED';
  end if;

  if v_preparing_or_earlier = v_total then
    return 'PREPARING';
  end if;

  return 'PREPARING';
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_update_shipping_group — the only write path for shipping_groups.
-- Checks is_admin() itself (defense in depth beyond the route/layout guard),
-- validates the transition, then atomically updates the group and recomputes
-- + writes the parent order's order_status in the same transaction.
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

  update public.shipping_groups
  set status = p_status,
      carrier = coalesce(p_carrier, carrier),
      tracking_number = coalesce(p_tracking_number, tracking_number)
  where id = p_shipping_group_id;

  select array_agg(status) into v_group_statuses
  from public.shipping_groups
  where order_id = v_order_id;

  update public.orders
  set order_status = public.compute_order_status(v_group_statuses)
  where id = v_order_id;
end;
$$;

grant execute on function public.admin_update_shipping_group to authenticated;
