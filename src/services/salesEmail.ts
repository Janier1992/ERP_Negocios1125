import { supabase } from "@/integrations/supabase/newClient";

export type SaleConfirmationPayload = {
  to: string;
  clienteNombre: string | null;
  direccion: string;
  ventaId: string;
  empresaId: string | null;
  total: number;
  metodoPago: string;
  items: Array<{ nombre: string; cantidad: number; precio: number }>;
};

export async function sendSaleConfirmationWithRetry(payload: SaleConfirmationPayload, retries = 3, baseDelayMs = 500) {
  let lastErr: any = null;
  for (let i = 0; i < retries; i++) {
    try {
      const { error } = await supabase.functions.invoke("send-sale-confirmation", {
        body: { message: payload },
      });
      if (error) throw error;
      return { ok: true } as const;
    } catch (err: any) {
      lastErr = err;
      const delay = baseDelayMs * Math.pow(2, i);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  return { ok: false, error: String(lastErr?.message || "Fallo de envío") } as const;
}