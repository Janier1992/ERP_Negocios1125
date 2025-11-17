# Mi_NegocioERP

[![CI](https://github.com/Janier1992/MiNegocio-ERP/actions/workflows/ci.yml/badge.svg)](https://github.com/Janier1992/MiNegocio-ERP/actions/workflows/ci.yml)

Aplicación ERP ligera para PyMEs que integra autenticación, usuarios y roles, inventario, proveedores, clientes, compras, ventas, finanzas, cuentas por pagar, promociones, invitaciones y auditoría, con seguridad basada en RLS de Supabase.

## Descripción del proyecto

Mi_NegocioERP es una aplicación web SPA desarrollada con React, Vite y TypeScript, orientada a la gestión integral de pequeñas y medianas empresas. Incluye módulos de autenticación, inventario, ventas, compras, finanzas y auditoría, con control de acceso por roles y políticas RLS en Postgres (Supabase). Está optimizada para despliegues estáticos (p. ej., GitHub Pages) y para integrarse con Supabase como Backend as a Service.

## Instalación rápida

- Requisitos: Node.js >= 18 y npm.
- Clona el repositorio y entra al proyecto:
- Configura el entorno en `.env` con tus credenciales de Supabase.

```sh
git clone https://github.com/Janier1992/Mi_NegocioERP.git
cd Mi_NegocioERP
npm install

# .env (ejemplo)
VITE_SUPABASE_URL=https://<tu-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<tu_anon_key>
```

## Ejecución en desarrollo

```sh
npm run dev
# Abre http://localhost:8080
```

- Si editas variables `VITE_...` en `.env`, reinicia el servidor de Vite para aplicar cambios.
- Verifica conectividad de Auth con Supabase en `/auth` (ver sección de diagnóstico más abajo).

## Compilación para producción

```sh
npm run build
npm run preview
# Preview local: http://localhost:4173
```

- Publica el contenido de `dist/` en tu hosting estático.
- Si despliegas en una subruta (p. ej., GitHub Pages), ajusta `base` en `vite.config.ts` y valida rutas de assets.

## Pruebas

- Pruebas unitarias con Vitest:

```sh
npm test
# o
npx vitest run
```

- Las pruebas clave incluyen lógica de precios y alertas en `tests/*.spec.ts`.
- Si reintroduces Testing Library y `jsdom`, añade `src/test/setup.ts` y configura `vitest.config.ts` según tus necesidades.

## Despliegue en GitHub Pages

- Este repositorio incluye `.github/workflows/pages.yml` para construir y publicar automáticamente.
- Pasos rápidos:
  - Ajusta `base` en `vite.config.ts` si tu sitio se sirve bajo una subruta.
  - Define secretos `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en GitHub Actions.
  - Activa Pages en Settings → Pages y selecciona GitHub Actions.
  - Tras hacer push a `main`, tu sitio se despliega en pocos minutos.

## Seguridad: CSP y Verificación

- Política CSP por entorno (inyectada en build):
  - Producción: sin `'unsafe-inline'` ni `'unsafe-eval'`; permite scripts y conexiones sólo a `self` y `*.supabase.co`; incluye `upgrade-insecure-requests`.
  - Desarrollo: permite HMR (`ws:`) y `'unsafe-inline'`/`'unsafe-eval'` para tooling.
- Implementación:
  - `vite.config.ts` añade el meta CSP vía `transformIndexHtml` según `mode`.
  - `index.html` no contiene scripts inline de redirección.
  - `src/main.tsx` maneja la redirección de producción usando `import.meta.env.BASE_URL`.
- Verificar en desarrollo:
  - `npm run dev` → abrir `http://localhost:8080` (o el puerto activo).
  - Comprobar en el inspector que existe un único `<meta http-equiv="Content-Security-Policy">` y que no hay violaciones en consola.
  - Confirmar HMR activo (modificar un componente y ver refresco).
- Verificar en producción local:
  - `npm run build` y `npm run preview`.
  - No deben existir scripts inline en `head`; consola sin errores CSP; Supabase debe conectar.
- Añadir orígenes si fuera necesario:
  - Editar `vite.config.ts` y agregar el dominio requerido en `script-src`, `connect-src` o `img-src` según el caso.
  - Evitar reintroducir `'unsafe-inline'` en producción; preferir mover cualquier script/estilo inline a archivos.

## Características principales

- Autenticación con Supabase Auth y perfiles (`profiles`).
- Organización multiempresa (`empresas`) con RLS por `empresa_id`.
- Roles y permisos por empresa (`user_roles`, `permissions`, `role_permissions`).
- Inventario: categorías y productos con stock y mínimos (`categorias`, `productos`).
- Proveedores y Clientes con CRUD e índices clave (`proveedores`, `clientes`).
- Ventas y detalle de venta (`ventas`, `ventas_detalle`) con totales y métodos de pago.
- Compras y detalle de compra (`compras`, `compras_detalle`) con estados: borrador, pendiente, recibida, anulada.
- Finanzas: movimientos de ingreso/egreso (`movimientos_financieros`) y reportes JSON (`get_finanzas_resumen`, `get_reportes_resumen`).
- Cuentas por pagar (CxP) con vencimientos y refresco de estado (`cuentas_por_pagar`, `refresh_cxp_estado`).
- Promociones por empresa con ventanas de fechas (`promociones`).
- Empleados e invitaciones con tokens y aceptación (`empleados`, `empleados_invitaciones`, `create_empleado_invitation_ex`, `accept_empleado_invitation`).
- Auditoría de acciones relevantes (`auditoria`).
- Políticas RLS exhaustivas por tabla, basadas en `empresa_id` del usuario autenticado.

## Stack tecnológico

- Frontend: `React` + `Vite` + `TypeScript` + `Tailwind CSS` + `shadcn-ui`.
- Estado y datos: `@tanstack/react-query`.
- Backend as a Service: `Supabase` (Postgres, Auth, Edge Functions).
- Pruebas: `Vitest` (+ `jsdom`).

## Requisitos previos

- Node.js LTS (>= 18) y npm.
- Proyecto de Supabase activo (obtén URL y `anon key`).
- Supabase CLI (opcional, para gestionar migraciones): `npm i -g supabase`.

## Configuración de entorno

1. Crea/edita el archivo `.env` en la raíz:

```
VITE_SUPABASE_URL=https://<tu-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<tu_anon_key>
```

- Los valores correctos están en Supabase: Project Settings → API.
- Si ves errores `ERR_NAME_NOT_RESOLVED` al iniciar, revisa que el dominio y la clave sean válidos.

2. Funciones Edge (si las despliegas) requieren en su entorno:

```
SUPABASE_URL=https://<tu-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<tu_service_role_key>
```

> Nota: Nunca expongas la `SERVICE_ROLE_KEY` en el frontend.

## Base de datos y migraciones

- Migración principal: `supabase/migrations/20251028_03_unified_app_schema.sql`.
  - Crea el enum `public.app_role` mediante bloque `DO $$ ... $$` (compatible con todas las versiones, evita error 42601).
  - Define tablas, relaciones, índices, triggers y funciones RPC.
  - Habilita RLS y políticas por empresa.
  - Inserta semilla mínima de permisos (`manage_users` para `admin`).
- Limpieza de esquemas: `20251028_04_drop_unused_schemas.sql` (opcional, manual).

### Aplicar migraciones

- Opción A: Editor SQL de Supabase → pega el contenido de `03_unified_app_schema.sql` y ejecuta.
- Opción B: Supabase CLI:

```
supabase db push
# o en local
supabase start
supabase db reset
```

> Recomendado: ejecutar `scripts/backup_before_migration.ps1` (Windows) antes de cambios mayores.

## Desarrollo local

```sh
npm install
npm run dev
# Abre http://localhost:8080
```

Si cambias variables `VITE_...` en `.env`, reinicia el servidor de Vite para que tomen efecto.

## Módulos y flujo de uso

- Autenticación y perfiles
  - Registro y login con Supabase Auth (`src/pages/Auth.tsx`).
  - `profiles` vincula el usuario a una `empresa` y almacena `email`, `full_name`, `username` y `rol` textual.

- Usuarios, roles y permisos
  - `user_roles` asigna roles (`app_role`: `admin`, `empleado`, `viewer`) por empresa.
  - `permissions` y `role_permissions` permiten granularidad de acceso.
  - RPC: `get_user_permissions`, `has_permission`, `has_role`, `assign_roles`.
  - Hook: `src/hooks/usePermissions.ts` para consumo en UI.

- Inventario
  - `categorias` y `productos` con `stock`, `stock_minimo`, precios y vínculos a proveedor.
  - RPC: `apply_purchase_stock` incrementa stock al recibir compras.

- Proveedores y Clientes
  - CRUD con restricciones e índices (`UNIQUE (empresa_id, nombre)` en clientes, email opcional único por empresa).

- Ventas
  - `ventas` y `ventas_detalle` con totales, método de pago y cliente opcional (`cliente_id`).

- Compras
  - `compras` y `compras_detalle` con estados.
  - Trigger `compras_cxp_mov`: crea/actualiza CxP o registra egreso al cambiar estado.

- Finanzas y CxP
  - `movimientos_financieros` y `cuentas_por_pagar` con índices críticos.
  - RPC: `get_finanzas_resumen` y `refresh_cxp_estado`.

- Promociones
  - Definición de promos por empresa, activas, con rango de fechas.

- Invitaciones y empleados
  - `create_empleado_invitation_ex` genera token con expiración y username opcional.
  - `accept_empleado_invitation` vincula perfil, crea/actualiza empleado y rol.
  - Email: función Edge `send-invitation` (opcional) con plantilla interna.
  - Logging de correo: RPC `log_auth_email_event` registra envíos y errores de confirmación.

- Auditoría
  - Inserciones automáticas en acciones clave (asignación de roles, aceptación de invitación).

## Políticas RLS (resumen)

- Todas las tablas relevantes tienen RLS habilitado.
- Las políticas usan `empresa_id = get_user_empresa_id(auth.uid())` y verifican permisos/roles.
- `auditoria` permite inserciones sólo a `service_role`.

## Integración con Supabase en el frontend

- Cliente principal: `src/integrations/supabase/newClient.ts`.
- Ejemplo de uso:

```ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

export default supabase;
```

## Pruebas (cómo reintroducirlas)

- Si decides volver a habilitar pruebas:
  - Instala dependencias de testing:
    - `npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom`
  - Restaura `src/test/setup.ts` con configuración de `jsdom` y utilidades de Testing Library.
  - Añade script `"test": "vitest"` en `package.json`.
  - Opcional: configura `vite.config.ts` con `test.setupFiles = ["src/test/setup.ts"]` (ya contemplado).
  - Organiza pruebas en `src/**/__tests__/`.

## Revisión de dependencias

- Para detectar paquetes no utilizados de forma periódica, usa:

```
npm run depcheck
```

- Revisa resultados y elimina dependencias que no se usen en el runtime.

## Configuración de correo y solución de problemas

- SMTP/Proveedor:
  - Configura proveedor en Supabase → Authentication → Email. Si usas SMTP, define host, puerto, usuario y contraseña; si usas proveedor (p.ej. Resend), sigue la guía del proveedor.
  - Habilita confirmación de correo y restablecimiento de contraseña.
- URLs de redirección:
  - Añade `http://localhost:8080` en Authentication → URL Configuration → Additional Redirect URLs.
  - Verifica `VITE_PUBLIC_SITE_URL` en `.env` para que `emailRedirectTo` apunte correctamente.
- Reenvío y colas:
  - La app reintenta `auth.resend` con backoff exponencial (`src/services/email.ts`).
  - Se registra cada intento/resultado vía RPC `log_auth_email_event` en `auditoria` (best‑effort). Revisa entradas con acción `auth_email`.
- Errores comunes y mensajes:
  - Dominio de redirección no permitido → añade URL de desarrollo/producción en Supabase.
  - SMTP no configurado o sin permisos → revisa credenciales y proveedor.
  - Edge no disponible durante registro → la app cae en `signUp` estándar y muestra estado de confirmación pendiente.

## Diagnóstico de autenticación y conectividad

Para diagnosticar el mensaje "No se pudo conectar al servicio de autenticación" y problemas de login/registro con Supabase Auth:

- Verifica variables de entorno:
  - `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` deben estar presentes y válidos.
  - Reinicia Vite tras cambios en `.env`.
- Prueba endpoint público de Auth:
  - `GET ${VITE_SUPABASE_URL}/auth/v1/info` debe responder `200`.
  - En Windows/PowerShell:
    - `Invoke-WebRequest "$env:VITE_SUPABASE_URL/auth/v1/info" -UseBasicParsing | Select-Object StatusCode`
- Revisa CSP y orígenes permitidos:
  - En producción, `connect-src` debe permitir `self` y `*.supabase.co`.
  - Si ves errores de CSP, ajusta `vite.config.ts` para añadir el origen requerido.
- URLs de redirección (Auth → URL Configuration):
  - Añade `http://localhost:8080` en Additional Redirect URLs para desarrollo.
  - Configura `VITE_PUBLIC_SITE_URL` para que `emailRedirectTo` apunte correctamente.
- Logs y manejo de errores:
  - La página `src/pages/Auth.tsx` ahora realiza un health check temprano y muestra toasts con pistas (falta de env, fallo de red/CSP).
  - Abre DevTools (F12) y revisa la consola y la red para detalles del fallo.
- Entornos:
  - Desarrollo: `npm run dev` y abre `/auth`.
  - Producción local: `npm run build && npm run preview` y abre `/MiNegocioPymes/auth` (ajusta `base` si cambias el repo/pages).

Archivo de soporte:

- `src/integrations/supabase/health.ts`: helpers `getSupabaseEnv()` y `checkAuthConnectivity()` para validar configuración y alcance de Supabase Auth.

### Verificación
- Inicia `npm run dev` y abre `http://localhost:8080/auth`.
- Registra con un correo nuevo; si queda pendiente, usa “Reenviar confirmación”.
- Verifica en Supabase → Table Editor → `auditoria` los eventos `auth_email`.
- En producción, valida que el proveedor de correo no esté bloqueando el dominio o la IP.
- Configuración: `src/test/setup.ts` (jsdom / utilidades).
- Ejecutar pruebas:

```
npx vitest
```

## Scripts útiles

- `depcheck`: analiza dependencias no usadas (`npm run depcheck`).

## Estructura de proyecto (resumen)

- `src/pages`: vistas principales (Dashboard, Auth, Clientes, Proveedores, Inventario, Ventas, Finanzas, Configuración, Alertas).
- `src/components`: UI y componentes por módulo.
- `src/services`: servicios (usuarios, invitaciones).
- `src/services`: servicios (usuarios, correo).
- `src/hooks`: hooks (perfil de usuario, permisos, etc.).
- `supabase/migrations`: scripts SQL de esquema.
- `supabase/functions`: funciones Edge (p.ej. `admin-create-user`, `send-invitation`).

## Despliegue

- Construcción: `npm run build`.
- Sirve `dist/` en tu hosting estático preferido y configura variables `VITE_...` en el entorno del servidor.
- Para funciones Edge, usa Supabase CLI o dashboard para desplegar y configurar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.

### GitHub Pages (MiNegocioPymes)

- Sitio: `https://janier1992.github.io/MiNegocioPymes/`
- Workflow: `.github/workflows/pages.yml` ya incluido.
- En producción, Vite usa `base: "/MiNegocioPymes/"` y el enrutador `BrowserRouter` toma `import.meta.env.BASE_URL`.

#### Pasos
- En el repositorio `MiNegocioPymes`, ve a Settings → Pages y selecciona “Build and deploy” con GitHub Actions.
- Añade secretos en Settings → Secrets and variables → Actions:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- El workflow construye y sube `dist/` y copia `404.html` desde `index.html` para SPA.
- Tras cada push a `main`, el sitio se actualiza en 1–3 minutos.

#### Troubleshooting
- 404 en rutas internas: confirma que existe `dist/404.html` (lo crea el workflow) y que `base` sea `"/MiNegocioPymes/"`.
- Assets no cargan: verifica que la URL incluya `/MiNegocioPymes/` y reconstruye (`npm run build`).
- Errores de CSP: en producción se permite `style-src 'unsafe-inline'` para compatibilidad con GitHub Pages; los scripts inline siguen bloqueados.
- Datos no cargan: revisa que los secretos de Supabase estén definidos en el repositorio y que el proyecto de Supabase acepte conexiones desde el sitio.
 - 404 de `main.tsx` y `favicon.svg` en Pages:
   - Síntoma: en consola aparecen 404 para `/src/main.tsx` y `/favicon.svg`.
   - Causa: rutas absolutas en `index.html` que ignoran la `base` del repositorio.
   - Corrección: usar rutas relativas en `index.html` (`href="favicon.svg"` y `src="src/main.tsx"`).
   - Verificación: ejecutar `npm run build` y abrir `https://janier1992.github.io/MiNegocioPymes/`; no deben aparecer 404 en consola.

### Checklist de publicación (CSP y entorno)

- Build y preview local:
  - Ejecuta `npm run build` y `npm run preview`.
  - En consola del navegador no deben aparecer violaciones de CSP.
  - Verifica que no haya scripts inline en `head` y que exista un único meta CSP.
- Variables de entorno del frontend:
  - Define `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en producción.
  - Ajusta `VITE_PUBLIC_SITE_URL` si usas redirecciones por correo.
- Supabase (seguridad y migraciones):
  - Aplica migraciones más recientes (`supabase db push`).
  - Confirma RLS activo en tablas principales y políticas por `empresa_id`.
  - Asegura que el trigger de autoconfirmación de email esté deshabilitado en producción (migración `20251109_160_disable_autoconfirm_trigger.sql`).
- Orígenes externos:
  - Si agregas nuevos dominios (APIs, CDNs), inclúyelos en `connect-src`, `img-src` o `script-src` en `vite.config.ts` (sólo lo necesario).
  - Evita `'unsafe-inline'`/`'unsafe-eval'` en producción; mueve cualquier script/estilo inline a archivos.
- Hosting estático:
  - Para GitHub Pages, confirma `base: "/MiNegocioPymes/"` y la redirección en `src/main.tsx`.
- Pruebas funcionales rápidas:
  - Login/logout, navegación por páginas principales, exportar e importar Excel.
  - Validar que Supabase conecte (sin errores de `connect-src`).

## Solución de problemas

- `ERR_NAME_NOT_RESOLVED` al iniciar: revisa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env`.
- Error 42601 al crear `app_role`: ya corregido con bloque `DO $$ ... $$` en la migración.
- Denegación por RLS: verifica que el usuario esté vinculado a una `empresa` en `profiles` y tenga roles/permissions adecuados.

### CI/CD (GitHub Actions)

- `npm ci` falla en Actions por lockfile mismatch:
  - Síntoma: el job “Install dependencies” falla indicando que `package-lock.json` no coincide con `package.json`.
  - Causa: el lockfile quedó desalineado tras cambios locales de dependencias.
  - Corrección: `npm install --package-lock-only` (Node 20/npm 10), luego `git add package-lock.json; git commit -m "ci: regenerate lock"; git push`.
  - Recomendación: mantener `npm ci` en los workflows para instalaciones deterministas.

- EPERM en Windows al ejecutar `npm ci` local:
  - Síntoma: `EPERM: operation not permitted, unlink ... esbuild.exe`.
  - Causa: el servidor de desarrollo mantiene abierto el binario de `esbuild`.
  - Corrección: detener el servidor dev (`npm run dev`) antes de `npm ci`; volver a ejecutar la instalación limpia.

### Push rechazado (git)

- Rechazo “fetch first” al hacer `git push`:
  - Causa: historial divergente con `origin/main`.
  - Corrección: `git pull --rebase origin main` y luego `git push`.

### Error al cargar métricas del Dashboard

- Síntoma: aparece un aviso "Error al cargar métricas del Dashboard" al abrir la página.
- Causa raíz habitual: fallas de relaciones PostgREST al usar joins implícitos (p.ej. `productos -> categorias`) o discrepancias de esquema en caché.
- Corrección aplicada:
  - Se eliminó el join `categorias(nombre)` en `Dashboard.tsx` y se consultan `categorias` por separado, mapeando por `categoria_id`.
  - Se añadió manejo granular de errores por consulta y registros en consola para diagnóstico sin interrumpir la carga completa del dashboard.
- Verificación:
  - Inicia `npm run dev` y abre `http://localhost:8081/`.
  - No deben aparecer toasts de error; las métricas y gráficos se muestran con datos disponibles.
  - Prueba también `npm run build` + `npm run preview` (`http://localhost:4173/MiNegocio-ERP/`).

### Pantalla no visible / "Service is unavailable"

- Causa probable: fallas de inicialización de Auth de Supabase (variables faltantes o servicio temporalmente indisponible) provocaban errores no capturados.
- Corrección aplicada:
  - Se añadió un `ErrorBoundary` global (`src/components/system/ErrorBoundary.tsx`) que muestra un fallback amigable y evita que la app se rompa con overlays opacos.
  - Se robusteció `ProtectedRoute` para capturar errores de `supabase.auth.getSession()` y degradar a navegación hacia `/auth`.
- Verificación:
  - Ejecuta `npm run dev` y accede a `http://localhost:8080/`.
  - Si Supabase está inaccesible, la app seguirá mostrando UI (Auth o fallback) en lugar de quedar en negro.
  - Revisa `.env`: deben existir `VITE_NEW_SUPABASE_URL` y `VITE_NEW_SUPABASE_PUBLISHABLE_KEY` válidos para el proyecto activo.

- Persistencia del onboarding tras crear empresa: tras el bootstrap puede existir latencia de propagación. Se corrigió `awaitEmpresaId` en `useUserProfile` para usar el `empresaId` retornado por `fetchProfile` y aumentar tolerancia a la latencia. Además, tanto Onboarding como Configuración navegan a `/` con `state: { hydratingEmpresa: true, postCreate: true }` usando un `Promise.race` entre confirmación primaria y timeout (3.5s). `AppLayout` muestra un overlay de hidratación no bloqueante y limpia automáticamente `hydratingEmpresa` y `postCreate` una vez disponible el `empresaId`. Si la interfaz sigue mostrando onboarding, refresca y/o verifica que la función Edge tenga `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` correctos.

## Notas

- Evita almacenar claves sensibles (`SERVICE_ROLE_KEY`) en el frontend.
- La lógica de UPSERT en CxP usa `ON CONFLICT (compra_id)`: si deseas múltiples CxP por compra, ajusta esa condición y la restricción única.
#   E R P _ N e g o c i o s P y m e s 
 
 
