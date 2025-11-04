# Pruebas: Empleados, Roles y Permisos

Este documento resume los casos de prueba para la página de `Empleados` y la gestión de roles/permisos desde Configuración.

## Preparación
- Variables necesarias en `.env`: `VITE_NEW_SUPABASE_URL`, `VITE_NEW_SUPABASE_PUBLISHABLE_KEY`, `VITE_PUBLIC_SITE_URL`.
- Usuario autenticado con `empresa_id` válido.

## Registro manual de empleado
- Renderiza la sección "Registrar empleado manualmente".
- Validación de email y nombre obligatorios.
- Previene duplicado por email dentro de la empresa (búsqueda previa).
- Inserta en `public.empleados` con `empresa_id` del usuario.

## Invitaciones (opcional)
- Renderiza sección de "Invitar empleado" y listado.
- Crea invitación vía RPC `create_empleado_invitation_ex`.
- Copia/abre enlace de aceptación `VITE_PUBLIC_SITE_URL/invitaciones/aceptar?token=...`.
- Envío de correo mediante función Edge `send-invitation`.

## Permisos y roles (Configuración)
- Listado de claves desde `public.permissions` y asignaciones desde `public.role_permissions` filtradas por `empresa_id`.
- Crea/actualiza claves con RPC `grant_permission`.
- Asigna y revoca con RPCs `assign_permission_to_role` y `revoke_permission_from_role`.
- RLS: acceso por `empresa_id`; inserciones sólo para `admin`.

## Trazabilidad y RLS
- La tabla `public.auditoria` incluye `empresa_id` y registra acciones de permisos.
- Políticas: `permissions_*`, `role_permissions_*`, `auditoria_*` con verificación por empresa y rol admin.

## Ejecución de pruebas
- `vitest` con `@testing-library/react`.
- Mocks de `@/integrations/supabase/newClient` y `@/hooks/useUserProfile` para escenarios UI.
- Archivos:
  - `src/pages/__tests__/Empleados.registration.test.tsx`
  - `src/components/configuracion/__tests__/UserManagementPanel.test.tsx`