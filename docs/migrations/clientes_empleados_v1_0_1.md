# Migración v1.0.1 — Clientes y Empleados (Índices y permisos)

Esta migración optimiza rendimiento y endurece seguridad en los módulos de **Clientes** y **Empleados/Invitaciones**.

## Cambios aplicados
- Índices en `public.clientes`:
  - `idx_clientes_empresa` sobre `empresa_id` para acelerar listados por empresa.
  - `idx_clientes_empresa_email_unique` (parcial) para unicidad `empresa_id + email` cuando `email` no es `NULL`.
- Índices en `public.empleados`:
  - `idx_empleados_empresa`, `idx_empleados_rol`, `idx_empleados_estado` para filtros en UI.
- Índices en `public.empleados_invitaciones`:
  - `idx_empleados_invitaciones_empresa`, `idx_empleados_invitaciones_expires`, `idx_empleados_invitaciones_used` para listados y verificación de expiración.
- Endurecimiento de permisos:
  - `create_empleado_invitation`: ahora exige rol `admin` mediante `public.has_role()`; mantiene `SECURITY DEFINER` y `search_path=public`.
  - Política RLS `inv_ins_admin` en `public.empleados_invitaciones`: limita `INSERT` directo a administradores de la empresa.
- Idempotencia/consistencia:
  - `accept_empleado_invitation` asegura `used_at = now()` al aceptar el token.

## Seguridad
- Mantiene RLS activada en todas las tablas afectadas.
- Las funciones usan `SECURITY DEFINER` y `search_path=public` para evitar escaladas por `search_path`.
- Las inserciones directas en invitaciones quedan limitadas a administradores; el flujo normal usa RPC.

## Rendimiento
- Índices clave reducen `seq scans` en listados por `empresa_id`, filtros por `rol/estado`, y cálculo de estados de invitación.
- Unicidad parcial por email evita duplicados silenciosos y mantiene soporte para `NULL`.

## Transacción y reversión
- Todo se aplica dentro de `BEGIN/COMMIT`.
- Rollback: eliminar índices creados y restaurar la política `inv_ins` si se desea comportamiento previo.

## Dependencias
- Requiere funciones existentes: `public.has_role`, `public.get_user_empresa_id` y tablas base `public.empresas`, `public.profiles`.

## Verificación posterior
- UI: envío/aceptación de invitaciones debe seguir funcionando y reflejar estados correctamente.
- DB: unicidad por email por empresa se respeta; inserciones directas en invitaciones desde clientes no-admin deben fallar.