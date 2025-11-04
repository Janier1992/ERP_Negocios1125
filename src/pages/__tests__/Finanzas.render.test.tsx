import React from 'react';
import { render, screen } from '@testing-library/react';
import Finanzas from '../Finanzas';
import { vi } from 'vitest';

vi.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ empresaId: 'emp_test', loading: false }),
}));

// Ajuste de mocks: emular el builder encadenable de Supabase (thenable)
vi.mock('@/integrations/supabase/newClient', () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('rpc unavailable') });

  const createBuilder = (result: any) => {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (resolve: any) => resolve(result),
    };
    return builder;
  };

  const from = vi.fn((table: string) => {
    switch (table) {
      case 'ventas':
        return createBuilder({ data: [], error: null });
      case 'compras':
        return createBuilder({ data: [], error: null });
      case 'compras_detalle':
        return createBuilder({ data: [], error: null });
      case 'cuentas_por_pagar':
        return createBuilder({ data: [], error: null });
      default:
        return createBuilder({ data: [], error: null });
    }
  });

  return { supabase: { rpc, from } };
});

describe('Finanzas page', () => {
  it('renders Finanzas title', async () => {
    render(<Finanzas />);
    expect(await screen.findByText('Finanzas')).toBeInTheDocument();
  });

  it('muestra montos en 0 con datos vacíos', async () => {
    render(<Finanzas />);
    expect(await screen.findByText('Ingresos (Mes)')).toBeInTheDocument();
    expect(await screen.findAllByText(/\$0\.00/)).not.toHaveLength(0);
    // El listado de CxP debe mostrar vacío
    expect(await screen.findByText('No hay cuentas por pagar.')).toBeInTheDocument();
  });

  it('modo compatibilidad ante PGRST205 en tablas', async () => {
    vi.resetModules();
    vi.doMock('@/hooks/useUserProfile', () => ({
      useUserProfile: () => ({ empresaId: 'emp_test', loading: false }),
    }));
    vi.doMock('@/integrations/supabase/newClient', () => {
      const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('rpc unavailable') });
      const createBuilder = (result: any) => {
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve(result),
        };
        return builder;
      };
      const from = (table: string) => {
        switch (table) {
          case 'ventas':
            return createBuilder({ data: null, error: { code: 'PGRST205', message: 'not found' } });
          case 'compras':
            return createBuilder({ data: null, error: { code: 'PGRST205', message: 'not found' } });
          case 'compras_detalle':
            return createBuilder({ data: null, error: { code: 'PGRST205', message: 'not found' } });
          case 'cuentas_por_pagar':
            return createBuilder({ data: [], error: null });
          default:
            return createBuilder({ data: [], error: null });
        }
      };
      return { supabase: { rpc, from } };
    });
    const { default: FinanzasCompat } = await import('../Finanzas');
    render(<FinanzasCompat />);
    expect(await screen.findByText('Finanzas')).toBeInTheDocument();
    // Debe renderizar sin crashear y mostrar 0s
    expect(await screen.findAllByText(/\$0\.00/)).not.toHaveLength(0);
    expect(await screen.findByText('No hay cuentas por pagar.')).toBeInTheDocument();
  });

  it('calcula resumen con datos de ejemplo', async () => {
    vi.resetModules();
    vi.doMock('@/hooks/useUserProfile', () => ({
      useUserProfile: () => ({ empresaId: 'emp_test', loading: false }),
    }));
    vi.doMock('@/integrations/supabase/newClient', () => {
      // En este caso probamos el flujo normal vía RPC
      const rpc = vi.fn().mockResolvedValue({
        data: { ingresos_mes: 100, egresos_mes: 40, balance_mes: 60, cuentas_por_pagar: 0 },
        error: null,
      });
      const createBuilder = (result: any) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve(result),
      });
      const from = vi.fn(() => createBuilder({ data: [], error: null }));
      return { supabase: { rpc, from } };
    });
    const { default: FinanzasCalc } = await import('../Finanzas');
    render(<FinanzasCalc />);
    expect(await screen.findByText('Finanzas')).toBeInTheDocument();
    // ingresos: 100, egresos: 40, balance: 60
    expect(await screen.findByText('$100.00')).toBeInTheDocument();
    expect(await screen.findByText('$40.00')).toBeInTheDocument();
    expect(await screen.findByText('$60.00')).toBeInTheDocument();
  });
});