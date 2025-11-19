# Validación Auth y PWA

Este documento resume las verificaciones y ajustes aplicados para asegurar el registro/autenticación y evitar 404 en la app instalada.

## Autenticación y Registro

- Cliente: `src/integrations/supabase/newClient.ts` usa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- Flujo UI: `src/pages/Auth.tsx` valida campos obligatorios y muestra feedback.
- Seguridad de credenciales: Supabase Auth gestiona hashing del password; la app no almacena contraseñas en tablas propias.
- Instrumentación: se añadieron logs con `createLogger` y módulo `src/services/monitoring.ts` para observabilidad durante login/registro.
- Post‑registro: bootstrap de empresa via RPC/Edge con fallback a `signUp` estándar.

## PWA y 404 en instalación

- Manifest: `public/manifest.json` define `id`, `start_url` y `scope` con la subruta del repositorio:
  - `id: "/ERP_Negocios1125/"`
  - `start_url: "/ERP_Negocios1125/index.html?pwa=1"`
  - `scope: "/ERP_Negocios1125/"`
- Deploy: workflow `.github/workflows/pages.yml` construye con `--base=$VITE_BASE` y copia `404.html` para SPA.

## Pruebas

- Local: `npm run build && npm run preview`; abrir `/auth` y completar registro/login.
- Test PWA: `tests/manifest.spec.ts` valida `start_url` y `scope` relativos.
- Salud Auth: usar `src/integrations/supabase/health.ts` para verificar conectividad.

## Monitoreo

- Utilizar `reportError` / `reportInfo` en puntos críticos para guardar trazas en consola.
- Futuro: enviar eventos a `auditoria` desde el frontend o a una función Edge específica.

## Despliegue

- Variables requeridas en Actions: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BASE`.
- URL esperada: `https://<usuario>.github.io/<repo>/`.