-- STEP 10: schema for coupons, points, banners, promotions, reviews,
-- product inquiries, notices, and FAQs. Purely additive — no existing
-- STEP 01~09 table/column/migration is edited.

create type public.coupon_discount_type_enum as enum ('FIXED', 'PERCENT');
create type public.point_transaction_type_enum as enum ('EARN', 'USE', 'CANCEL_EARN', 'REFUND', 'ADMIN_ADJUST');
create type public.review_status_enum as enum ('PUBLISHED', 'HIDDEN', 'REPORTED');
create type public.inquiry_status_enum as enum ('PENDING', 'ANSWERED', 'HIDDEN');

-- ---------------------------------------------------------------------------
-- coupons — market_code null means "all markets". A FIXED coupon only makes
-- sense in one currency, so it must name a market; PERCENT coupons may be
-- market-specific or global (STEP 10 spec section 3).
-- ---------------------------------------------------------------------------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  discount_type public.coupon_discount_type_enum not null,
  discount_value numeric not null check (discount_value > 0),
  minimum_order_amount numeric not null default 0 check (minimum_order_amount >= 0),
  maximum_discount_amount numeric check (maximum_discount_amount is null or maximum_discount_amount > 0),
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  per_user_limit integer not null default 1 check (per_user_limit > 0),
  market_code public.market_code_enum,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_fixed_requires_market check (discount_type <> 'FIXED' or market_code is not null),
  constraint coupons_percent_max_100 check (discount_type <> 'PERCENT' or discount_value <= 100),
  constraint coupons_valid_range check (valid_until > valid_from)
);

create index coupons_active_dates_idx on public.coupons (is_active, valid_from, valid_until);

-- Applies-to scope: no rows in either table below means "all products".
create table public.coupon_products (
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  primary key (coupon_id, product_id)
);

create table public.coupon_categories (
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (coupon_id, category_id)
);

-- Written only by the create_order RPC (STEP 10 000300 migration) — no direct
-- client insert policy exists, so usage counts can't be forged client-side.
create table public.coupon_usages (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  order_id uuid not null references public.orders (id) on delete cascade,
  used_at timestamptz not null default now()
);

create index coupon_usages_coupon_idx on public.coupon_usages (coupon_id);
create index coupon_usages_user_idx on public.coupon_usages (user_id);

-- ---------------------------------------------------------------------------
-- point_transactions — an append-only ledger (STEP 10 spec section 6): the
-- balance is always sum(amount), never a mutable counter, so it can't drift
-- out of sync with its own history. balance_after is a read convenience
-- snapshot computed server-side at insert time, never trusted from a client.
-- ---------------------------------------------------------------------------
create table public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.point_transaction_type_enum not null,
  amount integer not null,
  balance_after integer not null,
  reason text not null,
  order_id uuid references public.orders (id) on delete set null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index point_transactions_user_idx on public.point_transactions (user_id, created_at desc);

-- Points/coupon policy knobs that don't need a migration to change later
-- (STEP 10 spec section 7) — no admin UI to edit this table yet, but the
-- shape is ready for one.
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value) values
  ('points.earn_rate', '0.01'),
  ('points.min_use', '1000'),
  ('points.max_use_ratio', '0.5');

-- ---------------------------------------------------------------------------
-- banners — HOME hero. mobile_image_url falls back to image_url when null.
-- ---------------------------------------------------------------------------
create table public.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_url text not null,
  mobile_image_url text,
  link_url text,
  market_code public.market_code_enum,
  locale public.locale_code_enum,
  sort_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index banners_active_idx on public.banners (is_active, market_code, locale, sort_order);

-- ---------------------------------------------------------------------------
-- promotions
-- ---------------------------------------------------------------------------
create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_ko text not null,
  title_en text not null,
  description_ko text,
  description_en text,
  image_url text,
  market_code public.market_code_enum,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index promotions_active_idx on public.promotions (is_active, market_code);

create table public.promotion_products (
  promotion_id uuid not null references public.promotions (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (promotion_id, product_id)
);

-- ---------------------------------------------------------------------------
-- reviews — one review per purchased order_item at most (partial unique
-- index below), so a member can't review the same purchase twice. Written
-- through the create_review RPC (000300 migration), which enforces the
-- purchase/delivery gate server-side.
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  order_item_id uuid references public.order_items (id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  content text not null,
  option_snapshot jsonb not null default '{}'::jsonb,
  status public.review_status_enum not null default 'PUBLISHED',
  helpful_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index reviews_one_per_order_item_idx on public.reviews (order_item_id) where order_item_id is not null;
create index reviews_product_status_idx on public.reviews (product_id, status);

create table public.review_images (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0
);

create table public.review_helpful_votes (
  review_id uuid not null references public.reviews (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

-- ---------------------------------------------------------------------------
-- product_inquiries
-- ---------------------------------------------------------------------------
create table public.product_inquiries (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  author_name text not null,
  question text not null,
  status public.inquiry_status_enum not null default 'PENDING',
  answer text,
  answered_by uuid references public.profiles (id),
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create index product_inquiries_product_idx on public.product_inquiries (product_id, status);

-- ---------------------------------------------------------------------------
-- notices / faqs
-- ---------------------------------------------------------------------------
create table public.notices (
  id uuid primary key default gen_random_uuid(),
  title_ko text not null,
  title_en text not null,
  content_ko text not null,
  content_en text not null,
  is_pinned boolean not null default false,
  is_active boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notices_active_idx on public.notices (is_active, is_pinned, published_at desc);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  question_ko text not null,
  question_en text not null,
  answer_ko text not null,
  answer_en text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index faqs_active_idx on public.faqs (is_active, category, sort_order);

-- ---------------------------------------------------------------------------
-- orders — additive coupon/point columns. discount_amount (existing, STEP 08)
-- keeps meaning "sum of per-item markdown" (sale vs. original price); the
-- columns below are the separate coupon/point deductions applied on top, so
-- neither STEP 08's meaning nor any existing reader of discount_amount changes.
-- ---------------------------------------------------------------------------
alter table public.orders
  add column coupon_id uuid references public.coupons (id) on delete set null,
  add column coupon_discount_amount numeric not null default 0,
  add column points_used integer not null default 0,
  add column points_discount_amount numeric not null default 0;

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuses public.set_updated_at from STEP 08)
-- ---------------------------------------------------------------------------
create trigger set_updated_at before update on public.coupons
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.banners
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.promotions
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.notices
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.faqs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- review_helpful_votes maintains reviews.helpful_count itself, so the count
-- can never drift from the actual vote rows and no client ever writes it
-- directly (STEP 10 spec section 20).
-- ---------------------------------------------------------------------------
create or replace function public.handle_review_helpful_vote_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.reviews set helpful_count = helpful_count + 1 where id = new.review_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.reviews set helpful_count = greatest(0, helpful_count - 1) where id = old.review_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger review_helpful_vote_insert after insert on public.review_helpful_votes
  for each row execute function public.handle_review_helpful_vote_change();
create trigger review_helpful_vote_delete after delete on public.review_helpful_votes
  for each row execute function public.handle_review_helpful_vote_change();
