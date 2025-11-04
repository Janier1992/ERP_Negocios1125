import { describe, it, expect, vi } from 'vitest';
import { validateEmail, validatePassword, adminCreateUser } from '@/services/users';

vi.mock('@/integrations/supabase/newClient', () => {
  const functions = {
    invoke: vi.fn(async (fn: string, _opts: any) => ({ data: { ok: fn === 'admin-create-user', user_id: 'u_new' }, error: null })),
  };
  return { supabase: { functions } };
});

describe('users service', () => {
  it('validateEmail works', () => {
    expect(validateEmail('a@x.com')).toBe(true);
    expect(validateEmail('bad')).toBe(false);
  });

  it('validatePassword enforces min rules', () => {
    expect(validatePassword('Password1')).toBe(true);
    expect(validatePassword('short')).toBe(false);
    expect(validatePassword('nonumeric')).toBe(false);
  });

  it('adminCreateUser invokes edge function', async () => {
    const res = await adminCreateUser('u@test.com', 'Password1', 'User Test', ['empleado']);
    expect(res.ok).toBe(true);
    expect(res.user_id).toBe('u_new');
  });
});