-- Delete product with cascade across ventas/compras and adjust totals
begin;

create or replace function public.delete_product_cascade(_producto_id uuid, _empresa_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_emp uuid;
  v_producto_empresa uuid;
  v_ventas_ids uuid[] := '{}';
  v_compras_ids uuid[] := '{}';
  v_detalle_ventas_borrados int := 0;
  v_detalle_compras_borrados int := 0;
  v_ventas_actualizadas int := 0;
  v_compras_actualizadas int := 0;
  v_cxp_actualizadas int := 0;
begin
  -- Empresa del usuario
  select empresa_id into v_emp from public.profiles where id = v_user;
  if v_emp is null then
    raise exception 'Usuario sin empresa asociada';
  end if;
  if _empresa_id is null then
    _empresa_id := v_emp;
  end if;
  if _empresa_id <> v_emp then
    raise exception 'Empresa inválida para el usuario';
  end if;

  -- Validar producto y empresa
  select empresa_id into v_producto_empresa from public.productos where id = _producto_id;
  if v_producto_empresa is null then
    raise exception 'Producto no encontrado';
  end if;
  if v_producto_empresa <> _empresa_id then
    raise exception 'Producto fuera del alcance de la empresa';
  end if;

  -- Capturar ventas afectadas antes del borrado
  select array_agg(distinct d.venta_id) into v_ventas_ids
  from public.ventas_detalle d
  join public.ventas v on v.id = d.venta_id
  where v.empresa_id = _empresa_id
    and d.producto_id = _producto_id;

  -- Borrar detalles de ventas
  with del as (
    delete from public.ventas_detalle d
    using public.ventas v
    where d.venta_id = v.id
      and v.empresa_id = _empresa_id
      and d.producto_id = _producto_id
    returning 1
  )
  select count(*) into v_detalle_ventas_borrados from del;

  -- Recalcular totales de ventas afectadas
  if cardinality(v_ventas_ids) > 0 then
    update public.ventas v
    set total = coalesce((select sum(subtotal)::numeric(14,2) from public.ventas_detalle d where d.venta_id = v.id), 0)
    where v.id = any(v_ventas_ids);
    get diagnostics v_ventas_actualizadas = row_count;
  end if;

  -- Capturar compras afectadas antes del borrado
  select array_agg(distinct d.compra_id) into v_compras_ids
  from public.compras_detalle d
  join public.compras c on c.id = d.compra_id
  where c.empresa_id = _empresa_id
    and d.producto_id = _producto_id;

  -- Borrar detalles de compras
  with del2 as (
    delete from public.compras_detalle d
    using public.compras c
    where d.compra_id = c.id
      and c.empresa_id = _empresa_id
      and d.producto_id = _producto_id
    returning 1
  )
  select count(*) into v_detalle_compras_borrados from del2;

  -- Recalcular totales de compras afectadas
  if cardinality(v_compras_ids) > 0 then
    update public.compras c
    set total = coalesce((select sum(subtotal)::numeric(14,2) from public.compras_detalle d where d.compra_id = c.id), 0)
    where c.id = any(v_compras_ids);
    get diagnostics v_compras_actualizadas = row_count;

    -- Ajustar cuentas por pagar vinculadas a esas compras
    update public.cuentas_por_pagar x
    set monto = coalesce((select sum(subtotal)::numeric(14,2) from public.compras_detalle d where d.compra_id = x.compra_id), 0)
    where x.compra_id = any(v_compras_ids);
    get diagnostics v_cxp_actualizadas = row_count;
  end if;

  -- Finalmente, borrar el producto
  delete from public.productos p where p.id = _producto_id and p.empresa_id = _empresa_id;

  return jsonb_build_object(
    'ventas_detalle_borrados', v_detalle_ventas_borrados,
    'compras_detalle_borrados', v_detalle_compras_borrados,
    'ventas_actualizadas', v_ventas_actualizadas,
    'compras_actualizadas', v_compras_actualizadas,
    'cxp_actualizadas', v_cxp_actualizadas
  );
end $$;

grant execute on function public.delete_product_cascade(uuid, uuid) to authenticated, service_role;

commit;