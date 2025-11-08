// Deno Edge Function: send-sale-confirmation
// Env required: RESEND_API_KEY, MAIL_FROM, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "npm:@supabase/supabase-js";

type Message = {
  to: string;
  clienteNombre: string | null;
  direccion: string;
  ventaId: string;
  empresaId: string | null;
  total: number;
  metodoPago: string;
  items: { nombre: string; cantidad: number; precio: number }[];
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY") || "");
const MAIL_FROM = Deno.env.get("MAIL_FROM") || "no-reply@minogocioerp.local";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const html = (m: Message) => {
  const itemsRows = m.items.map(i => `<tr><td>${i.nombre}</td><td style="text-align:center">${i.cantidad}</td><td style="text-align:right">$${i.precio.toFixed(2)}</td></tr>`).join("");
  return `
    <div style="font-family:system-ui, sans-serif;">
      <h2>Confirmación de tu compra</h2>
      <p>Hola ${m.clienteNombre || "Cliente"}, gracias por tu compra.</p>
      <p><strong>Venta #${m.ventaId}</strong></p>
      <p><strong>Método de pago:</strong> ${m.metodoPago}</p>
      <table style="width:100%; border-collapse:collapse" border="1" cellpadding="6">
        <thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th></tr></thead>
        <tbody>${itemsRows}</tbody>
      </table>
      <p style="text-align:right"><strong>Total:</strong> $${m.total.toFixed(2)}</p>
      <p><strong>Dirección de entrega:</strong> ${m.direccion}</p>
      <p>¡Gracias por confiar en nosotros!</p>
    </div>
  `;
};

const text = (m: Message) => {
  const lines = [
    `Confirmación de tu compra`,
    `Cliente: ${m.clienteNombre || "Cliente"}`,
    `Venta #${m.ventaId}`,
    `Método de pago: ${m.metodoPago}`,
    `Items:`,
    ...m.items.map(i => ` - ${i.nombre} x${i.cantidad} $${i.precio.toFixed(2)}`),
    `Total: $${m.total.toFixed(2)}`,
    `Dirección: ${m.direccion}`,
    `Gracias por tu compra`,
  ];
  return lines.join("\n");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: { message: Message };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const m = body?.message;
  if (!m || !m.to) {
    return new Response(JSON.stringify({ error: "Missing message/to" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    await resend.emails.send({
      from: MAIL_FROM,
      to: m.to,
      subject: `Confirmación de compra #${m.ventaId}`,
      html: html(m),
      text: text(m),
    });

    // Auditoría: registrar envío de correo de confirmación
    try {
      await supabaseAdmin.from("auditoria").insert({
        empresa_id: m.empresaId,
        action: "venta_email_confirmacion",
        entity: "ventas",
        details: { venta_id: m.ventaId, email: m.to },
      });
    } catch (_) {}

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    const msg = String((err as any)?.message || "send error");
    try {
      await supabaseAdmin.from("auditoria").insert({
        empresa_id: m?.empresaId || null,
        action: "venta_email_confirmacion_error",
        entity: "ventas",
        details: { venta_id: m?.ventaId, email: m?.to, error: msg },
      });
    } catch (_) {}
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
});