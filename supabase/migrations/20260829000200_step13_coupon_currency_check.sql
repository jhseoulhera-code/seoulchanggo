-- STEP 13 (USD currency addendum) fix: a FIXED-amount coupon's
-- discount_value is denominated in whichever currency its market_code
-- implies (KRW for a KR-market coupon, INR for an IN-market coupon — see
-- the coupons_fixed_requires_market check in 20260823000100_step10_schema.sql).
-- Before STEP 13, order currency_code was always 1:1 with market_code, so
-- this was never ambiguous. Now that a customer can select a display
-- currency independent of their shipping Market (see
-- contexts/MarketContext.tsx's decoupled currency override), a FIXED
-- coupon validated for the right market_code could still return a raw
-- discount number that's silently misinterpreted in the wrong currency
-- (e.g. a 10,000 KRW coupon subtracted as if it were 10,000 USD) —
-- _compute_coupon_discount now also takes the order's actual currency_code
-- and refuses a FIXED coupon whose currency doesn't match it. PERCENT
-- coupons are unaffected (a percentage has no currency).
--
-- This file otherwise reproduces 20260823000300_step10_rpcs.sql's
-- _compute_coupon_discount / validate_coupon_code / create_order bodies
-- verbatim (Postgres has no ALTER FUNCTION for a signature change, and
-- create_order's own body is untouched except for threading the new
-- parameter through its one _compute_coupon_discount call) so this stays a
-- pure "add a parameter and one new check" change with no other behavior
-- drift.
--
-- Both functions gain a new parameter, which Postgres treats as a distinct
-- overload rather than a replacement of the old signature — drop the old
-- signatures explicitly so nothing can still resolve to the
-- currency-unaware version.
drop function if exists public._compute_coupon_discount(public.coupons, public.market_code_enum, numeric, uuid[]);
drop function if exists public.validate_coupon_code(text, public.market_code_enum, numeric, uuid[]);

create or replace function public._compute_coupon_discount(
  p_coupon public.coupons,
  p_market_code public.market_code_enum,
  p_currency_code public.currency_code_enum,
  p_subtotal numeric,
  p_product_ids uuid[]
)
returns numeric
language plpgsql
stable
as $$
declare
  v_scoped_product_count integer;
  v_matching_product_count integer;
  v_discount numeric;
  v_coupon_currency public.currency_code_enum;
begin
  if not p_coupon.is_active then
    raise exception 'coupon is not active';
  end if;
  if now() < p_coupon.valid_from or now() > p_coupon.valid_until then
    raise exception 'coupon is outside its valid period';
  end if;
  if p_coupon.market_code is not null and p_coupon.market_code <> p_market_code then
    raise exception 'coupon is not valid for this market';
  end if;

  if p_coupon.discount_type = 'FIXED' then
    v_coupon_currency := case p_coupon.market_code when 'KR' then 'KRW' when 'IN' then 'INR' end;
    if v_coupon_currency is distinct from p_currency_code then
      raise exception 'CURRENCY_MISMATCH';
    end if;
  end if;

  if p_subtotal < p_coupon.minimum_order_amount then
    raise exception 'order does not meet the coupon minimum amount';
  end if;

  -- Scope: no coupon_products/coupon_categories rows at all means "all
  -- products". Otherwise at least one item in the order must match either
  -- list directly (STEP 10 spec section 2).
  select count(*) into v_scoped_product_count
  from (
    select product_id from public.coupon_products where coupon_id = p_coupon.id
    union
    select cp.product_id from public.coupon_categories cc
      join public.products cp on cp.category_id = cc.category_id
     where cc.coupon_id = p_coupon.id
  ) scoped;

  if v_scoped_product_count > 0 then
    select count(*) into v_matching_product_count
    from unnest(p_product_ids) pid
    where pid in (
      select product_id from public.coupon_products where coupon_id = p_coupon.id
      union
      select cp.product_id from public.coupon_categories cc
        join public.products cp on cp.category_id = cc.category_id
       where cc.coupon_id = p_coupon.id
    );
    if v_matching_product_count = 0 then
      raise exception 'no item in the order is eligible for this coupon';
    end if;
  end if;

  if p_coupon.discount_type = 'FIXED' then
    v_discount := p_coupon.discount_value;
  else
    v_discount := p_subtotal * p_coupon.discount_value / 100;
  end if;

  if p_coupon.maximum_discount_amount is not null then
    v_discount := least(v_discount, p_coupon.maximum_discount_amount);
  end if;

  return greatest(0, least(v_discount, p_subtotal));
end;
$$;

-- validate_coupon_code now takes the order's currency too, so the preview
-- path (Checkout, before an order exists) applies the exact same
-- currency-mismatch guard as the authoritative create_order path below.
create or replace function public.validate_coupon_code(
  p_code text,
  p_market_code public.market_code_enum,
  p_currency_code public.currency_code_enum,
  p_subtotal numeric,
  p_product_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_coupon public.coupons%rowtype;
  v_discount numeric;
  v_usage_count integer;
  v_user_usage_count integer;
begin
  select * into v_coupon from public.coupons where code = p_code;
  if v_coupon.id is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  if v_coupon.usage_limit is not null then
    select count(*) into v_usage_count from public.coupon_usages where coupon_id = v_coupon.id;
    if v_usage_count >= v_coupon.usage_limit then
      return jsonb_build_object('ok', false, 'error', 'USAGE_LIMIT_REACHED');
    end if;
  end if;

  if auth.uid() is not null then
    select count(*) into v_user_usage_count
    from public.coupon_usages where coupon_id = v_coupon.id and user_id = auth.uid();
    if v_user_usage_count >= v_coupon.per_user_limit then
      return jsonb_build_object('ok', false, 'error', 'PER_USER_LIMIT_REACHED');
    end if;
  end if;

  begin
    v_discount := public._compute_coupon_discount(v_coupon, p_market_code, p_currency_code, p_subtotal, p_product_ids);
  exception when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;

  return jsonb_build_object('ok', true, 'coupon_id', v_coupon.id, 'discount_amount', v_discount);
end;
$$;

grant execute on function public.validate_coupon_code to anon, authenticated;

-- create_order — identical to 20260823000300_step10_rpcs.sql's version
-- except for the single _compute_coupon_discount call now passing
-- p_currency_code (which create_order already received as a parameter
-- since STEP 08; it just wasn't threaded into the coupon math before).
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
  p_items jsonb,
  p_coupon_code text default null,
  p_points_used integer default 0
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
  v_coupon public.coupons%rowtype;
  v_coupon_discount numeric := 0;
  v_usage_count integer;
  v_user_usage_count integer;
  v_point_balance integer;
  v_product_ids uuid[];
  v_final_total numeric;
begin
  if p_user_id is not null and p_user_id <> auth.uid() then
    raise exception 'user_id does not match the authenticated caller';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'an order needs at least one item';
  end if;

  if p_points_used < 0 then
    raise exception 'points_used must not be negative';
  end if;
  if p_points_used > 0 and p_user_id is null then
    raise exception 'points can only be used by a signed-in member';
  end if;

  -- Coupon: row-locked so a second concurrent order against the same coupon
  -- waits here rather than both passing the usage_limit check.
  if p_coupon_code is not null then
    select * into v_coupon from public.coupons where code = p_coupon_code for update;
    if v_coupon.id is null then
      raise exception 'coupon not found';
    end if;

    if v_coupon.usage_limit is not null then
      select count(*) into v_usage_count from public.coupon_usages where coupon_id = v_coupon.id;
      if v_usage_count >= v_coupon.usage_limit then
        raise exception 'coupon usage limit reached';
      end if;
    end if;

    if p_user_id is not null then
      select count(*) into v_user_usage_count
      from public.coupon_usages where coupon_id = v_coupon.id and user_id = p_user_id;
      if v_user_usage_count >= v_coupon.per_user_limit then
        raise exception 'coupon per-user limit reached';
      end if;
    end if;

    select array_agg(nullif(item ->> 'product_id', '')::uuid) into v_product_ids
    from jsonb_array_elements(p_items) item;

    v_coupon_discount := public._compute_coupon_discount(v_coupon, p_market_code, p_currency_code, p_subtotal, v_product_ids);
  end if;

  -- Points: balance re-derived from the ledger, never from client input.
  if p_points_used > 0 then
    select coalesce(sum(amount), 0) into v_point_balance from public.point_transactions where user_id = p_user_id;
    if v_point_balance < p_points_used then
      raise exception 'insufficient point balance';
    end if;
    if p_points_used > (p_subtotal + p_shipping_amount - v_coupon_discount) then
      raise exception 'points_used exceeds the payable amount';
    end if;
  end if;

  v_final_total := p_subtotal + p_shipping_amount - v_coupon_discount - p_points_used;

  insert into public.orders (
    order_number, user_id, guest_email, guest_phone, market_code, currency_code,
    subtotal, discount_amount, shipping_amount, total_amount, payment_method,
    shipping_address, customs_info, coupon_id, coupon_discount_amount, points_used, points_discount_amount
  ) values (
    p_order_number, p_user_id, p_guest_email, p_guest_phone, p_market_code, p_currency_code,
    p_subtotal, p_discount_amount, p_shipping_amount, v_final_total, p_payment_method,
    p_shipping_address, p_customs_info, v_coupon.id, v_coupon_discount, p_points_used, p_points_used
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

  if v_coupon.id is not null then
    insert into public.coupon_usages (coupon_id, user_id, order_id) values (v_coupon.id, p_user_id, v_order_id);
  end if;

  if p_points_used > 0 then
    insert into public.point_transactions (user_id, type, amount, balance_after, reason, order_id)
    values (p_user_id, 'USE', -p_points_used, v_point_balance - p_points_used, '주문 결제 사용', v_order_id);
  end if;

  return v_order_id;
end;
$$;

grant execute on function public.create_order to authenticated, anon;
