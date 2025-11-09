import { useEffect, useMemo, useRef, useState } from "react";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, DollarSign, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/newClient";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";
import { startOfMonth, startOfDay, subDays, format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { fetchAlerts } from "@/services/alerts";

type LinePoint = { label: string; total: number };

const InteractiveLineChart = ({
  current,
  previous,
  maxCurrent,
  maxPrevious,
  formatValue,
}: {
  current: LinePoint[];
  previous: LinePoint[];
  maxCurrent: number;
  maxPrevious: number;
  formatValue: (v: number) => string;
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const labels = current.map((d) => d.label);
  const width = 700;
  const height = 220;
  const padding = 24;
  const n = Math.max(current.length, previous.length);
  const xStep = n > 1 ? (width - padding * 2) / (n - 1) : 0;

  const toPath = (data: LinePoint[], max: number) => {
    if (data.length === 0) return "";
    return data
      .map((d, i) => {
        const x = padding + i * xStep;
        const y = padding + (height - padding * 2) * (1 - (d.total / Math.max(1, max)));
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  };

  // Trend line via simple linear regression on current series
  const trendPath = (() => {
    if (current.length < 2) return "";
    const xs = current.map((_, i) => i);
    const ys = current.map((d) => d.total);
    const n = xs.length;
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
    const sumXX = xs.reduce((a, x) => a + x * x, 0);
    const denom = n * sumXX - sumX * sumX;
    if (denom === 0) return "";
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    const trendPoints = xs.map((x, i) => ({ label: current[i].label, total: intercept + slope * x }));
    return toPath(trendPoints, maxCurrent);
  })();

  const currentPath = toPath(current, maxCurrent);
  const previousPath = toPath(previous, maxPrevious);

  const handleMove = (e: React.MouseEvent<SVGRectElement, MouseEvent>) => {
    const rect = (e.target as SVGRectElement).getBoundingClientRect();
    const x = e.clientX - rect.left - padding;
    const idx = Math.max(0, Math.min(n - 1, Math.round(x / Math.max(1, xStep))));
    setHoverIndex(idx);
  };

  const handleLeave = () => setHoverIndex(null);

  const tooltipData = hoverIndex != null ? {
    label: labels[hoverIndex] ?? "",
    current: current[hoverIndex]?.total ?? 0,
    previous: previous[hoverIndex]?.total ?? 0,
    x: padding + hoverIndex * xStep,
    y: padding + (height - padding * 2) * (1 - ((current[hoverIndex]?.total ?? 0) / Math.max(1, maxCurrent))),
  } : null;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} role="presentation">
      <g>
        {/* axes */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e5e7eb" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#e5e7eb" />
        {/* previous period */}
        {previousPath && (
          <path d={previousPath} fill="none" stroke="#9ca3af" strokeWidth={2} />
        )}
        {/* current period */}
        {currentPath && (
          <path d={currentPath} fill="none" stroke="#3b82f6" strokeWidth={2.5} />
        )}
        {/* trend line */}
        {trendPath && (
          <path d={trendPath} fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 4" />
        )}
        {/* hover tracker */}
        <rect x={0} y={0} width={width} height={height} fill="transparent" onMouseMove={handleMove} onMouseLeave={handleLeave} aria-hidden="true" />
        {/* tooltip */}
        {tooltipData && (
          <g>
            <circle cx={tooltipData.x} cy={tooltipData.y} r={3} fill="#3b82f6" />
            <foreignObject x={Math.min(width - 180, Math.max(padding, tooltipData.x + 8))} y={Math.max(padding, tooltipData.y - 40)} width={180} height={60}>
              <div className="rounded bg-white shadow px-2 py-1 border text-xs" aria-live="polite">
                <div className="font-medium">{tooltipData.label}</div>
                <div>Actual: {formatValue(tooltipData.current)}</div>
                <div className="text-muted-foreground">Previo: {formatValue(tooltipData.previous)}</div>
              </div>
            </foreignObject>
          </g>
        )}
      </g>
    </svg>
  );
};
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
  const [salesTrendPrev, setSalesTrendPrev] = useState<Array<{ label: string; total: number }>>([]);
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [inventoryByCategory, setInventoryByCategory] = useState<Array<{ categoria: string; normal: number; bajo: number; critico: number }>>([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [criticalStockCount, setCriticalStockCount] = useState(0);
  const prevAlertCounts = useRef<{ low: number; critical: number }>({ low: 0, critical: 0 });
  const navigate = useNavigate();

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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "productos", filter: `empresa_id=eq.${empresaId}` },
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
        .select("id, nombre, precio, stock, stock_minimo, categoria_id")
        .eq("empresa_id", empresaId);
      let productos: any[] = [];
      if (productosRes.error) {
        const code = (productosRes.error as any)?.code || "";
        if (code !== "PGRST205") {
          console.warn("[Dashboard] Error obteniendo productos:", productosRes.error);
        }
        productos = productosRes.data || [];
      } else {
        productos = productosRes.data || [];
      }

      // Consulta separada de categorías para evitar dependencias de relaciones
      const categoriasRes = await supabase
        .from("categorias")
        .select("id, nombre")
        .eq("empresa_id", empresaId);
      const categoriasMap = new Map<string, string>();
      if (categoriasRes.error) {
        const code = (categoriasRes.error as any)?.code || "";
        if (code !== "PGRST205") {
          console.warn("[Dashboard] Error obteniendo categorías:", categoriasRes.error);
        }
      } else {
        for (const c of (categoriasRes.data || [])) {
          if (c?.id) categoriasMap.set(String(c.id), String(c.nombre || "Sin categoría"));
        }
      }
      const productosEnStock = productos.reduce((sum, p: any) => sum + (p.stock || 0), 0);
      const valorInventario = productos.reduce((sum, p: any) => sum + ((p.precio || 0) * (p.stock || 0)), 0);

      // Ventas del periodo (con rango opcional)
      const desde = dateFrom ? new Date(dateFrom).toISOString() : getDesde();
      const hasta = dateTo ? new Date(dateTo).toISOString() : undefined;
      let ventasQuery = supabase
        .from("ventas")
        .select("id, total, created_at")
        .eq("empresa_id", empresaId)
        .gte("created_at", desde);
      const ventasRes = hasta ? await ventasQuery.lte("created_at", hasta) : await ventasQuery;
      if (ventasRes.error) {
        const code = (ventasRes.error as any)?.code || "";
        if (code !== "PGRST205") {
          console.warn("[Dashboard] Error obteniendo ventas del periodo:", ventasRes.error);
        }
      }
      const ventasDelPeriodo = (ventasRes.data || []).reduce((sum: number, v: any) => sum + (v.total || 0), 0);

      // Alertas activas (y conteo por tipo) usando servicio compartido
      let alertRows: any[] = [];
      try {
        alertRows = await fetchAlerts({ empresaId, desde, hasta, orderBy: "created_at", orderAsc: false });
      } catch (e: any) {
        console.warn("[Dashboard] Error obteniendo alertas:", e?.message || e);
      }
      const alertasActivas = alertRows.length;
      const lowCount = alertRows.filter((a: any) => a.tipo === "stock_bajo").length;
      const criticalCount = alertRows.filter((a: any) => a.tipo === "stock_critico").length;
      setLowStockCount(lowCount);
      setCriticalStockCount(criticalCount);
      if (lowCount > prevAlertCounts.current.low) {
        toast.warning(`Nuevas alertas de stock bajo: +${lowCount - prevAlertCounts.current.low}`);
      }
      if (criticalCount > prevAlertCounts.current.critical) {
        toast.error(`Nuevas alertas de stock crítico: +${criticalCount - prevAlertCounts.current.critical}`);
      }
      prevAlertCounts.current = { low: lowCount, critical: criticalCount };

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
          if (code !== "PGRST205") {
            console.warn("[Dashboard] Error obteniendo ventas_detalle:", ventasDetalleRes.error);
          }
        } else {
          ventasDetalleRows = ventasDetalleRes.data || [];
        }
      }

      const aggMap = new Map<string, { nombre: string; cantidad: number; valor: number }>();
      const productosMap = new Map<string, { categoria: string; nombre?: string; stock_minimo?: number; stock?: number }>();
      for (const p of productos as any[]) {
        const catName = categoriasMap.get(String(p.categoria_id)) || "Sin categoría";
        productosMap.set(p.id as string, { categoria: catName, nombre: p.nombre, stock_minimo: p.stock_minimo, stock: p.stock });
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

      // Comparativa periodo anterior basada en rango actual
      const periodoHasta = dateTo ? new Date(dateTo) : new Date();
      const periodoDesde = dateFrom ? new Date(dateFrom) : new Date(getDesde());
      const diffMs = Math.max(0, periodoHasta.getTime() - periodoDesde.getTime());
      const prevHasta = periodoDesde;
      const prevDesde = new Date(periodoDesde.getTime() - diffMs);
      const ventasPrevRes = await supabase
        .from("ventas")
        .select("id, total, created_at")
        .eq("empresa_id", empresaId)
        .gte("created_at", prevDesde.toISOString())
        .lte("created_at", prevHasta.toISOString());
      if (!ventasPrevRes.error) {
        const prevDailyMap = new Map<string, number>();
        for (const v of (ventasPrevRes.data || [])) {
          const label = format(new Date(v.created_at), period === "hoy" ? "HH:mm" : "dd MMM");
          prevDailyMap.set(label, (prevDailyMap.get(label) || 0) + (v.total || 0));
        }
        const prevTrend = Array.from(prevDailyMap.entries()).map(([label, total]) => ({ label, total }));
        setSalesTrendPrev(prevTrend);
      } else {
        const code = (ventasPrevRes.error as any)?.code || "";
        if (code !== "PGRST205") {
          console.warn("[Dashboard] Error obteniendo ventas del periodo anterior:", ventasPrevRes.error);
        }
      }

      // Alertas recientes (mismo servicio, misma fuente)
      try {
        const recentRows = await fetchAlerts({ empresaId, orderBy: "created_at", orderAsc: false, limit: 4 });
        setRecentAlerts(recentRows as any);
      } catch (e: any) {
        console.warn("[Dashboard] Error obteniendo alertas recientes:", e?.message || e);
        setRecentAlerts([] as any);
      }

      // Niveles de inventario por categoría (Normal, Bajo, Crítico)
      const byCategoryLevels = new Map<string, { normal: number; bajo: number; critico: number }>();
      for (const p of productos as any[]) {
        const categoria = (p.categorias?.nombre as string) || "Sin categoría";
        const min = Number(p.stock_minimo || 0);
        const stock = Number(p.stock || 0);
        let level: "normal" | "bajo" | "critico" = "normal";
        if (stock <= Math.max(0, Math.floor(min / 2))) level = "critico";
        else if (stock <= min) level = "bajo";
        const agg = byCategoryLevels.get(categoria) || { normal: 0, bajo: 0, critico: 0 };
        agg[level] += 1;
        byCategoryLevels.set(categoria, agg);
      }
      setInventoryByCategory(Array.from(byCategoryLevels.entries()).map(([categoria, v]) => ({ categoria, ...v })));
    } catch (error: any) {
      const msg = String(error?.message || "").toLowerCase();
      const isAbort = msg.includes("abort") || /err_aborted/i.test(msg);
      const isNetwork = /failed to fetch/i.test(msg);
      if (isAbort) {
        // abort silencioso
      } else if (isNetwork) {
        toast.error("Sin conexión con el servidor. Reintentaremos pronto…");
      } else {
        // En lugar de romper todo el dashboard, registramos el error y continuamos
        console.warn("[Dashboard] Error general en fetchMetrics:", error);
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
  const percentFormatter = useMemo(() => new Intl.NumberFormat("es-MX", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }), []);

  if (profileLoading || loading) {
    return <div className="flex items-center justify-center h-96">Cargando...</div>;
  }

  if (!empresaId) {
    return <div className="flex items-center justify-center h-96 text-muted-foreground">No hay empresa asociada a tu usuario.</div>;
  }

  const maxCatTotal = Math.max(1, ...salesByCategory.map((c) => c.total));
  const maxTrendTotal = Math.max(1, ...salesTrend.map((t) => t.total));
  const maxPrevTrendTotal = Math.max(1, ...salesTrendPrev.map((t) => t.total));
  const maxInventoryTotal = Math.max(1, ...inventoryByCategory.map((c) => (c.normal + c.bajo + c.critico)));

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
        <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex flex-col">
            <label htmlFor="date-from" className="text-xs text-muted-foreground">Desde</label>
            <Input id="date-from" type="date" value={dateFrom || ""} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label htmlFor="date-to" className="text-xs text-muted-foreground">Hasta</label>
            <Input id="date-to" type="date" value={dateTo || ""} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <Button variant="secondary" onClick={() => loadDashboard(true)} disabled={updating}>
            Aplicar
          </Button>
          <Button variant="ghost" onClick={() => { setDateFrom(null as any); setDateTo(null as any); }}>
            Limpiar
          </Button>
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Alertas Activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Stock bajo</div>
                <div className="text-2xl font-semibold text-foreground">{lowStockCount}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Stock crítico</div>
                <div className="text-2xl font-semibold text-destructive">{criticalStockCount}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Total</div>
                <div className="text-2xl font-semibold text-foreground">{kpis.alertasActivas}</div>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  const params = new URLSearchParams();
                  if (dateFrom) params.set("desde", dateFrom);
                  if (dateTo) params.set("hasta", dateTo);
                  params.set("period", period);
                  params.set("source", "dashboard");
                  navigate(`/alertas?${params.toString()}`);
                }}
              >
                Ver detalles
              </Button>
            </div>
          </CardContent>
        </Card>
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
              <div className="h-56">
                <InteractiveLineChart
                  current={salesTrend}
                  previous={salesTrendPrev}
                  maxCurrent={maxTrendTotal}
                  maxPrevious={maxPrevTrendTotal}
                  formatValue={(v) => currencyFormatter.format(v)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Productos Más Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay ventas registradas.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Participación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((p, idx) => {
                    const share = (p.valor || 0) / Math.max(1, kpis.ventasDelPeriodo);
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-foreground">{p.nombre}</TableCell>
                        <TableCell className="text-right">{p.cantidad}</TableCell>
                        <TableCell className="text-right">{currencyFormatter.format(p.valor)}</TableCell>
                        <TableCell className="text-right">{percentFormatter.format(share)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Inventario por categoría */}
            {inventoryByCategory.length > 0 && (
              <div className="mb-6">
                <div className="text-sm font-medium mb-3">Niveles de inventario por categoría</div>
                <div className="flex items-end gap-4 h-40">
                  {inventoryByCategory.map((c) => {
                    const total = c.normal + c.bajo + c.critico;
                    const scale = (v: number) => (v / Math.max(1, maxInventoryTotal)) * 100;
                    return (
                      <div key={c.categoria} className="flex flex-col items-center gap-2">
                        <div className="flex items-end gap-1 h-32">
                          <div className="w-3 bg-muted rounded" style={{ height: `${scale(c.normal)}%` }} title={`Normal: ${c.normal}`} />
                          <div className="w-3 bg-warning rounded" style={{ height: `${scale(c.bajo)}%` }} title={`Bajo: ${c.bajo}`} />
                          <div className="w-3 bg-destructive rounded" style={{ height: `${scale(c.critico)}%` }} title={`Crítico: ${c.critico}`} />
                        </div>
                        <span className="text-[10px] text-muted-foreground text-center w-24 truncate" title={c.categoria}>{c.categoria}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
