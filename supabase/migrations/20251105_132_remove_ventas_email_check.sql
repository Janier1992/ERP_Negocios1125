begin;

-- Eliminar el CHECK de email en ventas para evitar bloqueos en inserciones
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'ventas_cliente_email_soft_chk'
  ) then
    alter table public.ventas drop constraint ventas_cliente_email_soft_chk;
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'ventas_cliente_email_valid_chk'
  ) then
    alter table public.ventas drop constraint ventas_cliente_email_valid_chk;
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'ventas_cliente_email_format_chk'
  ) then
    alter table public.ventas drop constraint ventas_cliente_email_format_chk;
  end if;
end $$;

-- Opcional: normalizar datos existentes
update public.ventas
set cliente_email = lower(btrim(cliente_email))
where cliente_email is not null;

-- Forzar recarga del schema cache (PostgREST)
do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then
  null;
end $$;

commit;