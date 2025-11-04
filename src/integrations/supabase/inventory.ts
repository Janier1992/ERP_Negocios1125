import { supabase } from "./newClient";

export interface AddProductoInput {
  empresaId: string;
  codigo: string;
  nombre: string;
  cantidad: number; // stock inicial
  precio: number;
  descripcion?: string;
  categoria_id?: string | null;
  proveedor_id?: string | null;
  stock_minimo?: number; // default 0
}

export interface AddProductoResult {
  id: string;
  codigo: string;
  nombre: string;
}

/**
 * Agrega un producto manualmente con validaciones básicas.
 * - Verifica empresaId, código y nombre obligatorios
 * - Valida cantidad (>= 0) y precio (> 0)
 * - Previene duplicados por código
 */
export async function addProductoManual(input: AddProductoInput): Promise<AddProductoResult> {
  const errors: Record<string, string> = {};

  if (!input.empresaId) errors.empresaId = "empresaId requerido";
  if (!input.codigo?.trim()) errors.codigo = "Código requerido";
  if (!input.nombre?.trim()) errors.nombre = "Nombre requerido";

  if (!Number.isFinite(input.precio) || input.precio <= 0) errors.precio = "Precio inválido";
  if (!Number.isInteger(input.cantidad) || input.cantidad < 0) errors.cantidad = "Cantidad inválida";

  const stockMin = input.stock_minimo ?? 0;
  if (!Number.isInteger(stockMin) || stockMin < 0) errors.stock_minimo = "Stock mínimo inválido";

  if (Object.keys(errors).length) {
    throw new Error(Object.values(errors)[0]);
  }

  // Verificar duplicado de código (único a nivel tabla)
  const { data: existing, error: dupError } = await supabase
    .from("productos")
    .select("id, codigo")
    .eq("codigo", input.codigo)
    .limit(1);

  if (dupError) throw dupError;
  if (existing && existing.length > 0) {
    throw new Error("El código de producto ya existe");
  }

  const insertPayload = {
    empresa_id: input.empresaId,
    codigo: input.codigo.trim(),
    nombre: input.nombre.trim(),
    descripcion: input.descripcion || null,
    categoria_id: input.categoria_id || null,
    proveedor_id: input.proveedor_id || null,
    precio: input.precio,
    stock: input.cantidad,
    stock_minimo: stockMin,
  };

  const { data, error } = await supabase
    .from("productos")
    .insert(insertPayload)
    .select("id, codigo, nombre")
    .single();

  if (error) throw error;

  return data as AddProductoResult;
}