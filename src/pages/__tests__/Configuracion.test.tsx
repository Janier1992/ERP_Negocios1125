import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock navigate to avoid Router dependency
const navigateMock = vi.fn();
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// Mock useUserProfile to control empresaId/rol
vi.mock('@/hooks/useUserProfile', () => {
  return {
    useUserProfile: vi.fn(() => ({ empresaId: null, loading: false, profile: { rol: 'admin' }, refetch: vi.fn(async () => {}) }))
  };
});

// Mock company services
const mockRpc = vi.fn(async (_p: any) => 'emp_123');
const mockEdge = vi.fn(async (_p: any) => 'emp_123');
vi.mock('@/services/company', () => ({
  bootstrapEmpresaRpc: (...args: any[]) => mockRpc(...args),
  bootstrapEmpresaEdge: (...args: any[]) => mockEdge(...args),
}));

// Mock toast to avoid side-effects
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Import after mocks
import Configuracion from '@/pages/Configuracion';

describe('Configuracion - creación de empresa', () => {
  beforeEach(() => {
    mockRpc.mockClear();
    mockEdge.mockClear();
    navigateMock.mockClear();
  });

  it('muestra formulario de creación cuando no hay empresa y usuario es admin', async () => {
    render(<Configuracion />);

    const nombreInput = await screen.findByLabelText(/Nombre de la empresa/i);
    expect(nombreInput).toBeInTheDocument();

    fireEvent.change(nombreInput, { target: { value: 'Mi Empresa' } });
    const crearBtn = screen.getByRole('button', { name: /Crear empresa/i });
    fireEvent.click(crearBtn);

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledTimes(1);
    });
  });

  it('usa fallback Edge cuando RPC falla por cache de esquema', async () => {
    mockRpc.mockImplementationOnce(async () => { const err: any = new Error('schema cache out of date'); err.code = 'PGRST205'; throw err; });

    render(<Configuracion />);

    const nombreInput = await screen.findByLabelText(/Nombre de la empresa/i);
    fireEvent.change(nombreInput, { target: { value: 'Mi Empresa' } });
    const crearBtn = screen.getByRole('button', { name: /Crear empresa/i });
    fireEvent.click(crearBtn);

    await waitFor(() => {
      expect(mockEdge).toHaveBeenCalledTimes(1);
    });
  });
});