# Seguridad y Cumplimiento

Este documento resume políticas, medidas implementadas y recomendaciones para mantener la seguridad de la aplicación.

## Políticas Frontend
- Política CSP por entorno (inyectada vía configuración de build):
  - Producción: `default-src 'self'`; `script-src 'self' https://*.supabase.co`; `style-src 'self'`; `img-src 'self' data: https://*.supabase.co`; `connect-src 'self' https://*.supabase.co`; `font-src 'self' data:`; `frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'self'`; `upgrade-insecure-requests`.
  - Desarrollo: igual que producción, pero permitiendo `'unsafe-inline'` y `'unsafe-eval'` en `script-src`, `'unsafe-inline'` en `style-src` y `ws:` en `connect-src` para HMR.
- `referrer: strict-origin-when-cross-origin` para limitar el envío de cabeceras de referencia.
- Evitar inyección de fórmulas en exportaciones Excel/CSV mediante sanitización de valores que inicien con `=`, `-`, `+`, `@`.
- Validación de tipo y tamaño de archivos `.xlsx` (máx. 5MB) en cargas masivas.

## Buenas Prácticas
- No exponer claves o secretos en cliente.
- Validar entradas de usuario en cliente y servidor.
- Mantener RLS (Row Level Security) habilitado en Supabase y roles mínimos.
- Revisar dependencias con actualizaciones de seguridad periódicas.

## Procedimientos de Prueba
- Pruebas de responsividad y ausencia de desbordamiento horizontal.
- Verificación de sanitización en exportación: celdas peligrosas se prefijan con `'`.
- Validación de carga: rechazo por tipo o tamaño inválido.
- Verificación CSP por entorno:
  - Desarrollo: confirmar presencia de un único `<meta http-equiv="Content-Security-Policy">` y ausencia de violaciones; HMR activo.
  - Producción (build + preview): sin scripts inline; consola sin errores CSP; recursos de Supabase permitidos.

## Incidentes y Reporte
Para reportar vulnerabilidades, abrir un issue etiquetado como `security` con pasos de reproducción y alcance.