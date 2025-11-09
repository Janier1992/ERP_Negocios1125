import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/newClient";
import { useUserProfile } from "@/hooks/useUserProfile";
import { ProductDialog } from "@/components/inventario/ProductDialog";
import { ExcelUploadDialog } from "@/components/inventario/ExcelUploadDialog";
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

const Inventario = () => {
  const { empresaId, loading: profileLoading, profile } = useUserProfile();
  const [productos, setProductos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
// Eliminado: searchTerm (DataTable gestiona la búsqueda global)
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [deletingProduct, setDeletingProduct] = useState<any>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const isAdmin = profile?.rol === "admin";

  useEffect(() => {
    if (empresaId) {
      fetchData();
    } else if (!profileLoading) {
      setLoading(false);
    }
  }, [empresaId, profileLoading]);

  const fetchData = async () => {
    if (!empresaId) return;
    
    setLoading(true);
    try {
      const [productosRes, categoriasRes, proveedoresRes] = await Promise.all([
        supabase
          .from("productos")
          .select("*, categorias(nombre), proveedores(nombre)")
          .eq("empresa_id", empresaId)
          .order("created_at", { ascending: false }),
        supabase
          .from("categorias")
          .select("id, nombre")
          .eq("empresa_id", empresaId),
        supabase
          .from("proveedores")
          .select("id, nombre")
          .eq("empresa_id", empresaId),
      ]);

      if (productosRes.error) throw productosRes.error;
      if (categoriasRes.error) throw categoriasRes.error;
      if (proveedoresRes.error) throw proveedoresRes.error;

      setProductos(productosRes.data || []);
      setCategorias(categoriasRes.data || []);
      setProveedores(proveedoresRes.data || []);
    } catch (error: any) {
      toast.error("Error al cargar datos");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    if (!isAdmin) return;
    if (checked) {
      const allIds = (productos || []).map((p: any) => String(p.id));
      setSelectedProductIds(allIds);
    } else {
      setSelectedProductIds([]);
    }
  };

  const toggleRowSelection = (id: string, checked: boolean) => {
    if (!isAdmin) return;
    setSelectedProductIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(id); else set.delete(id);
      return Array.from(set);
    });
  };

  const handleBulkDelete = async () => {
    if (!isAdmin) return;
    const ids = selectedProductIds;
    if (!ids.length) {
      setBulkDeleteOpen(false);
      return;
    }
    try {
      const uniqueIds = Array.from(new Set(ids));
      // Asegura que sólo eliminamos IDs actualmente presentes en la grilla
      const presentIds = uniqueIds.filter((id) => (productos || []).some((p) => String(p.id) === id));
      if (presentIds.length === 0) {
        setBulkDeleteOpen(false);
        setSelectedProductIds([]);
        return;
      }

      // Verificar si los productos están referenciados en ventas o compras
      const { data: ventasRef, error: ventasErr } = await supabase
        .from("ventas_detalle")
        .select("producto_id")
        .in("producto_id", presentIds);
      const { data: comprasRef, error: comprasErr } = await supabase
        .from("compras_detalle")
        .select("producto_id")
        .in("producto_id", presentIds);

      if (ventasErr || comprasErr) {
        console.warn("No se pudieron verificar referencias antes del borrado", ventasErr || comprasErr);
      }

      const referencedSet = new Set<string>([
        ...((ventasRef || []).map((r: any) => String(r.producto_id))),
        ...((comprasRef || []).map((r: any) => String(r.producto_id))),
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
          .from("productos")
          .delete()
          .in("id", chunk)
          .eq("empresa_id", empresaId)
          .select("id");

        if (res.error) {
          // Fallback por ID para sortear posibles políticas o errores de operador
          for (const id of chunk) {
            const { error: e2 } = await supabase
              .from("productos")
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
          // Si algunas IDs no fueron borradas por políticas, intentar borrarlas individualmente
          const missing = chunk.filter((id) => !returnedIds.includes(String(id)));
          for (const id of missing) {
            const { error: e3 } = await supabase
              .from("productos")
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

      // Intentar eliminación en cascada vía RPC para los bloqueados por referencias
      for (const id of blockedIds) {
        const { data: rpcData, error: rpcErr } = await supabase.rpc("delete_product_cascade", {
          _producto_id: id,
          _empresa_id: empresaId,
        });
        if (rpcErr) {
          failedCount += 1;
        } else {
          deletedCount += 1;
        }
      }

      if (deletedCount > 0) toast.success(`Eliminados ${deletedCount} productos`);
      // Si quedaron bloqueados aún por error, informar con nombres
      const stillBlocked = blockedIds.slice(0, Math.max(0, blockedIds.length - deletedCount));
      if (stillBlocked.length > 0) {
        const nombresBloqueados = (productos || [])
          .filter((p) => stillBlocked.includes(String(p.id)))
          .map((p) => String(p.nombre));
        const muestra = nombresBloqueados.slice(0, 4).join(", ");
        const sufijo = nombresBloqueados.length > 4 ? "…" : "";
        toast.info(`No se pudieron eliminar ${stillBlocked.length} productos: ${muestra}${sufijo}`);
      }
      if (failedCount > 0) toast.info(`No se pudieron eliminar ${failedCount} productos por error`);

      setBulkDeleteOpen(false);
      setSelectedProductIds([]);
      // Actualizar la UI de forma optimista removiendo eliminados
      if (deletedCount > 0) {
        const deletedIdsSet = new Set([...deletableIds, ...blockedIds]);
        setProductos((prev) => prev.filter((p) => !deletedIdsSet.has(String(p.id))));
      }
      // Sincronizar con el servidor
      fetchData();
    } catch (error: any) {
      const msg = String(error?.message || "");
      const friendly = /Failed to fetch/i.test(msg)
        ? "Sin conexión con el servidor. Intenta nuevamente."
        : /policy|rls|permission/i.test(msg)
        ? "No tienes permisos para eliminar productos."
        : "Error al eliminar productos";
      toast.error(friendly);
    }
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;

    try {
      // Intentar eliminación en cascada vía RPC primero
      const { data: rpcData, error: rpcError } = await supabase.rpc("delete_product_cascade", {
        _producto_id: deletingProduct.id,
        _empresa_id: empresaId,
      });

      if (rpcError) {
        // Fallback manual: borrar detalles y recalcular totales, luego borrar producto
        // Ventas
        const { data: vdRows, error: vdErr } = await supabase
          .from("ventas_detalle")
          .select("venta_id")
          .eq("producto_id", deletingProduct.id);
        if (vdErr) throw vdErr;
        const ventaIds = Array.from(new Set((vdRows || []).map((r: any) => String(r.venta_id))));
        if (ventaIds.length > 0) {
          const { error: vdDelErr } = await supabase
            .from("ventas_detalle")
            .delete()
            .eq("producto_id", deletingProduct.id);
          if (vdDelErr) throw vdDelErr;

          for (const vid of ventaIds) {
            const { data: sumRows, error: sumErr } = await supabase
              .from("ventas_detalle")
              .select("subtotal")
              .eq("venta_id", vid);
            if (sumErr) throw sumErr;
            const total = (sumRows || []).reduce((acc: number, r: any) => acc + Number(r.subtotal || 0), 0);
            const { error: vUpdErr } = await supabase
              .from("ventas")
              .update({ total })
              .eq("id", vid);
            if (vUpdErr) throw vUpdErr;
          }
        }

        // Compras
        const { data: cdRows, error: cdErr } = await supabase
          .from("compras_detalle")
          .select("compra_id")
          .eq("producto_id", deletingProduct.id);
        if (cdErr) throw cdErr;
        const compraIds = Array.from(new Set((cdRows || []).map((r: any) => String(r.compra_id))));
        if (compraIds.length > 0) {
          const { error: cdDelErr } = await supabase
            .from("compras_detalle")
            .delete()
            .eq("producto_id", deletingProduct.id);
          if (cdDelErr) throw cdDelErr;

          for (const cid of compraIds) {
            const { data: sumRows2, error: sumErr2 } = await supabase
              .from("compras_detalle")
              .select("subtotal")
              .eq("compra_id", cid);
            if (sumErr2) throw sumErr2;
            const totalCompra = (sumRows2 || []).reduce((acc: number, r: any) => acc + Number(r.subtotal || 0), 0);
            const { error: cUpdErr } = await supabase
              .from("compras")
              .update({ total: totalCompra })
              .eq("id", cid);
            if (cUpdErr) throw cUpdErr;
            const { error: cxpUpdErr } = await supabase
              .from("cuentas_por_pagar")
              .update({ monto: totalCompra })
              .eq("compra_id", cid);
            if (cxpUpdErr) throw cxpUpdErr;
          }
        }

        // Finalmente, borrar el producto
        const { error: prodErr } = await supabase
          .from("productos")
          .delete()
          .eq("id", deletingProduct.id)
          .eq("empresa_id", empresaId);
        if (prodErr) throw prodErr;
      }

      toast.success("Producto eliminado correctamente");
      fetchData();
    } catch (error: any) {
      const msg = String(error?.message || "");
      const friendly = /Failed to fetch/i.test(msg)
        ? "Sin conexión con el servidor. Intenta nuevamente."
        : /policy|rls|permission|referenced/i.test(msg) || String(error?.code) === '23503'
        ? "El producto está referenciado en ventas/compras. Se intentó cascada pero ocurrió un error."
        : "Error al eliminar producto";
      toast.error(friendly);
      console.error(error);
    } finally {
      setDeletingProduct(null);
    }
  };

  const getEstado = (stock: number, minimo: number) => {
    if (stock <= minimo * 0.5) return "critico";
    if (stock <= minimo) return "bajo";
    return "normal";
  };

// Configuración de columnas tipo Excel
const columns: Column<any>[] = [
  {
    key: "select",
    header: "",
    sortable: false,
    filterable: false,
    align: "center",
    headerRender: () => (
      <input
        type="checkbox"
        aria-label="Seleccionar todos"
        checked={selectedProductIds.length > 0 && selectedProductIds.length === (productos?.length || 0)}
        onChange={(e) => toggleSelectAll(e.target.checked)}
        onClick={(e) => e.stopPropagation()}
        disabled={!isAdmin || (productos?.length || 0) === 0}
      />
    ),
    render: (p) => (
      <input
        type="checkbox"
        aria-label={`Seleccionar ${p.nombre}`}
        checked={selectedProductIds.includes(String(p.id))}
        onChange={(e) => toggleRowSelection(String(p.id), e.target.checked)}
        onClick={(e) => e.stopPropagation()}
        disabled={!isAdmin}
      />
    ),
  },
  { key: "codigo", header: "Código", sortable: true, filterable: true },
  { key: "nombre", header: "Producto", sortable: true, filterable: true },
  { key: "categoria", header: "Categoría", sortable: true, filterable: true, accessor: (p) => p.categorias?.nombre ?? "Sin categoría" },
  { key: "stock", header: "Stock", sortable: true, filterable: true, align: "right" },
  { key: "stock_minimo", header: "Mínimo", sortable: true, filterable: true, align: "right" },
  { key: "precio", header: "Precio", sortable: true, filterable: true, align: "right", render: (p) => `$${Number(p.precio).toFixed(2)}` },
  { 
    key: "estado", 
    header: "Estado", 
    sortable: false, 
    filterable: true,
    accessor: (p) => {
      const e = getEstado(p.stock, p.stock_minimo);
      return e === "critico" ? "Crítico" : e === "bajo" ? "Stock Bajo" : "Normal";
    },
    render: (p) => {
      const e = getEstado(p.stock, p.stock_minimo);
      switch (e) {
        case "critico":
          return <Badge variant="destructive">Crítico</Badge>;
        case "bajo":
          return <Badge className="bg-warning text-warning-foreground">Stock Bajo</Badge>;
        default:
          return <Badge className="bg-success text-success-foreground">Normal</Badge>;
      }
    }
  },
  {
    key: "acciones",
    header: "Acciones",
    align: "right",
    render: (producto) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="p-2 hover:bg-muted rounded-md transition-colors">
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setEditingProduct(producto)} disabled={!isAdmin}>
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setDeletingProduct(producto)}
            disabled={!isAdmin}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
];

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "critico":
        return <Badge variant="destructive">Crítico</Badge>;
      case "bajo":
        return <Badge className="bg-warning text-warning-foreground">Stock Bajo</Badge>;
      default:
        return <Badge className="bg-success text-success-foreground">Normal</Badge>;
    }
  };

  if (profileLoading || loading) {
    return <div className="flex items-center justify-center h-96">Cargando...</div>;
  }

  if (!empresaId) {
    return <div className="flex items-center justify-center h-96 text-muted-foreground">No hay empresa asociada a tu usuario. Completa el registro y vuelve a intentar.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-3xl font-bold text-foreground">Inventario</h2>
          <p className="text-muted-foreground mt-1">
            Gestión completa de productos y stock
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExcelUploadDialog
            onUploadComplete={fetchData}
            categorias={categorias}
            proveedores={proveedores}
          />
          <ProductDialog
            onProductAdded={fetchData}
            categorias={categorias}
            proveedores={proveedores}
            editingProduct={editingProduct}
            onClose={() => setEditingProduct(null)}
          />
          <button
            className="px-3 py-2 rounded-md bg-destructive text-destructive-foreground disabled:opacity-50 w-full sm:w-auto"
            disabled={!isAdmin || selectedProductIds.length === 0}
            onClick={() => setBulkDeleteOpen(true)}
            title={isAdmin ? (selectedProductIds.length ? `Eliminar ${selectedProductIds.length} seleccionados` : "Selecciona registros para eliminar") : "Permisos requeridos"}
          >
            Eliminar seleccionados ({selectedProductIds.length})
          </button>
        </div>
      </div>

      <Card>
        <CardHeader>
  <CardTitle>Productos</CardTitle>
</CardHeader>
        <CardContent>
          <DataTable columns={columns} data={productos} filename="productos.xlsx" globalSearchPlaceholder="Buscar productos por nombre o código..." />
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingProduct} onOpenChange={() => setDeletingProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente el producto "{deletingProduct?.nombre}". 
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
            <AlertDialogTitle>¿Eliminar productos seleccionados?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán {selectedProductIds.length} productos seleccionados. Esta acción no se puede deshacer.
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

export default Inventario;
