# Gestión de usuarios y autenticación

Este módulo añade funcionalidades de registro, invitaciones, asignación de roles y verificación de permisos desde Configuración.

## Registro y autenticación

- Pantalla `src/pages/Auth.tsx`:
  - Inicio de sesión con correo y contraseña (`supabase.auth.signInWithPassword`).
  - Registro con correo y contraseña (`supabase.auth.signUp`), incluyendo metadatos `full_name` y `business_name`.
  - Confirmación por correo y reenvío de confirmación.
  - Manejo de sesión segura (verificación con `ProtectedRoute` y cierre de sesión global).

## Registro directo por administrador

- Función Edge `admin-create-user`:
  - Crea usuarios con `auth.admin.createUser` y `email_confirm: true` (login inmediato).
  - Valida permiso `manage_users` con RPC `has_permission`.
  - Upsert en `profiles` con `empresa_id` del administrador y asigna rol inicial con `assign_roles`.
  - Registra auditoría de la acción.

## Asignación de roles y permisos

- UI `UserManagementPanel`:
  - Agregar nuevo usuario con correo único, contraseña y rol principal.
  - Asignación múltiple de roles a usuarios (`assign_roles`).

- RPC `assign_roles(user_id, roles[], replace)`:
  - Valida roles: `admin`, `empleado`, `viewer`.
  - Opción `replace` para reemplazar roles previos.

- Permisos:
  - Catálogo `permissions` y asignaciones `role_permissions`.
  - Hook `usePermissions` para listar y verificar permisos por usuario (`get_user_permissions`, `has_permission`).

## Seguridad y RLS

- Políticas RLS por empresa en `profiles`, `empleados`, `empleados_invitaciones`, `permissions`, `role_permissions` y `auditoria`.
- Inserciones y cambios críticos usan funciones `SECURITY DEFINER` con `search_path` fijo.

## Validación y manejo de errores

- UI valida email y nombre de usuario mínimo 3 caracteres.
- RPCs validan permisos y roles existentes, con mensajes de error amigables.
- Logging en `auditoria` para acciones: crear invitación, aceptar invitación, asignar/revocar permisos.

## Pruebas unitarias

- `src/components/configuracion/__tests__/UserManagementPanel.test.tsx`:
  - Valida creación de invitación y asignación múltiple de roles con mocks de Supabase.

## Campos obligatorios y trazabilidad

- `profiles.username` único (case-insensitive, opcional si no se sugiere en invitación).
- Contraseña en Supabase Auth (hash gestionado por el proveedor).
- Rol asignado (`profiles.rol` + `user_roles`).
- Estado del empleado (`empleados.estado`: `activo`/`revocado`).
- Fecha de creación (`empleados.created_at`).

## Notas de integración

- La aceptación de invitación requiere sesión (el usuario primero crea su cuenta en Auth).
- Para limitar acceso por permisos, usar `usePermissions.hasPermission('clave')` en componentes sensibles.