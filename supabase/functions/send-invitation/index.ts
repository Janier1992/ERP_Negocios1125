// Deno Edge Function: send-invitation
// Env required: RESEND_API_KEY, MAIL_FROM, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "npm:@supabase/supabase-js";

type Message = {
  email: string;
  username?: string | null;
  token: string;
  link: string;
  empresaId?: string | null;
  createdBy?: string | null;
  expiresHours: number;
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY") || "");
const MAIL_FROM = Deno.env.get("MAIL_FROM") || "no-reply@minogocioerp.local";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function html(link: string, username?: string | null, expiresHours = 72) {
  return `<!DOCTYPE html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="max-width:600px;margin:0 auto;padding:24px;">
      <h2>Has sido invitado a Mi Negocio ERP</h2>
      <p>Hola${username ? ` ${username}` : ''},</p>
      <p>Has recibido una invitación para unirte a la empresa en Mi Negocio ERP.</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;">Aceptar invitación</a>
      </p>
      <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
      <p><a href="${link}">${link}</a></p>
      <p style="color:#6b7280;font-size:12px;">Esta invitación expira en ${expiresHours} horas.</p>
    </div>
  </body></html>`;
}

function text(link: string, username?: string | null, expiresHours = 72) {
  return `Hola${username ? ` ${username}` : ''},\n\nHas recibido una invitación para unirte a la empresa en Mi Negocio ERP.\nPara aceptar, abre este enlace: ${link}\n\nEsta invitación expira en ${expiresHours} horas.\n\nSi no esperabas este correo, puedes ignorarlo.`;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: { messages: Message[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const messages = body?.messages || [];
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "No messages" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const results: { email: string; ok: boolean; error?: string }[] = [];
  for (const m of messages) {
    try {
      await resend.emails.send({
        from: MAIL_FROM,
        to: m.email,
        subject: "Invitación a Mi Negocio ERP",
        html: html(m.link, m.username, m.expiresHours),
        text: text(m.link, m.username, m.expiresHours),
      });

      // Auditoría: registrar envío de correo
      try {
        await supabaseAdmin.from("auditoria").insert({
          empresa_id: m.empresaId,
          user_id: m.createdBy,
          action: "invitation_email_send",
          target_table: "empleados_invitaciones",
          details: { email: m.email, token: m.token },
        });
      } catch (_) {
        // ignore auditoría errors to not block email sending
      }

      results.push({ email: m.email, ok: true });
    } catch (err) {
      results.push({ email: m.email, ok: false, error: (err as any)?.message || "send error" });
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});