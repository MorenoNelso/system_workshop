"use server";

import { empleadoSchema, validate } from "@/lib/schemas";
import {
  db,
  friendlyDbError,
  touch,
  type ActionResult,
} from "@/lib/actions/_crud-helpers";

const PATH = "/empleados";

export async function listEmpleados() {
  const supabase = await db();
  const { data, error } = await supabase
    .from("empleados")
    .select("*, usuario:usuarios(email), moneda_salario:monedas(simbolo)")
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
  const parsed = validate(empleadoSchema, raw);
  if (!parsed.ok) return parsed;
  const supabase = await db();
  const { data, error } = await supabase
    .from("empleados")
    .insert(parsed.data)
    .select()
    .single();
  if (error) return { ok: false, error: friendlyDbError("crear el empleado") };
  touch(PATH);
  return { ok: true, data };
}

export async function updateEmpleado(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = validate(empleadoSchema, raw);
  if (!parsed.ok) return parsed;
  const supabase = await db();
  const { data, error } = await supabase
    .from("empleados")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();
  if (error) return { ok: false, error: friendlyDbError("actualizar el empleado") };
  touch(PATH);
  return { ok: true, data };
}

export async function deleteEmpleado(id: string): Promise<ActionResult> {
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
