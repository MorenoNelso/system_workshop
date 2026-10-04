"use server";

import { getCurrentUser, requireRole } from "@/lib/auth/session";
import { convertir, getTasasVigentes } from "@/lib/currency";
import { db } from "@/lib/actions/_crud-helpers";
import type { createClient } from "@/lib/supabase/server";

/* ------------------------------------------------------------------ */
/* Formas de los datos que consumen los componentes                    */
/* ------------------------------------------------------------------ */

export interface MonedaBase {
  id: string;
  codigo: string;
  simbolo: string;
  nombre: string;
}

export interface AlertaStock {
  id: string;
  nombre: string;
  sku: string | null;
  stock_actual: number;
  stock_minimo: number;
}

export interface ResumenOrdenes {
  recibido: number;
  en_proceso: number;
  terminado: number;
  entregado: number;
}

export interface VentaSemanal {
  semanaInicio: string;
  label: string;
  total: number;
  cantidad: number;
}

export interface IngresoMecanico {
  empleadoId: string;
  nombre: string;
  totalComision: number;
  totalManoObra: number;
  cantidadServicios: number;
}

export interface VentaRango {
  totalFacturado: number;
  totalCobrado: number;
  cantidad: number;
  pendientes: number;
  pagadas: number;
}

export interface MiProduccion {
  empleadoNombre: string;
  ordenesAsignadas: number;
  totalComision: number;
  totalManoObra: number;
  cantidadServicios: number;
  /** Servicios del mes donde fue ayudante (incluidos en lo anterior). */
  cantidadAyudas: number;
}

export interface DeduccionMes {
  total: number;
  items: Array<{
    id: string;
    descripcion: string;
    costo: number;
    moneda_id: string;
    fecha: string;
    convertido: number;
  }>;
}

/** YYYY-MM-DD en hora local (evita desfase UTC de toISOString). */
function fechaLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Lunes de la semana de una fecha (00:00 local). */
function lunesDe(date: Date): Date {
  const d = new Date(date);
  const dia = d.getDay();
  const diff = d.getDate() - dia + (dia === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Etiqueta compacta para una semana: "dd/mm". */
function etiquetaSemana(inicio: Date): string {
  const dd = String(inicio.getDate()).padStart(2, "0");
  const mm = String(inicio.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

/** Obtiene las monedas y asume la primera (COP) como base. */
async function getMonedasYBase(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("monedas")
    .select("*")
    .order("codigo");
  const monedas = (data ?? []) as unknown as MonedaBase[];
  // Sin monedas no hay base para convertir: fallar con mensaje claro en vez
  // de TypeError en `monedas[0].id`. Requiere el seed inicial (ver
  // supabase/migrations/20260930_bootstrap_inicial.sql).
  if (monedas.length === 0) {
    throw new Error("No hay monedas configuradas. Registra COP, USD y VES antes de operar.");
  }
  return monedas;
}

/* ------------------------------------------------------------------ */
/* Alertas de stock bajo                                              */
/* ------------------------------------------------------------------ */

export async function getAlertasStock(): Promise<AlertaStock[]> {
  const supabase = await db();
  const { data } = await supabase
    .from("repuestos")
    .select("id, nombre, sku, stock_actual, stock_minimo")
    .eq("activo", true)
    .order("nombre");

  return ((data ?? []) as unknown as AlertaStock[]).filter(
    (r) => r.stock_actual <= r.stock_minimo,
  );
}

/* ------------------------------------------------------------------ */
/* Resumen de órdenes por estado                                      */
/* ------------------------------------------------------------------ */

export async function getResumenOrdenes(): Promise<ResumenOrdenes> {
  const supabase = await db();
  const { data } = await supabase
    .from("ordenes_servicio")
    .select("estado");

  const resumen: ResumenOrdenes = {
    recibido: 0,
    en_proceso: 0,
    terminado: 0,
    entregado: 0,
  };
  for (const o of data ?? []) {
    resumen[o.estado as keyof ResumenOrdenes] += 1;
  }
  return resumen;
}

/* ------------------------------------------------------------------ */
/* Ventas semanales (gráfico — solo admin)                            */
/* ------------------------------------------------------------------ */

export async function getVentasSemanales(
  semanas = 12,
): Promise<{ semanas: VentaSemanal[]; moneda: MonedaBase }> {
  await requireRole("administrador");
  const supabase = await db();

  const monedas = await getMonedasYBase(supabase);
  const monedaBase = monedas[0];
  const tasas = await getTasasVigentes(supabase);

  const ahora = new Date();
  const semanaActual = lunesDe(ahora);
  const inicio = new Date(semanaActual);
  inicio.setDate(inicio.getDate() - (semanas - 1) * 7);

  const { data: facturas } = await supabase
    .from("facturas")
    .select("total, fecha_emision, moneda_id")
    .gte("fecha_emision", inicio.toISOString())
    .neq("estado_pago", "anulada")
    .order("fecha_emision", { ascending: true });

  const buckets: VentaSemanal[] = [];
  for (let i = 0; i < semanas; i++) {
    const ws = new Date(inicio);
    ws.setDate(inicio.getDate() + i * 7);
    buckets.push({
      semanaInicio: ws.toISOString(),
      label: etiquetaSemana(ws),
      total: 0,
      cantidad: 0,
    });
  }

  for (const f of (facturas ?? []) as unknown as {
    total: number;
    fecha_emision: string;
    moneda_id: string;
  }[]) {
    const fecha = new Date(f.fecha_emision);
    for (const b of buckets) {
      const bs = new Date(b.semanaInicio);
      const be = new Date(bs);
      be.setDate(bs.getDate() + 7);
      if (fecha >= bs && fecha < be) {
        const conv = convertir(
          Number(f.total),
          f.moneda_id,
          monedaBase.id,
          tasas,
        );
        if (conv !== null) {
          b.total += conv;
          b.cantidad += 1;
        }
        break;
      }
    }
  }

  return { semanas: buckets, moneda: monedaBase };
}

/* ------------------------------------------------------------------ */
/* Ingresos por mecánico (solo admin)                                 */
/* ------------------------------------------------------------------ */

export async function getIngresosPorMecanico(): Promise<{
  mecanicos: IngresoMecanico[];
  moneda: MonedaBase;
}> {
  await requireRole("administrador");
  const supabase = await db();

  const monedas = await getMonedasYBase(supabase);
  const monedaBase = monedas[0];
  const tasas = await getTasasVigentes(supabase);

  const { data } = await supabase
    .from("orden_detalle_mano_obra")
    .select("monto, comision_calculada, moneda_id, empleado:empleados(id, nombre)");

  const filas = (data ?? []) as unknown as {
    monto: number;
    comision_calculada: number | null;
    moneda_id: string;
    empleado: { id: string; nombre: string } | null;
  }[];

  const porMecanico = new Map<string, IngresoMecanico>();

  for (const f of filas) {
    if (!f.empleado) continue;
    const key = f.empleado.id;
    let entry = porMecanico.get(key);
    if (!entry) {
      entry = {
        empleadoId: key,
        nombre: f.empleado.nombre,
        totalComision: 0,
        totalManoObra: 0,
        cantidadServicios: 0,
      };
      porMecanico.set(key, entry);
    }
    const convMO = convertir(Number(f.monto), f.moneda_id, monedaBase.id, tasas);
    if (convMO !== null) entry.totalManoObra += convMO;
    const convCom = convertir(
      Number(f.comision_calculada ?? 0),
      f.moneda_id,
      monedaBase.id,
      tasas,
    );
    if (convCom !== null) entry.totalComision += convCom;
    entry.cantidadServicios += 1;
  }

  // Trabajos como ayudante: también son ganancia del que ayudó.
  // Lectura plana (sin joins) + nombres por lote.
  const { data: ayudas } = await supabase
    .from("orden_detalle_mano_obra")
    .select("ayudante_id, ayudante_monto, moneda_id")
    .not("ayudante_id", "is", null);

  const ayudaRows = (ayudas ?? []) as unknown as {
    ayudante_id: string;
    ayudante_monto: number | null;
    moneda_id: string;
  }[];
  const ayudaIds = [...new Set(ayudaRows.map((a) => a.ayudante_id))];
  const nombresAyud: Record<string, string> = {};
  if (ayudaIds.length > 0) {
    const { data: empsAyuda } = await supabase
      .from("empleados")
      .select("id, nombre")
      .in("id", ayudaIds);
    for (const e of empsAyuda ?? []) nombresAyud[e.id] = e.nombre;
  }
  for (const a of ayudaRows) {
    const key = a.ayudante_id;
    let entry = porMecanico.get(key);
    if (!entry) {
      entry = {
        empleadoId: key,
        nombre: nombresAyud[key] ?? "Desconocido",
        totalComision: 0,
        totalManoObra: 0,
        cantidadServicios: 0,
      };
      porMecanico.set(key, entry);
    }
    const convAyuda = convertir(
      Number(a.ayudante_monto ?? 0),
      a.moneda_id,
      monedaBase.id,
      tasas,
    );
    if (convAyuda !== null) entry.totalComision += convAyuda;
    entry.cantidadServicios += 1;
  }

  return {
    mecanicos: [...porMecanico.values()].sort(
      (a, b) => b.totalManoObra - a.totalManoObra,
    ),
    moneda: monedaBase,
  };
}

/* ------------------------------------------------------------------ */
/* Ventas por rango de fechas (solo admin, llamable desde cliente)     */
/* ------------------------------------------------------------------ */

export async function getVentasPorRango(
  fechaInicio: string,
  fechaFin: string,
): Promise<{ resultado: VentaRango; moneda: MonedaBase } | null> {
  const user = await getCurrentUser();
  if (!user || user.rol !== "administrador") return null;

  const supabase = await db();
  const monedas = await getMonedasYBase(supabase);
  const monedaBase = monedas[0];
  const tasas = await getTasasVigentes(supabase);

  const inicio = new Date(fechaInicio + "T00:00:00");
  const fin = new Date(fechaFin + "T23:59:59");

  const { data } = await supabase
    .from("facturas")
    .select("id, total, moneda_id, estado_pago")
    .gte("fecha_emision", inicio.toISOString())
    .lte("fecha_emision", fin.toISOString());

  const filas = (data ?? []) as unknown as {
    id: string;
    total: number;
    moneda_id: string;
    estado_pago: "pendiente" | "cuotas" | "pagada" | "anulada";
  }[];

  // Cobrado real = suma de pagos (las cuotas aportan parcial).
  const idsVigentes = filas.filter((f) => f.estado_pago !== "anulada").map((f) => f.id);
  const cobradoPorFactura: Record<string, number> = {};
  if (idsVigentes.length > 0) {
    const { data: pagos } = await supabase
      .from("pagos")
      .select("factura_id, monto, moneda_id")
      .in("factura_id", idsVigentes);
    for (const p of pagos ?? []) {
      const fid = p.factura_id as string;
      const convPago = convertir(Number(p.monto), p.moneda_id as string, monedaBase.id, tasas);
      if (convPago === null) continue;
      cobradoPorFactura[fid] = (cobradoPorFactura[fid] ?? 0) + convPago;
    }
  }

  let totalFacturado = 0;
  let totalCobrado = 0;
  let pendientes = 0;
  let pagadas = 0;

  for (const f of filas) {
    if (f.estado_pago === "anulada") continue;
    const conv = convertir(Number(f.total), f.moneda_id, monedaBase.id, tasas);
    if (conv === null) continue;
    totalFacturado += conv;
    totalCobrado += cobradoPorFactura[f.id] ?? 0;
    if (f.estado_pago === "pagada") {
      pagadas += 1;
    } else {
      pendientes += 1;
    }
  }

  return {
    resultado: {
      totalFacturado,
      totalCobrado,
      cantidad: pendientes + pagadas,
      pendientes,
      pagadas,
    },
    moneda: monedaBase,
  };
}

/* ------------------------------------------------------------------ */
/* Mi producción (colaborador)                                        */
/* ------------------------------------------------------------------ */

export async function getMiProduccion(
  usuarioId: string,
): Promise<{ produccion: MiProduccion; moneda: MonedaBase; deducciones: DeduccionMes; gananciaNeta: number } | null> {
  // Seguridad: el colaborador solo puede ver su propia producción.
  // Se ignora el parámetro y se usa el usuario de la sesión, salvo que
  // quien llame sea administrador (p. ej. soporte).
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return null;
  const efectivoUsuarioId =
    sessionUser.rol === "administrador" && usuarioId ? usuarioId : sessionUser.id;

  const supabase = await db();
  const monedas = await getMonedasYBase(supabase);
  const monedaBase = monedas[0];
  const tasas = await getTasasVigentes(supabase);

  const { data: empleado } = await supabase
    .from("empleados")
    .select("id, nombre")
    .eq("usuario_id", efectivoUsuarioId)
    .maybeSingle();

  if (!empleado) return null;

  // ---- 1. Órdenes asignadas (no entregadas) ----
  const { count } = await supabase
    .from("ordenes_servicio")
    .select("id", { count: "exact", head: true })
    .eq("empleado_asignado_id", empleado.id)
    .neq("estado", "entregado");

  // ---- 2. Mano de obra + comisiones DEL MES (por fecha_ingreso de la orden) ----
  // orden_detalle_mano_obra no tiene fecha propia: se usa la fecha_ingreso
  // de la orden para que comisiones y deducciones compartan el mismo periodo.
  const hoy = new Date();
  const inicioMes = fechaLocalISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const finMes = fechaLocalISO(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0));

  const { data: manoObra } = await supabase
    .from("orden_detalle_mano_obra")
    .select("monto, comision_calculada, moneda_id, orden_id, orden:ordenes_servicio(fecha_ingreso)")
    .eq("empleado_id", empleado.id);

  const filas = (manoObra ?? []) as unknown as {
    monto: number;
    comision_calculada: number | null;
    moneda_id: string;
    orden_id: string;
    orden: { fecha_ingreso: string } | null;
  }[];

  const filasMes = filas.filter((f) => {
    const fecha = f.orden?.fecha_ingreso ? String(f.orden.fecha_ingreso).slice(0, 10) : null;
    return fecha !== null && fecha >= inicioMes && fecha <= finMes;
  });

  let totalComision = 0;
  let totalManoObra = 0;
  let cantidadServicios = filasMes.length;
  for (const f of filasMes) {
    const convMO = convertir(Number(f.monto), f.moneda_id, monedaBase.id, tasas);
    if (convMO !== null) totalManoObra += convMO;
    const convCom = convertir(
      Number(f.comision_calculada ?? 0),
      f.moneda_id,
      monedaBase.id,
      tasas,
    );
    if (convCom !== null) totalComision += convCom;
  }

  // ---- 2b. Servicios de facturas DIRECTAS (venta rápida) del mes ----
  // factura_detalle_servicios no tiene fecha propia: se usa fecha_emision.
  const { data: servDirectos } = await supabase
    .from("factura_detalle_servicios")
    .select("monto, comision_calculada, moneda_id, factura:facturas(fecha_emision)")
    .eq("empleado_id", empleado.id);

  const directos = (servDirectos ?? []) as unknown as {
    monto: number;
    comision_calculada: number | null;
    moneda_id: string;
    factura: { fecha_emision: string } | null;
  }[];

  for (const s of directos) {
    const fecha = s.factura?.fecha_emision ? String(s.factura.fecha_emision).slice(0, 10) : null;
    if (fecha === null || fecha < inicioMes || fecha > finMes) continue;
    const convMO = convertir(Number(s.monto), s.moneda_id, monedaBase.id, tasas);
    if (convMO !== null) totalManoObra += convMO;
    const convCom = convertir(
      Number(s.comision_calculada ?? 0),
      s.moneda_id,
      monedaBase.id,
      tasas,
    );
    if (convCom !== null) totalComision += convCom;
    cantidadServicios += 1;
  }

  // ---- 2c. Trabajos como AYUDANTE del mes (el titular es otro mecánico) ----
  // Sin esto, lo que gana ayudando es invisible en su propio dashboard
  // (el admin sí lo veía en getResumenEmpleados). Mes por fecha_ingreso.
  const { data: ayudas } = await supabase
    .from("orden_detalle_mano_obra")
    .select("ayudante_monto, moneda_id, orden:ordenes_servicio(fecha_ingreso)")
    .eq("ayudante_id", empleado.id);

  const ayudasRows = (ayudas ?? []) as unknown as {
    ayudante_monto: number | null;
    moneda_id: string;
    orden: { fecha_ingreso: string } | null;
  }[];

  let cantidadAyudas = 0;
  for (const a of ayudasRows) {
    const fecha = a.orden?.fecha_ingreso ? String(a.orden.fecha_ingreso).slice(0, 10) : null;
    if (fecha === null || fecha < inicioMes || fecha > finMes) continue;
    const convAyuda = convertir(
      Number(a.ayudante_monto ?? 0),
      a.moneda_id,
      monedaBase.id,
      tasas,
    );
    if (convAyuda !== null) totalComision += convAyuda;
    cantidadServicios += 1;
    cantidadAyudas += 1;
  }

  // ---- 3. Deducciones del mes para este empleado ----
  const { data: deducciones } = await supabase
    .from("deducciones_mecanico")
    .select("id, descripcion, costo, moneda_id, fecha")
    .eq("empleado_id", empleado.id)
    .gte("fecha", inicioMes)
    .lte("fecha", finMes)
    .order("fecha", { ascending: false });

  const itemsDeducciones: DeduccionMes["items"] = [];
  let totalDeducciones = 0;
  for (const d of deducciones ?? []) {
    const row = d as unknown as {
      id: string;
      descripcion: string;
      costo: number;
      moneda_id: string;
      fecha: string;
    };
    const costo = Number(row.costo);
    const convertido = convertir(costo, row.moneda_id, monedaBase.id, tasas) ?? costo;
    totalDeducciones += convertido;
    itemsDeducciones.push({
      id: row.id,
      descripcion: row.descripcion,
      costo,
      moneda_id: row.moneda_id,
      fecha: row.fecha,
      convertido,
    });
  }

  // ---- 4. Ganancia neta del mes = comisiones del mes - deducciones del mes ----
  const gananciaNeta = totalComision - totalDeducciones;

  return {
    produccion: {
      empleadoNombre: empleado.nombre,
      ordenesAsignadas: count ?? 0,
      totalComision,
      totalManoObra,
      cantidadServicios,
      cantidadAyudas,
    },
    moneda: monedaBase,
    deducciones: {
      total: totalDeducciones,
      items: itemsDeducciones,
    },
    gananciaNeta,
  };
}

/* ------------------------------------------------------------------ */
/* Ganancias (solo admin)                                              */
/* ------------------------------------------------------------------ */

export interface GananciaVenta {
  facturaId: string;
  numero: number;
  fecha: string;
  ingreso: number;
  egreso: number;
  comisionMecanico: number;
  /** Monto fijo pagado a ayudantes (sale del taller) */
  ayudaMecanico: number;
  ganancia: number;
}

export interface GananciaDia {
  fecha: string;
  ingreso: number;
  egreso: number;
  comisionMecanico: number;
  /** Monto fijo pagado a ayudantes (sale del taller) */
  ayudaMecanico: number;
  ganancia: number;
  cantidad: number;
}

export interface GananciasResultado {
  hoy: GananciaVenta[];
  diasAnteriores: GananciaDia[];
  moneda: MonedaBase;
  /** Ganancia del taller antes de retiros y deducciones */
  gananciaTallerMes: number;
  /** Total de retiros personales del dueño en el mes */
  retirosMes: number;
  /** Total de deducciones de materiales a mecánicos en el mes */
  deduccionesMes: number;
  /** Ganancia neta = gananciaTaller - retiros - deducciones */
  gananciaNetaMes: number;
  /** ID del usuario dueño (admin que también es mecánico) */
  duenoId: string | null;
}

/**
 * Calcula ganancias por factura (ingreso − egreso − comisión mecánico − ayuda).
 * - "hoy": detalle por factura del día actual.
 * - "diasAnteriores": solo el total por día (sin desglose por venta).
 * Todo convertido a la moneda base (COP) con tasas vigentes.
 * La comisión del dueño no resta (queda en el taller); lo pagado a
 * ayudantes sí resta porque sale del taller al empleado que ayudó.
 */
export async function getGanancias(): Promise<GananciasResultado> {
  await requireRole("administrador");
  const supabase = await db();

  const monedas = await getMonedasYBase(supabase);
  const monedaBase = monedas[0];
  const tasas = await getTasasVigentes(supabase);

  // Identificar al dueño: admin que también tiene registro en empleados
  const { data: adminUser } = await supabase.auth.getUser();
  let duenoId: string | null = null;
  if (adminUser?.user) {
    const { data: empDueno } = await supabase
      .from("empleados")
      .select("id")
      .eq("usuario_id", adminUser.user.id)
      .single();
    if (empDueno) duenoId = empDueno.id;
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const hace30 = new Date(hoy);
  hace30.setDate(hace30.getDate() - 29);

  const { data: facturas } = await supabase
    .from("facturas")
    .select("id, numero_consecutivo, orden_id, fecha_emision")
    .gte("fecha_emision", hace30.toISOString())
    .neq("estado_pago", "anulada")
    .order("fecha_emision", { ascending: true });

  const filas = (facturas ?? []) as unknown as {
    id: string;
    numero_consecutivo: number;
    orden_id: string | null;
    fecha_emision: string;
  }[];

  // Cargar detalles en batch: 2 queries en vez de 2N
  const ordenIds = filas.filter((f) => f.orden_id).map((f) => f.orden_id as string);
  const facturaIds = filas.filter((f) => !f.orden_id).map((f) => f.id);

  const [repByOrden, moByOrden, repByFactura, moByFactura] = await Promise.all([
    ordenIds.length > 0
      ? supabase
          .from("orden_detalle_repuestos")
          .select("orden_id, cantidad, precio_unitario_aplicado, precio_costo_aplicado, moneda_id")
          .in("orden_id", ordenIds)
      : { data: [] as Record<string, unknown>[] },
    ordenIds.length > 0
      ? supabase
          .from("orden_detalle_mano_obra")
          .select("orden_id, monto, comision_calculada, moneda_id, empleado_id, ayudante_monto")
          .in("orden_id", ordenIds)
      : { data: [] as Record<string, unknown>[] },
    facturaIds.length > 0
      ? supabase
          .from("factura_detalle_repuestos")
          .select("factura_id, cantidad, precio_unitario_aplicado, precio_costo_aplicado, moneda_id")
          .in("factura_id", facturaIds)
      : { data: [] as Record<string, unknown>[] },
    facturaIds.length > 0
      ? supabase
          .from("factura_detalle_servicios")
          .select("factura_id, monto, comision_calculada, moneda_id, empleado_id")
          .in("factura_id", facturaIds)
      : { data: [] as Record<string, unknown>[] },
  ]);

  // Indexar por orden_id / factura_id para acceso O(1)
  const repByOrdenMap: Record<string, { cantidad: number; precio: number; costo: number | null; moneda_id: string }[]> = {};
  for (const r of repByOrden.data ?? []) {
    const oid = r.orden_id as string;
    if (!repByOrdenMap[oid]) repByOrdenMap[oid] = [];
    repByOrdenMap[oid].push({
      cantidad: r.cantidad as number,
      precio: Number(r.precio_unitario_aplicado),
      costo: r.precio_costo_aplicado === null ? null : Number(r.precio_costo_aplicado),
      moneda_id: r.moneda_id as string,
    });
  }

  const moByOrdenMap: Record<string, { monto: number; comision: number | null; moneda_id: string; empleado_id: string | null; ayuda: number | null }[]> = {};
  for (const m of moByOrden.data ?? []) {
    const oid = m.orden_id as string;
    if (!moByOrdenMap[oid]) moByOrdenMap[oid] = [];
    moByOrdenMap[oid].push({
      monto: Number(m.monto),
      comision: m.comision_calculada === null ? null : Number(m.comision_calculada),
      moneda_id: m.moneda_id as string,
      empleado_id: m.empleado_id as string | null,
      ayuda: m.ayudante_monto === null || m.ayudante_monto === undefined ? null : Number(m.ayudante_monto),
    });
  }

  const repByFacturaMap: Record<string, { cantidad: number; precio: number; costo: number | null; moneda_id: string }[]> = {};
  for (const r of repByFactura.data ?? []) {
    const fid = r.factura_id as string;
    if (!repByFacturaMap[fid]) repByFacturaMap[fid] = [];
    repByFacturaMap[fid].push({
      cantidad: r.cantidad as number,
      precio: Number(r.precio_unitario_aplicado),
      costo: r.precio_costo_aplicado === null ? null : Number(r.precio_costo_aplicado),
      moneda_id: r.moneda_id as string,
    });
  }

  const moByFacturaMap: Record<string, { monto: number; comision: number | null; moneda_id: string; empleado_id: string | null; ayuda: number | null }[]> = {};
  for (const s of moByFactura.data ?? []) {
    const fid = s.factura_id as string;
    if (!moByFacturaMap[fid]) moByFacturaMap[fid] = [];
    moByFacturaMap[fid].push({
      monto: Number(s.monto),
      comision: s.comision_calculada === null ? null : Number(s.comision_calculada),
      moneda_id: s.moneda_id as string,
      empleado_id: s.empleado_id as string | null,
      // factura_detalle_servicios no tiene columnas de ayudante: solo las órdenes
      ayuda: null,
    });
  }

  const conMontos = filas.map((f) => {
    const repuestos = f.orden_id ? (repByOrdenMap[f.orden_id] ?? []) : (repByFacturaMap[f.id] ?? []);
    const manoObra = f.orden_id ? (moByOrdenMap[f.orden_id] ?? []) : (moByFacturaMap[f.id] ?? []);

    let ingreso = 0;
    let egreso = 0;
    let comision = 0;
    let ayuda = 0;

    for (const r of repuestos) {
      const convIng = convertir(r.precio * r.cantidad, r.moneda_id, monedaBase.id, tasas);
      if (convIng !== null) ingreso += convIng;
      if (r.costo !== null) {
        const convEg = convertir(r.costo * r.cantidad, r.moneda_id, monedaBase.id, tasas);
        if (convEg !== null) egreso += convEg;
      }
    }
    for (const m of manoObra) {
      const convIng = convertir(m.monto, m.moneda_id, monedaBase.id, tasas);
      if (convIng !== null) ingreso += convIng;
      if (m.comision !== null && m.empleado_id !== duenoId) {
        const convCom = convertir(m.comision, m.moneda_id, monedaBase.id, tasas);
        if (convCom !== null) comision += convCom;
      }
      // Lo pagado al ayudante sale del taller, sin importar quién sea el titular
      if (m.ayuda !== null && m.ayuda !== undefined) {
        const convAyuda = convertir(m.ayuda, m.moneda_id, monedaBase.id, tasas);
        if (convAyuda !== null) ayuda += convAyuda;
      }
    }

    return {
      facturaId: f.id,
      numero: f.numero_consecutivo,
      fecha: f.fecha_emision,
      ingreso,
      egreso,
      comisionMecanico: comision,
      ayudaMecanico: ayuda,
      ganancia: ingreso - egreso - comision - ayuda,
    };
  });

  const ventasHoy = conMontos.filter((v) => new Date(v.fecha) >= hoy);
  const diasPrevios = conMontos.filter((v) => new Date(v.fecha) < hoy);

  // Agrupar días anteriores por fecha (solo total del día).
  const porDia = new Map<string, GananciaDia>();
  for (const v of diasPrevios) {
    const clave = v.fecha.slice(0, 10);
    let d = porDia.get(clave);
    if (!d) {
      d = { fecha: clave, ingreso: 0, egreso: 0, comisionMecanico: 0, ayudaMecanico: 0, ganancia: 0, cantidad: 0 };
      porDia.set(clave, d);
    }
    d.ingreso += v.ingreso;
    d.egreso += v.egreso;
    d.comisionMecanico += v.comisionMecanico;
    d.ayudaMecanico += v.ayudaMecanico;
    d.ganancia += v.ganancia;
    d.cantidad += 1;
  }

  // Calcular totales del mes actual para retiros y deducciones
  const now = new Date();
  const mesActual = now.getMonth() + 1;
  const anioActual = now.getFullYear();
  const fechaInicioMes = `${anioActual}-${String(mesActual).padStart(2, "0")}-01`;
  const fechaFinMes = new Date(anioActual, mesActual, 0).toISOString().split("T")[0];

  // Retiros personales del dueño en el mes
  const { data: gastosMes } = await supabase
    .from("gastos")
    .select("monto, moneda_id")
    .gte("fecha", fechaInicioMes)
    .lte("fecha", fechaFinMes);

  let retirosMes = 0;
  for (const g of gastosMes ?? []) {
    const conv = convertir(Number(g.monto), g.moneda_id, monedaBase.id, tasas);
    if (conv !== null) retirosMes += conv;
  }

  // Deducciones de materiales a mecánicos en el mes
  const { data: deduccionesMesData } = await supabase
    .from("deducciones_mecanico")
    .select("costo, moneda_id")
    .gte("fecha", fechaInicioMes)
    .lte("fecha", fechaFinMes);

  let deduccionesMes = 0;
  for (const d of deduccionesMesData ?? []) {
    const conv = convertir(Number(d.costo), d.moneda_id, monedaBase.id, tasas);
    if (conv !== null) deduccionesMes += conv;
  }

  // Ganancia del mes (solo facturas del mes)
  const ventasMes = conMontos.filter(
    (v) => new Date(v.fecha) >= new Date(fechaInicioMes) && new Date(v.fecha) <= new Date(fechaFinMes),
  );
  let gananciaTallerMes = 0;
  for (const v of ventasMes) {
    gananciaTallerMes += v.ganancia;
  }

  const gananciaNetaMes = gananciaTallerMes - retirosMes - deduccionesMes;

  return {
    hoy: ventasHoy,
    diasAnteriores: [...porDia.values()].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)),
    moneda: monedaBase,
    gananciaTallerMes,
    retirosMes,
    deduccionesMes,
    gananciaNetaMes,
    duenoId,
  };
}