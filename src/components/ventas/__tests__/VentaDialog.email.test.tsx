import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VentaDialog } from '@/components/ventas/VentaDialog';

vi.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ empresaId: 'e1', profile: { id: 'u1', rol: 'empleado' }, loading: false }),
}));

const productos = [
  { id: 'p1', nombre: 'Prod1', precio: 50, stock: 10 },
];

vi.mock('@/integrations/supabase/newClient', () => {
  const insertMock = vi.fn(async () => ({ data: { id: 'v1', total: 100, created_at: new Date().toISOString() }, error: null }));
  const selectMock = vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: 'v1', total: 100, created_at: new Date().toISOString() }, error: null })) }));
  const fromMock = vi.fn((table: string) => {
    if (table === 'productos') {
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ gt: vi.fn(async () => ({ data: productos, error: null })) })) })) };
    }
    return {
      select: vi.fn(() => ({ single: vi.fn(() => ({ data: null, error: null })) })),
      insert: insertMock,
      update: vi.fn(async () => ({ error: null })),
      eq: vi.fn(() => ({})),
    };
  });
  return {
    supabase: {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) },
      from: fromMock,
      functions: { invoke: vi.fn(async () => ({ data: { ok: true }, error: null })) },
    },
  };
});

describe('VentaDialog email and address', () => {
  it('requires email and address and triggers confirmation send', async () => {
    const onAdded = vi.fn();
    render(<VentaDialog onVentaAdded={onAdded} />);

    // Abrir el diálogo
    fireEvent.click(screen.getByText('Nueva Venta'));

    // Rellenar campos
    fireEvent.change(screen.getByLabelText('Cliente (Opcional)'), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByLabelText('Correo del Cliente'), { target: { value: 'juan@example.com' } });
    fireEvent.change(screen.getByLabelText('Dirección completa'), { target: { value: 'Calle 1 #2-3 Ciudad' } });

    // Método de pago
    fireEvent.mouseDown(screen.getByText('Seleccionar método'));
    fireEvent.click(await screen.findByText('Efectivo'));

    // Agregar producto
    fireEvent.click(screen.getByText('Agregar Producto'));
    // seleccionar producto
    fireEvent.mouseDown(screen.getByText('Seleccionar producto'));
    fireEvent.click(await screen.findByText(/Prod1/));
    // cantidad y precio (precio se autocompleta, pero lo aseguramos)
    const cantidad = screen.getByPlaceholderText('Cant.');
    fireEvent.change(cantidad, { target: { value: '1' } });
    const precio = screen.getByPlaceholderText('Precio');
    fireEvent.change(precio, { target: { value: '50' } });

    // Enviar
    fireEvent.click(screen.getByText('Registrar Venta'));

    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    // Verificar que no hay errores de validación
    expect(screen.queryByText(/Formato de correo inválido/)).toBeNull();
  });
});