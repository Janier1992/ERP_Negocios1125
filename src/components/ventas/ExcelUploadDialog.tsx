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
  const { uploadVentas, loading } = useExcelUpload();

  const downloadTemplate = () => {
    const template = [
      {
        fecha: "2024-01-15",
        cliente: "Cliente Ejemplo",
        producto_codigo: "PROD001",
        cantidad: 5,
        precio_unitario: 100.00,
        metodo_pago: "Efectivo",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas");
    XLSX.writeFile(wb, "plantilla_ventas.xlsx");
    toast.success("Plantilla descargada");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await uploadVentas(file);
      toast.success(`${result.inserted} ventas agregadas`);
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
          <DialogTitle>Carga Masiva de Ventas</DialogTitle>
          <DialogDescription>
            Descarga la plantilla, complétala y súbela para agregar múltiples ventas
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
                id="file-upload-ventas"
              />
              <label htmlFor="file-upload-ventas">
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
              <li>fecha (formato: YYYY-MM-DD)</li>
              <li>cliente (opcional)</li>
              <li>producto_codigo (código del producto)</li>
              <li>cantidad (número entero)</li>
              <li>precio_unitario (número)</li>
              <li>metodo_pago (Efectivo, Tarjeta, Transferencia)</li>
            </ul>
            <p className="text-warning font-medium mt-2">⚠️ Las ventas múltiples del mismo día y cliente se agruparán automáticamente</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
