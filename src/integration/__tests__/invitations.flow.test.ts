import { describe, it, expect, vi } from 'vitest';
import { createAndSendInvitations } from '@/services/invitations';

vi.mock('@/integrations/supabase/newClient', () => {
  const rpc = vi.fn(async (name: string, args: any) => {
    if (name === 'create_empleado_invitation_ex') {
      return { data: `token_${args._email}`, error: null };
    }
    return { data: null, error: null };
  });
  const functions = {
    invoke: vi.fn(async (_fn: string, _opts: any) => ({ data: { ok: true }, error: null })),
  };
  return { supabase: { rpc, functions } };
});

describe('Invitations integration flow', () => {
  it('procesa carga de múltiples solicitudes simultáneas', async () => {
    const emails = Array.from({ length: 20 }, (_, i) => `u${i}@test.com`).join(',');
    const res = await createAndSendInvitations(emails, 'userx', 'empleado', 24, 'emp1', 'u_admin');
    expect(res.ok).toBe(true);
    expect(res.count).toBe(20);
  });

  it('fallback cuando falla el envío de correo', async () => {
    const mod = await import('@/integrations/supabase/newClient');
    (mod as any).supabase.functions.invoke = vi.fn(async () => ({ data: null, error: { message: 'failed' } }));
    const res = await createAndSendInvitations('err@test.com', 'userx', 'empleado', 24, 'emp1', 'u_admin');
    expect(res.ok).toBe(false);
    expect(res.count).toBe(1);
  });
});