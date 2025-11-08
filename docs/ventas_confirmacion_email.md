# Confirmación por correo al registrar una venta

Este módulo envía un correo de confirmación al cliente cuando se registra una venta, con el detalle de ítems, método de pago y total.

## Flujo de aplicación

- La página de creación de ventas (`src/components/ventas/VentaDialog.tsx`) valida correo y dirección.
- Tras insertar la venta y el detalle, invoca el servicio `sendSaleConfirmationWithRetry` (`src/services/salesEmail.ts`).
- Si el envío se confirma, actualiza `public.ventas.confirmacion_enviada_at` con la hora de envío.
- Si falla, registra la venta igualmente y muestra aviso; el envío puede reintentarse manualmente más tarde si se añade esa acción.

## Requisitos

- Función Edge desplegada: `supabase/functions/send-sale-confirmation/index.ts`.
- Secretos en el proyecto Supabase:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY` (proveedor de correo)
  - `MAIL_FROM` (por ejemplo `no-reply@minogocioerp.com`)

## Configuración rápida (Windows / PowerShell)

1) Establecer secretos del proyecto:

```
pwsh .\scripts\set_supabase_secrets.ps1 -Env prod
```

Te pedirá los valores faltantes. También puede leerlos de `.env.secrets` si existe.

2) Desplegar funciones Edge:

```
pwsh .\scripts\deploy_edge_functions.ps1
```

El script incluye `send-sale-confirmation` y avisa si faltan secretos.

## Prueba funcional

- En la app, abre “Nueva Venta”, completa:
  - `Cliente (Opcional)`
  - `Correo del Cliente` (formato válido)
  - `Dirección completa` (texto no vacío)
  - Ítems de venta y método de pago
- Registra la venta. Deberías ver:
  - Notificación de “Venta registrada exitosamente”.
  - Si el correo se envía, el campo `confirmacion_enviada_at` queda poblado.
- Puedes verificar en el dashboard de tu proveedor de correo (Resend) el estado del envío.

## Consideraciones de entregabilidad

- Configura `SPF/DKIM/DMARC` en tu dominio para mejorar la entrega.
- Usa un `MAIL_FROM` del dominio autenticado.
- Evita contenido con spam words en la plantilla.

## Extensiones recomendadas

- Reenvío manual desde el historial de ventas si `confirmacion_enviada_at` está vacío.
- Etiqueta visual “Correo enviado” en la tabla de ventas basada en `confirmacion_enviada_at`.