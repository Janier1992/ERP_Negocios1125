# Limpieza de migraciones (2025-10-28)

Este documento registra la consolidación y limpieza de migraciones realizada para Mi_NegocioERP.

## Contexto
- Se consolidó el esquema en `supabase/migrations/20251028_03_unified_app_schema.sql`.
- Se verificó que las RPCs usadas por la app y documentadas están definidas en el esquema unificado, incluyendo:
  - `get_user_empresa_id`, `has_role`, `get_user_permissions`, `has_permission`, `assign_roles`
  - `create_empleado_invitation_ex`, `accept_empleado_invitation`
  - `apply_purchase_stock`, `get_reportes_resumen`, `get_finanzas_resumen`
  - `get_compra_total`, `tg_compras_cxp_mov`, `refresh_cxp_estado`

## Acciones realizadas
- Se creó carpeta de respaldo con timestamp: `supabase/migrations_backup/cleanup_20251028222600`.
- Se movieron allí las migraciones previas, reemplazadas por el esquema unificado:
  - `20251019_02_handle_new_user_business_name.sql`
  - `20251020_01_bootstrap_full_schema_rls.sql`
  - `20251020_02_extend_clients_compras_promociones.sql`
  - `20251026_01_clients_finanzas_empleados.sql`
  - `20251027_01_empleados_roles_permisos.sql`
  - `20251027_01_finanzas_core_v1_0_0.sql`
  - `20251027_02_migration_history_v1_0_0.sql`
  - `202510280900_admin_create_user_fix.sql`
  - `20251028_01_clients_empleados_indexes_hardening.sql`
  - `20251028_02_config_users_management.sql`
  - `README_admin_create_user_fix.md`
- Se mantuvieron en `supabase/migrations/` únicamente:
  - `20251028_03_unified_app_schema.sql`
  - `20251028_04_drop_unused_schemas.sql`

> Importante: el script `20251028_03_unified_app_schema.sql` ya no incluye ninguna operación destructiva (DROP/DELETE). La limpieza de esquemas quedó separada en `20251028_04_drop_unused_schemas.sql` y debe ejecutarse explícitamente sólo si deseas eliminar esquemas personalizados.

## Justificación
- Evitar duplicidad y conflictos entre migraciones parciales y el esquema unificado.
- Asegurar que las funciones/RPCs necesarias para la app (p. ej. `apply_purchase_stock`, `get_finanzas_resumen`, `get_user_empresa_id`) permanecen definidas y consistentes.
- Facilitar mantenimiento futuro y despliegues más predecibles.

## Impacto y verificación
- No se eliminó ninguna RPC requerida por la app; el esquema unificado las define explícitamente.
- Para verificar en desarrollo:
  - `supabase db reset` (ATENCIÓN: borra datos locales) o
  - `supabase db push` para aplicar cambios pendientes.
  - Al ejecutar el script 03 en el editor SQL de Supabase no aparecerán alertas por operaciones destructivas.
  - Si ejecutas el script 04 (limpieza), el editor mostrará una advertencia porque contiene `DROP SCHEMA`; confirma sólo si estás seguro.
- Validar en la app los flujos:
  - Finanzas (`get_finanzas_resumen` en `src/pages/Finanzas.tsx`).
  - Permisos y roles (`usePermissions`, `assign_roles`).
  - Recepción de compras (`apply_purchase_stock` según `docs/compras.md`).

## Rollback
- Si se requiere restaurar migraciones anteriores, mover los archivos desde `supabase/migrations_backup/cleanup_20251028222600/` de vuelta a `supabase/migrations/` y re-ejecutar el proceso de migración correspondiente.

## Notas
- Mantener este documento actualizado si se realizan nuevas consolidaciones.
- Considerar añadir pruebas de integración para RPCs críticas (compras, finanzas, permisos).