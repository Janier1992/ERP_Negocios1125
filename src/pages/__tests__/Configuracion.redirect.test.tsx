import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import Configuracion from '@/pages/Configuracion';

// Mock navigate
const navigateMock = vi.fn();
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// Mock useUserProfile with awaitEmpresaId
const awaitEmpresaIdMock = vi.fn(async () => true);
const refetchMock = vi.fn(async () => {});
vi.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ empresaId: null, loading: false, profile: { rol: 'admin' }, refetch: refetchMock, awaitEmpresaId: awaitEmpresaIdMock }),
}));

// Mock supabase insert/select for empresa fetch
vi.mock('@/integrations/supabase/newClient', () => ({
  supabase: {
    from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null }) }) }),
  },
}));

// Mock company services
const bootstrapRpcMock = vi.fn(async () => 'emp_123');
const bootstrapEdgeMock = vi.fn(async () => 'emp_123');
vi.mock('@/services/company', () => ({
  bootstrapEmpresaRpc: (...args: any[]) => bootstrapRpcMock(...args),
  bootstrapEmpresaEdge: (...args: any[]) => bootstrapEdgeMock(...args),
  verifyEmpresaExists: async () => true,
}));

describe('Configuracion - redirige tras crear empresa', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    awaitEmpresaIdMock.mockClear();
    refetchMock.mockClear();
    bootstrapRpcMock.mockClear();
    bootstrapEdgeMock.mockClear();
  });

  it('muestra creación y navega al dashboard al terminar', async () => {
    render(<Configuracion />);

    const nombreInput = await screen.findByLabelText(/Nombre de la empresa/i);
    fireEvent.change(nombreInput, { target: { value: 'Mi Empresa' } });

    const crearBtn = screen.getByRole('button', { name: /Crear empresa/i });
    fireEvent.click(crearBtn);

  await waitFor(() => {
    expect(bootstrapRpcMock).toHaveBeenCalled();
    expect(refetchMock).toHaveBeenCalled();
    expect(awaitEmpresaIdMock).toHaveBeenCalled();
    const args = navigateMock.mock.calls.find(([path]) => path === '/');
    expect(args?.[1]).toEqual(expect.objectContaining({ replace: true }));
    expect(args?.[1]?.state).toEqual(expect.objectContaining({ hydratingEmpresa: true, postCreate: true }));
    expect(screen.getByText(/Redirigiendo a los módulos/i)).toBeInTheDocument();
  });
  });
});