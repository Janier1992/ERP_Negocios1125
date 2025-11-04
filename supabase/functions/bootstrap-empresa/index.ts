// Edge Function: bootstrap-empresa
// Crea una empresa y vincula el perfil del usuario actual como admin.
// Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY configurados en el entorno de funciones.

import { createClient } from "@supabase/supabase-js";

// Minimal request/response helpers
const json = (body: any, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});

export const config = {
  runtime: "edge",
};

export default async function handler(req: Request) {
  try {
    const url = process.env.SUPABASE_URL as string;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    if (!url || !key) {
      return json({ error: "missing_env", message: "SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados" }, 500);
    }

    const supabaseAdmin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

    // Extraer JWT del usuario que invoca
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return json({ error: "unauthenticated", message: "Falta token de autorización" }, 401);
    }

    const userRes = await supabaseAdmin.auth.getUser(jwt);
    if (userRes.error || !userRes.data.user) {
      return json({ error: "unauthenticated", message: "Token inválido o usuario no encontrado" }, 401);
    }
    const user = userRes.data.user;

    const body = await req.json().catch(() => ({}));
    const nombre = String(body?.nombre || body?._nombre || "").trim();
    const descripcion = body?.descripcion ?? body?._descripcion ?? null;

    if (!nombre || nombre.length < 2) {
      return json({ error: "validation", message: "El nombre de la empresa es requerido" }, 400);
    }

    // Crear empresa y vincular perfil
    const { data: empresa, error: empErr } = await supabaseAdmin
      .from("empresas")
      .insert({ nombre, descripcion: descripcion })
      .select("id")
      .single();
    if (empErr) return json({ error: "db_error", message: empErr.message }, 500);

    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({ empresa_id: empresa.id, rol: "admin" })
      .eq("id", user.id);
    if (profErr) return json({ error: "profile_update_failed", message: profErr.message }, 500);

    // Asegurar rol admin
    await supabaseAdmin.from("user_roles").upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });

    // Semilla mínima
    await supabaseAdmin.from("categorias").insert({ empresa_id: empresa.id, nombre: "General" }).select("id");

    // Auditoría
    await supabaseAdmin.from("auditoria").insert({
      empresa_id: empresa.id,
      action: "bootstrap_empresa_edge",
      entity: "public.empresas",
      details: { nombre, descripcion },
      actor_id: user.id,
    });

    return json({ ok: true, empresa_id: empresa.id }, 200);
  } catch (err: any) {
    return json({ error: "internal_error", message: String(err?.message || "") }, 500);
  }
}