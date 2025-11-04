# Registro directo de usuarios por correo

Este módulo reemplaza el sistema de invitaciones y permite a un administrador agregar usuarios directamente con correo y contraseña.

## Requisitos

- Variables de entorno (servidor):
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Variables de entorno (cliente):
  - `VITE_PUBLIC_SITE_URL` (opcional, para enlaces públicos)

## Función Edge `admin-create-user`

- Ubicación: `supabase/functions/admin-create-user/index.ts`
- Entrada: `{ email, password, full_name?, roles?, username? }`
- Seguridad:
  - Valida token de quien llama y verifica permiso `manage_users` con RPC `has_permission`.
  - Usa `auth.admin.createUser` (service role) con `email_confirm: true` para permitir login inmediato.
  - Upsert en `public.profiles` con `empresa_id` del administrador que realiza el alta.
  - Asigna roles vía RPC `assign_roles`.
  - Registra auditoría (`action='admin_user_create'`).

## Cliente

- Servicio: `src/services/users.ts`
  - `adminCreateUser(email, password, fullName?, roles?, username?)`
  - Validaciones: `validateEmail`, `validatePassword` (mínimo 8 caracteres y 1 número).

## UI

- Componente: `src/components/configuracion/UserManagementPanel.tsx`
  - Sección “Agregar nuevo usuario” con campos: correo (único), contraseña, nombre opcional y rol principal.
  - Validación en tiempo real y mensajes de error claros (correo ya registrado, permisos insuficientes).
  - Diseño responsive consistente.
  - Sección de “Asignar roles múltiples” se mantiene para gestionar roles de usuarios existentes.

## Aceptación y Seguridad

- Usuarios pueden autenticarse inmediatamente después del registro (email ya confirmado por admin).
- Contraseñas almacenadas de forma segura por Supabase Auth (hash en servidor).
- Interfaz intuitiva y coherente con el resto de la aplicación.
- Cumple estándares actuales: principio de mínimo privilegio, validación en servidor, auditoría, y roles.

### Política de contraseñas

- Longitud mínima: 8 caracteres.
- Complejidad: al menos 1 dígito numérico.
- La UI valida estos requisitos y el backend los refuerza en la función Edge.

### Solución de problemas: "Error al agregar usuario"

Si el panel muestra el mensaje genérico, valide:
- La función Edge `admin-create-user` está desplegada y accesible (Supabase → Functions).
- Existen y funcionan las RPCs `has_permission`, `assign_roles`, `get_user_permissions`.
- El rol `admin` tiene asignado el permiso `manage_users` (`permissions`/`role_permissions`).
- Políticas RLS permiten `profiles.upsert` y `user_roles` para administradores (según migraciones incluidas).
- El cliente envía el token del usuario autenticado (sesión vigente). Si no, re‑inicie sesión.
- Variables de entorno están configuradas correctamente (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

## Pruebas

- Unitarias: `src/services/__tests__/users.service.test.ts` (validación y creación de usuario).
- UI: `src/components/configuracion/__tests__/UserManagementPanel.test.tsx` (agregar usuario y asignar roles).
- Integración: se mantienen las pruebas de roles; las de invitaciones pueden retirarse gradualmente.
 - Nuevas: `src/pages/__tests__/Auth.render.test.tsx` y `Auth.interaction.test.tsx` (registro/login y confirmación de email).