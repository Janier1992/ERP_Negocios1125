import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/newClient";
import { useUserProfile } from "@/hooks/useUserProfile";

export const usePermissions = () => {
  const { profile } = useUserProfile();
  const userId = profile?.id || null;
  const [permissions, setPermissions] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase.rpc("get_user_permissions", { _user_id: userId });
      if (error) throw error;
      setPermissions((data || []).map((row: any) => row.permission_key));
    } catch {
      setPermissions([]);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasPermission = useCallback(async (key: string) => {
    if (!userId) return false;
    try {
      const { data, error } = await supabase.rpc("has_permission", { _user_id: userId, _permission_key: key });
      if (error) throw error;
      return Boolean(data);
    } catch {
      return false;
    }
  }, [userId]);

  return { permissions, refresh, hasPermission };
};