import { supabase } from "@/integrations/supabase/newClient";

export type AlertRow = {
  id: string;
  tipo: string;
  titulo: string;
  mensaje?: string | null;
  created_at: string;
  leida?: boolean | null;
};

export type FetchAlertsParams = {
  empresaId: string;
  desde?: string; // ISO
  hasta?: string; // ISO
  tipo?: string | null;
  leida?: boolean | null;
  orderBy?: "created_at" | "tipo";
  orderAsc?: boolean;
  limit?: number;
};

export async function fetchAlerts(params: FetchAlertsParams) {
  const { empresaId, desde, hasta, tipo, leida, orderBy = "created_at", orderAsc = false, limit } = params;
  let q = supabase
    .from("alertas")
    .select("id, tipo, titulo, mensaje, created_at, leida")
    .eq("empresa_id", empresaId);
  if (desde) q = q.gte("created_at", desde);
  if (hasta) q = q.lte("created_at", hasta);
  if (tipo) q = q.eq("tipo", tipo);
  if (typeof leida === "boolean") q = q.eq("leida", leida);
  q = q.order(orderBy, { ascending: orderAsc });
  if (limit) q = q.limit(limit);
  const res = await q;
  const code = (res.error as any)?.code || "";
  if (res.error && code !== "PGRST205") throw res.error;
  return res.data || [];
}

export function subscribeAlerts(empresaId: string, onChange: () => void) {
  const channel = supabase
    .channel("alertas-sync")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "alertas", filter: `empresa_id=eq.${empresaId}` },
      () => onChange()
    )
    .subscribe();
  return channel;
}

export async function markAlertRead(id: string, leida: boolean) {
  const res = await supabase
    .from("alertas")
    .update({ leida })
    .eq("id", id);
  if (res.error) throw res.error;
}