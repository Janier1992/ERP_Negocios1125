import { test, expect } from '@playwright/test';

// Pruebas de visualización en diferentes tamaños de pantalla.
// Ejecutar con: npx playwright test (requiere instalar playwright)

const viewports = [
  { name: 'mobile-320', width: 320, height: 640 },
  { name: 'mobile-375', width: 375, height: 667 },
  { name: 'mobile-414', width: 414, height: 736 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1024', width: 1024, height: 768 },
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
];

for (const vp of viewports) {
  test.describe(`Responsive layout @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('Header: iconos visibles sin scroll horizontal', async ({ page }) => {
      await page.goto('http://localhost:8080/');
      // Abre directamente el módulo de Inventario (ajusta ruta si es distinta)
      await page.goto('http://localhost:8080/inventario');

      const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
      expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth);

      // Verifica presencia de campana y toggle de tema en header
      const bell = page.locator('button[aria-label="Notificaciones"]');
      const theme = page.locator('button[aria-label="Cambiar tema"]');
      await expect(bell).toBeVisible();
      await expect(theme).toBeVisible();
    });

    test('Tabla/lista: información completa legible y scroll vertical en móviles', async ({ page }) => {
      await page.goto('http://localhost:8080/ventas');
      // Wrapper del Table genera scroll vertical en móviles
      const tableWrapper = page.locator('table').locator('xpath=..');
      await expect(tableWrapper).toBeVisible();
      const overflowY = await tableWrapper.evaluate((el) => getComputedStyle(el).overflowY);
      expect(["auto", "scroll", "visible"]).toContain(overflowY);
    });
  });
}