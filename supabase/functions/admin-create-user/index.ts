// Deno Edge Function: admin-create-user
// Env required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

type CreateUserPayload = {
  email: string;
  password: string;
  full_name?: string | null;
  roles?: ("admin" | "empleado" | "viewer")[];
  username?: string | null;
  business_name?: string | null; // opcional: crear empresa en bootstrap
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordOk = (p: string) => /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(p);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

serve(async (req) => {
  try {
    // Preflight CORS
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    let bootstrap = false;
    let caller: { user?: { id: string } } = {};
    if (!token) {
      // Permitir bootstrap sin auth si el proyecto no tiene usuarios
      const { data: usersList, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
      if (listErr) {
        return json({ error: "internal_error", message: listErr.message }, 500);
      }
      if ((usersList?.users?.length || 0) === 0) {
        bootstrap = true;
      } else {
        return json({ error: "unauthorized" }, 401);
      }
    } else {
      const { data: _caller, error: callerErr } = await supabaseAdmin.auth.getUser(token!);
      if (callerErr || !_caller?.user?.id) {
        return json({ error: "unauthorized" }, 401);
      }
      caller = _caller as any;
    }

    const body = (await req.json()) as CreateUserPayload;
    const email = (body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const full_name = body.full_name || null;
    const username = body.username || null;
    const roles = Array.isArray(body.roles) && body.roles.length ? body.roles : ["empleado"];

    if (!emailRegex.test(email)) {
      return json({ error: "invalid_email" }, 400);
    }
    if (!passwordOk(password)) {
      return json({ error: "weak_password" }, 400);
    }

    // Check permission manage_users for caller unless bootstrap
    if (!bootstrap) {
      const { data: allowed, error: permErr } = await supabaseAdmin.rpc("has_permission", {
        _user_id: caller.user!.id,
        _permission_key: "manage_users",
      });
      if (permErr) {
        return json({ error: "permission_check_failed" }, 500);
      }
      if (!allowed) {
        return json({ error: "forbidden" }, 403);
      }
    }

    // Find caller empresa_id
    let empresaId: string | null = null;
    let empresaName = (body as any).business_name || null;
    if (bootstrap) {
      // Crear empresa en bootstrap si se provee nombre
      if (empresaName && empresaName.trim()) {
        const { data: emp, error: empErr } = await supabaseAdmin
          .from("empresas")
          .insert({ nombre: empresaName.trim() })
          .select("id")
          .single();
        if (!empErr) empresaId = emp?.id || null;
      }
    } else {
      const { data: callerProfile } = await supabaseAdmin
        .from("profiles")
        .select("empresa_id")
        .eq("id", caller.user!.id)
        .maybeSingle();
      empresaId = callerProfile?.empresa_id || null;
    }

    // Create user via Admin API, set email_confirm to true so user can log in immediately
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, created_by: caller.user?.id || "bootstrap" },
    });

    if (createErr) {
      const rawMsg = String((createErr as any)?.message || "");
      const low = rawMsg.toLowerCase();
      if (/exists|already/.test(low)) {
        return json({ error: "email_exists", message: rawMsg }, 409);
      }
      if (/apikey|service|not allowed|forbidden|permission|admin/i.test(low)) {
        // Falta SUPABASE_SERVICE_ROLE_KEY o la clave no es válida
        return json({ error: "admin_api_forbidden", message: rawMsg }, 403);
      }
      return json({ error: "create_failed", message: rawMsg }, 500);
    }

    const userId = created.user?.id;
    if (!userId) {
      return json({ error: "create_failed" }, 500);
    }

    // Upsert profile for user with empresa_id and optional username
    const rolText = roles?.[0] || null;
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, email, full_name, empresa_id: empresaId, username, rol: rolText }, { onConflict: "id" });
    if (upErr) {
      // Not fatal for login, but return 500 to surface configuration issues
      return json({ error: "profile_upsert_failed", message: upErr.message }, 500);
    }

    // Assign roles if provided
    if (roles && roles.length) {
      // Ensure role keys exist in catalog to satisfy foreign key on user_roles
      try {
        const roleRows = roles.map((r) => ({ key: r, description: r === 'admin' ? 'Administrador' : (r.charAt(0).toUpperCase() + r.slice(1)) }));
        await supabaseAdmin.from('roles').upsert(roleRows, { onConflict: 'key' });
      } catch (_seedErr) {
        // non-fatal; RPC may still work if keys exist
      }
      const { error: arErr } = await supabaseAdmin.rpc("assign_roles", {
        _user_id: userId,
        _roles: roles,
        _replace: true,
      });
      if (arErr) {
        return json({ error: "assign_roles_failed", message: arErr.message }, 500);
      }
    }

    // Audit (no bloquear creación si auditoría falla por esquema/RLS)
    try {
      await supabaseAdmin.from("auditoria").insert({
        empresa_id: empresaId,
        action: bootstrap ? "bootstrap_user_create" : "admin_user_create",
        entity: "auth.users",
        details: { email, full_name, roles, bootstrap },
        actor_id: caller.user?.id || null,
      });
    } catch (_auditErr) {
      // swallow audit errors to not block user creation
    }

    return json({ ok: true, user_id: userId }, 200);
  } catch (err) {
    return json({ error: "internal_error", message: String((err as any)?.message || "") }, 500);
  }
});