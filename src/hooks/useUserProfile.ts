import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/newClient";

export const useUserProfile = () => {
  const [profile, setProfile] = useState<{
    id: string;
    empresa_id: string | null;
    rol: string | null;
    full_name: string | null;
    email: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const fetchProfile = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setProfile(null);
        setEmpresaId(null);
        return null;
      }

      const [profileRes, rpcRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, empresa_id, rol, full_name, email")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.rpc("get_user_empresa_id", { _user_id: user.id }),
      ]);
      if (profileRes.error) {
        // Manejo amable para PGRST205 (schema cache desactualizado)
        const low = String(profileRes.error.message || "").toLowerCase();
        if (profileRes.error.code === "PGRST205" || low.includes("schema cache")) {
          console.warn("[Profiles] Esquema no sincronizado. Mostrando onboarding.");
        } else {
          throw profileRes.error;
        }
      }
      if (rpcRes.error) {
        console.warn("RPC get_user_empresa_id error:", rpcRes.error.message);
      }

      const empresaFromRpc = (rpcRes.data as string) || null;
      const currentProfile = profileRes.data || null;

      const currentEmpresaId = currentProfile?.empresa_id ?? empresaFromRpc;
      setProfile(currentProfile);
      setEmpresaId(currentEmpresaId);
      return currentEmpresaId;
    } catch (error) {
      console.error("Error fetching profile:", error);
      setProfile(null);
      setEmpresaId(null);
      return null;
    }
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchProfile();
    setLoading(false);
  }, [fetchProfile]);

  // Espera activa a que empresaId esté disponible, reintentando el fetch
  // Útil justo después de bootstrap donde puede haber latencia de propagación
  const awaitEmpresaId = useCallback(async (opts?: { retries?: number; delayMs?: number }) => {
    const retries = Math.max(1, Math.min(20, opts?.retries ?? 10));
    const delayMs = Math.max(50, Math.min(2000, opts?.delayMs ?? 300));
    for (let i = 0; i < retries; i++) {
      const fetchedId = await fetchProfile();
      if (fetchedId) return true;
      await new Promise((res) => setTimeout(res, delayMs));
    }
    // Último intento
    const finalId = await fetchProfile();
    return !!finalId;
  }, [fetchProfile]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { profile, loading, empresaId, refetch, awaitEmpresaId };
};
