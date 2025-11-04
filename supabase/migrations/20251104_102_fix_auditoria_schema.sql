-- Fix auditoria schema to match application expectations
-- Adds empresa_id, action, entity, details, actor_id columns
-- Relaxes NOT NULL on mensaje to allow edge inserts without it

begin;

-- Ensure table exists
do $$ begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'auditoria'
  ) then
    create table public.auditoria (
      id bigserial primary key,
      empresa_id uuid references public.empresas(id) on delete set null,
      action text,
      entity text,
      details jsonb,
      actor_id uuid references auth.users(id) on delete set null,
      mensaje text,
      detalle jsonb,
      created_at timestamptz not null default now()
    );
  end if;
end $$;

-- Add missing columns if table already existed
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='auditoria' and column_name='empresa_id') then
    alter table public.auditoria add column empresa_id uuid references public.empresas(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='auditoria' and column_name='action') then
    alter table public.auditoria add column action text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='auditoria' and column_name='entity') then
    alter table public.auditoria add column entity text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='auditoria' and column_name='details') then
    alter table public.auditoria add column details jsonb;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='auditoria' and column_name='actor_id') then
    alter table public.auditoria add column actor_id uuid references auth.users(id) on delete set null;
  end if;
end $$;

-- Relax NOT NULL on mensaje if present
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='auditoria' and column_name='mensaje'
  ) then
    -- Drop NOT NULL constraint if exists
    begin
      alter table public.auditoria alter column mensaje drop not null;
    exception when others then null; end;
  end if;
end $$;

-- Ensure RLS is enabled and service_role policy exists
alter table public.auditoria enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='auditoria' and policyname='auditoria_all_for_service'
  ) then
    create policy auditoria_all_for_service on public.auditoria as permissive for all to service_role using (true) with check (true);
  end if;
end $$;

commit;