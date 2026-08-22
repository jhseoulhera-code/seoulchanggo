-- One-off, manual script — NOT a migration, run this exactly once per
-- environment after signing up one real account through the app, to make
-- that account the environment's first ADMIN.
--
-- Requires supabase/migrations/20260903000100_step15_5_admin_bootstrap_exception.sql
-- to be applied first: that migration lets prevent_role_self_escalation()
-- allow exactly one role change with no existing admin, so this plain
-- UPDATE works as-is — no need to disable any trigger by hand. Once this
-- runs once, an admin exists and the exception can never fire again for
-- any future account.
--
-- Usage: replace <YOUR_USER_UUID> below with the UUID of the account you
-- signed up with (Supabase Dashboard -> Authentication -> Users), then run
-- this whole file in the SQL Editor (or `psql ... -f` from your machine).

update public.profiles
set role = 'ADMIN'
where id = '<YOUR_USER_UUID>';

-- Sanity check — should return exactly the one row you just promoted.
select id, email, role from public.profiles where role in ('ADMIN', 'SUPER_ADMIN');
