import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { UserManagementPanel } from '../UserManagementPanel';

vi.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ empresaId: 'emp_test', loading: false, profile: { id: 'u_admin', rol: 'admin' } }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/integrations/supabase/newClient', () => {
  const createBuilder = (result: any) => {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (resolve: any) => resolve(result),
    };
    return builder;
  };
  const from = vi.fn((table: string) => {
    if (table === 'profiles') {
      return createBuilder({ data: [], error: null });
    }
    return createBuilder({ data: [], error: null });
  });
  const rpc = vi.fn(async (name: string, args: any) => {
    if (name === 'create_empleado_invitation_ex') {
      return { data: `token_${args._email}`, error: null };
    }
    return { data: null, error: null };
  });
  const functions = {
    invoke: vi.fn(async () => ({ data: { ok: true }, error: null })),
  };
  return { supabase: { from, rpc, functions } };
});

describe('UserManagementPanel - validación de contraseña', () => {
  it('deshabilita Agregar con contraseña insegura', async () => {
    render(<UserManagementPanel />);
    expect(await screen.findByText('Agregar nuevo usuario')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('correo@dominio.com'), { target: { value: 'uno@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Contraseña (8+ y 1 número)'), { target: { value: 'short' } });

    const btn = screen.getByRole('button', { name: /Agregar/i });
    expect(btn).toBeDisabled();
  });
});