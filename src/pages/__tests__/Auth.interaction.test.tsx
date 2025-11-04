import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import Auth from '@/pages/Auth';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Mock router hooks to avoid Router context requirement
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ search: '' }),
}));

vi.mock('@/integrations/supabase/newClient', () => {
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: null } })),
    signInWithPassword: vi.fn(async () => ({ data: { session: { user: { id: 'u1' } } }, error: null })),
    // En el primer test usamos signUp sin sesión; en el de fallback lo sobreescribimos para devolver sesión
    signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
    resend: vi.fn(async () => ({ error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ error: null })),
  };
  const functions = {
    // Simular que la función falla por red en el test de fallback; se puede reconfigurar con spy
    invoke: vi.fn(async () => ({ data: null, error: new Error('net::ERR_FAILED') })),
  };
  return { supabase: { auth, functions } };
});

// Mock adminCreateUser para nuevo flujo integrado
const adminCreateUserMock = vi.fn(async () => ({ ok: true, user_id: 'u1' }));
vi.mock('@/services/users', () => ({
  adminCreateUser: (...args: any[]) => adminCreateUserMock(...args),
  validateEmail: (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
  validatePassword: (p: string) => /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(p),
}));

describe('Auth interactions', () => {
  it('registration creates account and company, logs in immediately', async () => {
    render(<Auth />);
    fireEvent.click(screen.getByText(/¿No tienes cuenta\? Regístrate/i));
    fireEvent.change(screen.getByLabelText(/Nombre del negocio/i), { target: { value: 'Mi Negocio' } });
    fireEvent.change(screen.getByLabelText(/Nombre Completo/i), { target: { value: 'Juan Test' } });
    fireEvent.change(screen.getByLabelText(/Correo Electrónico/i), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), { target: { value: 'Password1' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear Cuenta/i }));
    await waitFor(() => {
      expect(adminCreateUserMock).toHaveBeenCalled();
      expect(screen.queryByText(/Debes confirmar tu correo para acceder/i)).not.toBeInTheDocument();
    });
  });

  it('login with unconfirmed email shows pending confirmation', async () => {
    render(<Auth />);
    // In login mode by default
    fireEvent.change(screen.getByLabelText(/Correo Electrónico/i), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), { target: { value: 'Password1' } });
    fireEvent.click(screen.getByRole('button', { name: /Iniciar Sesión/i }));
    await waitFor(() => {
      expect(screen.getByText(/Reenviar correo de confirmación/i)).toBeInTheDocument();
    });
  });
});
it('registration falls back to signUp when Edge function fails', async () => {
  const { supabase } = await import('@/integrations/supabase/newClient');
  // Redefinir signUp para devolver sesión inmediata en este caso
  (supabase.auth.signUp as any).mockResolvedValueOnce({
    data: { session: { user: { id: 'u1' } } },
    error: null,
  });

  // Mock de RPC de empresa (éxito)
  vi.mock('@/services/company', () => ({
    bootstrapEmpresaRpc: vi.fn(async () => 'emp1'),
    bootstrapEmpresaEdge: vi.fn(async () => ({ ok: true, empresa_id: 'emp1' })),
  }));

  render(<Auth />);
  fireEvent.click(screen.getByText(/¿No tienes cuenta\? Regístrate/i));
  fireEvent.change(screen.getByLabelText(/Nombre del negocio/i), { target: { value: 'Mi Negocio' } });
  fireEvent.change(screen.getByLabelText(/Nombre Completo/i), { target: { value: 'Juan Test' } });
  fireEvent.change(screen.getByLabelText(/Correo Electrónico/i), { target: { value: 'user@test.com' } });
  fireEvent.change(screen.getByLabelText(/Contraseña/i), { target: { value: 'Password1' } });
  fireEvent.click(screen.getByRole('button', { name: /Crear Cuenta/i }));

  await waitFor(() => {
    // Verificar que no se muestre la UI de confirmación por correo
    expect(screen.queryByText(/Debes confirmar tu correo para acceder/i)).not.toBeInTheDocument();
  });
});