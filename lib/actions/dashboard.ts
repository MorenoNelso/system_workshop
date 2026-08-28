"use server";

import { getCurrentUser, requireRole } from "@/lib/auth/session";
import { convertir, getTasasVigentes } from "@/lib/currency";
import { db } from "@/lib/actions/_crud-helpers";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
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