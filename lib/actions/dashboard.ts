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
    .select("total, moneda_id, estado_pago")
    .gte("fecha_emision", inicio.toISOString())
    .lte("fecha_emision", fin.toISOString());

  const filas = (data ?? []) as unknown as {
    total: number;
    moneda_id: string;
    estado_pago: "pendiente" | "pagada" | "anulada";
  }[];

  let totalFacturado = 0;
  let totalCobrado = 0;
  let pendientes = 0;
  let pagadas = 0;

  for (const f of filas) {
    if (f.estado_pago === "anulada") continue;
    const conv = convertir(Number(f.total), f.moneda_id, monedaBase.id, tasas);
    if (conv === null) continue;
    totalFacturado += conv;
    if (f.estado_pago === "pagada") {
      totalCobrado += conv;
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
): Promise<{ produccion: MiProduccion; moneda: MonedaBase } | null> {
  const supabase = await db();
  const monedas = await getMonedasYBase(supabase);
  const monedaBase = monedas[0];
  const tasas = await getTasasVigentes(supabase);

  const { data: empleado } = await supabase
    .from("empleados")
    .select("id, nombre")
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  if (!empleado) return null;

  const { count } = await supabase
    .from("ordenes_servicio")
    .select("id", { count: "exact", head: true })
    .eq("empleado_asignado_id", empleado.id)
    .neq("estado", "entregado");

  const { data: manoObra } = await supabase
    .from("orden_detalle_mano_obra")
    .select("monto, comision_calculada, moneda_id")
    .eq("empleado_id", empleado.id);

  const filas = (manoObra ?? []) as unknown as {
    monto: number;
    comision_calculada: number | null;
    moneda_id: string;
  }[];

  let totalComision = 0;
  let totalManoObra = 0;
  for (const f of filas) {
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

  return {
    produccion: {
      empleadoNombre: empleado.nombre,
      ordenesAsignadas: count ?? 0,
      totalComision,
      totalManoObra,
      cantidadServicios: filas.length,
    },
    moneda: monedaBase,
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
  ganancia: number;
}

export interface GananciaDia {
  fecha: string;
  ingreso: number;
  egreso: number;
  comisionMecanico: number;
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
 * Calcula ganancias por factura (ingreso − egreso − comisión mecánico).
 * - "hoy": detalle por factura del día actual.
 * - "diasAnteriores": solo el total por día (sin desglose por venta).
 * Todo convertido a la moneda base (COP) con tasas vigentes.
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
          .select("orden_id, monto, comision_calculada, moneda_id, empleado_id")
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

  const moByOrdenMap: Record<string, { monto: number; comision: number | null; moneda_id: string; empleado_id: string | null }[]> = {};
  for (const m of moByOrden.data ?? []) {
    const oid = m.orden_id as string;
    if (!moByOrdenMap[oid]) moByOrdenMap[oid] = [];
    moByOrdenMap[oid].push({
      monto: Number(m.monto),
      comision: m.comision_calculada === null ? null : Number(m.comision_calculada),
      moneda_id: m.moneda_id as string,
      empleado_id: m.empleado_id as string | null,
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

  const moByFacturaMap: Record<string, { monto: number; comision: number | null; moneda_id: string; empleado_id: string | null }[]> = {};
  for (const s of moByFactura.data ?? []) {
    const fid = s.factura_id as string;
    if (!moByFacturaMap[fid]) moByFacturaMap[fid] = [];
    moByFacturaMap[fid].push({
      monto: Number(s.monto),
      comision: s.comision_calculada === null ? null : Number(s.comision_calculada),
      moneda_id: s.moneda_id as string,
      empleado_id: s.empleado_id as string | null,
    });
  }

  const conMontos = filas.map((f) => {
    const repuestos = f.orden_id ? (repByOrdenMap[f.orden_id] ?? []) : (repByFacturaMap[f.id] ?? []);
    const manoObra = f.orden_id ? (moByOrdenMap[f.orden_id] ?? []) : (moByFacturaMap[f.id] ?? []);

    let ingreso = 0;
    let egreso = 0;
    let comision = 0;

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
    }

    return {
      facturaId: f.id,
      numero: f.numero_consecutivo,
      fecha: f.fecha_emision,
      ingreso,
      egreso,
      comisionMecanico: comision,
      ganancia: ingreso - egreso - comision,
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
      d = { fecha: clave, ingreso: 0, egreso: 0, comisionMecanico: 0, ganancia: 0, cantidad: 0 };
      porDia.set(clave, d);
    }
    d.ingreso += v.ingreso;
    d.egreso += v.egreso;
    d.comisionMecanico += v.comisionMecanico;
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