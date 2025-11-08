begin;

-- 1) Eliminar constraints anteriores si existen
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'ventas_cliente_email_valid_chk') then
    alter table public.ventas drop constraint ventas_cliente_email_valid_chk;
  end if;

  if exists (select 1 from pg_constraint where conname = 'ventas_cliente_email_format_chk') then
    alter table public.ventas drop constraint ventas_cliente_email_format_chk;
  end if;
end $$;

-- 2) Eliminar la función previa si quedó en el esquema (ya no se usa)
do $$
begin
  if exists (select 1 from pg_proc where proname = 'is_valid_email') then
    drop function public.is_valid_email(text);
  end if;
end $$;

-- 3) Añadir un CHECK más tolerante:
--    - Permite NULL y '' (vacío)
--    - Requiere al menos "local@dominio.tld" sin espacios
--    - Acepta caracteres comunes y unicode en local y dominio
alter table public.ventas
  add constraint ventas_cliente_email_soft_chk
  check (
    cliente_email is null
    or btrim(cliente_email) = ''
    or (
      btrim(cliente_email) ~* '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'
      and length(btrim(cliente_email)) <= 254
    )
  );

-- 4) Saneado de datos existentes (recorta y pasa a minúsculas)
update public.ventas
set cliente_email = lower(btrim(cliente_email))
where cliente_email is not null;

-- 5) Forzar recarga del schema cache (PostgREST)
do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then
  null;
end $$;

commit;