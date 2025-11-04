import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/newClient";
import { validateEmail, validatePassword } from "@/services/users";
import { useUserProfile } from "@/hooks/useUserProfile";

type AppRole = "admin" | "empleado" | "viewer";
const ROLES: AppRole[] = ["admin", "empleado", "viewer"];

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  rol: string | null;
  empresa_id: string | null;
};

type RoleRow = {
  user_id: string;
  empresa_id?: string | null;
  role?: AppRole; // esquema original con columna 'role'
  rol?: AppRole;  // esquema alterno con columna 'rol'
};

export const UserManagementPanel = () => {
  const { empresaId, profile, loading: profileLoading } = useUserProfile();
  const isAdmin = profile?.rol === "admin";

  // Registro directo
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regFullName, setRegFullName] = useState("");
  const [regRole, setRegRole] = useState<AppRole>("empleado");
  const [regSubmitting, setRegSubmitting] = useState<boolean>(false);
  const [regError, setRegError] = useState<string>("");

  // Asignación múltiple de roles
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userRoles, setUserRoles] = useState<AppRole[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [savingRoles, setSavingRoles] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter(u => (u.full_name || "").toLowerCase().includes(term) || (u.email || "").toLowerCase().includes(term));
  }, [users, search]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!empresaId) return;
      setLoadingUsers(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, email, full_name, rol, empresa_id")
          .eq("empresa_id", empresaId);
        if (error) throw error;
        setUsers((data || []) as ProfileRow[]);
      } catch (err: any) {
        const msg = String(err?.message || "");
        const friendly = /policy|rls|permission/i.test(msg) ? "Sin permisos para ver usuarios" : "No se pudieron cargar usuarios";
        toast.error(friendly);
      } finally {
        setLoadingUsers(false);
      }
    };
    if (empresaId) fetchUsers();
  }, [empresaId]);

  const fetchUserRoles = async (userId: string) => {
    if (!userId) return;
    try {
      // Intentar ambos esquemas de user_roles
      const res = await supabase
        .from("user_roles")
        .select("user_id, empresa_id, role, rol")
        .eq("user_id", userId)
        .eq("empresa_id", empresaId);
      if (res.error) throw res.error;
      const rows = (res.data || []) as RoleRow[];
      const roles = rows.map(r => (r.role || r.rol) as AppRole).filter(Boolean) as AppRole[];
      setUserRoles([...new Set(roles)]);
    } catch (err: any) {
      // Si la tabla no existe o falla, degradar a rol primario en profiles
      const fallback = users.find(u => u.id === userId)?.rol as AppRole | undefined;
      setUserRoles(fallback ? [fallback] : []);
    }
  };

  useEffect(() => {
    if (selectedUserId) void fetchUserRoles(selectedUserId);
  }, [selectedUserId]);

  const handleRegisterUser = async () => {
    setRegError("");
    if (!isAdmin) { toast.error("Solo administradores pueden agregar usuarios"); return; }
    const email = regEmail.trim();
    const password = regPassword;
    const fullName = regFullName.trim() || null;
    if (!validateEmail(email)) { setRegError("Correo inválido"); toast.error("Correo inválido"); return; }
    if (!validatePassword(password)) { setRegError("La contraseña debe tener mínimo 8 caracteres y 1 número"); toast.error("Contraseña insegura"); return; }
    setRegSubmitting(true);
    try {
      const svc = await import("@/services/users");
      const res = await svc.adminCreateUser(email, password, fullName, [regRole]);
      if (res?.ok) {
        toast.success("Usuario agregado. Puede iniciar sesión de inmediato.");
        setRegEmail("");
        setRegPassword("");
        setRegFullName("");
        setRegRole("empleado");
        // refrescar listado
        const { data, error } = await supabase
          .from("profiles")
          .select("id, email, full_name, rol, empresa_id")
          .eq("empresa_id", empresaId);
        if (!error) setUsers((data || []) as any);
      } else {
        toast.error("No se pudo agregar el usuario");
      }
  } catch (err: any) {
      const raw = String(err?.message || "");
      const msg = raw.toLowerCase();
      const serverErr = String((err?.context?.body?.error || err?.context?.error || "")).toLowerCase();
      const match = (s: string) => s && s.toLowerCase();
      const m1 = match(msg);
      const m2 = match(serverErr);
      const has = (re: RegExp) => re.test(m1 || "") || re.test(m2 || "");

      if (has(/exists|already|email_exists|409/)) {
        setRegError("El correo ya está registrado");
        toast.error("El correo ya está registrado");
      } else if (has(/invalid_email/)) {
        setRegError("Correo inválido");
        toast.error("Correo inválido");
      } else if (has(/weak_password/)) {
        setRegError("Contraseña insegura (8+ y al menos 1 número)");
        toast.error("Contraseña insegura (8+ y al menos 1 número)");
      } else if (has(/unauthorized/)) {
        setRegError("Sesión no válida. Vuelve a iniciar sesión.");
        toast.error("Sesión no válida. Vuelve a iniciar sesión.");
      } else if (has(/permission|forbidden|permission_check_failed/)) {
        setRegError("Sin permisos para agregar usuarios");
        toast.error("Sin permisos para agregar usuarios");
      } else if (has(/profile_upsert_failed/)) {
        setRegError("No se pudo crear el perfil. Revisa RLS y esquema.");
        toast.error("No se pudo crear el perfil. Revisa RLS y esquema.");
      } else if (has(/assign_roles_failed/)) {
        setRegError("No se pudieron asignar roles (RPC assign_roles)");
        toast.error("No se pudieron asignar roles (RPC assign_roles)");
      } else if (has(/failed to fetch|network|net::err|function not found|404|503|timeout|cors/)) {
        setRegError("No se pudo contactar la función. Verifica despliegue y variables.");
        toast.error("No se pudo contactar la función. Verifica despliegue y variables.");
      } else {
        setRegError("Error al agregar usuario");
        toast.error("Error al agregar usuario");
      }
    } finally {
      setRegSubmitting(false);
    }
  };

  const toggleRole = (role: AppRole) => {
    setUserRoles(prev => (prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]));
  };

  const handleAssignRoles = async () => {
    if (!isAdmin) {
      toast.error("Solo administradores pueden asignar roles");
      return;
    }
    if (!selectedUserId) {
      toast.error("Selecciona un usuario");
      return;
    }
    if (userRoles.length === 0) {
      toast.error("Selecciona al menos un rol");
      return;
    }
    setSavingRoles(true);
    try {
      const { data, error } = await supabase.rpc("assign_roles", {
        _user_id: selectedUserId,
        _roles: userRoles,
        _replace: true,
      });
      if (error) throw error;
      if (String(data) !== "ok") throw new Error("Respuesta inesperada del servidor");
      toast.success("Roles asignados");
      await fetchUserRoles(selectedUserId);
    } catch (err: any) {
      const msg = String(err?.message || "");
      const friendly = /policy|rls|permission|admin/i.test(msg) ? "Sin permisos para asignar" : "No se pudo asignar roles";
      toast.error(friendly);
    } finally {
      setSavingRoles(false);
    }
  };

  if (profileLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Usuarios</CardTitle>
          <CardDescription>Cargando perfil…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Usuarios</CardTitle>
          <CardDescription>Solo los administradores pueden gestionar usuarios.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Gestión de Usuarios</CardTitle>
          <CardDescription>Registro directo con contraseña y roles múltiples</CardDescription>
        </div>
        <div className="w-60">
          <Input placeholder="Buscar usuarios" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Registro directo */}
        <div className="space-y-4">
          <h4 className="font-medium">Agregar nuevo usuario</h4>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Input placeholder="correo@dominio.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
            <Input type="password" placeholder="Contraseña (8+ y 1 número)" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} />
            <Input placeholder="Nombre completo (opcional)" value={regFullName} onChange={(e) => setRegFullName(e.target.value)} />
            <Select value={regRole} onValueChange={(v) => setRegRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={handleRegisterUser} disabled={regSubmitting || !validateEmail(regEmail) || !validatePassword(regPassword)}>
              {regSubmitting ? "Agregando…" : "Agregar"}
            </Button>
          </div>
          {regError && (
            <div className="text-xs text-red-500">{regError}</div>
          )}
        </div>

        <Separator />

        {/* Asignación múltiple de roles */}
        <div className="space-y-4">
          <h4 className="font-medium">Asignar roles múltiples</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
            <Select value={selectedUserId} onValueChange={(v) => setSelectedUserId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un usuario" />
              </SelectTrigger>
              <SelectContent>
                {filteredUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-3">
              {ROLES.map(r => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={userRoles.includes(r)} onChange={() => toggleRole(r)} />
                  {r}
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={handleAssignRoles} disabled={savingRoles || !selectedUserId}>
                {savingRoles ? "Guardando…" : "Asignar"}
              </Button>
            </div>
          </div>

          {loadingUsers ? (
            <p className="text-sm text-muted-foreground">Cargando usuarios…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol principal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">Sin usuarios</TableCell>
                  </TableRow>
                ) : filteredUsers.map(u => (
                  <TableRow key={u.id}>
                    <TableCell>{u.full_name || '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{u.email}</TableCell>
                    <TableCell>{u.rol || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default UserManagementPanel;