import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, Download, FileSpreadsheet } from "lucide-react";
import { useExcelUpload } from "@/hooks/useExcelUpload";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ExcelUploadDialogProps {
  onUploadComplete: () => void;
  categorias: any[];
  proveedores: any[];
}

export const ExcelUploadDialog = ({ onUploadComplete, categorias, proveedores }: ExcelUploadDialogProps) => {
  const [open, setOpen] = useState(false);
  const { uploadProductos, loading } = useExcelUpload();

  const downloadTemplate = () => {
    const template = [
      {
        codigo: "PROD001",
        nombre: "Producto Ejemplo",
        descripcion: "Descripción del producto",
        categoria: categorias[0]?.nombre || "Categoría",
        proveedor: proveedores[0]?.nombre || "Proveedor",
        precio: 100.00,
        stock: 50,
        stock_minimo: 10,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productos");
    XLSX.writeFile(wb, "plantilla_productos.xlsx");
    toast.success("Plantilla descargada");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await uploadProductos(file, categorias, proveedores);
      toast.success(`${result.inserted} productos agregados, ${result.duplicates} duplicados omitidos`);
      setOpen(false);
      onUploadComplete();
    } catch (error: any) {
      toast.error(error.message || "Error al procesar archivo");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Cargar Excel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Carga Masiva de Productos</DialogTitle>
          <DialogDescription>
            Descarga la plantilla, complétala y súbela para agregar múltiples productos
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center space-y-4">
            <div className="flex justify-center">
              <Upload className="h-12 w-12 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Selecciona un archivo Excel (.xlsx)
              </p>
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileUpload}
                disabled={loading}
                className="hidden"
                id="file-upload-productos"
              />
              <label htmlFor="file-upload-productos">
                <Button variant="secondary" disabled={loading} asChild>
                  <span>{loading ? "Procesando..." : "Seleccionar Archivo"}</span>
                </Button>
              </label>
            </div>
          </div>
          <Button variant="outline" onClick={downloadTemplate} className="w-full">
            <Download className="mr-2 h-4 w-4" />
            Descargar Plantilla
          </Button>
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">Columnas requeridas:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>codigo (obligatorio, único)</li>
              <li>nombre (obligatorio)</li>
              <li>descripcion (opcional)</li>
              <li>categoria (nombre de categoría existente)</li>
              <li>proveedor (nombre de proveedor existente)</li>
              <li>precio (número)</li>
              <li>stock (número entero)</li>
              <li>stock_minimo (número entero)</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
