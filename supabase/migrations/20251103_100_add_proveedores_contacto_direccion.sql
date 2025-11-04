-- Añade columnas faltantes en proveedores para alinear con el frontend
begin;

alter table public.proveedores
  add column if not exists contacto text,
  add column if not exists direccion text;

commit;