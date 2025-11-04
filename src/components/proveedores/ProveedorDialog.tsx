import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/newClient";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";

interface ProveedorDialogProps {
  onProveedorAdded: () => void;
  editingProveedor?: any;
  onClose?: () => void;
}

export const ProveedorDialog = ({ 
  onProveedorAdded,
  editingProveedor,
  onClose 
}: ProveedorDialogProps) => {
  const { empresaId } = useUserProfile();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    nombre: "",
    contacto: "",
    email: "",
    telefono: "",
    direccion: "",
  });

  useEffect(() => {
    if (editingProveedor) {
      setFormData({
        nombre: editingProveedor.nombre || "",
        contacto: editingProveedor.contacto || "",
        email: editingProveedor.email || "",
        telefono: editingProveedor.telefono || "",
        direccion: editingProveedor.direccion || "",
      });
      setOpen(true);
    }
  }, [editingProveedor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Verificación de contexto de empresa y sesión
    if (!empresaId) {
      toast.error("No se encontró empresa asociada al usuario.");
      return;
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      toast.error("Sesión inválida. Inicia sesión nuevamente.");
      return;
    }

    // Validaciones
    const newErrors: Record<string, string> = {};
    if (!formData.nombre.trim()) newErrors.nombre = "El nombre es obligatorio";
    if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) newErrors.email = "Email inválido";
    if (formData.telefono && !/^[+\d\s-]{6,}$/.test(formData.telefono)) newErrors.telefono = "Teléfono inválido";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Corrige los campos marcados");
      return;
    } else {
      setErrors({});
    }

    // Normalizar payload
    const insertPayload = {
      nombre: formData.nombre.trim(),
      contacto: formData.contacto ? formData.contacto.trim() : null,
      email: formData.email ? formData.email.trim() : null,
      telefono: formData.telefono ? formData.telefono.trim() : null,
      direccion: formData.direccion ? formData.direccion.trim() : null,
      empresa_id: empresaId,
    };

    setLoading(true);
    try {
      if (editingProveedor) {
        const updatePayload: any = { ...insertPayload };
        delete updatePayload.empresa_id; // no se actualiza empresa en edición

        const { error } = await supabase
          .from("proveedores")
          .update(updatePayload)
          .eq("id", editingProveedor.id);

        if (error) throw error;
        toast.success("Proveedor actualizado correctamente");
      } else {
        const { error } = await supabase
          .from("proveedores")
          .insert(insertPayload)
          .select("id")
          .maybeSingle();

        if (error) throw error;
        toast.success("Proveedor agregado correctamente");
      }

      setFormData({
        nombre: "",
        contacto: "",
        email: "",
        telefono: "",
        direccion: "",
      });
      setErrors({});
      setOpen(false);
      if (onClose) onClose();
      onProveedorAdded();
    } catch (error: any) {
      const message = error?.message || "Error al agregar proveedor";
      toast.error(message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    if (onClose) onClose();
    setFormData({
      nombre: "",
      contacto: "",
      email: "",
      telefono: "",
      direccion: "",
    });
    setErrors({});
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) handleClose(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Proveedor
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingProveedor ? "Editar Proveedor" : "Agregar Nuevo Proveedor"}</DialogTitle>
          <DialogDescription>
            Ingrese los datos del proveedor
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              required
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            />
            {errors.nombre && <p className="text-sm text-destructive mt-1">{errors.nombre}</p>}
          </div>
          <div>
            <Label htmlFor="contacto">Persona de Contacto</Label>
            <Input
              id="contacto"
              value={formData.contacto}
              onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
          </div>
          <div>
            <Label htmlFor="telefono">Teléfono</Label>
            <Input
              id="telefono"
              value={formData.telefono}
              onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
            />
            {errors.telefono && <p className="text-sm text-destructive mt-1">{errors.telefono}</p>}
          </div>
          <div>
            <Label htmlFor="direccion">Dirección</Label>
            <Input
              id="direccion"
              value={formData.direccion}
              onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Guardando..." : editingProveedor ? "Actualizar Proveedor" : "Guardar Proveedor"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
