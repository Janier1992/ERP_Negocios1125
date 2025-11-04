import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ empresaId: 'emp_test', loading: false }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock Supabase client for insert flow (define inside vi.mock to avoid hoist issues)
var insertMock: any;

vi.mock('@/integrations/supabase/newClient', () => {
  const eq = vi.fn().mockReturnThis();
  const select = vi.fn().mockReturnThis();
  const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'prov_1' }, error: null });
  const insert = vi.fn(() => ({ select, maybeSingle }));
  const update = vi.fn().mockResolvedValue({ data: null, error: null });
  const from = vi.fn((table: string) => {
    if (table === 'proveedores') {
      return { insert, update, eq } as any;
    }
    return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) } as any;
  });
  insertMock = insert;
  const auth = { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user_test' } }, error: null }) };
  return { supabase: { from, auth } };
});

import { ProveedorDialog } from '../ProveedorDialog';

describe('ProveedorDialog creation flow', () => {
  it('opens dialog and submits new proveedor', async () => {
    const onAdded = vi.fn();
    render(<ProveedorDialog onProveedorAdded={onAdded} />);

    // Open dialog via trigger
    fireEvent.click(screen.getByText('Nuevo Proveedor'));

    // Fill required name
    const nombreInput = await screen.findByLabelText('Nombre *');
    fireEvent.change(nombreInput, { target: { value: 'Proveedor Test' } });

    // Optional fields
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@proveedor.com' } });
    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '+34 600 000 000' } });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /Guardar Proveedor/i }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledTimes(1);
    });

    // Validate payload includes empresa_id and nombre
    const payload = insertMock.mock.calls[0][0];
    expect(payload).toMatchObject({
      nombre: 'Proveedor Test',
      empresa_id: 'emp_test',
    });

    // Callback fired and dialog closes
    expect(onAdded).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Guardar Proveedor/i })).toBeNull();
    });
  });
});