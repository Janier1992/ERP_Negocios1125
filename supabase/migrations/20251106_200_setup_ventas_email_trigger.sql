-- Configura envío de confirmación de ventas desde la BD usando pg_net y pg_cron
begin;

-- Extensiones requeridas
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Cola de trabajos de correo
create table if not exists public.email_jobs (
  id bigserial primary key,
  venta_id uuid not null,
  created_at timestamptz not null default now(),
  attempts int not null default 0,
  last_error text null,
  processed_at timestamptz null
);

-- Procesar trabajos pendientes: construye payload de la venta y llama a la Edge Function
create or replace function public.process_pending_email_jobs() returns void as $$
declare
  j record;
  payload jsonb;
  http_res jsonb;
  url text := 'https://gsvthjtputwjqqkgwmeo.functions.supabase.co/send-sale-confirmation';
begin
  for j in
    select *
    from public.email_jobs
    where processed_at is null
      and attempts < 5
      and now() - created_at > interval '10 seconds'
  loop
    begin
      -- Construir payload con cabecera y detalle
      select jsonb_build_object(
        'to', v.cliente_email,
        'clienteNombre', coalesce(v.cliente, 'Cliente'),
        'direccion', v.cliente_direccion,
        'ventaId', v.id::text,
        'empresaId', v.empresa_id::text,
        'total', v.total,
        'metodoPago', v.metodo_pago,
        'items', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'nombre', coalesce(p.nombre, d.producto_id::text),
                'cantidad', d.cantidad,
                'precio', d.precio_unitario
              )
            )
            from public.ventas_detalle d
            left join public.productos p on p.id = d.producto_id
            where d.venta_id = v.id
          ), '[]'::jsonb
        )
      ) into payload
      from public.ventas v
      where v.id = j.venta_id;

      -- Validación mínima de correo
      if (payload->>'to') is null or (payload->>'to') = '' then
        update public.email_jobs set attempts = attempts + 1, last_error = 'Venta sin correo' where id = j.id;
        continue;
      end if;

      -- Llamar Edge Function (sin Authorization; función maneja credenciales internas)
      select net.http_post(
        url := url,
        headers := jsonb_build_object('content-type','application/json'),
        body := jsonb_build_object('message', payload)
      ) into http_res;

      if coalesce((http_res->>'status')::int, 0) = 200 then
        update public.ventas set confirmacion_enviada_at = now() where id = j.venta_id;
        update public.email_jobs set processed_at = now() where id = j.id;
      else
        update public.email_jobs set attempts = attempts + 1, last_error = http_res->>'error' where id = j.id;
      end if;
    exception when others then
      update public.email_jobs set attempts = attempts + 1, last_error = SQLERRM where id = j.id;
    end;
  end loop;
end;
$$ language plpgsql security definer;

-- Planificador: cada minuto
select cron.schedule('ventas_email_jobs_process', '* * * * *', $$select public.process_pending_email_jobs();$$);

-- Trigger para encolar tras insertar venta
create or replace function public.enqueue_email_job() returns trigger as $$
begin
  insert into public.email_jobs(venta_id) values (new.id);
  return new;
end;
$$ language plpgsql;

drop trigger if exists ventas_email_enqueue on public.ventas;
create trigger ventas_email_enqueue
after insert on public.ventas
for each row execute procedure public.enqueue_email_job();

commit;