# Módulo Compras

El módulo Compras permite:

- Crear órdenes de compra: selecciona proveedor, agrega productos con cantidad y precio, y guarda en `compras` y `compras_detalle`.
- Listado de compras: muestra proveedor, estado y total, con acciones por fila.
- Recepción de compras: intenta ejecutar `apply_purchase_stock` (RPC). Si falla, utiliza modo compatibilidad:
  1. Actualiza la compra a estado `recibida`.
  2. Suma las cantidades de cada detalle al `stock` del producto correspondiente.
- Anulación de compras: cambia el estado a `anulada`.

Integraciones y dependencias:

- Tablas: `compras`, `compras_detalle`, `productos`, `proveedores`.
- Hook: `useUserProfile` para `empresaId` y estado de perfil.
- UI: componentes de formulario, select y tabla.

Validaciones clave:

- Debe existir `empresaId` (usuario vinculado a empresa).
- Proveedor obligatorio y al menos un producto con cantidad > 0 y precio >= 0.

Pruebas:

- Render básico con mocks de Supabase y `useUserProfile`.
- Se recomienda añadir pruebas de flujo: creación y recepción (mockeando insert/update y RPC).