-- STEP 15 (highest-priority finding from the STEP 14 security audit): every
-- prior version of create_order() inserted the caller's own unit_price,
-- original_price, subtotal, discount_amount, shipping_amount, and
-- total_amount directly, with the only defense against a forged price being
-- the Next.js Server Action's own re-check (lib/actions/order.ts) before it
-- ever calls this RPC. Since create_order() is GRANTed to anon/authenticated
-- (guest checkout has no session to restrict it further), anyone holding the
-- public anon key could call it directly — bypassing the Server Action
-- entirely — and place an order at any price they chose. This migration
-- makes the RPC itself the source of truth: every item's price, discount,
-- and shipping fee is now recomputed here from product_prices /
-- product_shipping_markets / products, and the caller's own unit_price,
-- original_price, product_name_snapshot, sku_snapshot, shipping_type,
-- origin_country, subtotal, discount_amount, shipping_amount, and
-- total_amount are never read for anything but comparison logging — they
-- are not accepted as parameters at all anymore.
--
-- The four now-unnecessary parameters (p_subtotal, p_discount_amount,
-- p_shipping_amount, p_total_amount) and the old 16-parameter signature are
-- dropped; a new p_is_production parameter (set from the trusted
-- process.env.NODE_ENV check already in lib/actions/order.ts, never from
-- client input) lets production refuse to sell a product using
-- DEV_EXCHANGE_RATES the same way lib/actions/order.ts's existing
-- pre-check does — but now as the actual enforcement boundary, not just a
-- friendlier early error.

drop function if exists public.create_order(
  text, uuid, text, text, public.market_code_enum, public.currency_code_enum,
  numeric, numeric, numeric, numeric, public.payment_method_enum, jsonb, jsonb, jsonb, text, integer
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
  p_points_used integer default 0,
  p_is_production boolean default false
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
  v_price_row public.product_prices%rowtype;
  v_krw_price_row public.product_prices%rowtype;
  v_shipping_row public.product_shipping_markets%rowtype;
  v_currency_rate numeric;
  v_unit_price numeric;
  v_original_price numeric;
  v_base_shipping_fee_krw numeric;
  v_item_shipping_fee numeric;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_subtotal numeric := 0;
  v_discount_amount numeric := 0;
  v_shipping_amount numeric := 0;
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
  -- Points are plain KRW-equivalent integers (point_transactions has no
  -- currency_code) subtracted 1:1 from the order total, so redeeming them
  -- against a non-KRW order would misvalue them by the currency's exchange
  -- factor. lib/actions/order.ts already blocks this before calling the
  -- RPC, but that check is bypassable by anyone calling create_order
  -- directly with the anon key — this is the real boundary.
  if p_points_used > 0 and p_currency_code <> 'KRW' then
    raise exception 'points can only be used for KRW orders';
  end if;

  -- Development-only placeholder rate — must stay numerically identical to
  -- lib/currency.ts's DEV_EXCHANGE_RATES. Only reached for a currency with
  -- no explicit product_prices row (see below); a real exchange-rate source
  -- replaces this case statement wholesale when one is connected.
  v_currency_rate := case p_currency_code
    when 'KRW' then 1
    when 'INR' then 0.06
    when 'USD' then 0.00075
  end;

  -- Pass 1: resolve every item against the product's own DB rows. Nothing
  -- price-relevant is taken from p_items except product_id/variant_id/
  -- quantity (the customer's actual choices) and option_snapshot (display
  -- text with no price effect) — unit_price, original_price,
  -- product_name_snapshot, sku_snapshot, shipping_type, and origin_country
  -- from the caller are read here only to be discarded.
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

    if v_variant_id is not null and not exists (
      select 1 from public.product_variants where id = v_variant_id and product_id = v_product_id
    ) then
      raise exception 'variant % does not belong to product %', v_variant_id, v_product_id;
    end if;

    -- Availability: no product_shipping_markets row at all means "ships
    -- everywhere" (the STEP 08 default); once any row exists, only its
    -- is_available=true countries are allowed. Mirrors
    -- lib/shipping.ts's isProductAvailableInMarket exactly.
    if exists (select 1 from public.product_shipping_markets where product_id = v_product_id)
       and not exists (
         select 1 from public.product_shipping_markets
         where product_id = v_product_id and country_code = p_market_code and is_available
       )
    then
      raise exception 'product % is not available in market %', v_product_id, p_market_code;
    end if;

    -- Price: an explicit row for this exact currency wins — covers KRW's
    -- always-present base row, an admin-entered INR row, and an
    -- admin-entered USD row alike, since product_prices_product_id_currency_code_key
    -- guarantees at most one row per (product, currency) regardless of
    -- market_code. Falls back to a dev-rate conversion of the KRW base
    -- price only when no such row exists, and — in production — refuses to
    -- sell at that unverified rate at all (mirrors lib/currency.ts's
    -- getProductMarketPrice / the PRICE_NOT_READY policy in
    -- lib/actions/order.ts, now enforced here as the real boundary).
    -- Deliberately no `and is_active` filter here — lib/repositories/products.ts's
    -- mapProductRow (the TS layer's own price resolution, which the Server
    -- Action pre-checks against) doesn't filter on it either, and this must
    -- resolve to the exact same row that layer already approved.
    select * into v_price_row from public.product_prices
    where product_id = v_product_id and currency_code = p_currency_code;

    if v_price_row.id is not null then
      v_unit_price := v_price_row.sale_price;
      v_original_price := v_price_row.original_price;
    else
      if p_is_production then
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

    -- Shipping fee: always a dev-rate conversion of a KRW-denominated base
    -- (a per-market override in product_shipping_markets, else a
    -- shipping-type default) — unchanged from lib/shipping.ts's
    -- getShippingFeeForMarket, which was already never trusting the client.
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
      'sku_snapshot', v_product.sku,
      'option_snapshot', coalesce(v_item -> 'option_snapshot', '{}'::jsonb),
      'unit_price', v_unit_price,
      'original_price', v_original_price,
      'quantity', v_quantity,
      'shipping_type', v_product.shipping_type,
      'origin_country', v_product.origin_country,
      'shipping_method', v_product.default_shipping_method,
      'shipping_group_key', v_group_key
    );
  end loop;

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

    v_coupon_discount := public._compute_coupon_discount(v_coupon, p_market_code, p_currency_code, v_subtotal, v_product_ids);
  end if;

  -- Points: balance re-derived from the ledger, never from client input.
  -- Advisory-locked per user so two concurrent orders can't both read the
  -- same pre-spend balance and both pass the sufficiency check (STEP 14).
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

  -- Pass 2: write order_items/shipping_groups/shipping_group_items from the
  -- server-resolved item data computed in pass 1.
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
