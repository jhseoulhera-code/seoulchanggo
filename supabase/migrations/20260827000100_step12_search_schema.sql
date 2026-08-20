-- STEP 12: search infrastructure. Purely additive — no STEP 01~11 table,
-- column, or migration is edited.

-- ---------------------------------------------------------------------------
-- Partial-match text search (STEP 12 spec section 4). ILIKE '%term%' already
-- works without this, but pg_trgm + GIN lets it use an index instead of a
-- full table scan as the catalog grows — appropriately scoped for this
-- project's size, not a full search-engine migration.
-- ---------------------------------------------------------------------------
create extension if not exists pg_trgm;

create index products_name_ko_trgm_idx on public.products using gin (name_ko gin_trgm_ops);
create index products_name_en_trgm_idx on public.products using gin (name_en gin_trgm_ops);
create index products_brand_trgm_idx on public.products using gin (brand gin_trgm_ops);
create index products_sku_trgm_idx on public.products using gin (sku gin_trgm_ops);

-- Supports the 인기순/최신순 sort modes (STEP 12 spec sections 13-14) without
-- a full scan; is_active is the query's other near-universal filter.
create index products_active_review_count_idx on public.products (is_active, review_count desc);
create index products_active_created_at_idx on public.products (is_active, created_at desc);

-- ---------------------------------------------------------------------------
-- sync_product_review_stats — keeps products.rating/review_count (STEP 08
-- columns, seeded once and never touched since) honest against the real
-- reviews table (STEP 10). Without this, "인기순" sort would rank products
-- by a stale seed number — exactly the kind of fake-looking metric this
-- step's spec (section 14) rules out. Purely additive: reviews' own
-- STEP 10 triggers are untouched, this is a new trigger alongside them.
-- ---------------------------------------------------------------------------
create or replace function public.sync_product_review_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid := coalesce(new.product_id, old.product_id);
  v_count integer;
  v_avg numeric;
begin
  select count(*), avg(rating) into v_count, v_avg
  from public.reviews
  where product_id = v_product_id and status = 'PUBLISHED';

  update public.products
  set review_count = coalesce(v_count, 0), rating = coalesce(round(v_avg, 2), 0)
  where id = v_product_id;

  return coalesce(new, old);
end;
$$;

create trigger reviews_sync_product_stats_insert
  after insert on public.reviews
  for each row execute function public.sync_product_review_stats();

create trigger reviews_sync_product_stats_update
  after update of status, rating on public.reviews
  for each row execute function public.sync_product_review_stats();

create trigger reviews_sync_product_stats_delete
  after delete on public.reviews
  for each row execute function public.sync_product_review_stats();

-- ---------------------------------------------------------------------------
-- search_keywords — operator-curated 인기/추천 검색어 (STEP 12 spec section
-- 9): never a fabricated "real-time popularity" ranking, just an
-- admin-managed list, honestly labeled as such in the UI.
-- ---------------------------------------------------------------------------
create type public.search_keyword_type_enum as enum ('POPULAR', 'RECOMMENDED');

create table public.search_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  type public.search_keyword_type_enum not null,
  market_code public.market_code_enum,
  locale public.locale_code_enum,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index search_keywords_active_idx on public.search_keywords (type, market_code, locale, is_active, sort_order);

create trigger set_updated_at before update on public.search_keywords
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- search_events / search_click_events — minimal analytics ledger (STEP 12
-- spec sections 18-19). No IP address, no free-text beyond the query itself.
-- ---------------------------------------------------------------------------
create table public.search_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  session_id text,
  query text not null,
  normalized_query text not null,
  market_code public.market_code_enum not null,
  locale public.locale_code_enum not null,
  result_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index search_events_created_idx on public.search_events (created_at desc);
create index search_events_normalized_query_idx on public.search_events (normalized_query);

create table public.search_click_events (
  id uuid primary key default gen_random_uuid(),
  search_event_id uuid not null references public.search_events (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  "position" integer not null,
  created_at timestamptz not null default now()
);

create index search_click_events_search_event_idx on public.search_click_events (search_event_id);
