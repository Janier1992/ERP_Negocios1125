-- Seed default roles used by the application
begin;

-- Ensure base roles exist
insert into public.roles(key, description) values
  ('admin','Administrador'),
  ('empleado','Empleado'),
  ('viewer','Visor')
on conflict (key) do nothing;

commit;