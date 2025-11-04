import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/newClient";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";
import { UserRolePanel } from "@/components/configuracion/UserRolePanel";
import { UserManagementPanel } from "@/components/configuracion/UserManagementPanel";
import { bootstrapEmpresaRpc, bootstrapEmpresaEdge, verifyEmpresaExists } from "@/services/company";

interface Empresa {
  id: string;
  nombre: string;
  descripcion: string | null;
}

const Configuracion = () => {
  const navigate = useNavigate();
  const { empresaId, loading: profileLoading, profile, refetch, awaitEmpresaId } = useUserProfile();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [createNombre, setCreateNombre] = useState("");
  const [createDesc, setCreateDesc] = useState<string | "" | null>("");
  const [creating, setCreating] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const fetchEmpresa = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nombre, descripcion")
        .eq("id", empresaId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setEmpresa(data as Empresa);
        setNombre((data as Empresa).nombre || "");
        setDescripcion(((data as Empresa).descripcion as string) || "");
      }
    } catch (err: any) {
      const msg = String(err?.message || "").toLowerCase();
      const isAbort = msg.includes("abort") || /err_aborted/i.test(msg);
      const isNetwork = /failed to fetch/i.test(msg);
      // Evitar ruido por abortos de navegación o fallos transitorios de red
      if (isAbort) {
        // Silencioso en abortos
      } else if (isNetwork) {
        toast.error("Sin conexión con el servidor. Reintentando más tarde…");
      } else {
        toast.error("Error al cargar datos de la empresa");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (empresaId) {
      fetchEmpresa();
    } else if (!profileLoading) {
      // Permitir acceso al módulo para crear empresa cuando no hay empresaId
      setLoading(false);
    }
  }, [empresaId, profileLoading]);

  const saveEmpresa = async () => {
    if (!empresaId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("empresas")
        .update({ nombre, descripcion })
        .eq("id", empresaId);
      if (error) throw error;
      toast.success("Configuración guardada");
      await fetchEmpresa();
    } catch (err: any) {
      console.error(err);
      toast.error("No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  if (profileLoading || loading) {
    return <div className="flex items-center justify-center h-96">Cargando...</div>;
  }

  const handleCreateEmpresa = async () => {
    setCreating(true);
    try {
      const nombreVal = String(createNombre || "").trim();
      const descVal = (createDesc === "" ? null : createDesc) as string | null;
      if (!nombreVal || nombreVal.length < 2) {
        toast.error("El nombre de la empresa es requerido");
        return;
      }

      // Intentar vía RPC y fallback a función Edge si hay cache desactualizada
      let createdEmpresaId: string | null = null;
      try {
        createdEmpresaId = await bootstrapEmpresaRpc({ nombre: nombreVal, descripcion: descVal });
      } catch (bootErr: any) {
        const msg = String(bootErr?.message || "").toLowerCase();
        const isSchemaCache = msg.includes("schema cache") || (bootErr?.code === "PGRST205");
        if (isSchemaCache) {
          createdEmpresaId = await bootstrapEmpresaEdge({ nombre: nombreVal, descripcion: descVal });
        } else {
          throw bootErr;
        }
      }

      toast.success("Empresa creada correctamente. Se asignó el rol admin.");
      setCreateNombre("");
      setCreateDesc("");
      await refetch();
      if (empresaId) {
        await fetchEmpresa();
      }
      // Confirmación primaria y fallback con timeout
      const primaryCheck = (async () => {
        const hasEmpresaId = await awaitEmpresaId({ retries: 20, delayMs: 300 });
        if (!hasEmpresaId) return false;
        const savedOk = createdEmpresaId ? await verifyEmpresaExists(createdEmpresaId) : hasEmpresaId;
        return !!savedOk;
      })();
      const timeoutMs = 3500;
      let timeoutId: any;
      const timeoutPromise = new Promise<boolean>((resolve) => {
        timeoutId = setTimeout(() => resolve(false), timeoutMs);
      });
      const ok = await Promise.race([primaryCheck, timeoutPromise]);
      if (ok) {
        clearTimeout(timeoutId);
        setTransitioning(true);
        navigate('/', { replace: true, state: { hydratingEmpresa: true, postCreate: true } });
      } else {
        navigate('/', { replace: true, state: { hydratingEmpresa: true, postCreate: true } });
        primaryCheck
          .then((finalOk) => {
            if (!finalOk) {
              toast.error("No se pudo confirmar la creación de la empresa. Intenta nuevamente.");
            }
          })
          .catch(() => {
            toast.error("Error al confirmar la creación de la empresa.");
          })
          .finally(() => clearTimeout(timeoutId));
      }
    } catch (err: any) {
      const msg = String(err?.message || "");
      const friendly = /policy|rls|permission/i.test(msg)
        ? "Tu sesión no tiene permisos para crear empresa"
        : /Failed to fetch/i.test(msg)
        ? "Sin conexión con el servidor"
        : /schema cache/i.test(msg)
        ? "El esquema aún no está sincronizado. Refresca y reintenta en unos segundos"
        : msg || "No se pudo crear la empresa";
      toast.error(friendly);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Configuración</h2>
        <p className="text-muted-foreground mt-1">Panel de opciones de configuración del sistema</p>
      </div>
      {!empresaId ? (
        <Card>
          <CardHeader>
            <CardTitle>Crear empresa</CardTitle>
            <CardDescription>Configura los datos iniciales para tu empresa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Permitir crear empresa aunque el usuario aún no tenga rol asignado.
                El RPC bootstrap_empresa_for_user es SECURITY DEFINER y asigna admin.
                Esto evita el bloqueo inicial por falta de empresa/rol. */}
            <>
              <div className="space-y-2">
                <label htmlFor="c_nombre" className="text-sm font-medium text-foreground">Nombre de la empresa</label>
                <Input id="c_nombre" value={createNombre} onChange={(e) => setCreateNombre(e.target.value)} placeholder="Mi Empresa" />
              </div>
              <div className="space-y-2">
                <label htmlFor="c_desc" className="text-sm font-medium text-foreground">Descripción (opcional)</label>
                <Input id="c_desc" value={createDesc || ""} onChange={(e) => setCreateDesc(e.target.value)} placeholder="Breve descripción" />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleCreateEmpresa} disabled={creating}>
                  {creating ? "Creando..." : "Crear empresa"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Al crear la empresa, tu perfil se vincula y se te asigna rol administrador automáticamente.</p>
            </>
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Información básica de la empresa</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="nombre" className="text-sm font-medium text-foreground">Nombre de la empresa</label>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label htmlFor="descripcion" className="text-sm font-medium text-foreground">Descripción</label>
            <textarea
              id="descripcion"
              className="w-full rounded-md border border-input bg-background p-2 text-sm"
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={saveEmpresa} disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      <UserRolePanel />

      <UserManagementPanel />

      <Card>
        <CardHeader>
          <CardTitle>Notificaciones</CardTitle>
          <CardDescription>Preferencias de alertas y avisos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Configura cómo recibir notificaciones sobre stock bajo, movimientos y otros eventos.
          </p>
          <Separator />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Alertas de Stock Bajo</label>
              <p className="text-sm text-muted-foreground">Se muestran en el módulo de Alertas.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Alertas de Stock Crítico</label>
              <p className="text-sm text-muted-foreground">Se muestran en el módulo de Alertas.</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Próximamente: canales de notificación (email, push).</p>
        </CardContent>
      </Card>

      {transitioning && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <div className="rounded-lg bg-background border p-6 shadow-xl text-center">
            <p className="text-sm text-muted-foreground">Empresa creada correctamente</p>
            <p className="mt-2 font-medium">Redirigiendo a los módulos…</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Configuracion;