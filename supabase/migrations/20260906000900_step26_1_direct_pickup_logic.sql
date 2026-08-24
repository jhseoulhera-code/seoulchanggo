-- STEP 26.1 (part 2): the actual DIRECT_PICKUP / READY_FOR_PICKUP / PICKED_UP
-- logic, now that 20260906000800_step26_1_direct_pickup.sql's enum values
-- are fully committed. Every function below is `create or replace` with its
-- EXISTING signature (no drop needed) — only bodies change. No STEP 15.5/
-- order/payment/refund security logic (is_admin() checks, ownership checks,
-- amount/currency verification, idempotency) is touched; only shipping-type/
-- shipping-status branching is extended.

-- ---------------------------------------------------------------------------
-- create_order — STEP 26.1 spec section 3/8/9: a DIRECT_PICKUP item's base
-- shipping fee must be exactly 0, guaranteed here (never trusting a client-
-- sent shipping_fee, and never trusting an admin-entered
-- product_shipping_markets override either) by checking shipping_type
-- BEFORE free_shipping/the per-market override, mirroring the same
-- DIRECT_PICKUP-first guard added to lib/shipping.ts's getBaseShippingFeeKrw.
-- The shipping-group creation logic already keys off shipping_type
-- generically (v_group_key := v_product.shipping_type::text; a fresh key
-- starts a new group) — a DIRECT_PICKUP item's own group is created exactly
-- the same way an OVERSEAS_AGENCY item's is, with no code path change
-- needed there. Every other line is unchanged from
-- 20260906000300_step22_order_snapshot.sql.
-- ---------------------------------------------------------------------------
create or replace function public.create_order(
  p_order_number text,
  p_user_id uuid,
  p_guest_email text,
  p_guest_phone text,
  p_market_code public.market_code_enum,
  p_currency_code public.currency_code_enum,
  p_payment_method public.payment_method_enum,
  p_shipping_address jsonb,
  p_customs_info jsonb,
  p_items jsonb,
  p_coupon_code text default null,
  p_points_used integer default 0,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_resolved_items jsonb := '[]'::jsonb;
  v_order_item_id uuid;
  v_group_key text;
  v_group_id uuid;
  v_group_ids jsonb := '{}'::jsonb;
  v_group_shipping_fees jsonb := '{}'::jsonb;
  v_coupon public.coupons%rowtype;
  v_coupon_discount numeric := 0;
  v_usage_count integer;
  v_user_usage_count integer;
  v_point_balance integer;
  v_product_ids uuid[];
  v_final_total numeric;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_price_row public.product_prices%rowtype;
  v_krw_price_row public.product_prices%rowtype;
  v_shipping_row public.product_shipping_markets%rowtype;
  v_currency_rate numeric;
  v_unit_price numeric;
  v_original_price numeric;
  v_option_snapshot jsonb;
  v_base_shipping_fee_krw numeric;
  v_item_shipping_fee numeric;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_subtotal numeric := 0;
  v_discount_amount numeric := 0;
  v_shipping_amount numeric := 0;
  v_is_production boolean;
begin
  if p_user_id is not null and p_user_id <> auth.uid() then
    raise exception 'user_id does not match the authenticated caller';
  end if;

  -- STEP 22 idempotency fast path — a resubmit (double-click, reload,
  -- network retry) of the SAME checkout attempt carries the same key. If an
  -- order for it already exists, return it as-is without re-running any
  -- validation or touching the DB again, rather than risking a second order.
  if p_idempotency_key is not null then
    select id into v_order_id from public.orders where idempotency_key = p_idempotency_key;
    if v_order_id is not null then
      if p_user_id is not null and not exists (
        select 1 from public.orders where id = v_order_id and user_id = p_user_id
      ) then
        raise exception 'UNAUTHORIZED: idempotency key does not belong to this caller';
      end if;
      return v_order_id;
    end if;
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
  if p_points_used > 0 and p_currency_code <> 'KRW' then
    raise exception 'points can only be used for KRW orders';
  end if;

  select coalesce((value)::text::boolean, true) into v_is_production
  from public.app_settings where key = 'orders.is_production';
  v_is_production := coalesce(v_is_production, true);

  v_currency_rate := case p_currency_code
    when 'KRW' then 1
    when 'INR' then 0.06
    when 'USD' then 0.00075
  end;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    v_variant_id := nullif(v_item ->> 'variant_id', '')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_product_id is null then
      raise exception 'item is missing product_id';
    end if;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'item quantity must be positive';
    end if;

    select * into v_product from public.products where id = v_product_id and is_active;
    if v_product.id is null then
      raise exception 'product % not found or inactive', v_product_id;
    end if;

    -- Full variant resolution — belongs to this product, is active, and has
    -- enough stock for the requested quantity. An option-less item instead
    -- checks the product's own stock_quantity when it's stock-tracked
    -- (UNLIMITED products are never capped, same as every other stock
    -- check in this codebase).
    v_variant := null;
    if v_variant_id is not null then
      select * into v_variant from public.product_variants where id = v_variant_id and product_id = v_product_id;
      if v_variant.id is null then
        raise exception 'variant % does not belong to product %', v_variant_id, v_product_id;
      end if;
      if not v_variant.is_active then
        raise exception 'STOCK_CHANGED: variant % is not active', v_variant_id;
      end if;
      if v_quantity > v_variant.stock_quantity then
        raise exception 'STOCK_CHANGED: quantity exceeds available stock for variant %', v_variant_id;
      end if;
      v_option_snapshot := coalesce(v_variant.option_values, '{}'::jsonb);
    else
      if v_product.stock_type = 'TRACKED' and v_quantity > v_product.stock_quantity then
        raise exception 'STOCK_CHANGED: quantity exceeds available stock for product %', v_product_id;
      end if;
      v_option_snapshot := '{}'::jsonb;
    end if;

    if exists (select 1 from public.product_shipping_markets where product_id = v_product_id)
       and not exists (
         select 1 from public.product_shipping_markets
         where product_id = v_product_id and country_code = p_market_code and is_available
       )
    then
      raise exception 'SHIPPING_UNAVAILABLE: product % is not available in market %', v_product_id, p_market_code;
    end if;

    select * into v_price_row from public.product_prices
    where product_id = v_product_id and currency_code = p_currency_code;

    if v_price_row.id is not null then
      v_unit_price := v_price_row.sale_price;
      v_original_price := v_price_row.original_price;
    else
      if v_is_production then
        raise exception 'PRICE_NOT_READY: product % has no explicit % price', v_product_id, p_currency_code;
      end if;

      select * into v_krw_price_row from public.product_prices
      where product_id = v_product_id and currency_code = 'KRW';
      if v_krw_price_row.id is null then
        raise exception 'product % has no price on file', v_product_id;
      end if;

      v_unit_price := round(v_krw_price_row.sale_price * v_currency_rate, 2);
      v_original_price := round(v_krw_price_row.original_price * v_currency_rate, 2);
    end if;

    -- additional_price is always a raw KRW delta with no per-market
    -- override (STEP 18/19's documented scope, mirrored by
    -- lib/checkout/normalize.ts's resolveSellPrice on the TS side) —
    -- converted the same dev-rate way the base price itself was above,
    -- and floored at 0 the same way calculateVariantPrice does.
    if v_variant.id is not null then
      v_unit_price := greatest(0, v_unit_price + round(v_variant.additional_price * v_currency_rate, 2));
      v_original_price := greatest(0, v_original_price + round(v_variant.additional_price * v_currency_rate, 2));
    end if;

    select * into v_shipping_row from public.product_shipping_markets
    where product_id = v_product_id and country_code = p_market_code;

    -- STEP 26.1 — DIRECT_PICKUP is always 0, checked BEFORE free_shipping/
    -- the per-market override so neither can ever produce a non-zero fee
    -- for a pickup item, regardless of what an admin stored on
    -- product_shipping_markets.
    if v_product.shipping_type = 'DIRECT_PICKUP' then
      v_base_shipping_fee_krw := 0;
    elsif v_product.free_shipping then
      v_base_shipping_fee_krw := 0;
    elsif v_shipping_row.id is not null then
      v_base_shipping_fee_krw := v_shipping_row.shipping_fee;
    else
      v_base_shipping_fee_krw := case v_product.shipping_type
        when 'DOMESTIC' then 3000
        when 'OVERSEAS_DIRECT' then 5000
        when 'OVERSEAS_AGENCY' then 6000
        when 'DIRECT_PICKUP' then 0
      end;
    end if;
    v_item_shipping_fee := round(v_base_shipping_fee_krw * v_currency_rate, 2);

    v_subtotal := v_subtotal + v_unit_price * v_quantity;
    v_discount_amount := v_discount_amount + (v_original_price - v_unit_price) * v_quantity;
    v_shipping_amount := v_shipping_amount + v_item_shipping_fee;

    v_group_key := v_product.shipping_type::text;
    v_group_shipping_fees := jsonb_set(
      v_group_shipping_fees,
      array[v_group_key],
      to_jsonb(coalesce((v_group_shipping_fees ->> v_group_key)::numeric, 0) + v_item_shipping_fee)
    );

    v_resolved_items := v_resolved_items || jsonb_build_object(
      'product_id', v_product_id,
      'variant_id', v_variant_id,
      'product_name_snapshot', v_product.name_ko,
      'sku_snapshot', coalesce(v_variant.sku, v_product.sku),
      'option_snapshot', v_option_snapshot,
      'unit_price', v_unit_price,
      'original_price', v_original_price,
      'quantity', v_quantity,
      'shipping_type', v_product.shipping_type,
      'origin_country', v_product.origin_country,
      'shipping_method', v_product.default_shipping_method,
      'shipping_group_key', v_group_key
    );
  end loop;

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

    v_coupon_discount := public._compute_coupon_discount(v_coupon, p_market_code, p_currency_code, v_subtotal, v_product_ids);
  end if;

  if p_points_used > 0 then
    perform pg_advisory_xact_lock(hashtext('points:' || p_user_id::text));
    select coalesce(sum(amount), 0) into v_point_balance from public.point_transactions where user_id = p_user_id;
    if v_point_balance < p_points_used then
      raise exception 'insufficient point balance';
    end if;
    if p_points_used > (v_subtotal + v_shipping_amount - v_coupon_discount) then
      raise exception 'points_used exceeds the payable amount';
    end if;
  end if;

  v_final_total := v_subtotal + v_shipping_amount - v_coupon_discount - p_points_used;

  -- STEP 22 — the insert itself is wrapped so a UNIQUE violation on
  -- idempotency_key (two near-simultaneous calls with the same key both
  -- passing the fast-path check above before either commits) resolves to
  -- "return the winner's order id" instead of an error. A violation on
  -- order_number instead (a genuine, astronomically rare collision in the
  -- client's random suffix) finds no matching idempotency_key row and is
  -- re-raised as-is, since it is a distinct, non-idempotent order attempt.
  begin
    insert into public.orders (
      order_number, user_id, guest_email, guest_phone, market_code, currency_code,
      subtotal, discount_amount, shipping_amount, total_amount, payment_method,
      shipping_address, customs_info, coupon_id, coupon_discount_amount, points_used, points_discount_amount,
      idempotency_key
    ) values (
      p_order_number, p_user_id, p_guest_email, p_guest_phone, p_market_code, p_currency_code,
      v_subtotal, v_discount_amount, v_shipping_amount, v_final_total, p_payment_method,
      p_shipping_address, p_customs_info, v_coupon.id, v_coupon_discount, p_points_used, p_points_used,
      p_idempotency_key
    )
    returning id into v_order_id;
  exception when unique_violation then
    v_order_id := null;
    if p_idempotency_key is not null then
      select id into v_order_id from public.orders where idempotency_key = p_idempotency_key;
    end if;
    if v_order_id is null then
      raise;
    end if;
    return v_order_id;
  end;

  for v_item in select * from jsonb_array_elements(v_resolved_items)
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
        coalesce((v_group_shipping_fees ->> v_group_key)::numeric, 0),
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

-- ---------------------------------------------------------------------------
-- is_valid_shipping_status_transition — additive: PREPARING→READY_FOR_PICKUP
-- and READY_FOR_PICKUP→PICKED_UP are the only two new edges. Every existing
-- edge (courier flow) is copied verbatim, unchanged.
-- ---------------------------------------------------------------------------
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
    when p_current = 'PREPARING' and p_next in ('READY_TO_SHIP', 'PURCHASING', 'READY_FOR_PICKUP') then true
    when p_current = 'PURCHASING' and p_next = 'READY_TO_SHIP' then true
    when p_current = 'READY_TO_SHIP' and p_next = 'SHIPPED' then true
    when p_current = 'SHIPPED' and p_next = 'IN_TRANSIT' then true
    when p_current = 'IN_TRANSIT' and p_next in ('CUSTOMS', 'OUT_FOR_DELIVERY') then true
    when p_current = 'CUSTOMS' and p_next = 'OUT_FOR_DELIVERY' then true
    when p_current = 'OUT_FOR_DELIVERY' and p_next = 'DELIVERED' then true
    when p_current = 'READY_FOR_PICKUP' and p_next = 'PICKED_UP' then true
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- compute_order_status — READY_FOR_PICKUP folds into the same
-- "shipped_or_later" bucket READY_TO_SHIP-and-beyond already uses (past
-- pure preparation, not yet fulfilled — a mixed order with one courier
-- group SHIPPED and one pickup group READY_FOR_PICKUP still reads as
-- PARTIALLY_SHIPPED, not PREPARING). PICKED_UP folds into "delivered" the
-- same way DELIVERED does, so an order made ENTIRELY of pickup groups rolls
-- up to DELIVERED once every group is picked up, and mixed orders still
-- only reach DELIVERED when every group (courier-delivered or picked-up)
-- is done.
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

  select count(*) into v_delivered from unnest(p_group_statuses) s where s in ('DELIVERED', 'PICKED_UP');
  select count(*) into v_shipped_or_later from unnest(p_group_statuses) s
    where s in ('SHIPPED', 'IN_TRANSIT', 'CUSTOMS', 'OUT_FOR_DELIVERY', 'DELIVERED', 'READY_FOR_PICKUP', 'PICKED_UP');
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
-- admin_update_shipping_group — same 4-param signature as STEP 09/25 (no
-- drop needed). Two changes from the STEP 25 body:
--   1. the payment-before-ship gate also covers PICKED_UP (releasing a
--      pickup order's goods to the customer requires payment, exactly like
--      releasing a courier shipment does) — READY_FOR_PICKUP stays
--      ungated, same as READY_TO_SHIP, since a group can reach either
--      before payment completes (create_order's own insert already does).
--   2. shipped_at/delivered_at are reused generically: READY_FOR_PICKUP
--      sets shipped_at (a pickup group's own "ready" milestone), PICKED_UP
--      sets delivered_at (its own "fulfilled" milestone) — same
--      once-only-if-still-null guard as SHIPPED/DELIVERED already use.
-- The SHIPPING_INFO_REQUIRED carrier/tracking check is untouched: it only
-- ever matches the literal SHIPPED status, which a pickup group never
-- reaches, so it already never applies to DIRECT_PICKUP groups.
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

  if p_status in ('SHIPPED', 'IN_TRANSIT', 'CUSTOMS', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PICKED_UP') then
    select payment_status into v_payment_status from public.orders where id = v_order_id;
    if v_payment_status <> 'PAID' then
      raise exception 'ORDER_NOT_PAID: cannot move an unpaid order past shipping preparation';
    end if;
  end if;

  update public.shipping_groups
  set status = p_status,
      carrier = coalesce(v_carrier, carrier),
      tracking_number = coalesce(v_tracking, tracking_number),
      shipped_at = case when p_status in ('SHIPPED', 'READY_FOR_PICKUP') and shipped_at is null then now() else shipped_at end,
      delivered_at = case when p_status in ('DELIVERED', 'PICKED_UP') and delivered_at is null then now() else delivered_at end
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
-- admin_finalize_refund — same 7-param signature as STEP 26 (no drop
-- needed). Only the stock-restore eligibility allow-list changes:
-- READY_FOR_PICKUP now counts as pre-fulfillment (the item is still
-- physically in the store, exactly like PREPARING/PURCHASING/READY_TO_SHIP
-- — restorable), while PICKED_UP stays excluded (the customer already has
-- it in hand, same as SHIPPED-or-later — never auto-restored). Every other
-- line is unchanged from 20260906000700_step26_refunds.sql.
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

  if v_new_payment_status = 'REFUNDED' then
    select order_status into v_old_order_status from public.orders where id = v_refund.order_id;
    update public.orders set order_status = 'REFUNDED' where id = v_refund.order_id;
    if v_old_order_status is distinct from 'REFUNDED' then
      insert into public.order_status_history (order_id, shipping_group_id, from_status, to_status, admin_user_id)
      values (v_refund.order_id, null, v_old_order_status::text, 'REFUNDED', v_refund.admin_user_id);
    end if;
  end if;

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
        and sg.status not in ('PREPARING', 'PURCHASING', 'READY_TO_SHIP', 'READY_FOR_PICKUP')
    ) into v_eligible;

    if v_eligible then
      if v_item.variant_id is not null then
        update public.product_variants set stock_quantity = stock_quantity + v_item.quantity where id = v_item.variant_id;
      elsif v_item.stock_type = 'TRACKED' then
        update public.products set stock_quantity = stock_quantity + v_item.quantity where id = v_item.product_id;
      end if;
      update public.payment_refund_items set stock_restored_at = now() where id = v_item.refund_item_id;
    end if;
  end loop;

  return jsonb_build_object('status', 'COMPLETED', 'payment_status', v_new_payment_status);
end;
$$;

grant execute on function public.admin_finalize_refund to authenticated;
