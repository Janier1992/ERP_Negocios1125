import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/newClient";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";
import { startOfMonth, startOfDay, subDays, format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

export default function Finanzas() {
  const { empresaId, loading: profileLoading } = useUserProfile();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [period, setPeriod] = useState<"hoy" | "semana" | "mes">("hoy");
  const [resumen, setResumen] = useState<{ ingresos_mes: number; egresos_mes: number; balance_mes: number; cuentas_por_pagar: number } | null>(null);
  const [netTrend, setNetTrend] = useState<Array<{ label: string; total: number }>>([]);
  // Hooks de CxP colocados antes de los returns para respetar las Rules of Hooks
  const [cxpLoading, setCxpLoading] = useState(false);
  const [cxp, setCxp] = useState<Array<{ id: string; proveedor_id?: string | null; compra_id?: string | null; monto: number; fecha_emision: string; fecha_vencimiento: string; estado: 'pendiente'|'pagado'|'vencido' }>>([]);
  const [cxpEstado, setCxpEstado] = useState<'todas'|'pendiente'|'vencido'|'pagado'>('pendiente');
  useEffect(() => {
    if (!empresaId) return;
    const fetchCxp = async () => {
      setCxpLoading(true);
      try {
        const { data, error } = await supabase
          .from('cuentas_por_pagar')
          .select('id, proveedor_id, compra_id, monto, fecha_emision, fecha_vencimiento, estado')
          .eq('empresa_id', empresaId)
          .order('fecha_vencimiento', { ascending: true });
        if (error) {
          const code = (error as any)?.code || '';
          if (code === 'PGRST205') {
            setCxp([]);
          } else {
            throw error;
          }
        } else {
          setCxp((data || []) as any);
        }
      } catch (err) {
        console.error(err);
        toast.error('No se pudieron cargar CxP');
      } finally {
        setCxpLoading(false);
      }
    };
    fetchCxp();

    // Suscripción realtime a CxP para refrescar tabla automáticamente
    const channel = supabase
      .channel('finanzas-cxp')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cuentas_por_pagar', filter: `empresa_id=eq.${empresaId}` }, () => fetchCxp())
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [empresaId]);

  useEffect(() => {
    const getDesde = () => {
      if (period === 'hoy') return startOfDay(new Date()).toISOString();
      if (period === 'semana') return subDays(startOfDay(new Date()), 7).toISOString();
      return startOfMonth(new Date()).toISOString();
    };

    const fetchResumen = async (background: boolean) => {
      if (!empresaId) return;
      if (background) setUpdating(true); else setLoading(true);
      try {
        const desde = getDesde();

        // INGRESOS: ventas del periodo
        const ventasRes = await supabase
          .from('ventas')
          .select('total, created_at')
          .eq('empresa_id', empresaId)
          .gte('created_at', desde);
        let ingresos = 0;
        if (ventasRes.error) {
          const code = (ventasRes.error as any)?.code || '';
          if (code !== 'PGRST205') throw ventasRes.error;
        } else {
          ingresos = (ventasRes.data || []).reduce((sum: number, v: any) => sum + Number(v.total || 0), 0);
        }

        // EGRESOS: compras recibidas en el periodo
        const comprasRecRes = await supabase
          .from('compras')
          .select('id, estado, created_at')
          .eq('empresa_id', empresaId)
          .gte('created_at', desde)
          .eq('estado', 'recibida');
        let comprasRecRows: any[] = [];
        if (comprasRecRes.error) {
          const code = (comprasRecRes.error as any)?.code || '';
          if (code === 'PGRST205') {
            comprasRecRows = [];
          } else {
            throw comprasRecRes.error;
          }
        } else {
          comprasRecRows = comprasRecRes.data || [];
        }

        let egresos = 0;
        for (const c of comprasRecRows) {
          const detRes = await supabase
            .from('compras_detalle')
            .select('cantidad, precio')
            .eq('compra_id', c.id);
          let detRows: any[] = [];
          if (detRes.error) {
            const code = (detRes.error as any)?.code || '';
            if (code === 'PGRST205') {
              detRows = [];
            } else {
              throw detRes.error;
            }
          } else {
            detRows = detRes.data || [];
          }
          egresos += detRows.reduce((s: number, d: any) => s + Number(d.cantidad || 0) * Number(d.precio || 0), 0);
        }

        // CxP monto total actual (independiente del periodo)
        const cxpMontoRes = await supabase
          .from('cuentas_por_pagar')
          .select('monto, estado')
          .eq('empresa_id', empresaId)
          .neq('estado', 'pagado');
        let cuentasPorPagar = 0;
        if (!cxpMontoRes.error) {
          cuentasPorPagar = (cxpMontoRes.data || []).reduce((s: number, r: any) => s + Number(r.monto || 0), 0);
        }

        setResumen({
          ingresos_mes: ingresos,
          egresos_mes: egresos,
          balance_mes: ingresos - egresos,
          cuentas_por_pagar: cuentasPorPagar,
        });

        // Tendencia neta por día/horas
        const dailyMap = new Map<string, { ingresos: number; egresos: number }>();
        for (const v of (ventasRes.data || [])) {
          const label = format(new Date(v.created_at), period === 'hoy' ? 'HH:mm' : 'dd MMM');
          const cur = dailyMap.get(label) || { ingresos: 0, egresos: 0 };
          cur.ingresos += Number(v.total || 0);
          dailyMap.set(label, cur);
        }
        for (const c of comprasRecRows) {
          const label = format(new Date(c.created_at), period === 'hoy' ? 'HH:mm' : 'dd MMM');
          const detRes = await supabase
            .from('compras_detalle')
            .select('cantidad, precio')
            .eq('compra_id', c.id);
          const monto = (detRes.data || []).reduce((s: number, d: any) => s + Number(d.cantidad || 0) * Number(d.precio || 0), 0);
          const cur = dailyMap.get(label) || { ingresos: 0, egresos: 0 };
          cur.egresos += monto;
          dailyMap.set(label, cur);
        }
        const trend = Array.from(dailyMap.entries()).map(([label, v]) => ({ label, total: v.ingresos - v.egresos }));
        setNetTrend(trend);
      } catch (err: any) {
        toast.error('Error al cargar finanzas');
        console.error(err);
      } finally {
        if (background) setUpdating(false); else setLoading(false);
      }
    };
    if (empresaId) fetchResumen(false);
    else if (!profileLoading) setLoading(false);
    
    // Polling y suscripciones realtime para ventas/compras
    if (!empresaId) return;
    const interval = setInterval(() => fetchResumen(true), 5000);
    const channel = supabase
      .channel('finanzas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas', filter: `empresa_id=eq.${empresaId}` }, () => fetchResumen(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas_detalle' }, () => fetchResumen(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'compras', filter: `empresa_id=eq.${empresaId}` }, () => fetchResumen(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'compras_detalle' }, () => fetchResumen(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cuentas_por_pagar', filter: `empresa_id=eq.${empresaId}` }, () => fetchResumen(true))
      .subscribe();

    return () => {
      clearInterval(interval);
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [empresaId, profileLoading, period]);

  const currencyFormatter = useMemo(() => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }), []);

  if (profileLoading || loading) {
    return <div className="flex items-center justify-center h-96">Cargando...</div>;
  }

  if (!empresaId) {
    return <div className="flex items-center justify-center h-96 text-muted-foreground">No hay empresa asociada a tu usuario.</div>;
  }

  // (moved) Hooks de CxP re-ubicados arriba para cumplir reglas de Hooks

  const refreshVencimientos = async () => {
    if (!empresaId) return;
    try {
      const { data, error } = await supabase.rpc('refresh_cxp_estado', { _empresa: empresaId });
      if (error) throw error;
      toast.message(`Actualizados ${Number(data || 0)} vencimientos`);
      const { data: refData } = await supabase
        .from('cuentas_por_pagar')
        .select('id, proveedor_id, compra_id, monto, fecha_emision, fecha_vencimiento, estado')
        .eq('empresa_id', empresaId)
        .order('fecha_vencimiento', { ascending: true });
      setCxp((refData || []) as any);
    } catch (err) {
      toast.error('No se pudo actualizar vencimientos');
    }
  };

  const markPagada = async (id: string) => {
    // Actualización optimista para que desaparezca de inmediato en filtros de 'pendiente'
    const snapshot = cxp;
    setCxp((prev) => prev.map((x) => (x.id === id ? { ...x, estado: 'pagado' } : x)));
    try {
      const { error } = await supabase
        .from('cuentas_por_pagar')
        .update({ estado: 'pagado' })
        .eq('id', id);
      if (error) throw error;
      toast.success('Cuenta marcada como pagada');
    } catch (err) {
      // Revertir si falla
      setCxp(snapshot);
      toast.error('No se pudo marcar como pagada');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Finanzas</h2>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-muted-foreground">Resumen financiero consolidado.</p>
          {updating && <span className="text-xs text-muted-foreground animate-pulse">Actualizando…</span>}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ingresos (Mes)</CardTitle>
            <CardDescription>Ventas del mes</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{currencyFormatter.format(Number(resumen?.ingresos_mes || 0))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Egresos (Mes)</CardTitle>
            <CardDescription>Compras recibidas</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{currencyFormatter.format(Number(resumen?.egresos_mes || 0))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Balance (Mes)</CardTitle>
            <CardDescription>Ingresos - Egresos</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{currencyFormatter.format(Number(resumen?.balance_mes || 0))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cuentas por pagar</CardTitle>
            <CardDescription>Compras pendientes</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{currencyFormatter.format(Number(resumen?.cuentas_por_pagar || 0))}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Flujo Neto del Periodo</CardTitle>
          <CardDescription>Ingresos menos egresos</CardDescription>
        </CardHeader>
        <CardContent>
          {netTrend.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos en el periodo.</p>
          ) : (
            <div className="flex items-end gap-2 h-40">
              {netTrend.map((t) => (
                <div key={t.label} className="flex flex-col items-center gap-2">
                  <div
                    className="w-4 bg-primary rounded"
                    style={{ height: `${(t.total / Math.max(1, ...netTrend.map((x) => x.total))) * 100}%` }}
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
          <CardTitle>Cuentas por pagar</CardTitle>
          <CardDescription>Compras pendientes y vencidas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-end gap-4 mb-4">
            <div className="space-y-2">
              <label className="text-sm">Estado</label>
              <Select value={cxpEstado} onValueChange={(v) => setCxpEstado(v as any)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="vencido">Vencida</SelectItem>
                  <SelectItem value="pagado">Pagada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={refreshVencimientos} disabled={!empresaId || cxpLoading}>Refrescar vencimientos</Button>
          </div>
          {cxpLoading ? (
            <div className="text-sm text-muted-foreground">Cargando…</div>
          ) : cxp.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay cuentas por pagar.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compra</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cxp
                  .filter((x) => cxpEstado === 'todas' ? true : x.estado === cxpEstado)
                  .map((x) => (
                  <TableRow key={x.id}>
                    <TableCell>{x.compra_id ? String(x.compra_id).slice(0, 8) : '-'}</TableCell>
                    <TableCell>{x.proveedor_id ? String(x.proveedor_id).slice(0, 8) : '-'}</TableCell>
                    <TableCell>${Number(x.monto || 0).toFixed(2)}</TableCell>
                    <TableCell>{new Date(x.fecha_vencimiento).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {x.estado === 'vencido' && <Badge variant="destructive">Vencida</Badge>}
                      {x.estado === 'pendiente' && <Badge variant="outline">Pendiente</Badge>}
                      {x.estado === 'pagado' && <Badge variant="secondary">Pagada</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => markPagada(x.id)} disabled={x.estado === 'pagado'}>
                          Marcar pagada
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}