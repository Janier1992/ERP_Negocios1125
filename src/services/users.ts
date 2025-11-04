import { supabase } from "@/integrations/supabase/newClient";

export type AppRole = "admin" | "empleado" | "viewer";

export const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
export const validatePassword = (p: string) => /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(p);

export async function adminCreateUser(
  email: string,
  password: string,
  fullName?: string | null,
  roles?: AppRole[],
  username?: string | null,
  businessName?: string | null,
) {
  const payload = {
    email: email.trim().toLowerCase(),
    password,
    full_name: fullName || null,
    roles: roles && roles.length ? roles : ["empleado"],
    username: username || null,
    business_name: businessName || null,
  };

  try {
    // Incluir explícitamente el token de sesión para autorización
    const { data: sessionRes } = await supabase.auth.getSession();
    const accessToken = sessionRes?.session?.access_token || "";
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: payload,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    if (error) throw error;
    if (data && (data as any).error) {
      throw new Error(String((data as any).error));
    }
    if (!data?.ok) throw new Error("create_failed");
    return data;
  } catch (edgeFunctionError) {
    console.warn("Edge function failed:", edgeFunctionError);
    const msg = String((edgeFunctionError as any)?.message || "").toLowerCase();
    if (/admin_api_forbidden|forbidden|unauthorized/.test(msg)) {
      // Superficie el error de permisos/sesión sin intentar fallback
      throw edgeFunctionError;
    }
    // Fallback: usar flujo alterno SOLO para bootstrap (señalado por businessName y rol admin)
    const isBootstrap = !!(businessName && roles && roles.includes("admin"));
    if (!isBootstrap) {
      throw edgeFunctionError;
    }
    return await adminCreateUserFallback(
      email,
      password,
      fullName,
      roles,
      username,
      businessName
    );
  }
}

async function adminCreateUserFallback(
  email: string,
  password: string,
  fullName?: string | null,
  roles?: AppRole[],
  username?: string | null,
  businessName?: string | null,
) {
  // Verificar si hay usuarios existentes para determinar si es bootstrap
  const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1
  });

  const isBootstrap = !listError && (!existingUsers?.users || existingUsers.users.length === 0);
  
  if (!isBootstrap) {
    // Verificar permisos del usuario actual
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      throw new Error("unauthorized");
    }

    const { data: hasPermission, error: permError } = await supabase.rpc("has_permission", {
      _user_id: currentUser.id,
      _permission_key: "manage_users",
    });

    if (permError || !hasPermission) {
      throw new Error("forbidden");
    }
  }

  // Crear el usuario
  const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true, // Auto-confirmar para permitir login inmediato
    user_metadata: { 
      full_name: fullName,
      created_by: isBootstrap ? "bootstrap" : "admin_fallback"
    },
  });

  if (createError) {
    const msg = String(createError.message || "").toLowerCase();
    if (/exists|already/.test(msg)) {
      throw new Error("email_exists");
    }
    throw createError;
  }

  const userId = createdUser.user?.id;
  if (!userId) {
    throw new Error("create_failed");
  }

  // Obtener empresa_id del usuario actual o crear empresa si es bootstrap
  let empresaId: string | null = null;
  
  if (isBootstrap && businessName?.trim()) {
    // Crear empresa en bootstrap
    const { data: empresa, error: empresaError } = await supabase
      .from("empresas")
      .insert({ nombre: businessName.trim() })
      .select("id")
      .single();
    
    if (!empresaError && empresa) {
      empresaId = empresa.id;
    }
  } else if (!isBootstrap) {
    // Obtener empresa del usuario actual
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", currentUser.id)
        .maybeSingle();
      
      empresaId = profile?.empresa_id || null;
    }
  }

  // Crear/actualizar perfil
  const rolText = roles?.[0] || "empleado";
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      email: email.trim().toLowerCase(),
      full_name: fullName,
      empresa_id: empresaId,
      username: username,
      rol: rolText,
      nombre_empresa: businessName || "Mi Empresa" // Incluir nombre_empresa
    }, { onConflict: "id" });

  if (profileError) {
    throw new Error(`profile_upsert_failed: ${profileError.message}`);
  }

  // Asignar roles si se proporcionaron
  if (roles && roles.length) {
    const { error: rolesError } = await supabase.rpc("assign_roles", {
      _user_id: userId,
      _roles: roles,
      _replace: true,
    });

    if (rolesError) {
      console.warn("Failed to assign roles:", rolesError);
      // No lanzar error, el usuario fue creado exitosamente
    }
  }

  // Auditoría
  try {
    await supabase.from("auditoria").insert({
      empresa_id: empresaId,
      action: isBootstrap ? "bootstrap_user_create_fallback" : "admin_user_create_fallback",
      entity: "auth.users",
      details: { email: email.trim().toLowerCase(), full_name: fullName, roles, bootstrap: isBootstrap },
      actor_id: isBootstrap ? null : (await supabase.auth.getUser()).data.user?.id || null,
    });
  } catch (auditError) {
    console.warn("Audit log failed:", auditError);
    // No lanzar error, el usuario fue creado exitosamente
  }

  return { ok: true, user_id: userId };
}