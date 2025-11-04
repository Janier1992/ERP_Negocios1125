// Nuevo cliente de Supabase para conectar a una base distinta
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_NEW_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_NEW_SUPABASE_PUBLISHABLE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.warn('[Supabase] Faltan VITE_NEW_SUPABASE_URL o VITE_NEW_SUPABASE_PUBLISHABLE_KEY en .env.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});