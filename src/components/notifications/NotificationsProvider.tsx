import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/newClient";
import { toast } from "sonner";

export type NotificationItem = {
  id: string;
  message: string;
  type: "info" | "stock_bajo" | "stock_critico" | string;
  createdAt: number;
  read?: boolean;
};

type NotificationsContextType = {
  notifications: NotificationItem[];
  unreadCount: number;
  addNotification: (n: Omit<NotificationItem, "id" | "createdAt">) => void;
  markAllRead: () => void;
};

const NotificationsContext = createContext<NotificationsContextType | null>(null);

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}

export const NotificationsProvider: React.FC<React.PropsWithChildren<{ empresaId?: string | null }>> = ({ children, empresaId }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const addNotification: NotificationsContextType["addNotification"] = (n) => {
    const item: NotificationItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      message: n.message,
      type: n.type,
      createdAt: Date.now(),
      read: false,
    };
    setNotifications((prev) => [item, ...prev].slice(0, 200));
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  // Cargar alertas iniciales de inventario bajo/critico
  useEffect(() => {
    const fetchInitialAlerts = async () => {
      try {
        if (!empresaId) return;
        const { data, error } = await supabase
          .from("productos")
          .select("id, nombre, stock, stock_minimo")
          .eq("empresa_id", empresaId);
        if (error) {
          // Evita ruido si el esquema no tiene la tabla
          const code = (error as any)?.code || "";
          if (code !== "PGRST205") console.warn("[Notifications] Error cargando productos:", error);
          return;
        }
        const items = (data || []) as Array<{ id: string; nombre?: string; stock?: number; stock_minimo?: number }>;
        for (const p of items) {
          const stock = Number(p.stock || 0);
          const min = Number(p.stock_minimo || 0);
          if (stock <= min * 0.5) {
            addNotification({ type: "stock_critico", message: `Stock crítico en ${p.nombre || p.id}` });
          } else if (stock <= min && min > 0) {
            addNotification({ type: "stock_bajo", message: `Stock bajo en ${p.nombre || p.id}` });
          }
        }
      } catch (err) {
        console.warn("[Notifications] Exception inicial:", err);
      }
    };
    fetchInitialAlerts();
  }, [empresaId]);

  // Suscripción en tiempo real a cambios de productos para alertas
  useEffect(() => {
    if (!empresaId) return;
    try {
      const channel = supabase
        .channel(`notificaciones-productos-${empresaId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'productos', filter: `empresa_id=eq.${empresaId}` },
          (payload) => {
            const row = (payload.new || payload.old || {}) as any;
            const nombre = row.nombre || row.id;
            const stock = Number(row.stock || 0);
            const min = Number(row.stock_minimo || 0);
            if (min > 0) {
              if (stock <= min * 0.5) {
                addNotification({ type: "stock_critico", message: `Stock crítico en ${nombre}` });
                toast.warning(`Stock crítico en ${nombre}`);
              } else if (stock <= min) {
                addNotification({ type: "stock_bajo", message: `Stock bajo en ${nombre}` });
                toast.message(`Stock bajo en ${nombre}`);
              }
            }
          }
        )
        .subscribe();
      channelRef.current = channel;
      return () => {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
        channelRef.current = null;
      };
    } catch (err) {
      console.warn("[Notifications] No se pudo suscribir a cambios de productos:", err);
    }
  }, [empresaId]);

  const value: NotificationsContextType = {
    notifications,
    unreadCount,
    addNotification,
    markAllRead,
  };

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
};