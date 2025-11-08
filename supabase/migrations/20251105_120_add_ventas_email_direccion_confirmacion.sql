-- Añade columnas requeridas para confirmación por correo en ventas
begin;

-- Verificar existencia de tabla ventas
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='ventas') then
    raise exception 'Tabla public.ventas no existe';
  end if;
end $$;

-- cliente_email
do $$
begin
  if not exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='ventas' and column_name='cliente_email'
  ) then
    alter table public.ventas add column cliente_email varchar(255) not null default '';
  end if;
end $$;

-- cliente_direccion
do $$
begin
  if not exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='ventas' and column_name='cliente_direccion'
  ) then
    alter table public.ventas add column cliente_direccion text not null default '';
  end if;
end $$;

-- confirmacion_enviada_at
do $$
begin
  if not exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='ventas' and column_name='confirmacion_enviada_at'
  ) then
    alter table public.ventas add column confirmacion_enviada_at timestamptz null;
  end if;
end $$;

commit;