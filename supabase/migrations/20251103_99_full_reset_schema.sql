-- Full reset schema for ERP app
-- Consolidates tables, functions, RLS, and triggers expected by the frontend
-- Safe to run on a clean database; drops existing objects if present

begin;

-- Extensions
create extension if not exists pgcrypto;

-- Utility: drop if exists helper
-- Drop functions that may exist
do $$
declare
begin
  -- Triggers on auth.users
  if exists(select 1 from pg_trigger where tgname = 'on_auth_user_created') then
    drop trigger on_auth_user_created on auth.users;
  end if;
  if exists(select 1 from pg_trigger where tgname = 'on_auth_user_autoconfirm') then
    drop trigger on_auth_user_autoconfirm on auth.users;
  end if;
exception when others then null; end $$;

-- Drop tables if they exist (order respects FKs loosely)
drop table if exists public.role_permissions cascade;
drop table if exists public.permissions cascade;
drop table if exists public.user_roles cascade;
drop table if exists public.roles cascade;
drop table if exists public.invitaciones cascade;
drop table if exists public.auditoria cascade;
drop table if exists public.ventas_detalle cascade;
drop table if exists public.ventas cascade;
drop table if exists public.compras_detalle cascade;
drop table if exists public.compras cascade;
drop table if exists public.cuentas_por_pagar cascade;
drop table if exists public.productos cascade;
drop table if exists public.categorias cascade;
drop table if exists public.proveedores cascade;
drop table if exists public.clientes cascade;
drop table if exists public.alertas cascade;
drop table if exists public.empresas cascade;
drop table if exists public.profiles cascade;

-- Types
do $$ begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin','empleado','viewer');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'tipo_alerta') then
    create type public.tipo_alerta as enum ('stock_bajo','pago_vencido','general');
  end if;
end $$;

-- Core entities
create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  username text unique,
  empresa_id uuid references public.empresas(id) on delete set null,
  rol public.app_role,
  nombre_empresa text not null default 'Mi Empresa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  key text primary key,
  description text,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  key text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (empresa_id, key)
);

create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  role text not null,
  permission_key text not null,
  created_at timestamptz not null default now(),
  unique (empresa_id, role, permission_key)
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null references public.roles(key),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.auditoria (
  id bigserial primary key,
  mensaje text not null,
  detalle jsonb,
  created_at timestamptz not null default now()
);

create table public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  invited_email text not null,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  rol public.app_role not null default 'empleado',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Business entities
create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  created_at timestamptz not null default now(),
  unique (empresa_id, nombre)
);

create table public.proveedores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  email text,
  telefono text,
  created_at timestamptz not null default now(),
  unique (empresa_id, nombre)
);

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  codigo text,
  nombre text not null,
  descripcion text,
  precio numeric(12,2) not null default 0,
  stock integer not null default 0,
  stock_minimo integer not null default 0,
  categoria_id uuid references public.categorias(id) on delete set null,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (empresa_id, codigo)
);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  email text,
  telefono text,
  direccion text,
  created_at timestamptz not null default now(),
  unique (empresa_id, nombre)
);

create table public.ventas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  -- Cliente opcional como texto libre (para ventas rápidas)
  cliente text,
  -- Relación opcional al registro de cliente
  cliente_id uuid references public.clientes(id) on delete set null,
  -- Usuario que registra la venta
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Método de pago
  metodo_pago text not null default 'Efectivo',
  total numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.ventas_detalle (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.ventas(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete restrict,
  cantidad integer not null,
  precio_unitario numeric(12,2) not null,
  subtotal numeric(14,2) not null,
  created_at timestamptz not null default now()
);

create table public.compras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  estado text not null default 'pendiente',
  total numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.compras_detalle (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references public.compras(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete restrict,
  cantidad integer not null,
  precio_unitario numeric(12,2) not null,
  subtotal numeric(14,2) not null,
  created_at timestamptz not null default now()
);

create table public.cuentas_por_pagar (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  compra_id uuid references public.compras(id) on delete set null,
  monto numeric(14,2) not null,
  fecha_emision date not null default (now())::date,
  fecha_vencimiento date not null,
  estado text not null default 'pendiente',
  created_at timestamptz not null default now()
);

create table public.alertas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tipo public.tipo_alerta not null default 'general',
  titulo text not null,
  mensaje text,
  created_at timestamptz not null default now()
);

-- Indexes
create index on public.profiles(empresa_id);
create index on public.permissions(empresa_id);
create index on public.role_permissions(empresa_id);
create index on public.categorias(empresa_id);
create index on public.proveedores(empresa_id);
create index on public.productos(empresa_id);
create index on public.clientes(empresa_id);
create index on public.ventas(empresa_id);
create index on public.compras(empresa_id);
create index on public.cuentas_por_pagar(empresa_id);
create index on public.alertas(empresa_id);

-- Trigger helpers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger set_empresas_updated_at before update on public.empresas
for each row execute function public.set_updated_at();

create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- Utility functions
create or replace function public.get_user_empresa_id(_user_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select empresa_id from public.profiles where id = _user_id;
$$;

create or replace function public.has_permission(_user_id uuid, _permission_key text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_empresa uuid;
  v_rol text;
begin
  select empresa_id, rol::text into v_empresa, v_rol from public.profiles where id = _user_id;
  if v_empresa is null then
    return false;
  end if;
  -- Admin has all permissions by convention
  if v_rol = 'admin' then
    return true;
  end if;
  return exists (
    select 1 from public.role_permissions rp
    where rp.empresa_id = v_empresa
      and rp.role = v_rol
      and rp.permission_key = _permission_key
  );
end $$;

create or replace function public.get_user_permissions(_user_id uuid)
returns table(permission_key text) language plpgsql stable security definer set search_path = public as $$
declare
  v_empresa uuid;
  v_rol text;
begin
  select empresa_id, rol::text into v_empresa, v_rol from public.profiles where id = _user_id;
  if v_empresa is null then
    return;
  end if;
  if v_rol = 'admin' then
    -- Admin: return union of all permissions for the empresa
    return query select key from public.permissions where empresa_id = v_empresa;
  else
    return query select permission_key from public.role_permissions
      where empresa_id = v_empresa and role = v_rol;
  end if;
end $$;

create or replace function public.assign_roles(_user_id uuid, _roles text[], _replace boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if _replace then
    delete from public.user_roles where user_id = _user_id;
  end if;
  insert into public.user_roles(user_id, role)
  select _user_id, unnest(_roles)
  on conflict (user_id, role) do nothing;
end $$;

-- Bootstrap company for current user
create or replace function public.bootstrap_empresa_for_user(_nombre text default null, _descripcion text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_empresa uuid;
  v_nombre text := coalesce(_nombre, (select coalesce(nombre_empresa,'Mi Empresa') from public.profiles where id = v_user));
begin
  if v_user is null then
    raise exception 'Usuario no autenticado';
  end if;

  if exists(select 1 from public.profiles where id = v_user and empresa_id is not null) then
    return (select empresa_id from public.profiles where id = v_user);
  end if;

  insert into public.empresas(nombre, descripcion) values (v_nombre, _descripcion) returning id into v_empresa;

  update public.profiles set empresa_id = v_empresa, rol = 'admin', nombre_empresa = v_nombre where id = v_user;

  -- Seed default permissions for the empresa
  insert into public.permissions(empresa_id, key, description) values
    (v_empresa,'manage_company','Administrar empresa'),
    (v_empresa,'manage_users','Administrar usuarios'),
    (v_empresa,'view_finanzas','Ver finanzas'),
    (v_empresa,'create_ventas','Crear ventas'),
    (v_empresa,'view_inventario','Ver inventario')
  on conflict do nothing;

  -- Grant admin role with all permissions
  insert into public.role_permissions(empresa_id, role, permission_key)
  select v_empresa, 'admin', p.key from public.permissions p where p.empresa_id = v_empresa
  on conflict do nothing;

  -- Add default category
  insert into public.categorias(empresa_id, nombre) values (v_empresa, 'General') on conflict do nothing;

  -- Ensure user has global admin role key present
  insert into public.roles(key, description) values ('admin','Administrador') on conflict do nothing;
  insert into public.user_roles(user_id, role) values (v_user, 'admin') on conflict do nothing;

  return v_empresa;
end $$;

-- Invitations
create or replace function public.create_empleado_invitation_ex(_email text, _rol public.app_role default 'empleado', _expires_hours int default 72, _username text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_empresa uuid;
  v_token text := encode(gen_random_bytes(24),'hex');
begin
  if v_user is null then raise exception 'Usuario no autenticado'; end if;
  select empresa_id into v_empresa from public.profiles where id = v_user;
  if v_empresa is null then raise exception 'Usuario sin empresa'; end if;
  insert into public.invitaciones(token, invited_email, empresa_id, rol, expires_at, created_by)
  values (v_token, _email, v_empresa, _rol, now() + (_expires_hours || ' hours')::interval, v_user);
  return v_token;
end $$;

create or replace function public.accept_empleado_invitation(_token text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_inv record;
begin
  if v_user is null then raise exception 'Usuario no autenticado'; end if;
  select * into v_inv from public.invitaciones where token = _token;
  if not found then raise exception 'Invitación no encontrada'; end if;
  if v_inv.expires_at < now() then raise exception 'Invitación expirada'; end if;
  if v_inv.accepted_at is not null then raise exception 'Invitación ya aceptada'; end if;

  update public.profiles set empresa_id = v_inv.empresa_id, rol = v_inv.rol where id = v_user;
  update public.invitaciones set accepted_at = now() where id = v_inv.id;

  -- Ensure role key exists and assign it globally for convenience
  insert into public.roles(key, description) values (v_inv.rol::text, initcap(v_inv.rol::text)) on conflict do nothing;
  insert into public.user_roles(user_id, role) values (v_user, v_inv.rol::text) on conflict do nothing;
  return 'ok';
end $$;

-- Clientes frecuentes
create or replace function public.get_clientes_frecuentes(_empresa uuid, _min_compras int default 3, _dias int default 90)
returns table(cliente_id uuid, compras_count int) language sql security definer set search_path = public as $$
  select v.cliente_id, count(*)::int as compras_count
  from public.ventas v
  where v.empresa_id = _empresa
    and v.created_at >= now() - make_interval(days => _dias)
    and v.cliente_id is not null
  group by v.cliente_id
  having count(*) >= _min_compras
  order by compras_count desc;
$$;

-- Finanzas resumen
create or replace function public.get_finanzas_resumen(_empresa uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ingresos numeric(14,2);
  v_compras numeric(14,2);
  v_cxp_pendientes numeric(14,2);
  v_cxp_vencidas numeric(14,2);
begin
  select coalesce(sum(total),0) into v_ingresos from public.ventas where empresa_id = _empresa;
  select coalesce(sum(total),0) into v_compras from public.compras where empresa_id = _empresa;
  select coalesce(sum(monto),0) into v_cxp_pendientes from public.cuentas_por_pagar where empresa_id = _empresa and estado = 'pendiente';
  select coalesce(sum(monto),0) into v_cxp_vencidas from public.cuentas_por_pagar where empresa_id = _empresa and estado = 'vencida';
  return jsonb_build_object(
    'ingresos', v_ingresos,
    'compras', v_compras,
    'cxp_pendientes', v_cxp_pendientes,
    'cxp_vencidas', v_cxp_vencidas
  );
end $$;

create or replace function public.refresh_cxp_estado(_empresa uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  update public.cuentas_por_pagar
    set estado = 'vencida'
    where empresa_id = _empresa
      and estado <> 'vencida'
      and fecha_vencimiento < now()::date;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Inventario helper
create or replace function public.apply_purchase_stock(_compra_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  update public.productos p
  set stock = p.stock + cd.cantidad
  from public.compras_detalle cd
  where cd.compra_id = _compra_id and cd.producto_id = p.id;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Auth triggers: handle new user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nombre_empresa text := coalesce(new.raw_user_meta_data->>'nombre_empresa', new.raw_user_meta_data->>'business_name');
  v_full_name text := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name');
begin
  insert into public.profiles(id, email, full_name, nombre_empresa)
  values (new.id, new.email, v_full_name, coalesce(v_nombre_empresa, 'Mi Empresa'))
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Optional: auto-confirm email (for dev)
create or replace function public.autoconfirm_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update auth.users set email_confirmed_at = now() where id = new.id;
  return new;
end $$;

create trigger on_auth_user_autoconfirm
after insert on auth.users
for each row execute function public.autoconfirm_new_auth_user();

-- Propagate empresa nombre to profiles.nombre_empresa on update
create or replace function public.sync_profiles_nombre_empresa()
returns trigger language plpgsql as $$
begin
  update public.profiles set nombre_empresa = new.nombre where empresa_id = new.id;
  return new;
end $$;

create trigger empresas_nombre_sync
after update of nombre on public.empresas
for each row execute function public.sync_profiles_nombre_empresa();

-- RLS enable
alter table public.empresas enable row level security;
alter table public.profiles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.invitaciones enable row level security;
alter table public.categorias enable row level security;
alter table public.proveedores enable row level security;
alter table public.productos enable row level security;
alter table public.clientes enable row level security;
alter table public.ventas enable row level security;
alter table public.ventas_detalle enable row level security;
alter table public.compras enable row level security;
alter table public.compras_detalle enable row level security;
alter table public.cuentas_por_pagar enable row level security;
alter table public.alertas enable row level security;
alter table public.auditoria enable row level security;
alter table public.roles enable row level security;

-- RLS policies: service role bypass
create policy roles_all_for_service on public.roles as permissive for all to service_role using (true) with check (true);
create policy auditoria_all_for_service on public.auditoria as permissive for all to service_role using (true) with check (true);

-- Profiles: self read/update, service_role all
create policy profiles_select_self on public.profiles for select
  to authenticated using (id = auth.uid());
create policy profiles_update_self on public.profiles for update
  to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_all_service on public.profiles as permissive for all to service_role using (true) with check (true);

-- Empresas: only own via profile
create policy empresas_select_own on public.empresas for select to authenticated using (
  id = (select empresa_id from public.profiles where id = auth.uid())
);
create policy empresas_insert_admin on public.empresas for insert to authenticated
  with check (true);
create policy empresas_all_service on public.empresas as permissive for all to service_role using (true) with check (true);

-- Permissions and role_permissions: by empresa
create policy permissions_by_empresa on public.permissions for all to authenticated using (
  empresa_id = (select empresa_id from public.profiles where id = auth.uid())
) with check (
  empresa_id = (select empresa_id from public.profiles where id = auth.uid())
);
create policy role_permissions_by_empresa on public.role_permissions for all to authenticated using (
  empresa_id = (select empresa_id from public.profiles where id = auth.uid())
) with check (
  empresa_id = (select empresa_id from public.profiles where id = auth.uid())
);
create policy permissions_all_service on public.permissions as permissive for all to service_role using (true) with check (true);
create policy role_permissions_all_service on public.role_permissions as permissive for all to service_role using (true) with check (true);

-- user_roles read self, mutate via function
create policy user_roles_select_self on public.user_roles for select to authenticated using (
  user_id = auth.uid()
);
create policy user_roles_all_service on public.user_roles as permissive for all to service_role using (true) with check (true);

-- Invitaciones: empresa scope
create policy invitaciones_by_empresa on public.invitaciones for all to authenticated using (
  empresa_id = (select empresa_id from public.profiles where id = auth.uid())
) with check (
  empresa_id = (select empresa_id from public.profiles where id = auth.uid())
);
create policy invitaciones_all_service on public.invitaciones as permissive for all to service_role using (true) with check (true);

-- Common empresa policies for domain tables
create policy categorias_by_empresa on public.categorias for all to authenticated using (
  empresa_id = (select empresa_id from public.profiles where id = auth.uid())
) with check (
  empresa_id = (select empresa_id from public.profiles where id = auth.uid())
);
create policy proveedores_by_empresa on public.proveedores for all to authenticated using (
  empresa_id = (select empresa_id from public.profiles where id = auth.uid())
) with check (
  empresa_id = (select empresa_id from public.profiles where id = auth.uid())
);
create policy productos_by_empresa on public.productos for all to authenticated using (
  empresa_id = (select empresa_id from public.profiles where id = auth.uid())
) with check (
  empresa_id = (select empresa_id from public.profiles where id = auth.uid())
);
create policy clientes_by_empresa on public.clientes for all to authenticated using (
  empresa_id = (select empresa_id from public.profiles where id = auth.uid())
) with check (
  empresa_id = (select empresa_id from public.profiles where id = auth.uid())
);
create policy ventas_by_empresa on public.ventas for all to authenticated using (
  empresa_id = (select empresa_id from public.profiles where id = auth.uid())
) with check (
  empresa_id = (select empresa_id from public.profiles where id = auth.uid())
);
create policy ventas_detalle_by_empresa on public.ventas_detalle for all to authenticated using (
  exists (select 1 from public.ventas v where v.id = venta_id and v.empresa_id = (select empresa_id from public.profiles where id = auth.uid()))
) with check (
  exists (select 1 from public.ventas v where v.id = venta_id and v.empresa_id = (select empresa_id from public.profiles where id = auth.uid()))
);
create policy compras_by_empresa on public.compras for all to authenticated using (
  empresa_id = (select empresa_id from public.profiles where id = auth.uid())
) with check (
  empresa_id = (select empresa_id from public.profiles where id = auth.uid())
);
create policy compras_detalle_by_empresa on public.compras_detalle for all to authenticated using (
  exists (select 1 from public.compras c where c.id = compra_id and c.empresa_id = (select empresa_id from public.profiles where id = auth.uid()))
) with check (
  exists (select 1 from public.compras c where c.id = compra_id and c.empresa_id = (select empresa_id from public.profiles where id = auth.uid()))
);
create policy cxp_by_empresa on public.cuentas_por_pagar for all to authenticated using (
  empresa_id = (select empresa_id from public.profiles where id = auth.uid())
) with check (
  empresa_id = (select empresa_id from public.profiles where id = auth.uid())
);
create policy alertas_by_empresa on public.alertas for all to authenticated using (
  empresa_id = (select empresa_id from public.profiles where id = auth.uid())
) with check (
  empresa_id = (select empresa_id from public.profiles where id = auth.uid())
);

-- Service role permissive for domain tables
create policy categorias_all_service on public.categorias as permissive for all to service_role using (true) with check (true);
create policy proveedores_all_service on public.proveedores as permissive for all to service_role using (true) with check (true);
create policy productos_all_service on public.productos as permissive for all to service_role using (true) with check (true);
create policy clientes_all_service on public.clientes as permissive for all to service_role using (true) with check (true);
create policy ventas_all_service on public.ventas as permissive for all to service_role using (true) with check (true);
create policy ventas_detalle_all_service on public.ventas_detalle as permissive for all to service_role using (true) with check (true);
create policy compras_all_service on public.compras as permissive for all to service_role using (true) with check (true);
create policy compras_detalle_all_service on public.compras_detalle as permissive for all to service_role using (true) with check (true);
create policy cxp_all_service on public.cuentas_por_pagar as permissive for all to service_role using (true) with check (true);
create policy alertas_all_service on public.alertas as permissive for all to service_role using (true) with check (true);

-- Grants
grant usage on schema public to authenticated, service_role, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant all privileges on all tables in schema public to service_role;

grant execute on function public.get_user_empresa_id(uuid) to authenticated, service_role, anon;
grant execute on function public.get_user_permissions(uuid) to authenticated, service_role;
grant execute on function public.has_permission(uuid, text) to authenticated, service_role;
grant execute on function public.assign_roles(uuid, text[], boolean) to authenticated, service_role;
grant execute on function public.bootstrap_empresa_for_user(text, text) to authenticated, service_role;
grant execute on function public.create_empleado_invitation_ex(text, public.app_role, int, text) to authenticated, service_role;
grant execute on function public.accept_empleado_invitation(text) to authenticated, service_role;
grant execute on function public.get_clientes_frecuentes(uuid, int, int) to authenticated, service_role;
grant execute on function public.get_finanzas_resumen(uuid) to authenticated, service_role;
grant execute on function public.refresh_cxp_estado(uuid) to authenticated, service_role;
grant execute on function public.apply_purchase_stock(uuid) to authenticated, service_role;

commit;