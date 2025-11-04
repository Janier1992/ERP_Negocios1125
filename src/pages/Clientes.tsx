import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/newClient";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Badge } from "@/components/ui/badge";

interface Cliente {
  id: string;
  empresa_id: string;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  fecha_primera_compra?: string | null;
  fecha_ultima_compra?: string | null;
  total_comprado?: number | null;
  compras_count?: number | null;
}

export default function Clientes() {
  const { empresaId } = useUserProfile();
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [soloFrecuentes, setSoloFrecuentes] = useState(false);
  const [minCompras, setMinCompras] = useState(3);
  const [diasWindow, setDiasWindow] = useState(90);
  const [frecuenteIds, setFrecuenteIds] = useState<Set<string>>(new Set());
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [formErrors, setFormErrors] = useState<{ nombre?: string; email?: string; telefono?: string }>({});

  const fetchClientes = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setClientes((data || []) as Cliente[]);
    } catch (err: any) {
      const msg = String(err?.message || "");
      const friendly = /Failed to fetch/i.test(msg) ? "Sin conexión" : "No se pudieron cargar los clientes";
      toast.error(friendly);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClientes(); }, [empresaId]);
  useEffect(() => {
    const fetchFrecuentes = async () => {
      if (!empresaId) return;
      try {
        const { data, error } = await supabase.rpc("get_clientes_frecuentes", {
          _empresa: empresaId,
          _min_compras: minCompras,
          _dias: diasWindow,
        });
        if (error) throw error;
        const ids = new Set<string>();
        for (const row of (data || []) as any[]) {
          const id = (row as any)?.cliente_id || (row as any)?.id;
          if (id) ids.add(String(id));
        }
        setFrecuenteIds(ids);
      } catch (err) {
        console.error("RPC get_clientes_frecuentes falló", err);
      }
    };
    fetchFrecuentes();
  }, [empresaId, minCompras, diasWindow]);

  const validateEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const validateTelefono = (val: string) => /^[\d+\-\s()]{7,}$/.test(val);

  const crearCliente = async () => {
    const nombreVal = nombre.trim();
    const emailVal = email.trim();
    const telVal = telefono.trim();

    if (!empresaId) {
      toast.error("No hay empresa");
      return;
    }

    const errors: { nombre?: string; email?: string; telefono?: string } = {};
    if (!nombreVal || nombreVal.length < 2) {
      errors.nombre = "El nombre es requerido (mín. 2 caracteres)";
    }
    if (emailVal && !validateEmail(emailVal)) {
      errors.email = "Email inválido";
    }
    if (telVal && !validateTelefono(telVal)) {
      errors.telefono = "Teléfono inválido";
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Revisa los campos del formulario");
      return;
    }

    try {
      setSaving(true);
      // Comprobación de duplicado por email dentro de la empresa
      if (emailVal) {
        const dup = await supabase
          .from("clientes")
          .select("id")
          .eq("empresa_id", empresaId)
          .eq("email", emailVal)
          .limit(1);
        if ((dup?.data || []).length > 0) {
          setFormErrors({ email: "Ya existe un cliente con este email" });
          toast.error("Ya existe un cliente con este email");
          setSaving(false);
          return;
        }
      }

      const payload = {
        empresa_id: empresaId,
        nombre: nombreVal,
        email: emailVal || null,
        telefono: telVal || null,
        direccion: direccion.trim() || null,
      };
      const { error } = await supabase.from("clientes").insert(payload);
      if (error) throw error;
      toast.success("Cliente creado");
      setNombre(""); setEmail(""); setTelefono(""); setDireccion("");
      setFormErrors({});
      await fetchClientes();
    } catch (err: any) {
      const msg = String(err?.message || "");
      const friendly = /policy|rls|permission/i.test(msg) ? "Sin permisos" : "No se pudo crear el cliente";
      toast.error(friendly);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (c: Cliente) => {
    setEditingCliente(c);
    setNombre(c.nombre || "");
    setEmail((c.email as string) || "");
    setTelefono((c.telefono as string) || "");
    setDireccion((c.direccion as string) || "");
  };

  const cancelarEdicion = () => {
    setEditingCliente(null);
    setNombre("");
    setEmail("");
    setTelefono("");
    setDireccion("");
  };

  const guardarEdicion = async () => {
    if (!editingCliente) return;
    const nombreVal = nombre.trim();
    const emailVal = email.trim();
    const telVal = telefono.trim();

    const errors: { nombre?: string; email?: string; telefono?: string } = {};
    if (!nombreVal || nombreVal.length < 2) {
      errors.nombre = "El nombre es requerido (mín. 2 caracteres)";
    }
    if (emailVal && !validateEmail(emailVal)) {
      errors.email = "Email inválido";
    }
    if (telVal && !validateTelefono(telVal)) {
      errors.telefono = "Teléfono inválido";
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Revisa los campos del formulario");
      return;
    }

    try {
      setUpdating(true);
      // Comprobación de duplicado por email si cambió
      if (emailVal) {
        const dup = await supabase
          .from("clientes")
          .select("id")
          .eq("empresa_id", editingCliente.empresa_id)
          .eq("email", emailVal)
          .limit(1);
        const dupRows = (dup?.data || []) as any[];
        if (dupRows.length > 0 && String(dupRows[0]?.id) !== editingCliente.id) {
          setFormErrors({ email: "Ya existe un cliente con este email" });
          toast.error("Ya existe un cliente con este email");
          setUpdating(false);
          return;
        }
      }

      const { error } = await supabase
        .from("clientes")
        .update({
          nombre: nombreVal,
          email: emailVal || null,
          telefono: telVal || null,
          direccion: direccion.trim() || null,
        })
        .eq("id", editingCliente.id);
      if (error) throw error;
      toast.success("Cliente actualizado");
      setEditingCliente(null);
      setNombre(""); setEmail(""); setTelefono(""); setDireccion("");
      setFormErrors({});
      await fetchClientes();
    } catch (err: any) {
      const msg = String(err?.message || "");
      const friendly = /policy|rls|permission/i.test(msg) ? "Sin permisos" : "No se pudo actualizar el cliente";
      toast.error(friendly);
    } finally {
      setUpdating(false);
    }
  };

  const eliminarCliente = async (c: Cliente) => {
    try {
      const { error } = await supabase.from("clientes").delete().eq("id", c.id);
      if (error) throw error;
      toast.success("Cliente eliminado");
      await fetchClientes();
    } catch (err: any) {
      toast.error("No se pudo eliminar");
    }
  };

  // Lista filtrada para búsqueda y opción "Solo frecuentes"
  const filteredClientes = clientes.filter((c) => {
    const s = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !s ||
      [c.nombre, c.email, c.telefono, c.direccion]
        .map((v) => String(v || "").toLowerCase())
        .some((v) => v.includes(s));
    const matchesFrecuentes = !soloFrecuentes || frecuenteIds.has(c.id);
    return matchesSearch && matchesFrecuentes;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Clientes</h2>
        <p className="text-muted-foreground">Registro, búsqueda y contacto de clientes.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingCliente ? "Editar cliente" : "Nuevo cliente"}</CardTitle>
          <CardDescription>Agrega datos básicos del cliente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm">Nombre</label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Juan Pérez" disabled={saving || updating} />
              {formErrors.nombre && <p className="text-xs text-red-600">{formErrors.nombre}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="juan@dominio.com" disabled={saving || updating} />
              {formErrors.email && <p className="text-xs text-red-600">{formErrors.email}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm">Teléfono</label>
              <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+54 11 5555-5555" disabled={saving || updating} />
              {formErrors.telefono && <p className="text-xs text-red-600">{formErrors.telefono}</p>}
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm">Dirección</label>
              <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Av. Siempre Viva 742" disabled={saving || updating} />
            </div>
          </div>
          {editingCliente ? (
            <div className="flex gap-2">
              <Button onClick={guardarEdicion} disabled={updating || !nombre.trim()}>{updating ? "Guardando..." : "Guardar cambios"}</Button>
              <Button variant="secondary" onClick={cancelarEdicion} disabled={updating}>Cancelar</Button>
            </div>
          ) : (
            <Button onClick={crearCliente} disabled={saving || !nombre.trim()}>{saving ? "Guardando..." : "Guardar cliente"}</Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
          <CardDescription>{loading ? "Cargando…" : `${clientes.length} cliente(s)`}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-end gap-4 mb-4">
            <div className="flex-1 space-y-2">
              <label className="text-sm">Buscar</label>
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nombre, email, teléfono, dirección"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm">Mín. compras</label>
              <Input
                type="number"
                min={1}
                value={minCompras}
                onChange={(e) => setMinCompras(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm">Ventana (días)</label>
              <Input
                type="number"
                min={1}
                value={diasWindow}
                onChange={(e) => setDiasWindow(Number(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="solo-frecuentes"
                type="checkbox"
                checked={soloFrecuentes}
                onChange={(e) => setSoloFrecuentes(e.target.checked)}
              />
              <label htmlFor="solo-frecuentes" className="text-sm">Solo frecuentes</label>
            </div>
          </div>
          {clientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay clientes.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Compras</TableHead>
                  <TableHead>Total comprado</TableHead>
                  <TableHead>Última compra</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClientes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{c.nombre}</span>
                        {frecuenteIds.has(c.id) && <Badge>Frecuente</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{c.email || '-'}</TableCell>
                    <TableCell>{c.telefono || '-'}</TableCell>
                    <TableCell>{c.direccion || '-'}</TableCell>
                    <TableCell className="text-center">{Number(c.compras_count || 0)}</TableCell>
                    <TableCell>${Number(c.total_comprado || 0).toFixed(2)}</TableCell>
                    <TableCell>{c.fecha_ultima_compra ? new Date(c.fecha_ultima_compra).toLocaleDateString() : '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => startEdit(c)}>Editar</Button>
                        <Button variant="destructive" onClick={() => eliminarCliente(c)}>Eliminar</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}