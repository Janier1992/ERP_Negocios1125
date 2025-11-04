import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import Auth from '@/pages/Auth';

// Mock react-router navigate/location to avoid Router requirement
const navigateMock = vi.fn();
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ pathname: '/auth', search: '', hash: '', state: null, key: 'test' }),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}));

vi.mock('@/integrations/supabase/newClient', () => {
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: null } })),
    signInWithPassword: vi.fn(async () => ({ data: { session: { user: { id: 'u1' } } }, error: null })),
    signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
    resend: vi.fn(async () => ({ error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  };
  return { supabase: { auth } };
});

// Mock adminCreateUser para el nuevo flujo
const adminCreateUserMock = vi.fn(async () => ({ ok: true, user_id: 'u1' }));
vi.mock('@/services/users', () => ({
  adminCreateUser: (...args: any[]) => adminCreateUserMock(...args),
  validateEmail: (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
  validatePassword: (p: string) => /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(p),
}));

describe('Auth page render & validation', () => {
  it('shows registration fields and validates password policy', async () => {
    render(<Auth />);

    // Toggle to registration
    fireEvent.click(screen.getByText(/¿No tienes cuenta\? Regístrate/i));

    // Fill required business name
    fireEvent.change(screen.getByLabelText(/Nombre del negocio/i), { target: { value: 'Mi Negocio' } });
    fireEvent.change(screen.getByLabelText(/Nombre Completo/i), { target: { value: 'Juan Test' } });
    fireEvent.change(screen.getByLabelText(/Correo Electrónico/i), { target: { value: 'user@test.com' } });
    // Invalid password (too short / no number)
    fireEvent.change(screen.getByLabelText(/Contraseña/i), { target: { value: 'short' } });

    const submitBtn = screen.getByRole('button', { name: /Crear Cuenta/i });
    fireEvent.submit(submitBtn.closest('form')!);

    await waitFor(() => {
      const submitBtn2 = screen.getByRole('button', { name: /Crear Cuenta/i });
      expect(submitBtn2).toBeDisabled();
    });
  });
});