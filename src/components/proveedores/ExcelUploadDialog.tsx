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
}

export const ExcelUploadDialog = ({ onUploadComplete }: ExcelUploadDialogProps) => {
  const [open, setOpen] = useState(false);
  const { uploadProveedores, loading } = useExcelUpload();

  const downloadTemplate = () => {
    const template = [
      {
        nombre: "Proveedor Ejemplo",
        contacto: "Juan Pérez",
        email: "contacto@proveedor.com",
        telefono: "+1234567890",
        direccion: "Calle Principal 123",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Proveedores");
    XLSX.writeFile(wb, "plantilla_proveedores.xlsx");
    toast.success("Plantilla descargada");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE_MB = 5;
    const allowedTypes = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
    const isXlsx = file.name.toLowerCase().endsWith(".xlsx");
    if (!allowedTypes.includes(file.type) && !isXlsx) {
      toast.error("Tipo de archivo no permitido. Usa .xlsx");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Archivo demasiado grande (> ${MAX_SIZE_MB}MB)`);
      return;
    }

    try {
      const result = await uploadProveedores(file);
      toast.success(`${result.inserted} proveedores agregados, ${result.duplicates} duplicados omitidos`);
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
          <DialogTitle>Carga Masiva de Proveedores</DialogTitle>
          <DialogDescription>
            Descarga la plantilla, complétala y súbela para agregar múltiples proveedores
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
                id="file-upload"
              />
              <label htmlFor="file-upload">
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
              <li>nombre (obligatorio)</li>
              <li>contacto (opcional)</li>
              <li>email (opcional)</li>
              <li>telefono (opcional)</li>
              <li>direccion (opcional)</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
