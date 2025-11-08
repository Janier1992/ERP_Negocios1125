import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2";

Deno.serve(async (req: Request) => {
  try {
    const { venta_id } = await req.json();

    if (!venta_id) {
      return new Response("Falta el campo venta_id", { status: 400 });
    }

    // ✅ Usamos las variables correctas guardadas en supabase secrets
    const supabase = createClient(
      Deno.env.get("PROJECT_URL")!,        // Reemplaza SUPABASE_URL
      Deno.env.get("SERVICE_ROLE_KEY")!,   // Permite leer tabla con RLS
      { global: { fetch } }
    );

    // ✅ Consultar venta
    const { data: venta, error } = await supabase
      .from("ventas")
      .select("*")
      .eq("id", venta_id)
      .single();

    if (error || !venta) {
      console.error(error);
      return new Response("Venta no encontrada", { status: 404 });
    }

    // ✅ Inicializar Resend con tu secret
    const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

    // ✅ Enviar correo
    await resend.emails.send({
      from: "Factura <facturacion@tu-dominio.com>", // Puedes cambiarlo
      to: venta.cliente_email,
      subject: `Factura de compra #${venta.id}`,
      html: `
        <h2>Gracias por tu compra!</h2>
        <p><strong>Cliente:</strong> ${venta.cliente}</p>
        <p><strong>Total pagado:</strong> $${venta.total}</p>
        <p><strong>Fecha:</strong> ${venta.created_at}</p>
        <br>
        <p>¡Gracias por preferirnos!</p>
      `,
    });

    return new Response("Correo enviado correctamente ✅", { status: 200 });

  } catch (err) {
    console.error(err);
    return new Response("Error interno", { status: 500 });
  }
});
