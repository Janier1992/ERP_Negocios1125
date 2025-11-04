// Seed de datos de Finanzas para entorno de desarrollo Supabase
// Uso:
// 1) Exporta variables de entorno:
//    - SUPABASE_URL o VITE_SUPABASE_URL
//    - SUPABASE_SERVICE_ROLE_KEY
//    - (opcional) SEED_EMPRESA_ID (default: emp_test)
// 2) Ejecuta: node scripts/seed_finanzas_data.mjs

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const empresaId = process.env.SEED_EMPRESA_ID || 'emp_test';

if (!url || !serviceKey) {
  console.error('Faltan variables de entorno: SUPABASE_URL/VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

function id(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

async function main() {
  console.log('Seed Finanzas: empresa_id =', empresaId);
  const now = new Date();
  const isoNow = now.toISOString();

  // 1) Insertar una venta (ingresos)
  const ventaId = id('v');
  const { error: ventaErr } = await supabase
    .from('ventas')
    .insert([{ id: ventaId, empresa_id: empresaId, total: 100, created_at: isoNow }]);
  if (ventaErr) throw ventaErr;
  console.log('Venta insertada:', ventaId);

  // 2) Insertar compra recibida (egresos)
  const compraRecId = id('crec');
  const { error: compraRecErr } = await supabase
    .from('compras')
    .insert([{ id: compraRecId, empresa_id: empresaId, estado: 'recibida', created_at: isoNow }]);
  if (compraRecErr) throw compraRecErr;
  const { error: detRecErr } = await supabase
    .from('compras_detalle')
    .insert([
      { id: id('d'), empresa_id: empresaId, compra_id: compraRecId, cantidad: 10, precio: 2 },
      { id: id('d'), empresa_id: empresaId, compra_id: compraRecId, cantidad: 5, precio: 4 },
    ]);
  if (detRecErr) throw detRecErr;
  console.log('Compra recibida y detalle insertados:', compraRecId);

  // 3) Insertar compra pendiente (cuentas por pagar)
  const compraPendId = id('cpend');
  const { error: compraPendErr } = await supabase
    .from('compras')
    .insert([{ id: compraPendId, empresa_id: empresaId, estado: 'pendiente', created_at: isoNow }]);
  if (compraPendErr) throw compraPendErr;
  const detPend = [
    { id: id('d'), empresa_id: empresaId, compra_id: compraPendId, cantidad: 3, precio: 10 },
  ];
  const { error: detPendErr } = await supabase.from('compras_detalle').insert(detPend);
  if (detPendErr) throw detPendErr;
  console.log('Compra pendiente y detalle insertados:', compraPendId);

  // 4) Insertar CxP asociada a compra pendiente
  const montoPend = detPend.reduce((s, d) => s + Number(d.cantidad || 0) * Number(d.precio || 0), 0);
  const vencimiento = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();
  const cxpId = id('cxp');
  const { error: cxpErr } = await supabase
    .from('cuentas_por_pagar')
    .insert([{ id: cxpId, empresa_id: empresaId, compra_id: compraPendId, proveedor_id: null, monto: montoPend, fecha_emision: isoNow, fecha_vencimiento: vencimiento, estado: 'pendiente' }]);
  if (cxpErr) throw cxpErr;
  console.log('Cuenta por pagar insertada:', cxpId, 'monto:', montoPend);

  console.log('Seed completado. Resumen esperado: ingresos=100, egresos=40, balance=60, CxP=30');
}

main().catch((err) => {
  console.error('Error en seed:', err);
  process.exit(1);
});