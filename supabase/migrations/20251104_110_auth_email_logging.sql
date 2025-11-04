-- Auth Email Logging RPC
-- Creates a SECURITY DEFINER function to record email events into auditoria
-- Tables assumed: public.auditoria with columns (id, empresa_id, action, entity, details, actor_id, created_at)

begin;

-- Ensure auditoria table exists (no-op if already in unified schema)
create table if not exists public.auditoria (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid null,
  action text not null,
  entity text not null,
  details jsonb not null default '{}'::jsonb,
  actor_id uuid null,
  created_at timestamptz not null default now()
);

-- Function to log auth email events. SECURITY DEFINER to bypass RLS.
create or replace function public.log_auth_email_event(
  _email text,
  _type text,
  _status text,
  _message text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_empresa uuid := null;
begin
  -- Try to fetch empresa_id for actor if available
  if v_actor is not null then
    select empresa_id into v_empresa from public.profiles where id = v_actor;
  end if;

  insert into public.auditoria(empresa_id, action, entity, details, actor_id)
  values (
    v_empresa,
    'auth_email',
    'supabase.auth',
    jsonb_build_object(
      'email', _email,
      'type', _type,
      'status', _status,
      'message', coalesce(_message, '')
    ),
    v_actor
  );
exception when others then
  -- swallow errors to avoid breaking app flows
  null;
end;
$$;

comment on function public.log_auth_email_event(text, text, text, text) is 'Logs Supabase Auth email events into auditoria with SECURITY DEFINER';

commit;