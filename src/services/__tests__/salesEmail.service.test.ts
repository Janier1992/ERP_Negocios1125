import { describe, it, expect, vi } from 'vitest';
import { sendSaleConfirmationWithRetry } from '@/services/salesEmail';

vi.mock('@/integrations/supabase/newClient', () => {
  return {
    supabase: {
      functions: {
        invoke: vi.fn(async (_fn: string, _opts: any) => ({ data: { ok: true }, error: null })),
      },
    },
  };
});

describe('salesEmail service', () => {
  it('sends sale confirmation successfully', async () => {
    const res = await sendSaleConfirmationWithRetry({
      to: 'c@x.com',
      clienteNombre: 'Cliente',
      direccion: 'Calle 123 Ciudad',
      ventaId: 'v1',
      empresaId: 'e1',
      total: 100,
      metodoPago: 'Efectivo',
      items: [{ nombre: 'Prod', cantidad: 1, precio: 100 }],
    });
    expect(res.ok).toBe(true);
  });
});