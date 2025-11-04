import { supabase } from "@/integrations/supabase/newClient";

export async function resendSignupConfirmationWithRetry(email: string, retries = 3, baseDelayMs = 500) {
  const addr = String(email || "").trim();
  if (!addr) throw new Error("Correo requerido");
  let lastErr: any = null;
  for (let i = 0; i < retries; i++) {
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: addr });
      if (error) throw error;
      // Log success (best-effort)
      try { await supabase.rpc("log_auth_email_event", { _email: addr, _type: "signup", _status: "sent", _message: null }); } catch { /* ignore */ }
      return { ok: true };
    } catch (err: any) {
      lastErr = err;
      // Log attempt failure (best-effort)
      try { await supabase.rpc("log_auth_email_event", { _email: addr, _type: "signup", _status: "retry_fail", _message: String(err?.message || "") }); } catch { /* ignore */ }
      const delay = baseDelayMs * Math.pow(2, i);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  const msg = String(lastErr?.message || "No se pudo reenviar el correo");
  // Final failure log
  try { await supabase.rpc("log_auth_email_event", { _email: addr, _type: "signup", _status: "failed", _message: msg }); } catch { /* ignore */ }
  return { ok: false, error: msg };
}