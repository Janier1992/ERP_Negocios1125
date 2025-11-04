import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/newClient";
import { toast } from "sonner";
import { useUserProfile } from "@/hooks/useUserProfile";
import { addProductoManual } from "@/integrations/supabase/inventory";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

interface ProductDialogProps {
  onProductAdded: () => void;
  categorias: Array<{ id: string; nombre: string }>;
  proveedores: Array<{ id: string; nombre: string }>;
  editingProduct?: any;
  onClose?: () => void;
}

export const ProductDialog = ({ 
  onProductAdded, 
  categorias, 
  proveedores,
  editingProduct,
  onClose 
}: ProductDialogProps) => {
  const { empresaId } = useUserProfile();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const productSchema = z.object({
    codigo: z.string().min(1, "El código es obligatorio"),
    nombre: z.string().min(1, "El nombre es obligatorio"),
    descripcion: z.string().optional().nullable().transform((v) => v ?? ""),
    precio: z.coerce.number().positive("Precio inválido"),
    stock: z.coerce.number().min(0, "Stock inválido"),
    stock_minimo: z.coerce.number().min(0, "Stock mínimo inválido").default(0),
    categoria_id: z.string().optional().nullable().transform((v) => v ?? ""),
    proveedor_id: z.string().optional().nullable().transform((v) => v ?? ""),
  });

  type FormValues = z.infer<typeof productSchema>;

  const { control, register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      codigo: "",
      nombre: "",
      descripcion: "",
      precio: 0,
      stock: 0,
      stock_minimo: 0,
      categoria_id: "",
      proveedor_id: "",
    },
  });

  useEffect(() => {
    if (editingProduct) {
      reset({
        codigo: editingProduct.codigo ?? "",
        nombre: editingProduct.nombre ?? "",
        descripcion: editingProduct.descripcion ?? "",
        precio: Number(editingProduct.precio ?? 0),
        stock: Number(editingProduct.stock ?? 0),
        stock_minimo: Number(editingProduct.stock_minimo ?? 0),
        categoria_id: editingProduct.categoria_id ?? "",
        proveedor_id: editingProduct.proveedor_id ?? "",
      });
      setOpen(true);
    }
  }, [editingProduct, reset]);

  const onSubmit = async (values: FormValues) => {
    if (!empresaId) {
      toast.error("Error: No se pudo obtener la empresa");
      return;
    }

    setLoading(true);
    try {
      if (editingProduct) {
        const { error } = await supabase
          .from("productos")
          .update({
            codigo: values.codigo,
            nombre: values.nombre,
            descripcion: values.descripcion || undefined,
            precio: values.precio,
            stock: values.stock,
            stock_minimo: values.stock_minimo ?? 0,
            categoria_id: values.categoria_id || undefined,
            proveedor_id: values.proveedor_id || undefined,
          })
          .eq("id", editingProduct.id);
        if (error) throw error;
        toast.success("Producto actualizado correctamente");
      } else {
        await addProductoManual({
          empresaId,
          codigo: values.codigo,
          nombre: values.nombre,
          cantidad: values.stock,
          precio: values.precio,
          descripcion: values.descripcion || undefined,
          categoria_id: values.categoria_id || undefined,
          proveedor_id: values.proveedor_id || undefined,
          stock_minimo: values.stock_minimo ?? 0,
        });
        toast.success("Producto agregado exitosamente");
      }

      reset();
      setOpen(false);
      if (onClose) onClose();
      onProductAdded();
    } catch (error: any) {
      toast.error(error.message || "Error al guardar producto");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    if (onClose) onClose();
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (isOpen) setOpen(true);
      else handleClose();
    }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Agregar Producto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingProduct ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código</Label>
              <Input id="codigo" {...register("codigo")} />
              {errors.codigo && <p className="text-sm text-destructive mt-1">{errors.codigo.message as string}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" {...register("nombre")} />
              {errors.nombre && <p className="text-sm text-destructive mt-1">{errors.nombre.message as string}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea id="descripcion" {...register("descripcion")} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="precio">Precio</Label>
              <Input id="precio" type="number" step="0.01" {...register("precio")} />
              {errors.precio && <p className="text-sm text-destructive mt-1">{errors.precio.message as string}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock">Stock</Label>
              <Input id="stock" type="number" {...register("stock")} />
              {errors.stock && <p className="text-sm text-destructive mt-1">{errors.stock.message as string}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock_minimo">Stock Mínimo</Label>
              <Input id="stock_minimo" type="number" {...register("stock_minimo")} />
              {errors.stock_minimo && <p className="text-sm text-destructive mt-1">{errors.stock_minimo.message as string}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoría (opcional)</Label>
              <Controller
                control={control}
                name="categoria_id"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.categoria_id && <p className="text-sm text-destructive mt-1">{errors.categoria_id.message as string}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="proveedor">Proveedor (opcional)</Label>
              <Controller
                control={control}
                name="proveedor_id"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar proveedor (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {proveedores.map((prov) => (
                        <SelectItem key={prov.id} value={prov.id}>
                          {prov.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.proveedor_id && <p className="text-sm text-destructive mt-1">{errors.proveedor_id.message as string}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : editingProduct ? "Actualizar Producto" : "Guardar Producto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
