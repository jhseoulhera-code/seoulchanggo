-- STEP 09: admin product write RPCs.
--
-- admin_upsert_product touches products + product_prices + product_shipping_markets
-- together (replace-all semantics for the two child tables), so it's an RPC
-- rather than three sequential client calls — the same "one function call = one
-- transaction, no partial writes" reasoning as create_order in STEP 08.
-- Variants and images are NOT included here: they have their own add/remove
-- lifecycle independent of editing the product's core fields (see
-- lib/repositories/admin/products.ts), so plain RLS-gated insert/update/delete
-- is enough for those and an RPC would only add ceremony.

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
  p_shipping_markets jsonb
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
      stock_quantity, option_groups, is_active, free_shipping, discount_rate
    ) values (
      p_sku, p_category_id, p_slug, p_brand, p_name_ko, p_name_en, p_description_ko, p_description_en,
      p_origin_country, p_supply_type, p_shipping_type, p_default_shipping_method, p_stock_type,
      p_stock_quantity, coalesce(p_option_groups, '[]'::jsonb), p_is_active, p_free_shipping, p_discount_rate
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
      discount_rate = p_discount_rate
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

-- ---------------------------------------------------------------------------
-- admin_set_primary_image — the product_images_one_primary_per_product partial
-- unique index means "swap the primary image" must clear the old one before
-- setting the new one; doing that as two client calls risks leaving zero
-- primary images if the second call fails.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_primary_image(p_product_id uuid, p_image_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin privilege required';
  end if;

  update public.product_images set is_primary = false where product_id = p_product_id and is_primary = true;
  update public.product_images set is_primary = true where id = p_image_id and product_id = p_product_id;
end;
$$;

grant execute on function public.admin_set_primary_image to authenticated;
