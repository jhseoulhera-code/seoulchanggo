-- STEP 21: create_order() gains real variant support.
--
-- Every prior version of create_order() (STEP 08/15/15.5) validated that a
-- given variant_id belongs to the given product_id, but never actually
-- priced or stock-checked it: v_unit_price/v_original_price came only from
-- product_prices, so a variant order was silently charged the product's
-- base price (dropping its additional_price entirely), and neither an
-- option-less product's stock_quantity nor a variant's stock_quantity was
-- ever checked against the requested quantity at all. This migration fixes
-- both without changing the RPC's signature — same 12 parameters as the
-- STEP 15.5 version, only the body changes.
--
-- option_snapshot is now derived from the variant's own current
-- option_values server-side instead of trusted from the caller's p_items —
-- consistent with unit_price/original_price/product_name_snapshot/
-- sku_snapshot/shipping_type/origin_country already being server-resolved,
-- not client-supplied, since STEP 15.

drop function if exists public.create_order(
  text, uuid, text, text, public.market_code_enum, public.currency_code_enum,
  public.payment_method_enum, jsonb, jsonb, jsonb, text, integer
);

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

    -- STEP 21: full variant resolution — belongs to this product, is
    -- active, and has enough stock for the requested quantity. An
    -- option-less item instead checks the product's own stock_quantity
    -- when it's stock-tracked (UNLIMITED products are never capped, same
    -- as every other stock check in this codebase).
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
      raise exception 'product % is not available in market %', v_product_id, p_market_code;
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

    if v_product.free_shipping then
      v_base_shipping_fee_krw := 0;
    elsif v_shipping_row.id is not null then
      v_base_shipping_fee_krw := v_shipping_row.shipping_fee;
    else
      v_base_shipping_fee_krw := case v_product.shipping_type
        when 'DOMESTIC' then 3000
        when 'OVERSEAS_DIRECT' then 5000
        when 'OVERSEAS_AGENCY' then 6000
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

  insert into public.orders (
    order_number, user_id, guest_email, guest_phone, market_code, currency_code,
    subtotal, discount_amount, shipping_amount, total_amount, payment_method,
    shipping_address, customs_info, coupon_id, coupon_discount_amount, points_used, points_discount_amount
  ) values (
    p_order_number, p_user_id, p_guest_email, p_guest_phone, p_market_code, p_currency_code,
    v_subtotal, v_discount_amount, v_shipping_amount, v_final_total, p_payment_method,
    p_shipping_address, p_customs_info, v_coupon.id, v_coupon_discount, p_points_used, p_points_used
  )
  returning id into v_order_id;

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
