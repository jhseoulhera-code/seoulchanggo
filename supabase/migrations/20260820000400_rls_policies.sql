-- STEP 08: Row Level Security. Every app table is covered; anon/authenticated
-- get only the narrow access the app actually needs, nothing is left open.

-- ---------------------------------------------------------------------------
-- profiles — a user can read/update only their own row. No insert/delete
-- policy: rows are created exclusively by the handle_new_user trigger
-- (SECURITY DEFINER, bypasses RLS) and never deleted by app code.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- categories / products / product_prices / product_shipping_markets /
-- product_images / product_variants — public read of active/visible rows
-- only. No client role gets insert/update/delete; catalog changes go through
-- the service-role key from trusted server code (there is no admin UI yet).
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;

create policy categories_public_read on public.categories
  for select using (is_visible = true);

alter table public.products enable row level security;

create policy products_public_read on public.products
  for select using (is_active = true);

alter table public.product_prices enable row level security;

create policy product_prices_public_read on public.product_prices
  for select using (
    is_active = true
    and exists (
      select 1 from public.products p
      where p.id = product_prices.product_id and p.is_active = true
    )
  );

alter table public.product_shipping_markets enable row level security;

create policy product_shipping_markets_public_read on public.product_shipping_markets
  for select using (
    exists (
      select 1 from public.products p
      where p.id = product_shipping_markets.product_id and p.is_active = true
    )
  );

alter table public.product_images enable row level security;

create policy product_images_public_read on public.product_images
  for select using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.is_active = true
    )
  );

alter table public.product_variants enable row level security;

create policy product_variants_public_read on public.product_variants
  for select using (
    is_active = true
    and exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.is_active = true
    )
  );

-- ---------------------------------------------------------------------------
-- cart_items — a user can only ever touch rows where user_id = auth.uid().
-- Guests never reach this table at all (see contexts/CartContext.tsx).
-- ---------------------------------------------------------------------------
alter table public.cart_items enable row level security;

create policy cart_items_select_own on public.cart_items
  for select using (auth.uid() = user_id);

create policy cart_items_insert_own on public.cart_items
  for insert with check (auth.uid() = user_id);

create policy cart_items_update_own on public.cart_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy cart_items_delete_own on public.cart_items
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- orders — a logged-in member can read only their own orders. Deliberately
-- NO insert policy for anon/authenticated: every order (member or guest) is
-- created through the public.create_order() SECURITY DEFINER RPC, which
-- validates the caller before writing (see 20260820000500_create_order_rpc.sql).
-- This is what "anon에게 orders 전체 select 허용하지 않는다" and "guest
-- 주문을 브라우저 anon client에서 무제한 insert 하게 만들지 않는다" require.
-- Guest order lookup (by order number + email/phone) goes through a
-- separate SECURITY DEFINER RPC, not a broad select policy — see STEP 08 report.
-- ---------------------------------------------------------------------------
alter table public.orders enable row level security;

create policy orders_select_own on public.orders
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- order_items / shipping_groups / shipping_group_items — readable only
-- through a currently-owned order; no direct write policy for any client role.
-- ---------------------------------------------------------------------------
alter table public.order_items enable row level security;

create policy order_items_select_own on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

alter table public.shipping_groups enable row level security;

create policy shipping_groups_select_own on public.shipping_groups
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = shipping_groups.order_id and o.user_id = auth.uid()
    )
  );

alter table public.shipping_group_items enable row level security;

create policy shipping_group_items_select_own on public.shipping_group_items
  for select using (
    exists (
      select 1 from public.shipping_groups sg
      join public.orders o on o.id = sg.order_id
      where sg.id = shipping_group_items.shipping_group_id and o.user_id = auth.uid()
    )
  );
