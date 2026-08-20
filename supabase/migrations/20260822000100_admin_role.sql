-- STEP 09: admin role (spec section 2, "Method A" — profiles.role). A separate
-- user_roles table was considered and rejected: a user never holds more than
-- one role at a time in this app, so a join table would only add a join for
-- no benefit; a column on the existing 1:1 profiles table is the natural fit.

create type public.user_role_enum as enum ('CUSTOMER', 'ADMIN', 'SUPER_ADMIN');

alter table public.profiles add column role public.user_role_enum not null default 'CUSTOMER';

-- ---------------------------------------------------------------------------
-- is_admin() — the single helper every admin-only RLS policy and RPC checks.
-- SECURITY DEFINER so it works uniformly regardless of the caller's own RLS
-- visibility into profiles (today profiles_select_own already covers the
-- caller's own row, but this keeps the check independent of that policy).
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('ADMIN', 'SUPER_ADMIN')
  );
$$;

-- ---------------------------------------------------------------------------
-- Role changes never ride through the normal "update your own profile" path.
-- profiles_update_own (RLS) lets a user update their own row at the row
-- level, but RLS can't diff individual columns — so this trigger independently
-- blocks any change to `role` unless the CALLER already holds ADMIN/SUPER_ADMIN,
-- closing the "일반 사용자가 role을 직접 CUSTOMER→ADMIN으로 변경" path even if
-- a future code change accidentally exposes role in a client-side update call.
-- Admin UI does not expose a "make this user admin" control this step — that
-- stays a DB-console/future-SUPER_ADMIN-path action per spec section 2.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'insufficient privilege to change role';
  end if;
  return new;
end;
$$;

create trigger prevent_role_self_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

-- ---------------------------------------------------------------------------
-- Admin read-all policies — a customer's own-row policies (profiles_select_own,
-- orders_select_own, etc.) stay as-is; these add a second, independent path
-- for admin. RLS policies are OR'd together, so a normal customer is
-- unaffected and an admin gets both their own-row access and this broader one.
-- ---------------------------------------------------------------------------
create policy profiles_admin_read_all on public.profiles
  for select using (public.is_admin());

create policy orders_admin_read_all on public.orders
  for select using (public.is_admin());

create policy order_items_admin_read_all on public.order_items
  for select using (public.is_admin());

create policy shipping_groups_admin_read_all on public.shipping_groups
  for select using (public.is_admin());

create policy shipping_group_items_admin_read_all on public.shipping_group_items
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Admin write policies — catalog management. No delete policy on
-- categories/products themselves (spec section 18: soft "판매중지"/is_visible
-- toggle instead of hard delete, to protect order_items/order snapshots that
-- reference them); child tables (prices/shipping-markets/images/variants) do
-- get delete, since removing e.g. one image or one market row is routine.
-- ---------------------------------------------------------------------------
create policy categories_admin_write on public.categories
  for insert with check (public.is_admin());
create policy categories_admin_update on public.categories
  for update using (public.is_admin()) with check (public.is_admin());

create policy products_admin_write on public.products
  for insert with check (public.is_admin());
create policy products_admin_update on public.products
  for update using (public.is_admin()) with check (public.is_admin());

create policy product_prices_admin_write on public.product_prices
  for insert with check (public.is_admin());
create policy product_prices_admin_update on public.product_prices
  for update using (public.is_admin()) with check (public.is_admin());
create policy product_prices_admin_delete on public.product_prices
  for delete using (public.is_admin());

create policy product_shipping_markets_admin_write on public.product_shipping_markets
  for insert with check (public.is_admin());
create policy product_shipping_markets_admin_update on public.product_shipping_markets
  for update using (public.is_admin()) with check (public.is_admin());
create policy product_shipping_markets_admin_delete on public.product_shipping_markets
  for delete using (public.is_admin());

create policy product_images_admin_write on public.product_images
  for insert with check (public.is_admin());
create policy product_images_admin_update on public.product_images
  for update using (public.is_admin()) with check (public.is_admin());
create policy product_images_admin_delete on public.product_images
  for delete using (public.is_admin());

create policy product_variants_admin_write on public.product_variants
  for insert with check (public.is_admin());
create policy product_variants_admin_update on public.product_variants
  for update using (public.is_admin()) with check (public.is_admin());
create policy product_variants_admin_delete on public.product_variants
  for delete using (public.is_admin());

create policy home_sections_admin_write on public.home_sections
  for insert with check (public.is_admin());
create policy home_sections_admin_update on public.home_sections
  for update using (public.is_admin()) with check (public.is_admin());

create policy home_section_items_admin_write on public.home_section_items
  for insert with check (public.is_admin());
create policy home_section_items_admin_update on public.home_section_items
  for update using (public.is_admin()) with check (public.is_admin());
create policy home_section_items_admin_delete on public.home_section_items
  for delete using (public.is_admin());
