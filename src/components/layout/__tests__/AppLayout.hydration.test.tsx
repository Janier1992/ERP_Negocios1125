import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';
import { AppLayout } from '../AppLayout';

// Mock mutable store for useUserProfile
let empresaIdValue: string | null = null;
let loadingValue = false;
const refetchMock = vi.fn(async () => {});
vi.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ empresaId: empresaIdValue, loading: loadingValue, refetch: refetchMock }),
}));

// Avoid supabase calls in layout logout button
vi.mock('@/integrations/supabase/newClient', () => ({
  supabase: { auth: { signOut: async () => ({}) } },
}));

describe('AppLayout - hidratación y cierre de Onboarding', () => {
  // Mock matchMedia para el hook de mobile en AppSidebar
  beforeAll(() => {
    // @ts-expect-error
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });
  beforeEach(() => {
    empresaIdValue = null;
    loadingValue = false;
    refetchMock.mockClear();
  });

  it('muestra overlay de hidratación cuando se navega con hydratingEmpresa y oculta Onboarding', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/', state: { hydratingEmpresa: true } }]}> 
        <Routes>
          <Route path="/" element={<AppLayout />}> 
            <Route index element={<div>Dashboard Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/Hidratando tu perfil de empresa/i)).toBeInTheDocument();
    expect(screen.queryByText(/Configura tu empresa/i)).not.toBeInTheDocument();

    // Al hidratar empresaId, debe ocultarse el overlay y renderizar el contenido del dashboard
    empresaIdValue = 'emp_1';
    // Limpiar render previo y renderizar nuevamente
    cleanup();
    render(
      <MemoryRouter initialEntries={[{ pathname: '/' }]}> 
        <Routes>
          <Route path="/" element={<AppLayout />}> 
            <Route index element={<div>Dashboard Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText(/Hidratando tu perfil de empresa/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Dashboard Content/i)).toBeInTheDocument();
  });


  it('renderiza módulos cuando empresaId está presente y permite navegar a Inventario', () => {
    // Estado inicial: con empresa → mostrar contenido
    empresaIdValue = 'emp_1';
    render(
      <MemoryRouter initialEntries={[{ pathname: '/' }]}> 
        <Routes>
          <Route path="/" element={<AppLayout />}> 
            <Route index element={<div>Dashboard Content</div>} />
            <Route path="inventario" element={<div>Inventario Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/Dashboard Content/i)).toBeInTheDocument();

    // Navegar a Inventario
    const inventarioLink = screen.getByText(/Inventario/i);
    fireEvent.click(inventarioLink);

    expect(screen.getByText(/Inventario Content/i)).toBeInTheDocument();
  });
});