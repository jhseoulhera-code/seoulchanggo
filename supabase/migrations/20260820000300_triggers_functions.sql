-- STEP 08: shared triggers + the profile auto-creation trigger.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.product_prices
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.product_shipping_markets
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.cart_items
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.shipping_groups
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Profile auto-creation. A DB trigger (rather than app-side "server-side
-- create") is used so a profile always exists the instant an auth.users row
-- does, regardless of which client (web, future mobile, admin import) created
-- the account. SECURITY DEFINER lets it write to profiles despite the
-- caller having no direct insert grant there (see RLS policies).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, auth_provider, preferred_locale, preferred_market, marketing_opt_in)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce(upper(new.raw_user_meta_data ->> 'auth_provider'), 'EMAIL')::public.auth_provider_enum,
    coalesce(new.raw_user_meta_data ->> 'preferred_locale', 'ko')::public.locale_code_enum,
    coalesce(new.raw_user_meta_data ->> 'preferred_market', 'KR')::public.market_code_enum,
    coalesce((new.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
