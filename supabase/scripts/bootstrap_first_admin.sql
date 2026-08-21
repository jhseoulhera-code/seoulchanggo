-- One-off, manual script — NOT a migration, and not meant to be applied
-- automatically. Run this exactly once per environment, after signing up
-- one real account through the app, to create that environment's first
-- ADMIN. See supabase/migrations/20260822000100_admin_role.sql for why a
-- plain UPDATE won't work here: prevent_role_self_escalation blocks any
-- role change unless the calling session already resolves as admin via
-- auth.uid(), and a SQL Editor / direct psql session has no such session —
-- so the trigger has to be stepped around for this one statement only.
--
-- Usage: replace <YOUR_USER_UUID> below with the UUID of the account you
-- signed up with (Supabase Dashboard -> Authentication -> Users), then run
-- this whole file in the SQL Editor (or `psql ... -f` from your machine).

alter table public.profiles disable trigger prevent_role_self_escalation;

update public.profiles
set role = 'ADMIN'
where id = '<YOUR_USER_UUID>';

alter table public.profiles enable trigger prevent_role_self_escalation;

-- Sanity check — should return exactly the one row you just promoted.
select id, email, role from public.profiles where role in ('ADMIN', 'SUPER_ADMIN');
