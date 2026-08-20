-- STEP 08: core schema tables.

-- ---------------------------------------------------------------------------
-- profiles — 1:1 with auth.users, created by the handle_new_user trigger
-- (see 20260820000300_triggers_functions.sql). Never stores a password.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  auth_provider public.auth_provider_enum not null default 'EMAIL',
  preferred_locale public.locale_code_enum not null default 'ko',
  preferred_market public.market_code_enum not null default 'KR',
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per auth.users row. Populated by the on_auth_user_created trigger.';

-- ---------------------------------------------------------------------------
-- categories — self-referencing for up to N levels; level/sort_order/show_on_home
-- reproduce the current HOME ordering + "exists but not a HOME quick-icon" case
-- (스포츠/레저 in the STEP 08 spec).
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ko text not null,
  name_en text not null,
  icon_name text, -- lucide-react icon key, resolved to a component in the repository mapper
  parent_id uuid references public.categories (id) on delete set null,
  level smallint not null default 1 check (level >= 1),
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  show_on_home boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  category_id uuid not null references public.categories (id),
  slug text not null unique,
  brand text,
  name_ko text not null,
  name_en text,
  description_ko text,
  description_en text,
  origin_country text, -- OriginCountryCode (KR/CN/US/JP/IN/VN/TH/DE) — validated at the app layer
  supply_type public.supply_type_enum not null,
  shipping_type public.shipping_type_enum not null,
  default_shipping_method public.shipping_method_enum,
  stock_type public.stock_type_enum not null default 'TRACKED',
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  -- Display-only "what choices exist" metadata, e.g. [{"name":"색상","choices":["화이트","블랙"]}].
  -- Deliberately not product_variants: today's UI never prices/stocks a specific combination,
  -- so seeding fake per-combination stock there would fabricate data that doesn't exist yet.
  -- product_variants stays ready for when that's real.
  option_groups jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  rating numeric(2, 1) not null default 0 check (rating >= 0 and rating <= 5),
  review_count integer not null default 0 check (review_count >= 0),
  free_shipping boolean not null default false,
  discount_rate smallint check (discount_rate is null or (discount_rate >= 0 and discount_rate <= 100)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_id_idx on public.products (category_id);

-- ---------------------------------------------------------------------------
-- product_prices — one row per (product, market); avoids ever-growing
-- KRW/INR/USD columns on products and matches STEP 05-R's per-market override.
-- ---------------------------------------------------------------------------
create table public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  market_code public.market_code_enum not null,
  currency_code public.currency_code_enum not null,
  original_price numeric(12, 2) not null check (original_price >= 0),
  sale_price numeric(12, 2) not null check (sale_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, market_code),
  constraint product_prices_sale_le_original check (sale_price <= original_price)
);

-- ---------------------------------------------------------------------------
-- product_shipping_markets — explicit opt-in per destination market.
-- A product with no row for a market is NOT shippable there (safer default
-- than the dummy-data convention of "absent = ships everywhere"); the seed
-- data inserts one row per product per supported market to stay behavior-
-- equivalent with the current mock catalog. See STEP 08 report for detail.
-- ---------------------------------------------------------------------------
create table public.product_shipping_markets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  country_code public.market_code_enum not null,
  is_available boolean not null default true,
  shipping_fee numeric(12, 2) not null default 0 check (shipping_fee >= 0),
  estimated_min_days smallint check (estimated_min_days is null or estimated_min_days >= 0),
  estimated_max_days smallint check (estimated_max_days is null or estimated_max_days >= estimated_min_days),
  shipping_method public.shipping_method_enum,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, country_code)
);

-- ---------------------------------------------------------------------------
-- product_images
-- ---------------------------------------------------------------------------
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  image_url text not null,
  alt_ko text,
  alt_en text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index product_images_product_id_idx on public.product_images (product_id);
create unique index product_images_one_primary_per_product on public.product_images (product_id) where is_primary;

-- ---------------------------------------------------------------------------
-- product_variants — option combinations (e.g. 색상+용량); deliberately not
-- a fully generic EAV structure per the STEP 08 spec.
-- ---------------------------------------------------------------------------
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique,
  option_values jsonb not null default '{}'::jsonb, -- e.g. {"색상":"화이트","용량":"500ml"}
  additional_price numeric(12, 2) not null default 0,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, option_values)
);

create index product_variants_product_id_idx on public.product_variants (product_id);

-- ---------------------------------------------------------------------------
-- cart_items — logged-in members only; guests keep using localStorage
-- (see contexts/CartContext.tsx and the STEP 08 report for the fallback rule).
-- ---------------------------------------------------------------------------
create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete set null,
  selected_options jsonb not null default '{}'::jsonb,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id, variant_id, selected_options)
);

create index cart_items_user_id_idx on public.cart_items (user_id);

-- ---------------------------------------------------------------------------
-- orders — user_id is nullable to support guest checkout; guest orders carry
-- guest_email/guest_phone instead (see STEP 06 Order type and STEP 08 report
-- for how guest orders are currently created via the create_order RPC).
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references auth.users (id) on delete set null,
  guest_email text,
  guest_phone text,
  market_code public.market_code_enum not null,
  currency_code public.currency_code_enum not null,
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0),
  shipping_amount numeric(12, 2) not null default 0 check (shipping_amount >= 0),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  payment_method public.payment_method_enum not null,
  payment_status public.payment_status_enum not null default 'UNPAID',
  order_status public.order_status_enum not null default 'ORDER_CREATED',
  shipping_address jsonb not null,
  customs_info jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_owner_check check (user_id is not null or guest_email is not null)
);

create index orders_user_id_idx on public.orders (user_id);
create index orders_guest_email_idx on public.orders (guest_email);

-- ---------------------------------------------------------------------------
-- order_items — snapshots product/price/name at order time so later catalog
-- edits never change historical orders (see STEP 08 spec section 13).
-- ---------------------------------------------------------------------------
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_name_snapshot text not null,
  sku_snapshot text not null,
  option_snapshot jsonb not null default '{}'::jsonb,
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  original_price numeric(12, 2) not null check (original_price >= 0),
  quantity integer not null check (quantity > 0),
  shipping_type public.shipping_type_enum not null,
  origin_country text,
  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- shipping_groups — one order can split into several shipping groups
-- (domestic / overseas direct / overseas agency), each tracked separately.
-- ---------------------------------------------------------------------------
create table public.shipping_groups (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  shipping_type public.shipping_type_enum not null,
  shipping_method public.shipping_method_enum,
  origin_country text,
  destination_country public.market_code_enum not null,
  shipping_fee numeric(12, 2) not null default 0 check (shipping_fee >= 0),
  status public.shipping_group_status_enum not null default 'PREPARING',
  carrier text,
  tracking_number text,
  estimated_min_days smallint,
  estimated_max_days smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shipping_groups_order_id_idx on public.shipping_groups (order_id);

-- ---------------------------------------------------------------------------
-- shipping_group_items — join table linking order_items to their shipping_group.
-- ---------------------------------------------------------------------------
create table public.shipping_group_items (
  shipping_group_id uuid not null references public.shipping_groups (id) on delete cascade,
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  primary key (shipping_group_id, order_item_id)
);

create index shipping_group_items_order_item_id_idx on public.shipping_group_items (order_item_id);
