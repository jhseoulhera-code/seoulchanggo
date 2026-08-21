-- STEP 10: coupon validation, points, and the extended create_order RPC.
-- Nothing in 20260820000500_order_rpcs.sql is edited — this file only adds
-- `create or replace function public.create_order(...)` with two new
-- trailing optional parameters (defaulted), which is additive: any existing
-- caller that omits them keeps getting exactly STEP 08's behavior.
--
-- STEP 15 fresh-migration fix: even though the new parameters are
-- defaulted, PostgreSQL still identifies a function by name+parameter
-- TYPES — a longer parameter list is a distinct overload, not a
-- replacement, so without an explicit drop of the STEP 08 14-parameter
-- signature, both versions of create_order() coexist and the unqualified
-- `grant execute on function public.create_order ...` below becomes
-- ambiguous ("function name is not unique"), which fails a fresh database
-- bootstrap outright. Confirmed by actually applying every migration from
-- scratch against a clean database for the first time in this project's
-- history (STEP 15) — this had never been exercised end-to-end before.
drop function if exists public.create_order(
  text, uuid, text, text, public.market_code_enum, public.currency_code_enum,
  numeric, numeric, numeric, numeric, public.payment_method_enum, jsonb, jsonb, jsonb
);

-- ---------------------------------------------------------------------------
-- _compute_coupon_discount — shared math for validate_coupon_code() (preview)
-- and create_order() (authoritative, row-locked). Not granted to
-- anon/authenticated directly; only callable from other SECURITY DEFINER
-- functions owned by the same role.
-- ---------------------------------------------------------------------------
create or replace function public._compute_coupon_discount(
  p_coupon public.coupons,
  p_market_code public.market_code_enum,
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
    select cp.id from public.coupon_categories cc
      join public.products cp on cp.category_id = cc.category_id
     where cc.coupon_id = p_coupon.id
  ) scoped;

  if v_scoped_product_count > 0 then
    select count(*) into v_matching_product_count
    from unnest(p_product_ids) pid
    where pid in (
      select product_id from public.coupon_products where coupon_id = p_coupon.id
      union
      select cp.id from public.coupon_categories cc
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

-- ---------------------------------------------------------------------------
-- validate_coupon_code — preview/apply in Checkout. No row lock (a real
-- decrement only happens inside create_order), so this is safe for anon too:
-- supports "비회원 쿠폰 코드 입력" (STEP 10 spec section 5).
-- ---------------------------------------------------------------------------
create or replace function public.validate_coupon_code(
  p_code text,
  p_market_code public.market_code_enum,
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
    v_discount := public._compute_coupon_discount(v_coupon, p_market_code, p_subtotal, p_product_ids);
  exception when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;

  return jsonb_build_object('ok', true, 'coupon_id', v_coupon.id, 'discount_amount', v_discount);
end;
$$;

grant execute on function public.validate_coupon_code to anon, authenticated;

-- ---------------------------------------------------------------------------
-- list_available_coupons — logged-in "사용 가능한 쿠폰 목록" (STEP 10 spec
-- section 4). Returns only fields a customer needs to decide whether to use
-- one; never the full row (no admin-only metadata like usage_limit internals).
-- ---------------------------------------------------------------------------
create or replace function public.list_available_coupons(p_market_code public.market_code_enum)
returns table (
  id uuid, code text, name text, description text,
  discount_type public.coupon_discount_type_enum, discount_value numeric,
  minimum_order_amount numeric, maximum_discount_amount numeric, valid_until timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  select c.id, c.code, c.name, c.description, c.discount_type, c.discount_value,
         c.minimum_order_amount, c.maximum_discount_amount, c.valid_until
  from public.coupons c
  where c.is_active
    and now() between c.valid_from and c.valid_until
    and (c.market_code is null or c.market_code = p_market_code)
    and (c.usage_limit is null or (select count(*) from public.coupon_usages u where u.coupon_id = c.id) < c.usage_limit)
    and (select count(*) from public.coupon_usages u where u.coupon_id = c.id and u.user_id = auth.uid()) < c.per_user_limit
  order by c.created_at desc;
end;
$$;

grant execute on function public.list_available_coupons to authenticated;

-- ---------------------------------------------------------------------------
-- get_point_balance / admin_adjust_points
-- ---------------------------------------------------------------------------
create or replace function public.get_point_balance(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if auth.uid() <> p_user_id and not public.is_admin() then
    raise exception 'not authorized to read this balance';
  end if;
  return coalesce((select sum(amount) from public.point_transactions where user_id = p_user_id), 0);
end;
$$;

grant execute on function public.get_point_balance to authenticated;

create or replace function public.admin_adjust_points(p_user_id uuid, p_amount integer, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if not public.is_admin() then
    raise exception 'admin privilege required';
  end if;
  if p_amount = 0 then
    raise exception 'adjustment amount must not be zero';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'reason is required for a manual point adjustment';
  end if;

  select coalesce(sum(amount), 0) into v_balance from public.point_transactions where user_id = p_user_id;
  if v_balance + p_amount < 0 then
    raise exception 'adjustment would take the balance below zero';
  end if;

  insert into public.point_transactions (user_id, type, amount, balance_after, reason, created_by)
  values (p_user_id, 'ADMIN_ADJUST', p_amount, v_balance + p_amount, p_reason, auth.uid());
end;
$$;

grant execute on function public.admin_adjust_points to authenticated;

-- ---------------------------------------------------------------------------
-- handle_order_delivered_points — auto-EARN when an order's rolled-up status
-- reaches DELIVERED (STEP 10 spec section 9: never earn on order creation
-- alone, since there is no real PG yet). Purely additive: a new trigger on
-- public.orders, no existing STEP 08/09 function body is touched, so this
-- fires the same way whether order_status was set by
-- admin_update_shipping_group() or any other future path.
-- ---------------------------------------------------------------------------
create or replace function public.handle_order_delivered_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate numeric;
  v_earn integer;
  v_balance integer;
  v_net_amount numeric;
begin
  if new.order_status <> 'DELIVERED' or old.order_status = 'DELIVERED' then
    return new;
  end if;
  if new.user_id is null then
    return new; -- guest orders have no point account
  end if;
  if exists (select 1 from public.point_transactions where order_id = new.id and type = 'EARN') then
    return new; -- already earned (defensive; DELIVERED should only be entered once)
  end if;

  select (value)::text::numeric into v_rate from public.app_settings where key = 'points.earn_rate';
  v_rate := coalesce(v_rate, 0.01);

  v_net_amount := new.total_amount;
  v_earn := floor(v_net_amount * v_rate);
  if v_earn <= 0 then
    return new;
  end if;

  select coalesce(sum(amount), 0) into v_balance from public.point_transactions where user_id = new.user_id;

  insert into public.point_transactions (user_id, type, amount, balance_after, reason, order_id)
  values (new.user_id, 'EARN', v_earn, v_balance + v_earn, '주문 배송완료 적립', new.id);

  return new;
end;
$$;

create trigger order_delivered_points_earn
  after update on public.orders
  for each row execute function public.handle_order_delivered_points();

-- ---------------------------------------------------------------------------
-- create_order — extends STEP 08's function with p_coupon_code and
-- p_points_used, both optional/defaulted. Coupon discount and point balance
-- are re-derived from the DB inside this one transaction (never trusted from
-- the caller), and the coupon row is row-locked for the duration so
-- concurrent orders against a near-exhausted coupon serialize instead of
-- racing past usage_limit (STEP 10 spec section 37).
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

    v_coupon_discount := public._compute_coupon_discount(v_coupon, p_market_code, p_subtotal, v_product_ids);
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
        (case when (v_item ->> 'shipping_type') = 'OVERSEAS_AGENCY' then 'PURCHASING' else 'PREPARING' end)::public.shipping_group_status_enum
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
