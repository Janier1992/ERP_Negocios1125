import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: {
    message: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ empresaId: 'emp_test', loading: false }),
}));

describe('Finanzas interactions', () => {
  it('Refrescar vencimientos vacía la lista (cambia dataset)', async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Flag para simular cambio de dataset tras el RPC
    let refreshed = false;

    vi.doMock('@/integrations/supabase/newClient', () => {
      const rpc = vi.fn().mockImplementation(async (fn: string) => {
        if (fn === 'refresh_cxp_estado') {
          refreshed = true;
          return { data: 1, error: null };
        }
        // Resumen por RPC para evitar fallback
        return { data: { ingresos_mes: 0, egresos_mes: 0, balance_mes: 0, cuentas_por_pagar: 0 }, error: null };
      });

      const createBuilder = (getResult: () => any) => {
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve(getResult()),
        };
        return builder;
      };

      const from = vi.fn((table: string) => {
        if (table === 'cuentas_por_pagar') {
          return createBuilder(() => {
            // Antes del refresh devuelve una fila pendiente; después devuelve lista vacía
            if (!refreshed) {
              return {
                data: [
                  { id: 'cxp1', empresa_id: 'emp_test', compra_id: 'cpend', proveedor_id: 'prov1', monto: 50, fecha_emision: new Date().toISOString(), fecha_vencimiento: new Date().toISOString(), estado: 'pendiente' },
                ],
                error: null,
              };
            }
            return { data: [], error: null };
          });
        }
        // Otras tablas devuelven vacío
        return createBuilder(() => ({ data: [], error: null }));
      });

      return { supabase: { rpc, from } };
    });

    const { default: Finanzas } = await import('../Finanzas');
    render(<Finanzas />);

    // Sección CxP muestra acciones disponibles
    const refreshBtn = await screen.findByRole('button', { name: 'Refrescar vencimientos' });
    const markBtnVisible = await screen.findByRole('button', { name: 'Marcar pagada' });
    expect(refreshBtn).toBeInTheDocument();
    expect(markBtnVisible).toBeInTheDocument();

    fireEvent.click(refreshBtn);

    // Tras refrescar, la lista queda vacía
    expect(await screen.findByText('No hay cuentas por pagar.')).toBeInTheDocument();
  });

  it('Marcar pagada oculta la fila pendiente', async () => {
    vi.resetModules();
    vi.clearAllMocks();

    vi.doMock('@/integrations/supabase/newClient', () => {
      const rpc = vi.fn().mockResolvedValue({ data: { ingresos_mes: 0, egresos_mes: 0, balance_mes: 0, cuentas_por_pagar: 0 }, error: null });

      let paid = false;
      const createBuilder = (resultFactory: () => any) => {
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve(resultFactory()),
        };
        return builder;
      };

      const updateBuilder = () => createBuilder(() => ({ data: { updated: 1 }, error: null }));

      const from = vi.fn((table: string) => {
        if (table === 'cuentas_por_pagar') {
          const builder = createBuilder(() => {
            if (!paid) {
              return { data: [ { id: 'cxp1', empresa_id: 'emp_test', compra_id: 'cpend', proveedor_id: 'prov1', monto: 50, fecha_emision: new Date().toISOString(), fecha_vencimiento: new Date().toISOString(), estado: 'pendiente' } ], error: null };
            }
            return { data: [], error: null };
          });
          builder.update = vi.fn(() => { paid = true; return updateBuilder(); });
          return builder;
        }
        return createBuilder(() => ({ data: [], error: null }));
      });

      return { supabase: { rpc, from } };
    });

    const { default: Finanzas } = await import('../Finanzas');
    render(<Finanzas />);

    // Confirma que hay acciones disponibles inicialmente
    const markBtn = await screen.findByRole('button', { name: 'Marcar pagada' });
    expect(markBtn).toBeInTheDocument();

    // Click en "Marcar pagada" debe actualizar estado local y desaparecer por filtro
    fireEvent.click(markBtn);

    // La fila pendiente ya no debe estar disponible
    expect(screen.queryByRole('button', { name: 'Marcar pagada' })).not.toBeInTheDocument();
  });
});