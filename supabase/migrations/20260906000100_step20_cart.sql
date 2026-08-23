-- STEP 20: persistent guest + member shopping cart, variant-aware.
--
-- Reuses the existing cart_items table (STEP 08) rather than introducing a
-- parallel schema: it already has product_id/variant_id/quantity, just never
-- supported a guest owner, a variant-aware identity, or a price snapshot.
-- No separate "carts" table — cart_items itself carries either user_id OR
-- anonymous_token (never both, enforced by a check constraint), which is
-- enough to identify "this browser/user's cart" without a redundant
-- parent row; nothing in this project tracks cart status/history yet, so a
-- Cart aggregate would only add migration risk with no present payoff.
--
-- Everything reads/writes through SECURITY DEFINER RPCs, never direct table
-- access — a guest has no auth.uid() at all, so ordinary auth.uid()-based
-- RLS can't protect anonymous rows, and per spec section 24/25 a client must
-- never be able to read/write a cart by just knowing an id or token value.
-- RLS stays enabled on cart_items with zero policies (default-deny for
-- anon/authenticated table access), matching the existing orders/payments
-- pattern (20260820000400_rls_policies.sql's own comment on orders).

-- The STEP 08 merge_guest_cart RPC operated on user_id/selected_options,
-- both removed below — it would error if ever called again with the new
-- schema. No TS code calls it after this step (see lib/repositories/cart.ts),
-- so it's dropped outright rather than left as a landmine.
drop function if exists public.merge_guest_cart(jsonb);

-- selected_options is superseded by variant_id: every purchasable option
-- combination is now a real product_variants row (STEP 18/19), so a cart
-- line's option display can always be derived by joining product_variants
-- instead of trusting a client-supplied option-label blob.
drop policy if exists cart_items_select_own on public.cart_items;
drop policy if exists cart_items_insert_own on public.cart_items;
drop policy if exists cart_items_update_own on public.cart_items;
drop policy if exists cart_items_delete_own on public.cart_items;

alter table public.cart_items
  add column anonymous_token uuid,
  add column unit_price_snapshot numeric(12, 2) not null default 0;

alter table public.cart_items alter column user_id drop not null;

alter table public.cart_items
  add constraint cart_items_owner_check check (
    (user_id is not null and anonymous_token is null) or
    (user_id is null and anonymous_token is not null)
  );

-- Drops the STEP 08 compound unique constraint along with it (Postgres
-- auto-drops constraints defined on a column being dropped).
alter table public.cart_items drop column if exists selected_options cascade;

drop index if exists public.cart_items_user_id_idx;
create index cart_items_owner_idx on public.cart_items (coalesce(user_id, anonymous_token));

-- One line per (owner, product, variant) — an option-less item's variant_id
-- is null, coalesced to a sentinel so two option-less adds of the same
-- product merge instead of stacking separate rows (nullable columns are
-- never equal to each other in a plain unique constraint).
create unique index cart_items_unique_line on public.cart_items (
  coalesce(user_id, anonymous_token),
  product_id,
  coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- A hard-deleted variant should take its cart lines with it, not silently
-- turn them into a null-variant (looks option-less) row for the same
-- product — was ON DELETE SET NULL since STEP 08, tightened now that
-- variant_id is load-bearing for identity/price instead of just metadata.
alter table public.cart_items drop constraint if exists cart_items_variant_id_fkey;
alter table public.cart_items
  add constraint cart_items_variant_id_fkey foreign key (variant_id) references public.product_variants (id) on delete cascade;

comment on column public.cart_items.unit_price_snapshot is
  'KRW unit price (base + variant additional_price, matching STEP 18/19''s documented KRW-only variant pricing) captured at add-to-cart time, for "price changed since you added this" comparisons only — never trusted for an actual order total, which must re-read current price.';

-- ---------------------------------------------------------------------------
-- cart_find_id — read-only owner resolution: an authenticated caller's own
-- cart_items rows, or an anonymous caller's rows for the given cart_token
-- cookie value. Returns void/no rows rather than creating anything, so a
-- page view alone never creates empty cart state.
-- ---------------------------------------------------------------------------
create or replace function public.cart_owner_key(p_anonymous_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is not null then
    return v_user_id;
  end if;
  return p_anonymous_token;
end;
$$;

create or replace function public.cart_get_items(p_anonymous_token uuid)
returns setof public.cart_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := public.cart_owner_key(p_anonymous_token);
begin
  if v_owner is null then
    return;
  end if;
  return query
    select * from public.cart_items
    where coalesce(user_id, anonymous_token) = v_owner
    order by created_at asc;
end;
$$;

grant execute on function public.cart_get_items to anon, authenticated;

-- ---------------------------------------------------------------------------
-- cart_add_item — the only way a row is ever inserted into cart_items.
-- Re-validates everything server-side per spec section 10: product must
-- exist and be active, a variant (if given) must actually belong to that
-- product and be active, stock/price are read fresh from the DB, never
-- accepted from the caller. Same (owner, product, variant) merges quantity
-- (capped at current stock) instead of stacking a duplicate row.
-- ---------------------------------------------------------------------------
create or replace function public.cart_add_item(
  p_anonymous_token uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity integer
)
returns public.cart_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner uuid;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_stock integer; -- null means "not stock-tracked" (no cap)
  v_unit_price numeric(12, 2);
  v_existing_id uuid;
  v_existing_qty integer;
  v_next_qty integer;
  v_row public.cart_items;
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception 'quantity must be at least 1';
  end if;

  select * into v_product from public.products where id = p_product_id;
  if v_product.id is null or not v_product.is_active then
    raise exception 'product not available';
  end if;

  select sale_price into v_unit_price
  from public.product_prices
  where product_id = p_product_id and market_code = 'KR';
  v_unit_price := coalesce(v_unit_price, 0);

  if p_variant_id is not null then
    select * into v_variant from public.product_variants where id = p_variant_id;
    if v_variant.id is null or v_variant.product_id <> p_product_id then
      raise exception 'variant does not belong to product';
    end if;
    if not v_variant.is_active then
      raise exception 'variant not active';
    end if;
    v_stock := v_variant.stock_quantity;
    v_unit_price := v_unit_price + v_variant.additional_price;
  else
    v_stock := case when v_product.stock_type = 'TRACKED' then v_product.stock_quantity else null end;
  end if;

  if v_stock is not null and v_stock <= 0 then
    raise exception 'out of stock';
  end if;

  if v_user_id is not null then
    v_owner := v_user_id;
  else
    if p_anonymous_token is null then
      raise exception 'cart identity required';
    end if;
    v_owner := p_anonymous_token;
  end if;

  select id, quantity into v_existing_id, v_existing_qty
  from public.cart_items
  where coalesce(user_id, anonymous_token) = v_owner
    and product_id = p_product_id
    and coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_variant_id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_existing_id is not null then
    v_next_qty := v_existing_qty + p_quantity;
    if v_stock is not null then
      v_next_qty := least(v_next_qty, greatest(v_stock, 1));
    end if;
    update public.cart_items
    set quantity = v_next_qty, unit_price_snapshot = v_unit_price, updated_at = now()
    where id = v_existing_id
    returning * into v_row;
  else
    v_next_qty := p_quantity;
    if v_stock is not null then
      v_next_qty := least(v_next_qty, greatest(v_stock, 1));
    end if;
    insert into public.cart_items (user_id, anonymous_token, product_id, variant_id, quantity, unit_price_snapshot)
    values (v_user_id, case when v_user_id is null then p_anonymous_token else null end, p_product_id, p_variant_id, v_next_qty, v_unit_price)
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

grant execute on function public.cart_add_item to anon, authenticated;

-- ---------------------------------------------------------------------------
-- cart_set_quantity — re-caps at current stock every time, and the
-- `coalesce(user_id, anonymous_token) = v_owner` match is the ownership
-- check: a caller can only ever touch a row that already belongs to their
-- own resolved identity, so a guessed cart_item id from someone else's
-- cart matches nothing and quietly raises "not found".
-- ---------------------------------------------------------------------------
create or replace function public.cart_set_quantity(
  p_anonymous_token uuid,
  p_cart_item_id uuid,
  p_quantity integer
)
returns public.cart_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := public.cart_owner_key(p_anonymous_token);
  v_item public.cart_items%rowtype;
  v_stock integer;
  v_clamped integer;
  v_row public.cart_items;
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception 'quantity must be at least 1';
  end if;
  if v_owner is null then
    raise exception 'cart item not found';
  end if;

  select * into v_item
  from public.cart_items
  where id = p_cart_item_id and coalesce(user_id, anonymous_token) = v_owner;

  if v_item.id is null then
    raise exception 'cart item not found';
  end if;

  if v_item.variant_id is not null then
    select stock_quantity into v_stock from public.product_variants where id = v_item.variant_id;
  else
    select case when stock_type = 'TRACKED' then stock_quantity else null end into v_stock
    from public.products where id = v_item.product_id;
  end if;

  v_clamped := p_quantity;
  if v_stock is not null then
    v_clamped := least(v_clamped, greatest(v_stock, 1));
  end if;

  update public.cart_items set quantity = v_clamped, updated_at = now()
  where id = p_cart_item_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.cart_set_quantity to anon, authenticated;

create or replace function public.cart_remove_item(p_anonymous_token uuid, p_cart_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := public.cart_owner_key(p_anonymous_token);
begin
  if v_owner is null then
    return;
  end if;
  delete from public.cart_items
  where id = p_cart_item_id and coalesce(user_id, anonymous_token) = v_owner;
end;
$$;

grant execute on function public.cart_remove_item to anon, authenticated;

-- ---------------------------------------------------------------------------
-- cart_merge_guest_into_user — called once right after sign-in (spec
-- section 7). Same (product, variant) sums quantity, capped at current
-- stock; a line whose product/variant no longer exists or is inactive is
-- dropped rather than failing the whole merge (matches the STEP 08
-- merge_guest_cart's own precedent). The guest cart's rows/token are
-- deleted once merged so it can never be merged twice or read again.
-- ---------------------------------------------------------------------------
create or replace function public.cart_merge_guest_into_user(p_anonymous_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.cart_items%rowtype;
  v_stock integer;
  v_product_active boolean;
  v_existing_id uuid;
  v_existing_qty integer;
  v_next_qty integer;
begin
  if v_user_id is null then
    raise exception 'cart_merge_guest_into_user requires an authenticated caller';
  end if;
  if p_anonymous_token is null then
    return;
  end if;

  for v_item in select * from public.cart_items where anonymous_token = p_anonymous_token
  loop
    select is_active into v_product_active from public.products where id = v_item.product_id;
    if v_product_active is null or not v_product_active then
      continue;
    end if;

    if v_item.variant_id is not null then
      select stock_quantity into v_stock
      from public.product_variants
      where id = v_item.variant_id and product_id = v_item.product_id and is_active = true;
      if not found then
        continue;
      end if;
    else
      select case when stock_type = 'TRACKED' then stock_quantity else null end into v_stock
      from public.products where id = v_item.product_id;
    end if;

    select id, quantity into v_existing_id, v_existing_qty
    from public.cart_items
    where user_id = v_user_id
      and product_id = v_item.product_id
      and coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_item.variant_id, '00000000-0000-0000-0000-000000000000'::uuid);

    if v_existing_id is not null then
      v_next_qty := v_existing_qty + v_item.quantity;
      if v_stock is not null then
        v_next_qty := least(v_next_qty, greatest(v_stock, 1));
      end if;
      update public.cart_items set quantity = v_next_qty, updated_at = now() where id = v_existing_id;
    else
      v_next_qty := v_item.quantity;
      if v_stock is not null then
        v_next_qty := least(v_next_qty, greatest(v_stock, 1));
      end if;
      insert into public.cart_items (user_id, product_id, variant_id, quantity, unit_price_snapshot)
      values (v_user_id, v_item.product_id, v_item.variant_id, v_next_qty, v_item.unit_price_snapshot);
    end if;
  end loop;

  delete from public.cart_items where anonymous_token = p_anonymous_token;
end;
$$;

grant execute on function public.cart_merge_guest_into_user to authenticated;
