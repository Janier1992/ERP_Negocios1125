# Módulo Finanzas

El módulo Finanzas presenta un resumen financiero consolidado por empresa:

- `ingresos_mes`: suma de `ventas.total` del mes actual.
- `egresos_mes`: suma del valor de compras `recibidas` (cantidad × precio por detalle) del mes actual.
- `balance_mes`: ingresos − egresos.
- `cuentas_por_pagar`: suma del valor de compras `pendientes`.

Flujo principal:

1. Se intenta obtener el resumen mediante el RPC `get_finanzas_resumen`.
2. Si el RPC falla, se activa el modo compatibilidad que calcula los totales directamente desde las tablas:
   - `ventas` → ingresos del mes (`created_at >= startOfMonth`).
   - `compras` + `compras_detalle` → egresos del mes (`estado = recibida`).
   - `compras` + `compras_detalle` → cuentas por pagar (`estado = pendiente`).

Dependencias:

- Tablas: `ventas`, `compras`, `compras_detalle`.
- Hook: `useUserProfile` (obtiene `empresaId`).

Pruebas:

- Prueba de renderizado con mocks del RPC fallando para validar que la pantalla se carga y el flujo de compatibilidad no rompe.
- Se recomienda añadir pruebas adicionales que verifiquen números concretos con datos mock.