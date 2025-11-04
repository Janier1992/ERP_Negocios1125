# Configuración de envío de invitaciones por correo

Este módulo añade envío de correos de invitación mediante una función Edge segura.

## Requisitos

- Variables de entorno (servidor):
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`
  - `MAIL_FROM` (ejemplo: `no-reply@minogocioerp.com`)
- Variables de entorno (cliente):
  - `VITE_PUBLIC_SITE_URL` (ejemplo: `https://app.minogocioerp.com`)

## Función Edge `send-invitation`

- Ubicación: `supabase/functions/send-invitation/index.ts`
- Entrada: `{ messages: { email, username, token, link, empresaId, createdBy, expiresHours }[] }`
- Acción:
  - Envía correos con Resend (`html` y `text`), asunto "Invitación a Mi Negocio ERP".
  - Registra auditoría en `public.auditoria` con `action='invitation_email_send'`.

## Uso en el cliente

- Invocación directa desde el cliente (ejemplo):

```ts
import supabase from '@/integrations/supabase/newClient';

const acceptLink = `${import.meta.env.VITE_PUBLIC_SITE_URL}/invitaciones/aceptar?token=TOKEN`;

const { data, error } = await supabase.functions.invoke('send-invitation', {
  body: {
    messages: [
      {
        email: 'empleado@example.com',
        username: 'empleado1',
        token: 'TOKEN',
        link: acceptLink,
        empresaId: 'EMPRESA_ID',
        createdBy: 'USER_ID_ADMIN',
        expiresHours: 72,
      },
    ],
  },
});

if (error) {
  // Mostrar mensaje y ofrecer copiar enlace (fallback)
}
```

## Plantilla de correo

- La función Edge incluye su propia plantilla HTML y texto.
- Personaliza contenidos modificando `html()`/`text()` dentro de `send-invitation`.

## Auditoría y seguridad

- La creación de invitación (`create_empleado_invitation_ex`) y aceptación (`accept_empleado_invitation`) ya registran auditoría.
- El envío de correo se registra desde la función Edge con service role.

## Pruebas

- Unitarias del servicio y del panel (múltiples destinatarios).
- Integración: flujo completo mockeado con `supabase.rpc` y `supabase.functions.invoke`.
- Carga: test de múltiples solicitudes simultáneas con `Promise.all`.

## Notas

- Para desarrollo local de funciones Edge, usar el CLI de Supabase (`supabase functions serve send-invitation`).
- En producción, desplegar la función y configurar las variables de entorno en el proyecto de Supabase.