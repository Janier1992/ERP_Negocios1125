import { useEffect, useMemo, useState } from "react";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, DollarSign, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/newClient";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";
import { startOfMonth, startOfDay, subDays, format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Dashboard = () => {
  const { empresaId, loading: profileLoading } = useUserProfile();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [period, setPeriod] = useState<"hoy" | "semana" | "mes">("hoy");
  const [kpis, setKpis] = useState({
    productosEnStock: 0,
    ventasDelPeriodo: 0,
    valorInventario: 0,
    alertasActivas: 0,
  });
  const [topProducts, setTopProducts] = useState<Array<{ nombre: string; cantidad: number; valor: number }>>([]);
  const [recentAlerts, setRecentAlerts] = useState<Array<{ tipo: string; titulo: string; mensaje: string }>>([]);
  const [salesByCategory, setSalesByCategory] = useState<Array<{ categoria: string; total: number }>>([]);
  const [salesTrend, setSalesTrend] = useState<Array<{ label: string; total: number }>>([]);

  useEffect(() => {
    if (empresaId) {
      // Carga inicial y cuando cambia el periodo
      fetchMetrics({ background: false });
    } else if (!profileLoading) {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, profileLoading, period]);

  // Polling cada 5s y suscripción realtime a cambios relevantes
  useEffect(() => {
    if (!empresaId) return;

    const interval = setInterval(() => fetchMetrics({ background: true }), 5000);

    const channel = supabase
      .channel("dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ventas", filter: `empresa_id=eq.${empresaId}` },
        () => fetchMetrics({ background: true })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ventas_detalle" },
        () => fetchMetrics({ background: true })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alertas", filter: `empresa_id=eq.${empresaId}` },
        () => fetchMetrics({ background: true })
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, period]);

  const getDesde = () => {
    const now = new Date();
    if (period === "hoy") return startOfDay(now).toISOString();
    if (period === "semana") return subDays(startOfDay(now), 7).toISOString();
    return startOfMonth(now).toISOString();
  };

  const fetchMetrics = async ({ background }: { background: boolean }) => {
    if (background) {
      setUpdating(true);
    } else {
      setLoading(true);
    }
    try {
      // Productos y valor de inventario
      const productosRes = await supabase
        .from("productos")
        .select("id, precio, stock, categoria_id, categorias(nombre)")
        .eq("empresa_id", empresaId);
      if (productosRes.error) {
        const code = (productosRes.error as any)?.code || "";
        if (code !== "PGRST205") throw productosRes.error;
      }

      const productos = productosRes.data || [];
      const productosEnStock = productos.reduce((sum, p: any) => sum + (p.stock || 0), 0);
      const valorInventario = productos.reduce((sum, p: any) => sum + ((p.precio || 0) * (p.stock || 0)), 0);

      // Ventas del periodo
      const desde = getDesde();
      const ventasRes = await supabase
        .from("ventas")
        .select("id, total, created_at")
        .eq("empresa_id", empresaId)
        .gte("created_at", desde);
      if (ventasRes.error) {
        const code = (ventasRes.error as any)?.code || "";
        if (code !== "PGRST205") throw ventasRes.error;
      }
      const ventasDelPeriodo = (ventasRes.data || []).reduce((sum: number, v: any) => sum + (v.total || 0), 0);

      // Alertas activas
      const alertasRes = await supabase
        .from("alertas")
        .select("id")
        .eq("empresa_id", empresaId)
        .gte("created_at", desde);
      if (alertasRes.error) {
        const code = (alertasRes.error as any)?.code || "";
        if (code !== "PGRST205") throw alertasRes.error;
      }
      const alertasActivas = (alertasRes.data || []).length;

      setKpis({ productosEnStock, ventasDelPeriodo, valorInventario, alertasActivas });

      // Top productos vendidos (en el periodo)
      // Para evitar problemas de RLS con joins, primero obtenemos IDs de ventas
      const ventaIds: string[] = (ventasRes.data || []).map((v: any) => String(v.id));
      let ventasDetalleRows: any[] = [];
      if (ventaIds.length > 0) {
        const ventasDetalleRes = await supabase
          .from("ventas_detalle")
          .select("producto_id, cantidad, precio_unitario")
          .in("venta_id", ventaIds);
        if (ventasDetalleRes.error) {
          const code = (ventasDetalleRes.error as any)?.code || "";
          if (code !== "PGRST205") throw ventasDetalleRes.error;
        } else {
          ventasDetalleRows = ventasDetalleRes.data || [];
        }
      }

      const aggMap = new Map<string, { nombre: string; cantidad: number; valor: number }>();
      const productosMap = new Map<string, { categoria: string; nombre?: string }>();
      for (const p of productos as any[]) {
        const catName = (p.categorias?.nombre as string) || "Sin categoría";
        productosMap.set(p.id as string, { categoria: catName, nombre: p.nombre });
      }

      const catAgg = new Map<string, number>();
      for (const row of ventasDetalleRows) {
        const key = row.producto_id as string;
        const prodInfo = productosMap.get(key);
        const nombre = prodInfo?.nombre || "Producto";
        const cantidad = row.cantidad || 0;
        const valor = cantidad * (row.precio_unitario || 0);
        const existing = aggMap.get(key);
        if (existing) {
          existing.cantidad += cantidad;
          existing.valor += valor;
        } else {
          aggMap.set(key, { nombre, cantidad, valor });
        }

        const categoria = prodInfo?.categoria || "Sin categoría";
        catAgg.set(categoria, (catAgg.get(categoria) || 0) + valor);
      }
      const top = Array.from(aggMap.values())
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 4);
      setTopProducts(top);

      const byCat = Array.from(catAgg.entries())
        .map(([categoria, total]) => ({ categoria, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 6);
      setSalesByCategory(byCat);

      // Tendencia diaria en el periodo
      const dailyMap = new Map<string, number>();
      for (const v of (ventasRes.data || [])) {
        const label = format(new Date(v.created_at), period === "hoy" ? "HH:mm" : "dd MMM");
        dailyMap.set(label, (dailyMap.get(label) || 0) + (v.total || 0));
      }
      const trend = Array.from(dailyMap.entries()).map(([label, total]) => ({ label, total }));
      setSalesTrend(trend);

      // Alertas recientes
      const alertasRecentRes = await supabase
        .from("alertas")
        .select("tipo, titulo, mensaje, created_at")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false })
        .limit(4);
      if (alertasRecentRes.error) {
        const code = (alertasRecentRes.error as any)?.code || "";
        if (code !== "PGRST205") throw alertasRecentRes.error;
      }
      setRecentAlerts(alertasRecentRes.data || []);
    } catch (error: any) {
      const msg = String(error?.message || "").toLowerCase();
      const isAbort = msg.includes("abort") || /err_aborted/i.test(msg);
      const isNetwork = /failed to fetch/i.test(msg);
      if (isAbort) {
        // Ignorar abortos de navegación o cancelaciones internas
      } else if (isNetwork) {
        toast.error("Sin conexión con el servidor. Reintentaremos pronto…");
      } else {
        toast.error("Error al cargar métricas del Dashboard");
        console.warn(error);
      }
    } finally {
      if (background) {
        setUpdating(false);
      } else {
        setLoading(false);
      }
    }
  };

  const currencyFormatter = useMemo(() => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }), []);

  if (profileLoading || loading) {
    return <div className="flex items-center justify-center h-96">Cargando...</div>;
  }

  if (!empresaId) {
    return <div className="flex items-center justify-center h-96 text-muted-foreground">No hay empresa asociada a tu usuario.</div>;
  }

  const maxCatTotal = Math.max(1, ...salesByCategory.map((c) => c.total));
  const maxTrendTotal = Math.max(1, ...salesTrend.map((t) => t.total));

  const getAlertClasses = (tipo: string) => {
    if (tipo === "pago_vencido") return "bg-destructive/10 border border-destructive/20";
    if (tipo === "stock_bajo") return "bg-warning/10 border border-warning/20";
    return "bg-success/10 border border-success/20";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
        <div className="flex items-center gap-3 mt-2">
          <p className="text-muted-foreground">Vista general de tu negocio en tiempo real</p>
          {updating && (
            <span className="text-xs text-muted-foreground animate-pulse">Actualizando…</span>
          )}
        </div>
        <div className="mt-4 w-full sm:w-64">
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger aria-label="Periodo">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hoy">Hoy</SelectItem>
              <SelectItem value="semana">Semana</SelectItem>
              <SelectItem value="mes">Mes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Productos en Stock"
          value={kpis.productosEnStock}
          icon={Package}
          variant="default"
        />
        <StatCard
          title="Ventas del Periodo"
          value={currencyFormatter.format(kpis.ventasDelPeriodo)}
          icon={DollarSign}
          variant="success"
        />
        <StatCard
          title="Valor Inventario"
          value={currencyFormatter.format(kpis.valorInventario)}
          icon={TrendingUp}
          variant="default"
        />
        <StatCard
          title="Alertas Activas"
          value={kpis.alertasActivas}
          icon={AlertTriangle}
          variant="warning"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ventas por Categoría</CardTitle>
          </CardHeader>
          <CardContent>
            {salesByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay ventas en el periodo.</p>
            ) : (
              <div className="space-y-3">
                {salesByCategory.map((c) => (
                  <div key={c.categoria} className="flex items-center gap-3">
                    <span className="w-32 text-sm text-foreground">{c.categoria}</span>
                    <div className="flex-1 h-3 bg-muted rounded">
                      <div
                        className="h-3 bg-primary rounded"
                        style={{ width: `${(c.total / maxCatTotal) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-24 text-right">
                      {currencyFormatter.format(c.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tendencia de Ventas</CardTitle>
          </CardHeader>
          <CardContent>
            {salesTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos en el periodo.</p>
            ) : (
              <div className="flex items-end gap-2 h-40">
                {salesTrend.map((t) => (
                  <div key={t.label} className="flex flex-col items-center gap-2">
                    <div
                      className="w-4 bg-primary rounded"
                      style={{ height: `${(t.total / maxTrendTotal) * 100}%` }}
                      title={`${t.label}: ${currencyFormatter.format(t.total)}`}
                    />
                    <span className="text-[10px] text-muted-foreground">{t.label}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Productos Más Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay ventas registradas.</p>
              ) : (
                topProducts.map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium text-foreground">{product.nombre}</p>
                      <p className="text-sm text-muted-foreground">{product.cantidad} unidades</p>
                    </div>
                    <p className="font-semibold text-primary">{currencyFormatter.format(product.valor)}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin alertas recientes.</p>
              ) : (
                recentAlerts.map((alert, index) => (
                  <div key={index} className={`flex items-start gap-3 p-3 rounded-lg ${getAlertClasses(alert.tipo)}`}>
                    <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{alert.tipo}</p>
                      <p className="text-sm text-muted-foreground">{alert.titulo}</p>
                      {alert.mensaje && (
                        <p className="text-sm text-muted-foreground mt-1">{alert.mensaje}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
