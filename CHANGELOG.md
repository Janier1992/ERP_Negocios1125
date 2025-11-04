# Historial de Cambios

## 2025-10-26

### Remoción de módulos innecesarios
- Eliminados completamente los módulos de `Compras` y `Promociones` del frontend.
- Archivos borrados:
  - `src/pages/Compras.tsx`
  - `src/pages/Promociones.tsx`
  - `src/pages/__tests__/Compras.render.test.tsx`
- Enrutamiento actualizado en `src/App.tsx`:
  - Eliminadas rutas `/compras` y `/promociones`.
  - Retiradas importaciones correspondientes.
- Menú de navegación actualizado en `src/components/layout/AppSidebar.tsx`:
  - Removidas entradas "Compras" y "Promociones".
  - Eliminados iconos no usados (`ShoppingBag`, `TicketPercent`).
- Verificación de dependencias cruzadas:
  - Sin referencias residuales a los componentes eliminados.
  - Mantenimiento de consultas a tablas `compras` desde otras páginas (p.ej. `Finanzas`) sin cambios.
- Pruebas:
  - Suite de Vitest ejecutada; `Finanzas.render.test.tsx` pasa.

Resultado: Aplicación más limpia y enfocada exclusivamente en administración del negocio.
# Changelog

## 2025-11-02
- Fix: Redirección automática al dashboard tras crear empresa desde Onboarding y Configuración.
- Enhancement: `useUserProfile.awaitEmpresaId` añade reintentos para hidratar `empresaId` y evitar la barrera de onboarding por latencia.
- Tests: Nuevas pruebas para validar creación de empresa y navegación posterior.

## 2025-11-04
### Auditoría y limpieza del código
- Análisis estático: identificados componentes, servicios, plantillas y dependencias no referenciadas.
- Archivos eliminados por no cumplir función esencial:
  - `src/components/onboarding/OnboardingScreen.tsx`
  - `src/components/onboarding/__tests__/OnboardingScreen.redirect.test.tsx`
  - `src/components/configuracion/PermissionsPanel.tsx`
  - `src/components/configuracion/__tests__/PermissionsPanel.test.tsx`
  - `src/services/invitations.ts`
  - `src/services/__tests__/invitations.service.test.ts`
  - `src/templates/invitationEmail.ts`
- Dependencias eliminadas en `package.json` por no ser utilizadas:
  - `cmdk`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-resizable-panels`, `recharts`, `vaul`.
- Verificación de integridad:
  - `npm install` ejecutado para actualizar `package-lock.json`.
  - `npm run build` completado sin errores; la UI y rutas principales permanecen operativas.
- Consideraciones:
  - La función Edge `send-invitation` incluye su propia plantilla; se elimina `src/templates/invitationEmail.ts` por duplicidad.
  - `next-themes` y `xlsx` se mantienen por uso en `sonner.tsx` y exportaciones/subidas.

Resultado: Proyecto simplificado con menor superficie de mantenimiento, sin afectar la funcionalidad principal.