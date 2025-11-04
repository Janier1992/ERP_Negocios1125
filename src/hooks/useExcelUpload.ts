import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/newClient";
import { useUserProfile } from "./useUserProfile";

export const useExcelUpload = () => {
  const [loading, setLoading] = useState(false);
  const { empresaId } = useUserProfile();

  const uploadProveedores = async (file: File) => {
    if (!empresaId) throw new Error("No se encontró empresa asociada");
    
    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) throw new Error("El archivo está vacío");

      // Validar columnas requeridas
      const firstRow: any = jsonData[0];
      if (!firstRow.nombre) {
        throw new Error("La columna 'nombre' es obligatoria");
      }

      // Obtener proveedores existentes para evitar duplicados
      const { data: existingProveedores } = await supabase
        .from("proveedores")
        .select("nombre")
        .eq("empresa_id", empresaId);

      const existingNames = new Set(existingProveedores?.map(p => p.nombre.toLowerCase()) || []);

      const newProveedores = jsonData
        .map((row: any) => ({
          nombre: String(row.nombre || "").trim(),
          contacto: row.contacto ? String(row.contacto).trim() : null,
          email: row.email ? String(row.email).trim() : null,
          telefono: row.telefono ? String(row.telefono).trim() : null,
          direccion: row.direccion ? String(row.direccion).trim() : null,
          empresa_id: empresaId,
        }))
        .filter(p => p.nombre && !existingNames.has(p.nombre.toLowerCase()));

      if (newProveedores.length === 0) {
        throw new Error("Todos los proveedores ya existen");
      }

      const { error } = await supabase.from("proveedores").insert(newProveedores);
      if (error) throw error;

      return {
        inserted: newProveedores.length,
        duplicates: jsonData.length - newProveedores.length,
      };
    } finally {
      setLoading(false);
    }
  };

  const uploadProductos = async (file: File, categorias: any[], proveedores: any[]) => {
    if (!empresaId) throw new Error("No se encontró empresa asociada");
    
    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) throw new Error("El archivo está vacío");

      // Validar columnas requeridas
      const firstRow: any = jsonData[0];
      if (!firstRow.codigo || !firstRow.nombre) {
        throw new Error("Las columnas 'codigo' y 'nombre' son obligatorias");
      }

      // Obtener productos existentes
      const { data: existingProductos } = await supabase
        .from("productos")
        .select("codigo")
        .eq("empresa_id", empresaId);

      const existingCodes = new Set(existingProductos?.map(p => p.codigo.toLowerCase()) || []);

      // Detectar categorías y proveedores faltantes y crearlos antes de insertar productos
      const normalize = (v: any) => String(v || "").trim().toLowerCase();
      const existingCategoriaMap = new Map<string, string>(categorias.map((c: any) => [normalize(c.nombre), c.id]));
      const existingProveedorMap = new Map<string, string>(proveedores.map((p: any) => [normalize(p.nombre), p.id]));

      const excelCategorias = Array.from(new Set((jsonData as any[])
        .map(r => normalize((r as any).categoria))
        .filter(n => !!n)));
      const excelProveedores = Array.from(new Set((jsonData as any[])
        .map(r => normalize((r as any).proveedor))
        .filter(n => !!n)));

      const missingCats = excelCategorias.filter(n => !existingCategoriaMap.has(n));
      const missingProvs = excelProveedores.filter(n => !existingProveedorMap.has(n));

      if (missingCats.length > 0) {
        const toInsert = missingCats.map(nombre => ({ nombre, empresa_id: empresaId }));
        // Insert y recuperar ids; si hay conflicto por unicidad, reconsultar
        const { data: insertedCats, error: insCatErr } = await supabase
          .from("categorias")
          .insert(toInsert)
          .select("id, nombre");
        if (insCatErr) {
          // Posibles conflictos por duplicado: reconsultar y continuar
          const { data: refreshed } = await supabase
            .from("categorias")
            .select("id, nombre")
            .eq("empresa_id", empresaId);
          for (const c of (refreshed || [])) existingCategoriaMap.set(normalize(c.nombre), c.id);
        } else {
          for (const c of (insertedCats || [])) existingCategoriaMap.set(normalize(c.nombre), c.id);
        }
      }

      if (missingProvs.length > 0) {
        const toInsert = missingProvs.map(nombre => ({ nombre, empresa_id: empresaId }));
        const { data: insertedProvs, error: insProvErr } = await supabase
          .from("proveedores")
          .insert(toInsert)
          .select("id, nombre");
        if (insProvErr) {
          const { data: refreshed } = await supabase
            .from("proveedores")
            .select("id, nombre")
            .eq("empresa_id", empresaId);
          for (const p of (refreshed || [])) existingProveedorMap.set(normalize(p.nombre), p.id);
        } else {
          for (const p of (insertedProvs || [])) existingProveedorMap.set(normalize(p.nombre), p.id);
        }
      }

      // Mapas finales con todo incluido
      const categoriaMap = existingCategoriaMap;
      const proveedorMap = existingProveedorMap;

      const newProductos = jsonData
        .map((row: any) => {
          const codigo = String(row.codigo || "").trim();
          if (!codigo || existingCodes.has(codigo.toLowerCase())) return null;

          return {
            codigo,
            nombre: String(row.nombre || "").trim(),
            descripcion: row.descripcion ? String(row.descripcion).trim() : null,
            categoria_id: row.categoria ? categoriaMap.get(normalize(row.categoria)) || null : null,
            proveedor_id: row.proveedor ? proveedorMap.get(normalize(row.proveedor)) || null : null,
            precio: Number(row.precio) || 0,
            stock: parseInt(String(row.stock || 0)),
            stock_minimo: parseInt(String(row.stock_minimo || 0)),
            empresa_id: empresaId,
          };
        })
        .filter(p => p !== null);

      if (newProductos.length === 0) {
        throw new Error("Todos los productos ya existen o tienen códigos inválidos");
      }

      const { error } = await supabase.from("productos").insert(newProductos);
      if (error) throw error;

      return {
        inserted: newProductos.length,
        duplicates: jsonData.length - newProductos.length,
      };
    } finally {
      setLoading(false);
    }
  };

  const uploadVentas = async (file: File) => {
    if (!empresaId) throw new Error("No se encontró empresa asociada");
    
    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) throw new Error("El archivo está vacío");

      // Validar columnas
      const firstRow: any = jsonData[0];
      if (!firstRow.producto_codigo || !firstRow.cantidad || !firstRow.precio_unitario || !firstRow.metodo_pago) {
        throw new Error("Faltan columnas obligatorias");
      }

      // Obtener productos
      const { data: productos } = await supabase
        .from("productos")
        .select("id, codigo, stock")
        .eq("empresa_id", empresaId);

      const productoMap = new Map(productos?.map(p => [p.codigo.toLowerCase(), p]) || []);

      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      // Agrupar ventas por fecha y cliente
      const ventasAgrupadas = new Map<string, any[]>();
      
      for (const row of jsonData) {
        const rowData = row as any;
        const codigo = String(rowData.producto_codigo).trim().toLowerCase();
        const producto = productoMap.get(codigo);
        
        if (!producto) {
          console.warn(`Producto ${rowData.producto_codigo} no encontrado, omitiendo`);
          continue;
        }

        const cantidad = parseInt(String(rowData.cantidad));
        if (cantidad > producto.stock) {
          throw new Error(`Stock insuficiente para ${rowData.producto_codigo}. Disponible: ${producto.stock}`);
        }

        const key = `${rowData.fecha || new Date().toISOString().split('T')[0]}_${rowData.cliente || 'General'}`;
        if (!ventasAgrupadas.has(key)) {
          ventasAgrupadas.set(key, []);
        }

        ventasAgrupadas.get(key)!.push({
          producto_id: producto.id,
          cantidad,
          precio_unitario: Number(rowData.precio_unitario),
          subtotal: cantidad * Number(rowData.precio_unitario),
          fecha: rowData.fecha,
          cliente: rowData.cliente,
          metodo_pago: rowData.metodo_pago,
        });
      }

      let totalVentasInsertadas = 0;

      // Insertar ventas agrupadas
      for (const [key, items] of ventasAgrupadas) {
        const total = items.reduce((sum, item) => sum + item.subtotal, 0);
        
        // Insertar venta
        const { data: venta, error: ventaError } = await supabase
          .from("ventas")
          .insert({
            cliente: items[0].cliente || null,
            metodo_pago: items[0].metodo_pago,
            total,
            empresa_id: empresaId,
            user_id: user.id,
            created_at: items[0].fecha ? new Date(items[0].fecha).toISOString() : undefined,
          })
          .select()
          .single();

        if (ventaError) throw ventaError;

        // Insertar detalles
        const detalles = items.map(item => ({
          venta_id: venta.id,
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          subtotal: item.subtotal,
        }));

        const { error: detalleError } = await supabase
          .from("ventas_detalle")
          .insert(detalles);

        if (detalleError) throw detalleError;

        // Actualizar stock
        for (const item of items) {
          const producto = productoMap.get(
            productos?.find(p => p.id === item.producto_id)?.codigo.toLowerCase() || ""
          );
          if (producto) {
            await supabase
              .from("productos")
              .update({ stock: producto.stock - item.cantidad })
              .eq("id", item.producto_id);
          }
        }

        // Upsert automático del cliente en módulo Clientes
        try {
          const nombreCliente = String(items[0].cliente || "").trim();
          if (nombreCliente) {
            const nowIso = venta.created_at ? new Date(venta.created_at).toISOString() : (items[0].fecha ? new Date(items[0].fecha).toISOString() : new Date().toISOString());
            const { data: existing } = await supabase
              .from("clientes")
              .select("id, total_comprado, compras_count, fecha_primera_compra")
              .eq("empresa_id", empresaId)
              .eq("nombre", nombreCliente)
              .maybeSingle();

            if (!existing) {
              await supabase
                .from("clientes")
                .insert({
                  empresa_id: empresaId,
                  nombre: nombreCliente,
                  fecha_primera_compra: nowIso,
                  fecha_ultima_compra: nowIso,
                  total_comprado: Number(total || 0),
                  compras_count: 1,
                });
            } else {
              await supabase
                .from("clientes")
                .update({
                  fecha_ultima_compra: nowIso,
                  total_comprado: Number(existing.total_comprado || 0) + Number(total || 0),
                  compras_count: Number(existing.compras_count || 0) + 1,
                })
                .eq("id", existing.id);
            }
          }
        } catch (clErr) {
          console.warn("[Clientes] No se pudo upsert el cliente tras venta (Excel)", clErr);
        }

        totalVentasInsertadas++;
      }

      return {
        inserted: totalVentasInsertadas,
        duplicates: 0,
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    uploadProveedores,
    uploadProductos,
    uploadVentas,
    loading,
  };
};
