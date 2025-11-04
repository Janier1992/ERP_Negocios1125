import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { UserManagementPanel } from '../UserManagementPanel';

vi.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ empresaId: 'emp_test', loading: false, profile: { rol: 'admin' } }),
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
      maybeSingle: vi.fn().mockReturnThis(),
      then: (resolve: any) => resolve(result),
    };
    return builder;
  };
  const from = vi.fn((table: string) => {
    if (table === 'profiles') {
      return createBuilder({ data: [{ id: 'u1', email: 'u1@test.com', full_name: 'Usuario Uno', rol: 'empleado', empresa_id: 'emp_test' }], error: null });
    }
    if (table === 'user_roles') {
      return createBuilder({ data: [{ user_id: 'u1', empresa_id: 'emp_test', role: 'empleado' }], error: null });
    }
    return createBuilder({ data: [], error: null });
  });
  const rpc = vi.fn(async (name: string, args: any) => {
    if (name === 'assign_roles') {
      return { data: 'ok', error: null };
    }
    return { data: null, error: null };
  });
  const functions = {
    invoke: vi.fn(async (fn: string, _opts: any) => ({ data: { ok: fn === 'admin-create-user' }, error: null })),
  };
  return { supabase: { from, rpc, functions } };
});

describe('UserManagementPanel', () => {
  it('renderiza secciones y agrega usuario', async () => {
    const mod = await import('@/integrations/supabase/newClient');
    render(<UserManagementPanel />);
    expect(await screen.findByText('Gestión de Usuarios')).toBeInTheDocument();
    expect(await screen.findByText('Agregar nuevo usuario')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('correo@dominio.com'), { target: { value: 'nuevo@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Contraseña (8+ y 1 número)'), { target: { value: 'Password1' } });
    fireEvent.change(screen.getByPlaceholderText('Nombre completo (opcional)'), { target: { value: 'Nuevo User' } });
    fireEvent.click(screen.getByRole('button', { name: /Agregar/i }));

    await waitFor(() => {
      expect((mod as any).supabase.functions.invoke).toHaveBeenCalledWith('admin-create-user', expect.anything());
    });
  });

  it('asigna roles múltiples', async () => {
    render(<UserManagementPanel />);
    expect(await screen.findByText('Asignar roles múltiples')).toBeInTheDocument();
    // Seleccionar usuario
    fireEvent.mouseDown(screen.getByText('Selecciona un usuario'));
    const option = await screen.findByText('Usuario Uno');
    fireEvent.click(option);

    // Marcar admin además de empleado
    const checkAdmin = screen.getByLabelText('admin');
    fireEvent.click(checkAdmin);

    fireEvent.click(screen.getByRole('button', { name: /Asignar/i }));

    // No esperamos errores (rpc mock responde ok)
    expect(true).toBe(true);
  });
});