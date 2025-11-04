import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/newClient";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { useUserProfile } from "@/hooks/useUserProfile";
// Onboarding eliminado: integramos la creación de empresa en el registro de Auth

export const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { empresaId, loading, refetch } = useUserProfile();
  const [hydrationActive, setHydrationActive] = useState<boolean>(Boolean(location.state?.hydratingEmpresa || location.state?.postCreate));
  const [empresaNombre, setEmpresaNombre] = useState<string>("Sistema de Gestión ERP");

  // Activar hidratación si venimos con estado post-creación, y mantenerla entre rutas
  useEffect(() => {
    if (location.state?.hydratingEmpresa || location.state?.postCreate) {
      setHydrationActive(true);
      // Limpiar el estado de navegación, pero mantener overlay activo localmente
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.hydratingEmpresa, location.state?.postCreate]);

  // Al hidratarse empresaId, desactivar overlay de hidratación y limpiar cualquier estado residual
  useEffect(() => {
    if (empresaId && hydrationActive) {
      setHydrationActive(false);
      if (location.state?.hydratingEmpresa || location.state?.postCreate) {
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  // Cargar el nombre de la empresa para mostrarlo en el encabezado
  useEffect(() => {
    const fetchEmpresaNombre = async () => {
      try {
        if (!empresaId) {
          setEmpresaNombre("Sistema de Gestión ERP");
          return;
        }
        const { data, error } = await supabase
          .from("empresas")
          .select("nombre")
          .eq("id", empresaId)
          .maybeSingle();
        if (error) {
          const msg = String(error?.message || "").toLowerCase();
          const isAbort = msg.includes("abort") || /err_aborted/i.test(msg);
          const isNetwork = /failed to fetch/i.test(msg);
          if (!isAbort && !isNetwork) {
            console.warn("Error obteniendo nombre de empresa:", error);
          }
          setEmpresaNombre("Sistema de Gestión ERP");
          return;
        }
        setEmpresaNombre((data?.nombre as string) || "Sistema de Gestión ERP");
      } catch (err) {
        const msg = String((err as any)?.message || "").toLowerCase();
        const isAbort = msg.includes("abort") || /err_aborted/i.test(msg);
        const isNetwork = /failed to fetch/i.test(msg);
        if (!isAbort && !isNetwork) {
          console.warn("Exception obteniendo nombre de empresa:", err);
        }
        setEmpresaNombre("Sistema de Gestión ERP");
      }
    };
    fetchEmpresaNombre();
  }, [empresaId]);

  // Suscribirse a cambios en el nombre de la empresa para reflejarlo en tiempo real
  useEffect(() => {
    if (!empresaId) return;
    const channel = supabase
      .channel(`empresa-header-${empresaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'empresas', filter: `id=eq.${empresaId}` },
        (payload) => {
          const newNombre = (payload?.new as any)?.nombre;
          if (typeof newNombre === 'string' && newNombre.trim()) {
            setEmpresaNombre(newNombre);
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        // noop
      }
    };
  }, [empresaId]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut(); // scope local para evitar net::ERR_ABORTED
      if (error) {
        toast.error("Error al cerrar sesión");
        return;
      }
      toast.success("Sesión cerrada exitosamente");
    } catch (err: any) {
      console.error("[Logout] Exception:", err);
      toast.error("Error al cerrar sesión");
      return;
    } finally {
      await new Promise((res) => setTimeout(res, 200));
      navigate("/auth", { replace: true });
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col w-full">
          <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-10">
            <div className="flex items-center">
              <SidebarTrigger className="mr-4" />
              <h1 className="text-xl font-semibold text-foreground">{empresaNombre}</h1>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Cerrar Sesión
            </Button>
          </header>
          <main className="flex-1 py-4 sm:py-6">
            <div className="app-container">
            {/* Gate content behind empresaId presence */}
            {loading ? (
              <div className="flex items-center justify-center h-96">Cargando...</div>
            ) : !empresaId ? (
              // Si venimos de una creación reciente (éxito o timeout), mostrar overlay de hidratación.
              hydrationActive ? (
                <div className="relative">
                  <div className="flex items-center justify-center h-96">Preparando módulos…</div>
                  <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center">
                    <div className="rounded-lg bg-background/90 border p-6 shadow-xl text-center">
                      <p className="text-sm text-muted-foreground">Hidratando tu perfil de empresa</p>
                      <p className="mt-2 font-medium">Cargando módulos…</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-96 text-center">
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">No hay empresa asociada a tu usuario.</p>
                    <p className="text-sm">Puedes crearla desde Configuración.</p>
                    <Button onClick={() => navigate('/configuracion')} variant="secondary">Ir a Configuración</Button>
                  </div>
                </div>
              )
              ) : (
              <Outlet />
            )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
