import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/newClient";
import { toast } from "sonner";
import { useUserProfile } from "@/hooks/useUserProfile";
import { validateEmail } from "@/services/users";
import { sendSaleConfirmationWithRetry } from "@/services/salesEmail";

interface VentaDialogProps {
  onVentaAdded: () => void;
}

interface ProductoVenta {
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
}

export const VentaDialog = ({ onVentaAdded }: VentaDialogProps) => {
  const { empresaId } = useUserProfile();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [productos, setProductos] = useState<Array<{ id: string; nombre: string; precio: number; stock: number }>>([]);
  const [cliente, setCliente] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [clienteDireccion, setClienteDireccion] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [items, setItems] = useState<ProductoVenta[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && empresaId) {
      fetchProductos();
    }
  }, [open, empresaId]);

  const fetchProductos = async () => {
    if (!empresaId) return;
    
    const { data, error } = await supabase
      .from("productos")
      .select("id, nombre, precio, stock")
      .eq("empresa_id", empresaId)
      .gt("stock", 0);

    if (error) {
      toast.error("Error al cargar productos");
      return;
    }
    setProductos(data || []);
  };

  const addItem = () => {
    setItems([...items, { producto_id: "", cantidad: 1, precio_unitario: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ProductoVenta, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === "producto_id") {
      const producto = productos.find(p => p.id === value);
      if (producto) {
        newItems[index].precio_unitario = producto.precio;
      }
    }
    
    setItems(newItems);
  };

  const getTotal = () => {
    return items.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId) {
      toast.error("Error: No se pudo obtener la empresa");
      return;
    }

    if (items.length === 0) {
      setErrors({ items: "Debe agregar al menos un producto" });
      toast.error("Debe agregar al menos un producto");
      return;
    }

    // Validaciones
    const newErrors: Record<string, string> = {};
    if (!metodoPago) newErrors.metodo_pago = "Seleccione un método de pago";

    // Email obligatorio con formato
    const emailTrim = clienteEmail.trim();
    if (!emailTrim) {
      newErrors.cliente_email = "Correo del cliente es obligatorio";
    } else if (!validateEmail(emailTrim)) {
      newErrors.cliente_email = "Formato de correo inválido";
    }

    // Dirección obligatoria con longitud mínima
    const dirTrim = clienteDireccion.trim();
    if (!dirTrim) {
      newErrors.cliente_direccion = "Dirección del cliente es obligatoria";
    } else if (dirTrim.length < 8) {
      newErrors.cliente_direccion = "Dirección demasiado corta (mínimo 8 caracteres)";
    }

    // Validar cada item
    for (const item of items) {
      if (!item.producto_id) newErrors.items = "Seleccione producto en cada línea";
      if (!item.cantidad || item.cantidad < 1) newErrors.items = "La cantidad debe ser al menos 1";
      if (!item.precio_unitario || item.precio_unitario <= 0) newErrors.items = "Precio unitario inválido";
    }

    // Validar stock agregado por producto
    const agregados: Record<string, number> = {};
    for (const item of items) {
      if (!item.producto_id) continue;
      agregados[item.producto_id] = (agregados[item.producto_id] || 0) + item.cantidad;
    }
    for (const [prodId, totalCant] of Object.entries(agregados)) {
      const prod = productos.find(p => p.id === prodId);
      if (prod && totalCant > prod.stock) {
        newErrors.stock = `Cantidad (${totalCant}) excede stock disponible para ${prod.nombre} (${prod.stock})`;
        break;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Corrige los campos marcados");
      return;
    } else {
      setErrors({});
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      // Crear venta
      const { data: venta, error: ventaError } = await supabase
        .from("ventas")
        .insert({
          user_id: user.id,
          empresa_id: empresaId,
          cliente: cliente || null,
          cliente_email: emailTrim,
          cliente_direccion: dirTrim,
          metodo_pago: metodoPago,
          total: getTotal(),
        })
        .select()
        .single();

      if (ventaError) throw ventaError;

      // Crear detalles de venta
      const detalles = items.map(item => ({
        venta_id: venta.id,
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        subtotal: item.cantidad * item.precio_unitario,
      }));

      const { error: detallesError } = await supabase
        .from("ventas_detalle")
        .insert(detalles);

      if (detallesError) throw detallesError;

      // Actualizar stock de productos
      for (const item of items) {
        const producto = productos.find(p => p.id === item.producto_id);
        if (producto) {
          const { error: stockError } = await supabase
            .from("productos")
            .update({ stock: producto.stock - item.cantidad })
            .eq("id", item.producto_id);

          if (stockError) throw stockError;
        }
      }

      // Upsert automático del cliente en módulo Clientes
      try {
        const nombreCliente = (cliente || "").trim();
        if (nombreCliente) {
          const nowIso = venta.created_at ? new Date(venta.created_at).toISOString() : new Date().toISOString();
          const { data: existing } = await supabase
            .from("clientes")
            .select("id, total_comprado, compras_count, fecha_primera_compra")
            .eq("empresa_id", empresaId)
            .eq("nombre", nombreCliente)
            .maybeSingle();

          if (!existing) {
            await supabase
              .from("clientes")
              .insert({
                empresa_id: empresaId,
                nombre: nombreCliente,
                fecha_primera_compra: nowIso,
                fecha_ultima_compra: nowIso,
                total_comprado: Number(venta.total || 0),
                compras_count: 1,
              });
          } else {
            await supabase
              .from("clientes")
              .update({
                fecha_ultima_compra: nowIso,
                total_comprado: Number(existing.total_comprado || 0) + Number(venta.total || 0),
                compras_count: Number(existing.compras_count || 0) + 1,
              })
              .eq("id", existing.id);
          }
        }
      } catch (clErr) {
        console.warn("[Clientes] No se pudo upsert el cliente tras venta", clErr);
      }

      // Envío de confirmación por correo con reintentos (no bloquea venta)
      try {
        const itemsResumen = items.map(i => {
          const p = productos.find(pp => pp.id === i.producto_id);
          return { nombre: p?.nombre || i.producto_id, cantidad: i.cantidad, precio: i.precio_unitario };
        });
        const res = await sendSaleConfirmationWithRetry({
          to: emailTrim,
          clienteNombre: (cliente || "Cliente"),
          direccion: dirTrim,
          ventaId: venta.id,
          empresaId,
          total: getTotal(),
          metodoPago,
          items: itemsResumen,
        }, 3, 600);
        if (res.ok) {
          try {
            await supabase
              .from("ventas")
              .update({ confirmacion_enviada_at: new Date().toISOString() })
              .eq("id", venta.id);
          } catch {}
        } else {
          toast.warning("Venta registrada; fallo al enviar confirmación: " + (res.error || ""));
        }
      } catch (mailErr: any) {
        console.warn("[Venta] Error al enviar confirmación", mailErr);
        toast.warning("Venta registrada; error de envío de confirmación");
      }

      toast.success("Venta registrada exitosamente");
      setCliente("");
      setClienteEmail("");
      setClienteDireccion("");
      setMetodoPago("");
      setItems([]);
      setErrors({});
      setOpen(false);
      onVentaAdded();
    } catch (error: any) {
      toast.error(error.message || "Error al registrar venta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-success hover:bg-success/90">
          <Plus className="h-4 w-4" />
          Nueva Venta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Venta</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cliente">Cliente (Opcional)</Label>
              <Input
                id="cliente"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nombre del cliente"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metodo_pago">Método de Pago</Label>
              <Select value={metodoPago} onValueChange={setMetodoPago} required>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Efectivo">Efectivo</SelectItem>
                  <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="Transferencia">Transferencia</SelectItem>
                </SelectContent>
              </Select>
              {errors.metodo_pago && <p className="text-sm text-destructive mt-1">{errors.metodo_pago}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cliente_email">Correo del Cliente</Label>
              <Input
                id="cliente_email"
                type="email"
                value={clienteEmail}
                onChange={(e) => setClienteEmail(e.target.value)}
                placeholder="cliente@correo.com"
                required
              />
              {errors.cliente_email && <p className="text-sm text-destructive mt-1">{errors.cliente_email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente_direccion">Dirección completa</Label>
              <Input
                id="cliente_direccion"
                value={clienteDireccion}
                onChange={(e) => setClienteDireccion(e.target.value)}
                placeholder="Calle, número, ciudad, país"
                required
              />
              {errors.cliente_direccion && <p className="text-sm text-destructive mt-1">{errors.cliente_direccion}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Productos</Label>
              <Button type="button" size="sm" variant="outline" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Agregar Producto
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Select
                      value={item.producto_id}
                      onValueChange={(value) => updateItem(index, "producto_id", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar producto" />
                      </SelectTrigger>
                      <SelectContent>
                        {productos.map((prod) => (
                          <SelectItem key={prod.id} value={prod.id}>
                            {prod.nombre} - Stock: {prod.stock}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      min="1"
                      value={item.cantidad}
                      onChange={(e) => updateItem(index, "cantidad", parseInt(e.target.value))}
                      placeholder="Cant."
                      required
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      step="0.01"
                      value={item.precio_unitario}
                      onChange={(e) => updateItem(index, "precio_unitario", parseFloat(e.target.value))}
                      placeholder="Precio"
                      required
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {(errors.items || errors.stock) && (
                <p className="text-sm text-destructive mt-1">{errors.items || errors.stock}</p>
              )}
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Total:</span>
              <span>${getTotal().toFixed(2)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Procesando..." : "Registrar Venta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
