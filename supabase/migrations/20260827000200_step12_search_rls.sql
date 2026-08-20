-- STEP 12: RLS for search_keywords/search_events/search_click_events. Same
-- posture as every other STEP 08~11 table.

alter table public.search_keywords enable row level security;

create policy search_keywords_public_read on public.search_keywords for select using (is_active = true);
create policy search_keywords_admin_read_all on public.search_keywords for select using (public.is_admin());
create policy search_keywords_admin_write on public.search_keywords for insert with check (public.is_admin());
create policy search_keywords_admin_update on public.search_keywords for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- search_events — anyone (including anon) can log their own search, but
-- never on behalf of another member: the WITH CHECK only allows user_id to
-- be null (guest) or exactly auth.uid(). No SELECT for customers — search
-- history in aggregate is an admin/analytics concern, not something a
-- browser session should be able to enumerate.
-- ---------------------------------------------------------------------------
alter table public.search_events enable row level security;

create policy search_events_insert_own on public.search_events for insert with check (
  user_id is null or user_id = auth.uid()
);
create policy search_events_admin_read_all on public.search_events for select using (public.is_admin());

-- search_click_events carries no user identity of its own (only a
-- search_event_id + product_id) so any caller may log a click; only admins
-- can read the aggregate.
alter table public.search_click_events enable row level security;

create policy search_click_events_insert on public.search_click_events for insert with check (true);
create policy search_click_events_admin_read_all on public.search_click_events for select using (public.is_admin());
