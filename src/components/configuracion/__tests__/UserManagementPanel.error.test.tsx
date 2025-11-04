import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { UserManagementPanel } from '../UserManagementPanel';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

vi.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ empresaId: 'emp_test', loading: false, profile: { id: 'u_admin', rol: 'admin' } }),
}));

// Mock dynamic import of services/users used by panel
vi.mock('@/services/users', () => ({
  validateEmail: (e: string) => /@/.test(e),
  validatePassword: (p: string) => p.length >= 8 && /\d/.test(p),
  adminCreateUser: vi.fn(async () => { throw new Error('weak_password'); }),
}));

describe('UserManagementPanel error mapping', () => {
  it('shows weak password message when edge function returns weak_password', async () => {
    render(<UserManagementPanel />);
    // Fill inputs
    const inputs = screen.getAllByPlaceholderText(/Contraseña|correo|Nombre completo/i);
    const emailInput = screen.getByPlaceholderText(/correo@dominio.com/i);
    const passInput = screen.getByPlaceholderText(/Contraseña/i);
    fireEvent.change(emailInput, { target: { value: 'user@test.com' } });
    fireEvent.change(passInput, { target: { value: 'Password1' } });
    const agregarBtn = screen.getByRole('button', { name: /^Agregar$/i });
    fireEvent.click(agregarBtn);
    await waitFor(() => {
      expect(screen.getByText(/Contraseña insegura/i)).toBeInTheDocument();
    });
  });
});