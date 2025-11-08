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
  const { empresaId, loading: profileLoading, profile } = useUserProfile();
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingProveedor, setEditingProveedor] = useState<any>(null);
  const [deletingProveedor, setDeletingProveedor] = useState<any>(null);
  const [selectedProveedorIds, setSelectedProveedorIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const isAdmin = profile?.rol === "admin";

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

  const toggleSelectAll = (checked: boolean) => {
    if (!isAdmin) return;
    if (checked) {
      const allIds = (filteredProveedores || []).map((p: any) => String(p.id));
      setSelectedProveedorIds(allIds);
    } else {
      setSelectedProveedorIds([]);
    }
  };

  const toggleRowSelection = (id: string, checked: boolean) => {
    if (!isAdmin) return;
    setSelectedProveedorIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(id); else set.delete(id);
      return Array.from(set);
    });
  };

  const handleBulkDelete = async () => {
    if (!isAdmin) return;
    const ids = selectedProveedorIds;
    if (!ids.length) {
      setBulkDeleteOpen(false);
      return;
    }
    try {
      const uniqueIds = Array.from(new Set(ids));
      // Asegura sólo IDs presentes en la grilla filtrada
      const presentIds = uniqueIds.filter((id) => (filteredProveedores || []).some((p) => String(p.id) === id));
      if (presentIds.length === 0) {
        setBulkDeleteOpen(false);
        setSelectedProveedorIds([]);
        return;
      }

      // Verificar referencias en compras y cuentas por pagar
      const { data: comprasRef, error: comprasErr } = await supabase
        .from("compras")
        .select("proveedor_id")
        .in("proveedor_id", presentIds);
      const { data: cxpRef, error: cxpErr } = await supabase
        .from("cuentas_por_pagar")
        .select("proveedor_id")
        .in("proveedor_id", presentIds);

      if (comprasErr || cxpErr) {
        console.warn("No se pudieron verificar referencias antes del borrado", comprasErr || cxpErr);
      }

      const referencedSet = new Set<string>([
        ...((comprasRef || []).map((r: any) => String(r.proveedor_id))),
        ...((cxpRef || []).map((r: any) => String(r.proveedor_id))),
      ]);
      const deletableIds = presentIds.filter((id) => !referencedSet.has(String(id)));
      const blockedIds = presentIds.filter((id) => referencedSet.has(String(id)));

      const chunkSize = 50;
      const chunks: string[][] = [];
      for (let i = 0; i < deletableIds.length; i += chunkSize) {
        chunks.push(deletableIds.slice(i, i + chunkSize));
      }

      let deletedCount = 0;
      let failedCount = 0;

      for (const chunk of chunks) {
        const res = await supabase
          .from("proveedores")
          .delete()
          .in("id", chunk)
          .eq("empresa_id", empresaId)
          .select("id");

        if (res.error) {
          for (const id of chunk) {
            const { error: e2 } = await supabase
              .from("proveedores")
              .delete()
              .eq("id", id)
              .eq("empresa_id", empresaId);
            if (e2) {
              failedCount += 1;
            } else {
              deletedCount += 1;
            }
          }
        } else {
          const returnedIds = (res.data || []).map((r: any) => String(r.id));
          deletedCount += returnedIds.length;
          const missing = chunk.filter((id) => !returnedIds.includes(String(id)));
          for (const id of missing) {
            const { error: e3 } = await supabase
              .from("proveedores")
              .delete()
              .eq("id", id)
              .eq("empresa_id", empresaId);
            if (e3) {
              failedCount += 1;
            } else {
              deletedCount += 1;
            }
          }
        }
      }

      if (deletedCount > 0) toast.success(`Eliminados ${deletedCount} proveedores`);
      if (blockedIds.length > 0) {
        const nombresBloqueados = (proveedores || [])
          .filter((p) => blockedIds.includes(String(p.id)))
          .map((p) => String(p.nombre));
        const muestra = nombresBloqueados.slice(0, 4).join(", ");
        const sufijo = nombresBloqueados.length > 4 ? "…" : "";
        toast.info(`No se pudieron eliminar ${blockedIds.length} por tener compras o cuentas por pagar: ${muestra}${sufijo}`);
      }
      if (failedCount > 0) toast.info(`No se pudieron eliminar ${failedCount} proveedores por error`);

      setBulkDeleteOpen(false);
      setSelectedProveedorIds([]);
      if (deletedCount > 0) {
        const deletedIdsSet = new Set(deletableIds);
        setProveedores((prev) => prev.filter((p) => !deletedIdsSet.has(String(p.id))));
      }
      fetchProveedores();
    } catch (error: any) {
      const msg = String(error?.message || "");
      const friendly = /Failed to fetch/i.test(msg)
        ? "Sin conexión con el servidor. Intenta nuevamente."
        : /policy|rls|permission/i.test(msg)
        ? "No tienes permisos para eliminar proveedores."
        : "Error al eliminar proveedores";
      toast.error(friendly);
      console.error(error);
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
          <button
            className="px-3 py-2 rounded-md bg-destructive text-destructive-foreground disabled:opacity-50"
            disabled={!isAdmin || selectedProveedorIds.length === 0}
            onClick={() => setBulkDeleteOpen(true)}
            title={isAdmin ? (selectedProveedorIds.length ? `Eliminar ${selectedProveedorIds.length} seleccionados` : "Selecciona registros para eliminar") : "Permisos requeridos"}
          >
            Eliminar seleccionados ({selectedProveedorIds.length})
          </button>
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
                <TableHead className="text-center">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todos"
                    checked={selectedProveedorIds.length > 0 && selectedProveedorIds.length === (filteredProveedores?.length || 0)}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    disabled={!isAdmin || (filteredProveedores?.length || 0) === 0}
                  />
                </TableHead>
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
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No se encontraron proveedores
                  </TableCell>
                </TableRow>
              ) : (
                filteredProveedores.map((proveedor) => (
                  <TableRow key={proveedor.id} className="hover:bg-muted/50">
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar ${proveedor.nombre}`}
                        checked={selectedProveedorIds.includes(String(proveedor.id))}
                        onChange={(e) => toggleRowSelection(String(proveedor.id), e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={!isAdmin}
                      />
                    </TableCell>
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
                          <DropdownMenuItem onClick={() => setEditingProveedor(proveedor)} disabled={!isAdmin}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeletingProveedor(proveedor)}
                            disabled={!isAdmin}
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

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proveedores seleccionados?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán {selectedProveedorIds.length} proveedores seleccionados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Proveedores;
