-- Añade columnas faltantes en public.alertas para alinear con el frontend
-- Safe to run multiple times gracias a IF NOT EXISTS

begin;

alter table public.alertas
  add column if not exists leida boolean not null default false;

alter table public.alertas
  add column if not exists producto_id uuid references public.productos(id) on delete set null;

-- Índice opcional para consultas por producto
create index if not exists alertas_producto_id_idx on public.alertas (producto_id);

commit;