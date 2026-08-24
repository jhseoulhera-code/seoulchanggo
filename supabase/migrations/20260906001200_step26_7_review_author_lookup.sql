-- STEP 26.7 — customer-facing review author display_name lookup.
--
-- Finding: lib/actions/reviews.ts's getProductReviewsAction (the CUSTOMER-
-- facing path — runs under the plain anon/authenticated session client via
-- lib/supabase/server.ts, never the service-role client) does
-- `.select("*, profiles(display_name), ...")` on `reviews` — a PostgREST
-- embedded-resource query. reviews.user_id and profiles.id both reference
-- auth.users(id) independently; there is no direct foreign key from
-- reviews to profiles for PostgREST to resolve a relationship from. This is
-- the exact bug class STEP 26's real-Supabase-Cloud pass already found and
-- fixed for the ADMIN side (see 96fd7af / scripts/test-admin-profile-embed.mts):
--   "Could not embed because more than one relationship was found for
--   'reviews' and 'profiles'"
-- That fix (lib/repositories/admin/profiles.ts's fetchProfilesByIds) is
-- admin-only by construction — its own doc comment says so, because
-- profiles' RLS (20260820000400_rls_policies.sql) only grants a caller
-- read access to their OWN row (profiles_select_own) or, for an admin,
-- every row (profiles_admin_read_all, 20260822000100_admin_role.sql). A
-- regular customer session has neither for another author's row, so even if
-- the embed syntax itself didn't error, RLS would silently return
-- `profiles: null` for every review except ones the viewer themselves
-- wrote — the customer-facing reviews list was never actually fixed by
-- STEP 26's admin-side pass.
--
-- Fix: a narrow SECURITY DEFINER RPC that resolves ONLY display_name for a
-- given set of user ids — never email, never any other profiles column.
-- reviews_public_read_published (STEP 10) has no auth condition at all, so
-- published reviews (and therefore their authors' display names) are
-- already meant to be visible to anonymous visitors too — this RPC is
-- granted to anon as well as authenticated to match that existing
-- visibility, not to widen it. The caller (getProductReviewsAction) masks
-- the resolved name to "김철**"-style before it ever reaches the browser,
-- exactly as it already did — this migration only fixes the broken
-- resolution mechanism underneath, not the masking/display behavior.
create or replace function public.get_review_author_names(p_user_ids uuid[])
returns table (user_id uuid, display_name text)
language sql
security definer
set search_path = public
stable
as $$
  select id, display_name from public.profiles where id = any(p_user_ids);
$$;

grant execute on function public.get_review_author_names to anon, authenticated;
