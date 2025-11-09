# Informe de Seguridad

Fecha: 2025-11-09

## Resumen de Vulnerabilidades Identificadas
- Riesgo de inyección de fórmulas al exportar Excel/CSV desde `DataTable`.
- Cargas masivas de Excel sin limitar el tipo MIME ni tamaño.
- Falta de encabezados de seguridad en `index.html` (CSP, referrer).

## Soluciones Implementadas
- Sanitización de valores exportados a Excel: prefijo `'` cuando comienzan con `=`, `+`, `-`, `@`.
- Validación de tipo y tamaño en componentes `ExcelUploadDialog` (inventario, ventas, proveedores): solo `.xlsx`, tamaño ≤ 5MB.
- Política CSP por entorno (inyectada en build): estricta en producción sin `'unsafe-inline'`/`'unsafe-eval'`; desarrollo permite HMR con `ws:`.
- `referrer: strict-origin-when-cross-origin`.

## Pruebas de Seguridad Realizadas
- Exportación con datos que empiezan con `=SUM(1,2)`, `+10`, `-5`, `@cmd` verifica celda con comilla simple.
- Intento de subir `.xls`, `.csv`, y archivo de 10MB: se rechaza con mensaje de error.
- Verificación CSP desarrollo: un único meta CSP, HMR activo, sin violaciones.
- Verificación CSP producción (build + preview): sin scripts inline, consola sin errores CSP, recursos de Supabase permitidos.

## Impacto en la Funcionalidad Existente
- Exportaciones mantienen contenido visible; sanitización no altera los valores mostrados en Excel.
- Cargas válidas `.xlsx` funcionan sin cambios en flujo; archivos inválidos son bloqueados de forma temprana.
- La CSP permite el dev server y Supabase; no se detectan bloqueos en recursos requeridos.

## Recomendaciones de Mantenimiento
- Auditorías periódicas de dependencias (`npm audit`, `pnpm audit`) y actualización de paquetes.
- Revisar RLS en Supabase: asegurar políticas por `company_id` y roles mínimos.
- Añadir pruebas unitarias para sanitización de exportación y validadores de carga.
- Considerar registro de auditoría (quién exporta/importa y cuándo) y límites de filas en importación.
- Mantener `'unsafe-inline'`/`'unsafe-eval'` sólo en desarrollo; evitar scripts inline en producción (ya migrado a `main.tsx`).