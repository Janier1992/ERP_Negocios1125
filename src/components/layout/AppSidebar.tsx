import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  AlertTriangle,
  Users,
  Settings,
  UserCircle,
  Wallet,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/newClient";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useIsMobileOrTablet } from "@/hooks/use-mobile";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Inventario",
    url: "/inventario",
    icon: Package,
  },
  {
    title: "Ventas",
    url: "/ventas",
    icon: ShoppingCart,
  },
  {
    title: "Alertas",
    url: "/alertas",
    icon: AlertTriangle,
  },
  {
    title: "Proveedores",
    url: "/proveedores",
    icon: Users,
  },
  {
    title: "Clientes",
    url: "/clientes",
    icon: UserCircle,
  },

  {
    title: "Finanzas",
    url: "/finanzas",
    icon: Wallet,
  },
  // Empleados removido: gestión de usuarios se hace en Configuración

  {
    title: "Configuración",
    url: "/configuracion",
    icon: Settings,
  },
];

export function AppSidebar() {
  const { state, isMobile, setOpen, setOpenMobile } = useSidebar();
  const { permissions } = usePermissions();
  const { profile } = useUserProfile();
  const location = useLocation();
  const navigate = useNavigate();
  const isCollapsed = state === "collapsed";
  const isAdmin = (profile?.rol || "").toLowerCase() === "admin";
  const isCompactViewport = useIsMobileOrTablet();

  const getNavClasses = (isActive: boolean) =>
    isActive
      ? "bg-sidebar-accent text-sidebar-primary font-medium"
      : "hover:bg-sidebar-accent/50";

  const handleAfterNavigate = () => {
    // Interactivo solo en móviles y tablets
    if (isCompactViewport) {
      try { setOpen(false); } catch {}
      try { setOpenMobile(false); } catch {}
    }
  };

  const handleLogout = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
        toast.success("Sesión cerrada exitosamente");
      } else {
        const res = await supabase.auth.signOut({ scope: 'global' });
        const error: any = (res as any)?.error;
        if (error) {
          const msg = String(error?.message || "").toLowerCase();
          const status = (error?.status as number) || null;
          const isAbort = msg.includes("abort") || /err_aborted/i.test(msg);
          const isUnauthorized = status === 401 || /401|unauthorized|invalid/i.test(msg);
          if (!isAbort && !isUnauthorized) {
            toast.error("Error al cerrar sesión");
            return;
          }
          toast.success("Sesión cerrada exitosamente");
        } else {
          toast.success("Sesión cerrada exitosamente");
        }
      }
    } catch (err) {
      const msg = String((err as any)?.message || "").toLowerCase();
      const isAbort = msg.includes("abort") || /err_aborted/i.test(msg);
      const isUnauthorized = /401|unauthorized|invalid/i.test(msg);
      if (!isAbort && !isUnauthorized) {
        console.error("[Sidebar Logout] Exception:", err);
        toast.error("Error al cerrar sesión");
        return;
      }
      toast.success("Sesión cerrada exitosamente");
    } finally {
      await new Promise((res) => setTimeout(res, 200));
      // Navegación SPA para evitar abortos de red por recarga completa
      try {
        navigate('/auth', { replace: true });
      } catch {
        // Fallback en caso extremo
        window.location.href = `${import.meta.env.BASE_URL}auth`;
      }
    }
  };

  return (
    <Sidebar
      className={isCollapsed ? "w-14" : "w-64"}
      collapsible="icon"
    >
      <SidebarContent>
        <div className="p-4">
          {!isCollapsed && (
            <h2 className="text-lg font-bold text-sidebar-foreground mb-6">
              ERP Facil
            </h2>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className={isCollapsed ? "sr-only" : ""}>
            Menú Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems
                .filter((item) => {
                  const required: Record<string, string | null> = {
                    "/inventario": "inventario_read",
                    "/ventas": "ventas_read",
                    "/proveedores": "proveedores_read",
                    "/clientes": "clientes_read",
                    "/finanzas": "finanzas_view",
                    "/configuracion": "config_view",
                    "/": null,
                    "/alertas": null,
                  };
                  const key = required[item.url] ?? null;
                  // Admin ve todos los módulos; otros roles según permisos listados
                  if (isAdmin) return true;
                  return key ? permissions.includes(key) : true;
                })
                .map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={getNavClasses(isActive)}
                        onClick={handleAfterNavigate}
                      >
                        <item.icon className="h-5 w-5" />
                        {!isCollapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Pie con logout en móvil */}
        {isMobile && (
          <div className="mt-auto p-4 border-t border-sidebar-border">
            <Button variant="ghost" className="w-full justify-start gap-2" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
