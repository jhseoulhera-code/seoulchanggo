-- STEP 18: product images / options / SKU / inventory structure.
--
-- No new tables or columns: product_images and product_variants already
-- existed since STEP 08 with everything this step's admin flow needs
-- (sort_order + a partial unique index enforcing "at most one primary
-- image" for images; sku/option_values/additional_price/stock_quantity/
-- is_active for variants, sku already unique table-wide — stricter than
-- this step's "unique within one product" requirement, so it's kept as
-- is). "품절" stays derived from stock_quantity <= 0 everywhere (matches
-- lib/repositories/admin/inventory.ts's existing statusFor(), which this
-- step deliberately doesn't change) rather than adding a second,
-- independently-settable is_sold_out flag no other part of the app has.
--
-- What this migration actually adds:
--   1. admin_replace_product_variants — the Wizard's new option-group ->
--      Cartesian-product -> variant-table flow can regenerate many rows at
--      once (e.g. 2 colors x 3 sizes = 6), and STEP 18 spec section 16
--      explicitly warns against saving a generated batch as N sequential
--      client calls (a mid-batch failure would leave a half-saved option
--      set). This makes "save this product's whole variant list" one
--      transaction: upserts by sku (preserving existing row ids, so any
--      unrelated FK — cart_items/order_items — never has to re-point),
--      deletes rows for skus no longer present, and rejects duplicate or
--      cross-product sku collisions with a clear error instead of silently
--      dropping rows. The existing single-row add/update/delete RLS-gated
--      helpers (lib/repositories/admin/products.ts) are untouched and still
--      used for one-off edits — this is additive, not a replacement.
--   2. Storage hardening on the existing product-images bucket (STEP 09) —
--      STEP 18 spec section 6's MIME/size limits now enforced by the
--      Storage API itself, not just the client's pre-upload check in
--      ImageUploadManager.tsx (which a direct API call could bypass).

create or replace function public.admin_replace_product_variants(
  p_product_id uuid,
  p_variants jsonb
)
returns setof public.product_variants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_sku text;
  v_incoming_skus text[];
  v_conflicting_sku text;
begin
  if not public.is_admin() then
    raise exception 'admin privilege required';
  end if;

  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'product not found';
  end if;

  select array_agg(trim(both from (value ->> 'sku')))
  into v_incoming_skus
  from jsonb_array_elements(coalesce(p_variants, '[]'::jsonb));

  if v_incoming_skus is not null
     and array_length(v_incoming_skus, 1) <> (select count(distinct s) from unnest(v_incoming_skus) as s)
  then
    raise exception 'duplicate sku in variant list';
  end if;

  select sku into v_conflicting_sku
  from public.product_variants
  where sku = any (coalesce(v_incoming_skus, array[]::text[]))
    and product_id <> p_product_id
  limit 1;
  if v_conflicting_sku is not null then
    raise exception 'sku % already used by another product', v_conflicting_sku;
  end if;

  delete from public.product_variants
  where product_id = p_product_id
    and (v_incoming_skus is null or not (sku = any (v_incoming_skus)));

  for v_row in select * from jsonb_array_elements(coalesce(p_variants, '[]'::jsonb))
  loop
    v_sku := trim(both from (v_row ->> 'sku'));
    if v_sku is null or v_sku = '' then
      raise exception 'variant sku is required';
    end if;
    if coalesce((v_row ->> 'stock_quantity')::integer, 0) < 0 then
      raise exception 'variant stock_quantity must be >= 0';
    end if;

    insert into public.product_variants (
      product_id, sku, option_values, additional_price, stock_quantity, is_active
    ) values (
      p_product_id,
      v_sku,
      coalesce(v_row -> 'option_values', '{}'::jsonb),
      coalesce((v_row ->> 'additional_price')::numeric, 0),
      coalesce((v_row ->> 'stock_quantity')::integer, 0),
      coalesce((v_row ->> 'is_active')::boolean, true)
    )
    on conflict (sku) do update set
      option_values = excluded.option_values,
      additional_price = excluded.additional_price,
      stock_quantity = excluded.stock_quantity,
      is_active = excluded.is_active
    where product_variants.product_id = p_product_id;
  end loop;

  return query select * from public.product_variants where product_id = p_product_id order by created_at asc;
end;
$$;

grant execute on function public.admin_replace_product_variants to authenticated;

-- ---------------------------------------------------------------------------
-- product-images bucket hardening (bucket + RLS already existed since STEP 09
-- — 20260822000400_admin_storage_bucket.sql). file_size_limit is bytes;
-- 10485760 = 10 MiB, matching lib/admin/productImages.ts's
-- PRODUCT_IMAGE_MAX_SIZE_BYTES exactly so the client's fail-fast check and
-- the server-enforced limit never drift apart.
-- ---------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'product-images';
