-- Disable autoconfirm email trigger in production
-- This migration safely removes the `on_auth_user_autoconfirm` trigger
-- created in the unified reset schema, avoiding automatic email confirmation
-- outside of development environments.

begin;

-- Drop the autoconfirm trigger if present
do $$
begin
  if exists(select 1 from pg_trigger where tgname = 'on_auth_user_autoconfirm') then
    execute 'drop trigger on_auth_user_autoconfirm on auth.users';
  end if;
exception when others then null; end $$;

commit;