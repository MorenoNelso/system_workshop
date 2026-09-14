"use server";

import { empleadoSchema, validate } from "@/lib/schemas";
import { requireRole } from "@/lib/auth/session";
import {
  db,
  friendlyDbError,
  runOnce,
  touch,
  type ActionResult,
} from "@/lib/actions/_crud-helpers";

const PATH = "/empleados";

interface EmpleadoCleanData {
  usuario_id?: string;
  nombre: string;
  documento?: string;
  telefono?: string;
  tipo_vinculacion?: "salario_fijo" | "comision" | "mixto";
  salario_base?: number;
  moneda_salario_id?: string;
  porcentaje_comision?: number;
  activo: boolean;
}

/** Convierte null a undefined para compatibilidad con Supabase types */
function cleanEmpleadoData(data: Record<string, unknown>): EmpleadoCleanData {
  return {
    nombre: data.nombre as string,
    activo: (data.activo as boolean) ?? true,
    ...(data.usuario_id != null ? { usuario_id: data.usuario_id as string } : {}),
    ...(data.documento != null ? { documento: data.documento as string } : {}),
    ...(data.telefono != null ? { telefono: data.telefono as string } : {}),
    ...(data.tipo_vinculacion != null ? { tipo_vinculacion: data.tipo_vinculacion as "salario_fijo" | "comision" | "mixto" } : {}),
    ...(data.salario_base != null ? { salario_base: Number(data.salario_base) } : {}),
    ...(data.moneda_salario_id != null ? { moneda_salario_id: data.moneda_salario_id as string } : {}),
    ...(data.porcentaje_comision != null ? { porcentaje_comision: Number(data.porcentaje_comision) } : {}),
  };
}

export async function listEmpleados() {
  const supabase = await db();
  const { data, error } = await supabase
    .from("empleados")
    .select("*, usuario:usuarios(email, rol), moneda_salario:monedas(simbolo)")
    .order("nombre");
  if (error) return [];
  return data;
}

export async function listMecanicosActivos() {
  const supabase = await db();
  const { data, error } = await supabase
    .from("empleados")
    .select("id, nombre, tipo_vinculacion, porcentaje_comision")
    .eq("activo", true)
    .order("nombre");
  if (error) return [];
  return data;
}

export async function createEmpleado(raw: unknown): Promise<ActionResult> {
  await requireRole("administrador");
  const parsed = validate(empleadoSchema, raw);
  if (!parsed.ok) return parsed;

  const key = `create:empleados:${JSON.stringify(parsed.data)}`;

  return runOnce<ActionResult>(key, async () => {
    const supabase = await db();
    const { data, error } = await supabase
      .from("empleados")
      .insert(cleanEmpleadoData(parsed.data))
      .select("*, usuario:usuarios(email), moneda_salario:monedas(simbolo)")
      .single();
    if (error) return { ok: false, error: friendlyDbError("crear el empleado") };
    touch(PATH);
    return { ok: true, data };
  });
}

export async function updateEmpleado(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  await requireRole("administrador");
  const parsed = validate(empleadoSchema, raw);
  if (!parsed.ok) return parsed;
  const supabase = await db();
  const { data, error } = await supabase
    .from("empleados")
    .update(cleanEmpleadoData(parsed.data))
    .eq("id", id)
    .select("*, usuario:usuarios(email), moneda_salario:monedas(simbolo)")
    .single();
  if (error) return { ok: false, error: friendlyDbError("actualizar el empleado") };
  touch(PATH);
  return { ok: true, data };
}

export async function deleteEmpleado(id: string): Promise<ActionResult> {
  await requireRole("administrador");
  const supabase = await db();
  const { error } = await supabase.from("empleados").delete().eq("id", id);
  if (error)
    return {
      ok: false,
      error: "No se pudo eliminar. Es posible que el empleado tenga órdenes o mano de obra asociadas.",
    };
  touch(PATH);
  return { ok: true };
}

export interface ResumenEmpleado {
  empleado_id: string;
  nombre: string;
  total_ganado: number;
  cantidad_trabajos: number;
}

export async function getResumenEmpleados(): Promise<ResumenEmpleado[]> {
  const supabase = await db();

  // Ejecutar las 3 queries en paralelo
  const [{ data: moOrdenes }, { data: moDirecta }, { data: moAyudantes }] = await Promise.all([
    supabase
      .from("orden_detalle_mano_obra")
      .select("empleado_id, comision_calculada"),
    supabase
      .from("factura_detalle_servicios")
      .select("empleado_id, comision_calculada"),
    supabase
      .from("orden_detalle_mano_obra")
      .select("ayudante_id, ayudante_monto"),
  ]);

  // Construir mapa de resumen
  const resumen: Record<string, { total: number; trabajos: number }> = {};

  for (const item of moOrdenes ?? []) {
    const eid = item.empleado_id;
    if (!eid) continue;
    if (!resumen[eid]) resumen[eid] = { total: 0, trabajos: 0 };
    resumen[eid].total += Number(item.comision_calculada ?? 0);
    resumen[eid].trabajos += 1;
  }

  for (const item of moDirecta ?? []) {
    const eid = item.empleado_id;
    if (!eid) continue;
    if (!resumen[eid]) resumen[eid] = { total: 0, trabajos: 0 };
    resumen[eid].total += Number(item.comision_calculada ?? 0);
    resumen[eid].trabajos += 1;
  }

  for (const item of moAyudantes ?? []) {
    const aid = item.ayudante_id;
    if (!aid) continue;
    if (!resumen[aid]) resumen[aid] = { total: 0, trabajos: 0 };
    resumen[aid].total += Number(item.ayudante_monto ?? 0);
    resumen[aid].trabajos += 1;
  }

  // Obtener nombres de empleados
  const ids = Object.keys(resumen);
  if (ids.length === 0) return [];

  const { data: empleados } = await supabase
    .from("empleados")
    .select("id, nombre")
    .in("id", ids);

  const nombres: Record<string, string> = {};
  for (const e of empleados ?? []) {
    nombres[e.id] = e.nombre;
  }

  return ids.map((id) => ({
    empleado_id: id,
    nombre: nombres[id] ?? "Desconocido",
    total_ganado: Number(resumen[id].total.toFixed(2)),
    cantidad_trabajos: resumen[id].trabajos,
  }));
}
