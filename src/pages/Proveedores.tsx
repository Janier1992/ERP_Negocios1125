import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/newClient";
import { useUserProfile } from "@/hooks/useUserProfile";
import { ProveedorDialog } from "@/components/proveedores/ProveedorDialog";
import { ExcelUploadDialog } from "@/components/proveedores/ExcelUploadDialog";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
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

const Proveedores = () => {
  const { empresaId, loading: profileLoading } = useUserProfile();
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingProveedor, setEditingProveedor] = useState<any>(null);
  const [deletingProveedor, setDeletingProveedor] = useState<any>(null);

  useEffect(() => {
    if (empresaId) {
      fetchProveedores();
    }
  }, [empresaId]);

  const fetchProveedores = async () => {
    if (!empresaId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("proveedores")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProveedores(data || []);
    } catch (error: any) {
      toast.error("Error al cargar proveedores");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingProveedor) return;

    try {
      const { error } = await supabase
        .from("proveedores")
        .delete()
        .eq("id", deletingProveedor.id);

      if (error) throw error;

      toast.success("Proveedor eliminado correctamente");
      fetchProveedores();
    } catch (error: any) {
      toast.error("Error al eliminar proveedor");
      console.error(error);
    } finally {
      setDeletingProveedor(null);
    }
  };

  const filteredProveedores = proveedores.filter(
    (p) =>
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (profileLoading || loading) {
    return <div className="flex items-center justify-center h-96">Cargando...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Proveedores</h2>
          <p className="text-muted-foreground mt-1">
            Gestión de proveedores y contactos
          </p>
        </div>
        <div className="flex gap-2">
          <ExcelUploadDialog onUploadComplete={fetchProveedores} />
          <ProveedorDialog 
            onProveedorAdded={fetchProveedores}
            editingProveedor={editingProveedor}
            onClose={() => setEditingProveedor(null)}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Proveedores</CardTitle>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar proveedores por nombre o email..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProveedores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No se encontraron proveedores
                  </TableCell>
                </TableRow>
              ) : (
                filteredProveedores.map((proveedor) => (
                  <TableRow key={proveedor.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{proveedor.nombre}</TableCell>
                    <TableCell className="text-muted-foreground">{proveedor.contacto || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{proveedor.email || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{proveedor.telefono || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{proveedor.direccion || "-"}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-2 hover:bg-muted rounded-md transition-colors">
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setEditingProveedor(proveedor)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeletingProveedor(proveedor)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingProveedor} onOpenChange={() => setDeletingProveedor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente el proveedor "{deletingProveedor?.nombre}". 
              Esta acción no se puede deshacer.
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

export default Proveedores;
