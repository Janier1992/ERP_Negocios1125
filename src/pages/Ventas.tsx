import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/newClient";
import { useUserProfile } from "@/hooks/useUserProfile";
import { VentaDialog } from "@/components/ventas/VentaDialog";
import { ExcelUploadDialog } from "@/components/ventas/ExcelUploadDialog";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Trash2, Eye, Pencil } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { validateEmail } from "@/services/users";

const Ventas = () => {
  const { empresaId, loading: profileLoading } = useUserProfile();
  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingVenta, setDeletingVenta] = useState<any>(null);
  const [editingVenta, setEditingVenta] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editProductos, setEditProductos] = useState<Array<{ id: string; nombre: string; precio: number; stock: number }>>([]);
  const [editCliente, setEditCliente] = useState("");
  const [editClienteEmail, setEditClienteEmail] = useState("");
  const [editClienteDireccion, setEditClienteDireccion] = useState("");
  const [editMetodoPago, setEditMetodoPago] = useState("");
  const [editItems, setEditItems] = useState<Array<{ id: string; producto_id: string; cantidad: number; precio_unitario: number }>>([]);
  const [editOriginalItems, setEditOriginalItems] = useState<Array<{ id: string; producto_id: string; cantidad: number; precio_unitario: number }>>([]);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [stats, setStats] = useState({
    ventasHoy: 0,
    ventasSemana: 0,
    ticketPromedio: 0,
    transaccionesHoy: 0,
  });

  useEffect(() => {
    if (empresaId) {
      fetchVentas();
    } else if (!profileLoading) {
      setLoading(false);
    }
  }, [empresaId, profileLoading]);

  // Carga de productos y detalles al iniciar edición
  useEffect(() => {
    const fetchEditProductos = async () => {
      if (!empresaId || !editingVenta) return;
      const { data, error } = await supabase
        .from("productos")
        .select("id, nombre, precio, stock")
        .eq("empresa_id", empresaId);
      if (error) {
        toast.error("Error al cargar productos");
      }
      setEditProductos(data || []);
    };
    const fetchEditDetalles = async () => {
      if (!editingVenta) return;
      const { data, error } = await supabase
        .from("ventas_detalle")
        .select("id, producto_id, cantidad, precio_unitario")
        .eq("venta_id", editingVenta.id)
        .order("id", { ascending: true });
      if (error) {
        toast.error("Error al cargar detalles");
        return;
      }
      const arr = (data || []).map((d: any) => ({ id: String(d.id), producto_id: String(d.producto_id), cantidad: Number(d.cantidad || 0), precio_unitario: Number(d.precio_unitario || 0) }));
      setEditItems(arr);
      setEditOriginalItems(arr);
    };

    if (editingVenta) {
      setEditCliente(editingVenta.cliente || "");
      setEditClienteEmail(editingVenta.cliente_email || "");
      setEditClienteDireccion(editingVenta.cliente_direccion || "");
      setEditMetodoPago(editingVenta.metodo_pago || "");
      setEditOpen(true);
      fetchEditProductos();
      fetchEditDetalles();
    } else {
      setEditOpen(false);
    }
  }, [editingVenta, empresaId]);

  const fetchVentas = async () => {
    if (!empresaId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ventas")
        .select("id, created_at, cliente, cliente_email, cliente_direccion, total, metodo_pago, ventas_detalle(cantidad)")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setVentas(data || []);
      calculateStats(data || []);
    } catch (error: any) {
      toast.error("Error al cargar ventas");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (ventasData: any[]) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const ventasHoy = ventasData.filter(
      (v) => new Date(v.created_at) >= hoy
    );
    
    const totalHoy = ventasHoy.reduce((sum, v) => sum + Number(v.total), 0);
    const ticketPromedio = ventasHoy.length > 0 ? totalHoy / ventasHoy.length : 0;

    setStats({
      ventasHoy: totalHoy,
      ventasSemana: ventasData.reduce((sum, v) => sum + Number(v.total), 0),
      ticketPromedio,
      transaccionesHoy: ventasHoy.length,
    });
  };

  const handleDelete = async () => {
    if (!deletingVenta) return;

    const ventaId = deletingVenta.id;

    // Optimistic UI update: remove immediately from list
    setVentas((prev) => {
      const updated = prev.filter((v) => v.id !== ventaId);
      calculateStats(updated);
      return updated;
    });
    // Close dialog quickly
    setDeletingVenta(null);
  
    try {
      // Prefer secure RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc("delete_venta", { _venta_id: ventaId });
  
      if (rpcError) {
        // Fallback: direct delete with RLS
        const { error } = await supabase
          .from("ventas")
          .delete()
          .eq("id", ventaId);
        if (error) throw error;
      }
  
      // Confirm and refresh to keep server/client in sync
      toast.success("Venta eliminada correctamente");
      fetchVentas();
    } catch (error: any) {
      const msg = String(error?.message || "");
      const friendly = /Failed to fetch/i.test(msg)
        ? "Sin conexión con el servidor. Intenta nuevamente."
        : /policy|rls|permission/i.test(msg)
        ? "No tienes permisos para eliminar ventas. Contacta al administrador."
        : "Error al eliminar venta";
  
      toast.error(friendly);
      // Restore from server state if optimistic update was incorrect
      fetchVentas();
    }
  };

  if (profileLoading || loading) {
    return <div className="flex items-center justify-center h-96">Cargando...</div>;
  }

  if (!empresaId) {
    return <div className="flex items-center justify-center h-96 text-muted-foreground">No hay empresa asociada a tu usuario. Completa el registro y vuelve a intentar.</div>;
  }

  // Helpers de edición
  const updateEditItem = (index: number, field: "producto_id" | "cantidad" | "precio_unitario", value: any) => {
    const next = [...editItems];
    if (field === "cantidad") value = Math.max(1, parseInt(value || 0));
    if (field === "precio_unitario") value = Math.max(0, parseFloat(value || 0));
    next[index] = { ...next[index], [field]: value } as any;
    if (field === "producto_id") {
      const prod = editProductos.find(p => p.id === value);
      if (prod) next[index].precio_unitario = Number(prod.precio || 0);
    }
    setEditItems(next);
  };

  const getEditTotal = () => editItems.reduce((s, it) => s + (Number(it.cantidad) * Number(it.precio_unitario)), 0);

  const validarEdit = () => {
    const newErrors: Record<string, string> = {};
    if (!editMetodoPago) newErrors.metodo_pago = "Selecciona método de pago";
    const emailTrim = (editClienteEmail || "").trim();
    if (!emailTrim) {
      newErrors.cliente_email = "Correo del cliente es obligatorio";
    } else if (!validateEmail(emailTrim)) {
      newErrors.cliente_email = "Formato de correo inválido";
    }
    const dirTrim = (editClienteDireccion || "").trim();
    if (!dirTrim) {
      newErrors.cliente_direccion = "Dirección del cliente es obligatoria";
    } else if (dirTrim.length < 8) {
      newErrors.cliente_direccion = "Dirección demasiado corta (mínimo 8 caracteres)";
    }
    if (editItems.length === 0) newErrors.items = "La venta debe tener al menos un producto";
    for (const it of editItems) {
      if (!it.producto_id) { newErrors.items = "Selecciona producto en todos los ítems"; break; }
      if (!(it.cantidad >= 1)) { newErrors.items = "Cantidad debe ser al menos 1"; break; }
      if (!(it.precio_unitario >= 0)) { newErrors.items = "Precio no puede ser negativo"; break; }
    }
    const deltas = new Map<string, number>();
    for (const curr of editItems) {
      const orig = editOriginalItems.find(o => o.id === curr.id);
      if (!orig) continue;
      if (orig.producto_id === curr.producto_id) {
        const delta = Number(curr.cantidad) - Number(orig.cantidad);
        if (delta !== 0) deltas.set(curr.producto_id, (deltas.get(curr.producto_id) || 0) + delta);
      } else {
        deltas.set(orig.producto_id, (deltas.get(orig.producto_id) || 0) - Number(orig.cantidad));
        deltas.set(curr.producto_id, (deltas.get(curr.producto_id) || 0) + Number(curr.cantidad));
      }
    }
    for (const [prodId, delta] of deltas.entries()) {
      if (delta > 0) {
        const prod = editProductos.find(p => p.id === prodId);
        if (!prod || Number(prod.stock || 0) < delta) {
          newErrors.stock = `Stock insuficiente para producto seleccionado (necesita ${delta})`;
          break;
        }
      }
    }
    setEditErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEditClose = () => {
    setEditOpen(false);
    setEditErrors({});
    setEditItems([]);
    setEditOriginalItems([]);
    setEditingVenta(null);
    setEditConfirmOpen(false);
    setEditClienteEmail("");
    setEditClienteDireccion("");
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validarEdit()) { toast.error("Corrige los campos marcados"); return; }
    setEditConfirmOpen(true);
  };

  const performEditSave = async () => {
    if (!empresaId || !editingVenta) return;
    setEditLoading(true);
    try {
      const total = getEditTotal();
      const { error: ventaError } = await supabase
        .from("ventas")
        .update({ cliente: editCliente || null, cliente_email: (editClienteEmail || "").trim(), cliente_direccion: (editClienteDireccion || "").trim(), metodo_pago: editMetodoPago, total })
        .eq("id", editingVenta.id);
      if (ventaError) throw ventaError;

      for (const curr of editItems) {
        const orig = editOriginalItems.find(o => o.id === curr.id);
        if (!orig) continue;
        const subtotal = Number(curr.cantidad) * Number(curr.precio_unitario);
        const { error: detErr } = await supabase
          .from("ventas_detalle")
          .update({ producto_id: curr.producto_id, cantidad: curr.cantidad, precio_unitario: curr.precio_unitario, subtotal })
          .eq("id", curr.id);
        if (detErr) throw detErr;
        if (orig.producto_id === curr.producto_id) {
          const delta = Number(curr.cantidad) - Number(orig.cantidad);
          if (delta !== 0) {
            const prod = editProductos.find(p => p.id === curr.producto_id);
            if (prod) {
              const nuevoStock = Number(prod.stock || 0) - delta;
              const { error: upErr } = await supabase
                .from("productos")
                .update({ stock: nuevoStock })
                .eq("id", curr.producto_id);
              if (upErr) throw upErr;
              prod.stock = nuevoStock;
            }
          }
        } else {
          const prodOrig = editProductos.find(p => p.id === orig.producto_id);
          if (prodOrig) {
            const { error: upErr1 } = await supabase
              .from("productos")
              .update({ stock: Number(prodOrig.stock || 0) + Number(orig.cantidad) })
              .eq("id", orig.producto_id);
            if (upErr1) throw upErr1;
            prodOrig.stock = Number(prodOrig.stock || 0) + Number(orig.cantidad);
          }
          const prodNew = editProductos.find(p => p.id === curr.producto_id);
          if (prodNew) {
            const { error: upErr2 } = await supabase
              .from("productos")
              .update({ stock: Number(prodNew.stock || 0) - Number(curr.cantidad) })
              .eq("id", curr.producto_id);
            if (upErr2) throw upErr2;
            prodNew.stock = Number(prodNew.stock || 0) - Number(curr.cantidad);
          }
        }
      }

      toast.success("Venta actualizada");
      setEditConfirmOpen(false);
      handleEditClose();
      fetchVentas();
    } catch (err: any) {
      const msg = String(err?.message || "");
      const friendly = /policy|rls|permission/i.test(msg) ? "Sin permisos para editar ventas" : /Failed to fetch/i.test(msg) ? "Sin conexión" : "No se pudo guardar cambios";
      toast.error(friendly);
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Ventas</h2>
          <p className="text-muted-foreground mt-1">
            Punto de venta y registro de transacciones
          </p>
        </div>
        <div className="flex gap-2">
          <ExcelUploadDialog onUploadComplete={fetchVentas} />
          <VentaDialog onVentaAdded={fetchVentas} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground font-medium mb-2">Ventas Hoy</p>
              <p className="text-4xl font-bold text-foreground">${stats.ventasHoy.toFixed(2)}</p>
              <p className="text-xs text-success font-medium mt-2">
                {stats.transaccionesHoy} transacciones
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground font-medium mb-2">Total Ventas</p>
              <p className="text-4xl font-bold text-foreground">${stats.ventasSemana.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-2">Últimas 50 ventas</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground font-medium mb-2">Ticket Promedio</p>
              <p className="text-4xl font-bold text-foreground">${stats.ticketPromedio.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-2">Promedio hoy</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Ventas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha y Hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead className="text-right">Productos</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Método de Pago</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ventas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No hay ventas registradas
                  </TableCell>
                </TableRow>
              ) : (
                ventas.map((venta) => {
                  const totalProductos = venta.ventas_detalle?.reduce(
                    (sum: number, d: any) => sum + d.cantidad, 0
                  ) || 0;
                  
                  return (
                    <TableRow key={venta.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">
                        {format(new Date(venta.created_at), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="font-medium">{venta.cliente || "Cliente General"}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[240px] truncate">{(venta.cliente_email || "-")}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[280px] truncate">{(venta.cliente_direccion || "-")}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{totalProductos}</TableCell>
                      <TableCell className="text-right font-semibold text-success">
                        ${Number(venta.total).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-md font-medium">
                          {venta.metodo_pago}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-2 hover:bg-muted rounded-md transition-colors">
                              <MoreVertical className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => setEditingVenta(venta)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setDeletingVenta(venta)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de edición */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) handleEditClose(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Venta</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cliente">Cliente (Opcional)</Label>
                <Input id="cliente" value={editCliente} onChange={(e) => setEditCliente(e.target.value)} placeholder="Nombre del cliente" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metodo_pago">Método de Pago</Label>
                <Select value={editMetodoPago} onValueChange={setEditMetodoPago} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                    <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="Transferencia">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
                {editErrors.metodo_pago && <p className="text-sm text-destructive mt-1">{editErrors.metodo_pago}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cliente_email">Correo del Cliente</Label>
                <Input
                  id="cliente_email"
                  type="email"
                  value={editClienteEmail}
                  onChange={(e) => setEditClienteEmail(e.target.value)}
                  placeholder="cliente@correo.com"
                  required
                />
                {editErrors.cliente_email && <p className="text-sm text-destructive mt-1">{editErrors.cliente_email}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cliente_direccion">Dirección completa</Label>
                <Input
                  id="cliente_direccion"
                  value={editClienteDireccion}
                  onChange={(e) => setEditClienteDireccion(e.target.value)}
                  placeholder="Calle, número, ciudad, país"
                  required
                />
                {editErrors.cliente_direccion && <p className="text-sm text-destructive mt-1">{editErrors.cliente_direccion}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Items de Venta</Label>
              <div className="space-y-2">
                {editItems.map((item, index) => (
                  <div key={item.id} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Select value={item.producto_id} onValueChange={(val) => updateEditItem(index, "producto_id", val)} required>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar producto" />
                        </SelectTrigger>
                        <SelectContent>
                          {editProductos.map((prod) => (
                            <SelectItem key={prod.id} value={prod.id}>{prod.nombre} - Stock: {prod.stock}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24">
                      <Input type="number" min="1" value={item.cantidad} onChange={(e) => updateEditItem(index, "cantidad", parseInt(e.target.value))} placeholder="Cant." required />
                    </div>
                    <div className="w-28">
                      <Input type="number" step="0.01" min="0" value={item.precio_unitario} onChange={(e) => updateEditItem(index, "precio_unitario", parseFloat(e.target.value))} placeholder="Precio" required />
                    </div>
                  </div>
                ))}
                {(editErrors.items || editErrors.stock) && (
                  <p className="text-sm text-destructive mt-1">{editErrors.items || editErrors.stock}</p>
                )}
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total:</span>
                <span>${getEditTotal().toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleEditClose}>Cancelar</Button>
              <Button type="submit" disabled={editLoading}>{editLoading ? "Guardando..." : "Guardar cambios"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmación antes de guardar edición */}
      <AlertDialog open={editConfirmOpen} onOpenChange={setEditConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cambios</AlertDialogTitle>
            <AlertDialogDescription>
              Se actualizarán los datos de la venta y se ajustará el stock de productos según corresponda. ¿Deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={performEditSave}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de eliminación */}
      <AlertDialog open={!!deletingVenta} onOpenChange={() => setDeletingVenta(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar venta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la venta del {deletingVenta && format(new Date(deletingVenta.created_at), "dd/MM/yyyy HH:mm")} por un total de ${deletingVenta && Number(deletingVenta.total).toFixed(2)}. 
              Esta acción no se puede deshacer y también eliminará todos los detalles asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Ventas;
