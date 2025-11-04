import { supabase } from "@/integrations/supabase/newClient";

export type BootstrapPayload = { nombre: string; descripcion?: string | null };

function normalizeName(name: string) {
  return (name || "").trim();
}

export async function bootstrapEmpresaRpc(payload: BootstrapPayload) {
  const nombre = normalizeName(payload.nombre);
  const descripcion = payload.descripcion ?? null;
  if (!nombre || nombre.length < 2) {
    throw new Error("El nombre de la empresa es requerido");
  }
  const { data, error } = await supabase.rpc("bootstrap_empresa_for_user", {
    _nombre: nombre,
    _descripcion: descripcion,
  });
  if (error) throw error;
  return data as string; // empresa_id
}

export async function bootstrapEmpresaEdge(payload: BootstrapPayload) {
  const nombre = normalizeName(payload.nombre);
  const descripcion = payload.descripcion ?? null;
  if (!nombre || nombre.length < 2) {
    throw new Error("El nombre de la empresa es requerido");
  }
  const { data, error } = await supabase.functions.invoke("bootstrap-empresa", {
    body: { nombre, descripcion },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(String(data?.error || "bootstrap_failed"));
  return data.empresa_id as string;
}

// Verifica que la empresa exista en la tabla y que la inserción haya sido efectiva
export async function verifyEmpresaExists(empresaId: string) {
  const id = String(empresaId || "").trim();
  if (!id) return false;
  const { data, error } = await supabase
    .from("empresas")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.id);
}