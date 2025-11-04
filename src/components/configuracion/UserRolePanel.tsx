import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/newClient";
import { useUserProfile } from "@/hooks/useUserProfile";

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  rol: string | null;
  empresa_id: string | null;
}

const ROLES = ["admin", "empleado", "viewer"] as const;

type AppRole = (typeof ROLES)[number];

export const UserRolePanel = () => {
  const { empresaId, profile, loading: profileLoading } = useUserProfile();
  const isAdmin = profile?.rol === "admin";

  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailLookup, setEmailLookup] = useState("");
  const [search, setSearch] = useState("");

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter(u =>
      (u.full_name || "").toLowerCase().includes(term) ||
      (u.email || "").toLowerCase().includes(term)
    );
  }, [search, users]);

  const fetchUsers = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, rol, empresa_id")
        .eq("empresa_id", empresaId);
      if (error) throw error;
      setUsers((data || []) as ProfileRow[]);
    } catch (err: any) {
      console.error(err);
      toast.error("No se pudieron cargar los usuarios de la empresa");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (empresaId) {
      fetchUsers();
    } else if (!profileLoading) {
      setLoading(false);
    }
  }, [empresaId, profileLoading]);

  const upsertUserRole = async (userId: string, newRole: AppRole) => {
    // Borramos roles previos para evitar duplicados
    try {
      await supabase.from("user_roles").delete().eq("user_id", userId);
    } catch (e) {
      // ignorar errores de borrado
    }

    // Estrategia 1: esquema con empresa_id + columna 'rol'
    const try1 = await supabase
      .from("user_roles")
      .insert({ user_id: userId, empresa_id: empresaId, rol: newRole } as any);
    if (!try1.error) return true;

    // Estrategia 2: esquema original con enum 'role' y sin empresa_id
    const try2 = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: newRole } as any);
    if (!try2.error) return true;

    console.warn("Fallo al insertar en user_roles:", try1.error?.message || try2.error?.message);
    return false;
  };

  const handleChangeRole = async (user: ProfileRow, newRole: AppRole) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ rol: newRole })
        .eq("id", user.id);
      if (error) throw error;

      const ok = await upsertUserRole(user.id, newRole);
      if (!ok) {
        // Si no podemos sincronizar user_roles, al menos dejamos el rol del perfil actualizado
        toast.warning("Rol actualizado en perfil; sincronización de user_roles falló");
      } else {
        toast.success("Rol actualizado correctamente");
      }

      setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, rol: newRole } : u)));
    } catch (err: any) {
      const msg = String(err?.message || "");
      const friendly = /policy|rls|permission/i.test(msg)
        ? "No tienes permisos para gestionar roles"
        : /Failed to fetch/i.test(msg)
        ? "Sin conexión con el servidor"
        : "No se pudo actualizar el rol";
      toast.error(friendly);
    }
  };

  const handleAssignByEmail = async () => {
    if (!empresaId) return;
    const email = emailLookup.trim().toLowerCase();
    if (!email) {
      toast.error("Ingresa un email válido");
      return;
    }

    try {
      // Asignar a empresa y rol por defecto 'empleado'
      const { data, error } = await supabase
        .from("profiles")
        .update({ empresa_id: empresaId, rol: "empleado" })
        .eq("email", email)
        .select("id, email, full_name, rol, empresa_id");
      if (error) throw error;

      const updated = (data || []) as ProfileRow[];
      if (updated.length === 0) {
        toast.warning("No existe un usuario con ese email");
        return;
      }

      // Sincronizar user_roles (intentar insertar empleado)
      await upsertUserRole(updated[0].id, "empleado");

      // Refrescar lista
      await fetchUsers();
      setEmailLookup("");
      toast.success("Usuario asignado a la empresa");
    } catch (err: any) {
      const msg = String(err?.message || "");
      const friendly = /policy|rls|permission/i.test(msg)
        ? "No tienes permisos para asignar usuarios"
        : /Failed to fetch/i.test(msg)
        ? "Sin conexión con el servidor"
        : "No se pudo asignar el usuario";
      toast.error(friendly);
    }
  };

  const handleRemoveFromEmpresa = async (user: ProfileRow) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ empresa_id: null })
        .eq("id", user.id);
      if (error) throw error;

      // Borrar roles asociados
      try {
        await supabase.from("user_roles").delete().eq("user_id", user.id);
      } catch {}

      setUsers(prev => prev.filter(u => u.id !== user.id));
      toast.success("Usuario removido de la empresa");
    } catch (err: any) {
      const msg = String(err?.message || "");
      const friendly = /policy|rls|permission/i.test(msg)
        ? "No tienes permisos para remover usuarios"
        : /Failed to fetch/i.test(msg)
        ? "Sin conexión con el servidor"
        : "No se pudo remover el usuario";
      toast.error(friendly);
    }
  };

  if (profileLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usuarios y Roles</CardTitle>
          <CardDescription>Cargando perfil…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usuarios y Roles</CardTitle>
          <CardDescription>Solo los administradores pueden gestionar usuarios.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuarios y Roles</CardTitle>
        <CardDescription>Asigna usuarios a tu empresa y define su rol.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Buscar</label>
            <Input placeholder="Nombre o email" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Asignar por email</label>
            <div className="flex gap-2">
              <Input placeholder="email@dominio.com" value={emailLookup} onChange={(e) => setEmailLookup(e.target.value)} />
              <Button onClick={handleAssignByEmail} disabled={!empresaId}>Asignar</Button>
            </div>
          </div>
        </div>
        <Separator />

        {loading ? (
          <div className="py-6 text-sm text-muted-foreground">Cargando usuarios…</div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-6 text-sm text-muted-foreground">No hay usuarios en tu empresa.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Nombre</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Rol</th>
                  <th className="py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b hover:bg-muted/30">
                    <td className="py-2">{u.full_name || "(Sin nombre)"}</td>
                    <td className="py-2">{u.email}</td>
                    <td className="py-2">
                      <Select value={(u.rol || "empleado") as AppRole} onValueChange={(v) => handleChangeRole(u, v as AppRole)}>
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder="Selecciona un rol" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2">
                      <Button variant="outline" onClick={() => handleRemoveFromEmpresa(u)}>
                        Remover de empresa
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};