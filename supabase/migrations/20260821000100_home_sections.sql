-- STEP 08.5: HOME section curation (spec item 8).
-- Replaces the STEP 08 stopgap (deriving BEST/DOMESTIC/OVERSEAS/DISCOUNT by a
-- fixed rule — review_count desc, shipping_type, discount_rate desc) with an
-- explicit merchandising relation, so HOME can show a genuinely hand-picked
-- set of products again, matching data/products.ts's original curated arrays
-- once seeded. A boolean-per-section column on products was considered and
-- rejected: it doesn't scale past four sections and can't express ordering
-- within a section, whereas this join table does both and extends to a new
-- section without a schema change.

create table public.home_sections (
  id uuid primary key default gen_random_uuid(),
  section_key text not null unique, -- 'BEST' | 'DOMESTIC_FEATURED' | 'OVERSEAS_FEATURED' | 'DISCOUNT_FEATURED'
  title_ko text not null,
  title_en text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.home_section_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.home_sections (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (section_id, product_id)
);

create index home_section_items_section_id_idx on public.home_section_items (section_id);
create index home_section_items_product_id_idx on public.home_section_items (product_id);

create trigger set_updated_at before update on public.home_sections
  for each row execute function public.set_updated_at();

-- Public read of active sections/items only; no client role can curate — that's
-- an admin capability the STEP 08 spec explicitly defers (no admin UI yet).
alter table public.home_sections enable row level security;

create policy home_sections_public_read on public.home_sections
  for select using (is_active = true);

alter table public.home_section_items enable row level security;

create policy home_section_items_public_read on public.home_section_items
  for select using (
    exists (
      select 1 from public.home_sections hs
      where hs.id = home_section_items.section_id and hs.is_active = true
    )
  );

insert into public.home_sections (section_key, title_ko, title_en, sort_order) values
  ('BEST', '베스트 상품', 'Best Products', 0),
  ('DOMESTIC_FEATURED', '빠른 국내배송', 'Fast Domestic Shipping', 1),
  ('OVERSEAS_FEATURED', '해외 인기상품', 'Popular Overseas Picks', 2),
  ('DISCOUNT_FEATURED', '할인상품', 'On Sale', 3);
