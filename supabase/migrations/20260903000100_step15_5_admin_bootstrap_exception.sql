-- STEP 15.5: a Cloud Supabase project starts with zero admins, and
-- prevent_role_self_escalation() (20260822000100_admin_role.sql) blocks
-- *any* change to profiles.role unless the calling session already
-- resolves as admin via auth.uid() — including a SQL Editor / direct psql
-- session, which has no such session at all. That leaves no way to create
-- the very first admin without manually disabling the trigger for one
-- statement, which is easy to get wrong (forgetting to re-enable it) and
-- needs no code change to justify it — so instead this widens the trigger
-- itself with a narrow, self-closing exception: a role change is also
-- allowed when the table currently has zero ADMIN/SUPER_ADMIN rows at all.
-- The instant one admin exists, this branch can never fire again — it is
-- not a standing bypass, just a one-time bootstrap door that closes itself.
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and not public.is_admin()
     and exists (select 1 from public.profiles where role in ('ADMIN', 'SUPER_ADMIN'))
  then
    raise exception 'insufficient privilege to change role';
  end if;
  return new;
end;
$$;
