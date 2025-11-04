# Configuración de correos de confirmación (Supabase Auth)

Para que los correos de confirmación lleguen correctamente a los usuarios, verifica y configura los siguientes puntos:

## 1) SMTP / Proveedor de envío

- En el panel de Supabase → Authentication → Email → **SMTP Settings**:
  - Si usas el servidor de Supabase, no necesitas credenciales, pero la entrega puede ser limitada en algunos dominios.
  - Para mejores tasas de entrega, configura un proveedor (ej. Resend, SendGrid, Postmark) y define:
    - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.
    - `MAIL_FROM` (ej. `no-reply@minogocioerp.com`).

## 2) URLs de redirección

- En Authentication → URL Configuration:
  - Añade tu dominio y puertos de desarrollo en **Additional Redirect URLs** (ej. `http://localhost:8080`, `http://localhost:5176`).
  - Asegúrate que el dominio principal (`SITE_URL`) coincide con el entorno.

## 3) Funciones Edge y logs

- Verifica que las funciones estén **desplegadas**: `admin-create-user`, `bootstrap-empresa`.
- Revisa **Logs** de Supabase (Functions) para errores de red o CORS.
- Variables necesarias en funciones:
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## 4) Cola de envío (si aplica)

- Supabase no expone una cola de correos en el proyecto; el proveedor SMTP gestiona la entrega.
- Si integras un proveedor externo (Resend) para otros correos (invitaciones), revisa su dashboard y estado de envíos.

## 5) Autenticación de dominio (SPF/DKIM/DMARC)

- Configura registros DNS en tu dominio para mejorar entregabilidad:
  - **SPF**: autoriza el servidor de envío.
  - **DKIM**: firma los mensajes.
  - **DMARC**: política y reportes.
- El proveedor (Resend/SendGrid/Postmark) te indica los registros a crear.

## 6) Plantillas de correo

- En Authentication → Email Templates, personaliza los correos con tu marca.
- Mantén un contenido claro, con enlaces visibles y textos alternativos.

## 7) Filtros de SPAM

- Pide a usuarios revisar la carpeta SPAM/Junk.
- Evita contenido sospechoso en plantillas (demasiados enlaces, adjuntos innecesarios).

## 8) Comportamiento de la app (fallback y reenvío)

- Si el registro se realiza mediante `admin-create-user`, el email queda **confirmado** y no se envía correo.
- Si falla la función Edge, el flujo hace fallback a `signUp`; la app ahora **reenviará automáticamente** el correo de confirmación y mostrará un botón para reenviar manualmente.

## Lista de comprobación rápida

- [ ] Functions desplegadas y accesibles
- [ ] Variables de entorno correctamente definidas
- [ ] Redirect URLs incluyen tu entorno local
- [ ] SMTP configurado (o proveedor dedicado) con `MAIL_FROM`
- [ ] SPF/DKIM/DMARC configurados en DNS
- [ ] Plantillas revisadas y limpias
- [ ] Reenvío de confirmación probado desde la UI