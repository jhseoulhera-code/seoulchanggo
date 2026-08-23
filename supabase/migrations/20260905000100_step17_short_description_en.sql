-- STEP 17: the AI Product Assistant's draft output (spec section 2A)
-- explicitly includes short_description_en alongside the short_description_ko
-- column STEP 16 already added — without a matching column, an admin
-- clicking "적용" on that specific AI suggestion would have nowhere to go.
-- Purely additive, nullable, never touched by any customer-facing query
-- (same reasoning as STEP 16's own short_description_ko/seo_title/
-- seo_description/search_tags columns).
alter table public.products
  add column short_description_en text;

-- admin_upsert_product gains one more trailing defaulted parameter — the
-- existing ProductForm/CSV-import/Wizard-Step-1-without-AI call sites never
-- pass it and are unaffected. Drops the STEP 16 24-parameter signature
-- first per Postgres's function-overload rules (a longer parameter list is
-- a distinct overload, not a replacement, without an explicit drop).
drop function if exists public.admin_upsert_product(
  uuid, text, uuid, text, text, text, text, text, text, text,
  public.supply_type_enum, public.shipping_type_enum, public.shipping_method_enum,
  public.stock_type_enum, integer, jsonb, boolean, boolean, smallint, jsonb, jsonb,
  public.product_status_enum, text, text, text, text[]
);

create or replace function public.admin_upsert_product(
  p_id uuid,
  p_sku text,
  p_category_id uuid,
  p_slug text,
  p_brand text,
  p_name_ko text,
  p_name_en text,
  p_description_ko text,
  p_description_en text,
  p_origin_country text,
  p_supply_type public.supply_type_enum,
  p_shipping_type public.shipping_type_enum,
  p_default_shipping_method public.shipping_method_enum,
  p_stock_type public.stock_type_enum,
  p_stock_quantity integer,
  p_option_groups jsonb,
  p_is_active boolean,
  p_free_shipping boolean,
  p_discount_rate smallint,
  p_prices jsonb,
  p_shipping_markets jsonb,
  p_status public.product_status_enum default 'ACTIVE',
  p_short_description_ko text default null,
  p_seo_title text default null,
  p_seo_description text default null,
  p_search_tags text[] default '{}',
  p_short_description_en text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_row jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin privilege required';
  end if;

  if p_id is null then
    insert into public.products (
      sku, category_id, slug, brand, name_ko, name_en, description_ko, description_en,
      origin_country, supply_type, shipping_type, default_shipping_method, stock_type,
      stock_quantity, option_groups, is_active, free_shipping, discount_rate, status,
      short_description_ko, seo_title, seo_description, search_tags, short_description_en
    ) values (
      p_sku, p_category_id, p_slug, p_brand, p_name_ko, p_name_en, p_description_ko, p_description_en,
      p_origin_country, p_supply_type, p_shipping_type, p_default_shipping_method, p_stock_type,
      p_stock_quantity, coalesce(p_option_groups, '[]'::jsonb), p_is_active, p_free_shipping, p_discount_rate,
      coalesce(p_status, 'ACTIVE'::public.product_status_enum), p_short_description_ko, p_seo_title, p_seo_description,
      coalesce(p_search_tags, '{}'), p_short_description_en
    )
    returning id into v_product_id;
  else
    update public.products set
      sku = p_sku,
      category_id = p_category_id,
      slug = p_slug,
      brand = p_brand,
      name_ko = p_name_ko,
      name_en = p_name_en,
      description_ko = p_description_ko,
      description_en = p_description_en,
      origin_country = p_origin_country,
      supply_type = p_supply_type,
      shipping_type = p_shipping_type,
      default_shipping_method = p_default_shipping_method,
      stock_type = p_stock_type,
      stock_quantity = p_stock_quantity,
      option_groups = coalesce(p_option_groups, '[]'::jsonb),
      is_active = p_is_active,
      free_shipping = p_free_shipping,
      discount_rate = p_discount_rate,
      status = coalesce(p_status, status),
      short_description_ko = p_short_description_ko,
      seo_title = p_seo_title,
      seo_description = p_seo_description,
      search_tags = coalesce(p_search_tags, '{}'),
      short_description_en = p_short_description_en
    where id = p_id
    returning id into v_product_id;

    if v_product_id is null then
      raise exception 'product not found';
    end if;

    delete from public.product_prices where product_id = v_product_id;
    delete from public.product_shipping_markets where product_id = v_product_id;
  end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_prices, '[]'::jsonb))
  loop
    insert into public.product_prices (product_id, market_code, currency_code, original_price, sale_price)
    values (
      v_product_id,
      (v_row ->> 'market_code')::public.market_code_enum,
      (v_row ->> 'currency_code')::public.currency_code_enum,
      (v_row ->> 'original_price')::numeric,
      (v_row ->> 'sale_price')::numeric
    );
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(p_shipping_markets, '[]'::jsonb))
  loop
    insert into public.product_shipping_markets (
      product_id, country_code, is_available, shipping_fee, estimated_min_days, estimated_max_days, shipping_method
    ) values (
      v_product_id,
      (v_row ->> 'country_code')::public.market_code_enum,
      coalesce((v_row ->> 'is_available')::boolean, true),
      coalesce((v_row ->> 'shipping_fee')::numeric, 0),
      nullif(v_row ->> 'estimated_min_days', '')::smallint,
      nullif(v_row ->> 'estimated_max_days', '')::smallint,
      nullif(v_row ->> 'shipping_method', '')::public.shipping_method_enum
    );
  end loop;

  return v_product_id;
end;
$$;

grant execute on function public.admin_upsert_product to authenticated;
