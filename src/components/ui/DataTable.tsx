import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowUpDown, FileDown } from "lucide-react";
import * as XLSX from "xlsx";

export type Column<T> = {
  key: string;
  header: string;
  accessor?: (row: T) => any;
  sortable?: boolean;
  filterable?: boolean;
  render?: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  /**
   * Custom header renderer. When provided, it will be rendered instead of the plain header text.
   * Useful for header controls like a master checkbox.
   */
  headerRender?: (() => React.ReactNode) | React.ReactNode;
};

export type SortDirection = "asc" | "desc" | null;

type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  filename?: string;
  globalSearchPlaceholder?: string;
};

function toComparable(val: any) {
  if (val == null) return "";
  if (typeof val === "number") return val;
  if (typeof val === "string") return val.toLowerCase();
  if (val instanceof Date) return val.getTime();
  return String(val).toLowerCase();
}

export function DataTable<T extends Record<string, any>>({ columns, data, filename = "export.xlsx", globalSearchPlaceholder = "Buscar..." }: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [globalQuery, setGlobalQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const onHeaderClick = (col: Column<T>) => {
    if (!col.sortable) return;
    if (sortKey !== col.key) {
      setSortKey(col.key);
      setSortDir("asc");
    } else {
      setSortDir(sortDir === "asc" ? "desc" : sortDir === "desc" ? null : "asc");
      if (sortDir === null) setSortKey(null);
    }
  };

  const filtered = useMemo(() => {
    const byGlobal = (row: T) => {
      if (!globalQuery.trim()) return true;
      const q = globalQuery.toLowerCase();
      return columns.some((c) => {
        const v = c.accessor ? c.accessor(row) : row[c.key];
        return String(v ?? "").toLowerCase().includes(q);
      });
    };
    const byColumn = (row: T) => {
      return Object.entries(filters).every(([key, value]) => {
        if (!value) return true;
        const col = columns.find((c) => c.key === key);
        const v = col?.accessor ? col.accessor(row) : (row as any)[key];
        return String(v ?? "").toLowerCase().includes(value.toLowerCase());
      });
    };
    return data.filter((row) => byGlobal(row) && byColumn(row));
  }, [data, columns, globalQuery, filters]);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = toComparable(col.accessor ? col.accessor(a) : (a as any)[sortKey]);
      const vb = toComparable(col.accessor ? col.accessor(b) : (b as any)[sortKey]);
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, columns, sortKey, sortDir]);

  // Evita inyección de fórmulas en Excel/CSV según OWASP
  const sanitizeForExcel = (val: any) => {
    if (val == null) return "";
    const s = String(val);
    // Si comienza con caracteres de fórmula, prefija con comilla simple
    return /^[=\-\+@]/.test(s) ? `'${s}` : s;
  };

  const exportXLSX = () => {
    const rows = sorted.map((row) => {
      const r: Record<string, any> = {};
      columns.forEach((c) => {
        const val = c.accessor ? c.accessor(row) : (row as any)[c.key];
        // Normaliza a texto plano y sanitiza fórmulas
        const plain = typeof val === "string" || typeof val === "number" ? val : String(val ?? "");
        r[c.header] = sanitizeForExcel(plain);
      });
      return r;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={globalSearchPlaceholder}
            className="pl-10"
            value={globalQuery}
            onChange={(e) => setGlobalQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={exportXLSX} className="gap-2 w-full sm:w-auto">
          <FileDown className="h-4 w-4" />
          Exportar XLSX
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead
                key={c.key}
                onClick={() => onHeaderClick(c)}
                className={`${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"} ${c.sortable ? "cursor-pointer select-none" : ""}`}
              >
                <span className="inline-flex items-center gap-1">
                  {c.headerRender ? (typeof c.headerRender === "function" ? (c.headerRender as () => React.ReactNode)() : c.headerRender) : c.header}
                  {c.sortable && <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                </span>
              </TableHead>
            ))}
          </TableRow>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={`${c.key}-filter`}>
                {c.filterable ? (
                  <Input
                    placeholder="Filtrar..."
                    value={filters[c.key] ?? ""}
                    onChange={(e) => setFilters((f) => ({ ...f, [c.key]: e.target.value }))}
                    className="h-8"
                  />
                ) : null}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                No hay datos
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((row, idx) => (
              <TableRow key={idx} className="hover:bg-muted/50">
                {columns.map((c) => {
                  const val = c.accessor ? c.accessor(row) : (row as any)[c.key];
                  return (
                    <TableCell key={`${c.key}-${idx}`} className={c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}>
                      {c.render ? c.render(row) : typeof val === "string" || typeof val === "number" ? val : String(val ?? "")}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}