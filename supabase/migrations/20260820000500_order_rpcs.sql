-- STEP 08: order-related RPCs. Orders intentionally have no direct insert/
-- broad-select policy (see 20260820000400_rls_policies.sql) — every write and
-- every guest read goes through one of these SECURITY DEFINER functions so
-- the multi-table write stays atomic and guest access stays narrow.

-- ---------------------------------------------------------------------------
-- create_order — atomically inserts the order, its order_items, and their
-- shipping_groups/shipping_group_items. Being a single PL/pgSQL function call
-- means Postgres wraps the whole body in one transaction: if any insert
-- fails, everything rolls back (STEP 08 spec section 28).
--
-- p_items shape (jsonb array), one element per order line:
--   {
--     "product_id": uuid | null,
--     "variant_id": uuid | null,
--     "product_name_snapshot": text,
--     "sku_snapshot": text,
--     "option_snapshot": object,
--     "unit_price": number,
--     "original_price": number,
--     "quantity": integer,
--     "shipping_type": "DOMESTIC" | "OVERSEAS_DIRECT" | "OVERSEAS_AGENCY",
--     "origin_country": text | null,
--     "shipping_group_key": text,        -- groups items into the same shipping_groups row
--     "group_shipping_fee": number,      -- shipping_fee for that group (same value repeated per item in the group)
--     "shipping_method": "SEA" | "AIR" | null
--   }
-- ---------------------------------------------------------------------------
create or replace function public.create_order(
  p_order_number text,
  p_user_id uuid,
  p_guest_email text,
  p_guest_phone text,
  p_market_code public.market_code_enum,
  p_currency_code public.currency_code_enum,
  p_subtotal numeric,
  p_discount_amount numeric,
  p_shipping_amount numeric,
  p_total_amount numeric,
  p_payment_method public.payment_method_enum,
  p_shipping_address jsonb,
  p_customs_info jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_order_item_id uuid;
  v_group_key text;
  v_group_id uuid;
  v_group_ids jsonb := '{}'::jsonb;
begin
  -- A caller can never create an order on behalf of a different member —
  -- either p_user_id is null (guest order) or it must equal the caller's own id.
  if p_user_id is not null and p_user_id <> auth.uid() then
    raise exception 'user_id does not match the authenticated caller';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'an order needs at least one item';
  end if;

  insert into public.orders (
    order_number, user_id, guest_email, guest_phone, market_code, currency_code,
    subtotal, discount_amount, shipping_amount, total_amount, payment_method,
    shipping_address, customs_info
  ) values (
    p_order_number, p_user_id, p_guest_email, p_guest_phone, p_market_code, p_currency_code,
    p_subtotal, p_discount_amount, p_shipping_amount, p_total_amount, p_payment_method,
    p_shipping_address, p_customs_info
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (
      order_id, product_id, variant_id, product_name_snapshot, sku_snapshot,
      option_snapshot, unit_price, original_price, quantity, shipping_type, origin_country
    ) values (
      v_order_id,
      nullif(v_item ->> 'product_id', '')::uuid,
      nullif(v_item ->> 'variant_id', '')::uuid,
      v_item ->> 'product_name_snapshot',
      v_item ->> 'sku_snapshot',
      coalesce(v_item -> 'option_snapshot', '{}'::jsonb),
      (v_item ->> 'unit_price')::numeric,
      (v_item ->> 'original_price')::numeric,
      (v_item ->> 'quantity')::integer,
      (v_item ->> 'shipping_type')::public.shipping_type_enum,
      v_item ->> 'origin_country'
    )
    returning id into v_order_item_id;

    v_group_key := v_item ->> 'shipping_group_key';

    if not (v_group_ids ? v_group_key) then
      insert into public.shipping_groups (
        order_id, shipping_type, shipping_method, origin_country, destination_country,
        shipping_fee, status
      ) values (
        v_order_id,
        (v_item ->> 'shipping_type')::public.shipping_type_enum,
        nullif(v_item ->> 'shipping_method', '')::public.shipping_method_enum,
        v_item ->> 'origin_country',
        p_market_code,
        coalesce((v_item ->> 'group_shipping_fee')::numeric, 0),
        case when (v_item ->> 'shipping_type') = 'OVERSEAS_AGENCY' then 'PURCHASING' else 'PREPARING' end
      )
      returning id into v_group_id;

      v_group_ids := v_group_ids || jsonb_build_object(v_group_key, v_group_id::text);
    else
      v_group_id := (v_group_ids ->> v_group_key)::uuid;
    end if;

    insert into public.shipping_group_items (shipping_group_id, order_item_id)
    values (v_group_id, v_order_item_id);
  end loop;

  return v_order_id;
end;
$$;

grant execute on function public.create_order to authenticated, anon;

-- ---------------------------------------------------------------------------
-- lookup_guest_order_full — the only way anon/authenticated can read a guest
-- order: order number + (email OR phone) must match, mirroring
-- lib/order.ts's lookupGuestOrder(). Returns null rather than raising when
-- nothing matches, so it can't be used to distinguish "wrong contact" from
-- "no such order" (avoids leaking which order numbers exist).
-- ---------------------------------------------------------------------------
create or replace function public.lookup_guest_order_full(
  p_order_number text,
  p_contact text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_result jsonb;
begin
  select *
  into v_order
  from public.orders o
  where o.order_number = p_order_number
    and (
      lower(o.guest_email) = lower(p_contact)
      or (
        o.guest_phone is not null
        and regexp_replace(o.guest_phone, '\D', '', 'g') = regexp_replace(p_contact, '\D', '', 'g')
      )
    )
  limit 1;

  if v_order.id is null then
    return null;
  end if;

  select to_jsonb(v_order) || jsonb_build_object(
    'items', coalesce(
      (select jsonb_agg(to_jsonb(oi)) from public.order_items oi where oi.order_id = v_order.id),
      '[]'::jsonb
    ),
    'shipping_groups', coalesce(
      (
        select jsonb_agg(
          to_jsonb(sg) || jsonb_build_object(
            'item_ids',
            coalesce(
              (select jsonb_agg(sgi.order_item_id) from public.shipping_group_items sgi where sgi.shipping_group_id = sg.id),
              '[]'::jsonb
            )
          )
        )
        from public.shipping_groups sg
        where sg.order_id = v_order.id
      ),
      '[]'::jsonb
    )
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.lookup_guest_order_full to anon, authenticated;
