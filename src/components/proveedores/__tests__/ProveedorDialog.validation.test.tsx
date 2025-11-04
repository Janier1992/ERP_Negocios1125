import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

// We will mock modules per-test using resetModules + doMock before dynamic import

describe('ProveedorDialog validation', () => {
  it('blocks submit on invalid email and shows error', async () => {
    vi.resetModules();

    const toastError = vi.fn();
    vi.doMock('sonner', () => ({ toast: { success: vi.fn(), error: toastError } }));

    let insertMock: any;
    vi.doMock('@/integrations/supabase/newClient', () => {
      const eq = vi.fn().mockReturnThis();
      const select = vi.fn().mockReturnThis();
      const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'prov_1' }, error: null });
      const insert = vi.fn(() => ({ select, maybeSingle }));
      const update = vi.fn().mockResolvedValue({ data: null, error: null });
      const auth = { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user_test' } }, error: null }) };
      const from = vi.fn((table: string) => ({ insert, update, eq } as any));
      insertMock = insert;
      return { supabase: { from, auth } };
    });

    vi.doMock('@/hooks/useUserProfile', () => ({
      useUserProfile: () => ({ empresaId: 'emp_test', loading: false }),
    }));

    const { ProveedorDialog } = await import('../ProveedorDialog');

    render(<ProveedorDialog onProveedorAdded={() => {}} />);

    fireEvent.click(screen.getByText('Nuevo Proveedor'));
    fireEvent.change(await screen.findByLabelText('Nombre *'), { target: { value: 'Proveedor X' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@demo' } });

    fireEvent.click(screen.getByRole('button', { name: /Guardar Proveedor/i }));

    expect(insertMock).not.toHaveBeenCalled();
    await screen.findByText('Email inválido');
    expect(toastError).toHaveBeenCalled();
  });

  it('blocks submit when empresaId missing', async () => {
    vi.resetModules();

    const toastError = vi.fn();
    vi.doMock('sonner', () => ({ toast: { success: vi.fn(), error: toastError } }));

    let insertMock: any;
    vi.doMock('@/integrations/supabase/newClient', () => {
      const eq = vi.fn().mockReturnThis();
      const select = vi.fn().mockReturnThis();
      const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'prov_2' }, error: null });
      const insert = vi.fn(() => ({ select, maybeSingle }));
      const update = vi.fn().mockResolvedValue({ data: null, error: null });
      const auth = { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user_test' } }, error: null }) };
      const from = vi.fn((table: string) => ({ insert, update, eq } as any));
      insertMock = insert;
      return { supabase: { from, auth } };
    });

    vi.doMock('@/hooks/useUserProfile', () => ({
      useUserProfile: () => ({ empresaId: null, loading: false }),
    }));

    const { ProveedorDialog } = await import('../ProveedorDialog');

    render(<ProveedorDialog onProveedorAdded={() => {}} />);

    fireEvent.click(screen.getByText('Nuevo Proveedor'));
    fireEvent.change(await screen.findByLabelText('Nombre *'), { target: { value: 'Proveedor Y' } });

    fireEvent.click(screen.getByRole('button', { name: /Guardar Proveedor/i }));

    expect(insertMock).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
  });
});