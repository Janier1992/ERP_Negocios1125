import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, CheckCircle2, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/newClient";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { fetchAlerts, subscribeAlerts, markAlertRead, AlertRow } from "@/services/alerts";

type Alerta = AlertRow & { producto_id?: string | null };

const Alertas = () => {
  const { empresaId, loading: profileLoading } = useUserProfile();
  const [loading, setLoading] = useState(true);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<"todas" | "activas" | "leidas">("todas");
  const [tipo, setTipo] = useState<"todos" | "stock_bajo" | "stock_critico">("todos");
  const [supportsLeida, setSupportsLeida] = useState(true);
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"fecha" | "prioridad" | "tipo">("fecha");
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [totalActivas, setTotalActivas] = useState<number>(0);
  const [params] = useSearchParams();

  const fetchAlertas = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const desde = dateFrom ? new Date(dateFrom).toISOString() : undefined;
      const hasta = dateTo ? new Date(dateTo).toISOString() : undefined;
      const orderBy = sortKey === "fecha" ? "created_at" : sortKey === "tipo" ? "tipo" : "created_at";
      try {
        const data = await fetchAlerts({ empresaId, desde, hasta, orderBy, orderAsc: sortAsc });
        setSupportsLeida(true);
        setAlertas(data as Alerta[]);
      } catch (error: any) {
        const msg = String(error?.message || "").toLowerCase();
        if (msg.includes("column") && msg.includes("leida")) {
          console.warn("[Alertas] Faltan columnas leida en la instancia. Fallback a columnas básicas.");
          setSupportsLeida(false);
          const retry = await supabase
            .from("alertas")
            .select("id, tipo, titulo, mensaje, created_at")
            .eq("empresa_id", empresaId)
            .order("created_at", { ascending: sortAsc });
          if (retry.error) throw retry.error;
          setAlertas((retry.data || []) as Alerta[]);
        } else {
          throw error;
        }
      }
    } catch (err: any) {
      const low = String(err?.message || "").toLowerCase();
      const isAbort = low.includes("abort") || /err_aborted/i.test(low);
      const isNetwork = /failed to fetch|network/i.test(low);
      if (isAbort) {
        // Navegación abortada o cancelaciones internas: no mostrar error
      } else if (isNetwork) {
        toast.error("Sin conexión con el servidor. Reintenta en unos segundos…");
      } else {
        toast.error("Error al cargar alertas");
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!empresaId) return;
    // Inicializa filtros desde query params (sincronizado con Dashboard)
    const qpDesde = params.get("desde");
    const qpHasta = params.get("hasta");
    if (qpDesde) setDateFrom(qpDesde);
    if (qpHasta) setDateTo(qpHasta);
    fetchAlertas();
    const ch = subscribeAlerts(empresaId, () => fetchAlertas());
    return () => {
      supabase.removeChannel(ch);
    };
  }, [empresaId]);

  const marcarLeida = async (id: string) => {
    if (!supportsLeida) {
      toast.info("La marcación de lectura no está disponible en esta instancia.");
      return;
    }
    try {
      await markAlertRead(id, true);
      setAlertas(prev => prev.map(a => (a.id === id ? { ...a, leida: true } : a)));
      toast.success("Alerta marcada como leída");
    } catch (err: any) {
      toast.error("No se pudo marcar la alerta");
      console.error(err);
    }
  };

  const marcarTodasLeidas = async () => {
    if (!supportsLeida) {
      toast.info("La marcación de lectura no está disponible en esta instancia.");
      return;
    }
    try {
      const ids = filteredAlertas.map(a => a.id);
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("alertas")
        .update({ leida: true })
        .in("id", ids);
      if (error) throw error;
      setAlertas(prev => prev.map(a => ({ ...a, leida: true })));
      toast.success("Todas las alertas visibles marcadas como leídas");
    } catch (err: any) {
      toast.error("No se pudieron marcar las alertas");
      console.error(err);
    }
  };

  const filteredAlertas = useMemo(() => {
    const base = alertas.filter(a => {
      const matchSearch =
        search.trim().length === 0 ||
        a.titulo.toLowerCase().includes(search.toLowerCase()) ||
        a.mensaje.toLowerCase().includes(search.toLowerCase());
      const matchEstado = supportsLeida
        ? (estado === "todas" || (estado === "activas" && !a.leida) || (estado === "leidas" && !!a.leida))
        : true; // si no hay soporte de "leida", ignoramos el filtro de estado
      const matchTipo = tipo === "todos" || a.tipo === tipo;
      return matchSearch && matchEstado && matchTipo;
    });
    const withSort = [...base];
    if (sortKey === "prioridad") {
      const priority = (t: string) => (t === "stock_critico" ? 3 : t === "stock_bajo" ? 2 : 1);
      withSort.sort((a, b) => (sortAsc ? 1 : -1) * (priority(a.tipo) - priority(b.tipo)));
    } else if (sortKey === "tipo") {
      withSort.sort((a, b) => (sortAsc ? 1 : -1) * a.tipo.localeCompare(b.tipo));
    } else {
      withSort.sort((a, b) => {
        const da = new Date(a.created_at).getTime();
        const db = new Date(b.created_at).getTime();
        return (sortAsc ? 1 : -1) * (da - db);
      });
    }
    return withSort;
  }, [alertas, search, estado, tipo, sortKey, sortAsc, supportsLeida]);

  useEffect(() => {
    setTotalActivas(alertas.filter(a => !a.leida).length);
  }, [alertas]);

  const getTipoBadge = (t: string) => {
    switch (t) {
      case "stock_critico":
        return <Badge variant="destructive">Stock Crítico</Badge>;
      case "stock_bajo":
        return <Badge className="bg-warning text-warning-foreground">Stock Bajo</Badge>;
      default:
        return <Badge>Alerta</Badge>;
    }
  };

  if (profileLoading || loading) {
    return <div className="flex items-center justify-center h-96">Cargando...</div>;
  }

  if (!empresaId) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        No hay empresa asociada a tu usuario. Completa el registro y vuelve a intentar.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Alertas</h2>
          <p className="text-muted-foreground mt-1">Gestión de alertas del sistema</p>
          <div className="text-sm mt-1">Activas: <span className="font-semibold">{totalActivas}</span></div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAlertas} className="gap-2">
            <Filter className="h-4 w-4" />
            Actualizar
          </Button>
          {supportsLeida && (
          <Button onClick={marcarTodasLeidas} className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Marcar todas como leídas
          </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de Alertas</CardTitle>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mt-4">
            <div className="relative">
              <Input
                placeholder="Buscar por título o mensaje..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={estado === "todas" ? "default" : "outline"}
                onClick={() => setEstado("todas")}
              >
                Todas
              </Button>
              <Button
                variant={estado === "activas" ? "default" : "outline"}
                onClick={() => supportsLeida && setEstado("activas")}
                disabled={!supportsLeida}
              >
                Activas
              </Button>
              <Button
                variant={estado === "leidas" ? "default" : "outline"}
                onClick={() => supportsLeida && setEstado("leidas")}
                disabled={!supportsLeida}
              >
                Leídas
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant={tipo === "todos" ? "default" : "outline"}
                onClick={() => setTipo("todos")}
              >
                Todos
              </Button>
              <Button
                variant={tipo === "stock_bajo" ? "default" : "outline"}
                onClick={() => setTipo("stock_bajo")}
              >
                Stock Bajo
              </Button>
              <Button
                variant={tipo === "stock_critico" ? "default" : "outline"}
                onClick={() => setTipo("stock_critico")}
              >
                Stock Crítico
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Input type="date" value={dateFrom || ""} onChange={(e) => setDateFrom(e.target.value)} />
                <Input type="date" value={dateTo || ""} onChange={(e) => setDateTo(e.target.value)} />
                <Button variant="secondary" onClick={fetchAlertas}>Aplicar</Button>
                <Button variant="ghost" onClick={() => { setDateFrom(null); setDateTo(null); fetchAlertas(); }}>Limpiar</Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant={sortKey === "fecha" ? "default" : "outline"} onClick={() => setSortKey("fecha")}>Fecha</Button>
                <Button variant={sortKey === "prioridad" ? "default" : "outline"} onClick={() => setSortKey("prioridad")}>Prioridad</Button>
                <Button variant={sortKey === "tipo" ? "default" : "outline"} onClick={() => setSortKey("tipo")}>Tipo</Button>
                <Button variant="outline" onClick={() => setSortAsc((v) => !v)}>{sortAsc ? "Asc" : "Desc"}</Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAlertas.length === 0 ? (
            <div className="text-sm text-muted-foreground">No hay alertas para los filtros seleccionados.</div>
          ) : (
            <div className="space-y-3">
              {filteredAlertas.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border border-border"
                >
                  <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{a.titulo}</p>
                      {getTipoBadge(a.tipo)}
                      {supportsLeida && a.leida && <Badge variant="outline">Leída</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{a.mensaje}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(a.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {supportsLeida && !a.leida && (
                      <Button variant="outline" size="sm" onClick={() => marcarLeida(a.id)}>
                        Marcar como leída
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Separator className="my-4" />
          <p className="text-xs text-muted-foreground">
            Las alertas se generan automáticamente según el stock y otros eventos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Alertas;