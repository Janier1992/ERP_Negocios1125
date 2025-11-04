# Migración v1.0.0 — Finanzas Core

Esta migración asegura la existencia y políticas RLS de las tablas `ventas`, `ventas_detalle`, `compras`, `compras_detalle` y `cuentas_por_pagar`, además de un RPC de compatibilidad `get_finanzas_resumen`.

## Alcance
- Tablas: crea con `IF NOT EXISTS` para evitar duplicados.
- RLS: habilita y define políticas por `empresa_id` basadas en `profiles.empresa_id`.
- RPC: provee `get_finanzas_resumen` usado por el módulo Finanzas.
- Transacción: todo dentro de `BEGIN`/`COMMIT`.

## Dependencias
- `public.empresas`, `public.profiles`, `public.productos`, `public.clientes`, `public.proveedores`.
- Extensión `pgcrypto` para `gen_random_uuid()`.

## Orden de ejecución
1. Extensiones.
2. Tablas (`ventas` → `ventas_detalle` → `compras` → `compras_detalle` → `cuentas_por_pagar`).
3. RLS y políticas.
4. RPC y permisos.

## Compatibilidad
- Retrocompatible: no elimina columnas ni rompe RLS existentes.
- `CREATE TABLE IF NOT EXISTS` y `CREATE POLICY IF NOT EXISTS` evitan colisiones.

## Seguridad (RLS)
- `SELECT/INSERT/UPDATE/DELETE` limitado a filas de la misma empresa del usuario (`profiles.empresa_id = auth.uid()`).
- Requiere que el usuario autenticado tenga `profiles.empresa_id` definido.

## Integridad de datos
- Recomendado ejecutar backup previo a la migración. Ver `scripts/backup_before_migration.ps1`.
- Transacción atómica: si ocurre un error, la migración se revierte automáticamente.

## Rollback
Manual, en orden inverso:
1. Eliminar políticas y tablas de `cuentas_por_pagar`.
2. Eliminar políticas y tablas de `compras_detalle` y `compras`.
3. Eliminar políticas y tablas de `ventas_detalle` y `ventas`.
4. Revocar y eliminar `get_finanzas_resumen`.

## Registro de cambios
- v1.0.0: creación/aseguramiento de tablas de finanzas y políticas RLS; RPC agregado/reemplazado.

## Mensajes de error
- `PGRST205`: indica tabla no encontrada. La UI utiliza modos de compatibilidad (listas vacías) y esta migración debe resolver el origen.
- Otros errores: revisar permisos RLS y existencia de tablas referenciadas por FKs.