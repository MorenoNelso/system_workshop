"use server";

import { repuestoSchema, validate } from "@/lib/schemas";
import {
  db,
  friendlyDbError,
  touch,
  type ActionResult,
} from "@/lib/actions/_crud-helpers";

const PATH = "/repuestos";

export async function listRepuestos() {
  const supabase = await db();
  const { data, error } = await supabase
    .from("repuestos")
    .select(
      "*, categoria:categorias_repuesto(nombre), proveedor:proveedores(nombre), moneda:monedas(simbolo)",
    )
    .order("nombre");
  if (error) return [];
  return data;
}

export async function createRepuesto(raw: unknown): Promise<ActionResult> {
  const parsed = validate(repuestoSchema, raw);
  if (!parsed.ok) return parsed;
  const supabase = await db();
  const { data, error } = await supabase
    .from("repuestos")
    .insert(parsed.data)
    .select()
    .single();
  if (error) return { ok: false, error: friendlyDbError("crear el repuesto") };
  touch(PATH);
  return { ok: true, data };
}

export async function updateRepuesto(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = validate(repuestoSchema, raw);
  if (!parsed.ok) return parsed;
  const supabase = await db();
  const { data, error } = await supabase
    .from("repuestos")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();
  if (error) return { ok: false, error: friendlyDbError("actualizar el repuesto") };
  touch(PATH);
  return { ok: true, data };
}

export async function deleteRepuesto(id: string): Promise<ActionResult> {
  const supabase = await db();
  const { error } = await supabase.from("repuestos").delete().eq("id", id);
  if (error)
    return {
      ok: false,
      error: "No se pudo eliminar. Es posible que tenga movimientos asociados.",
    };
  touch(PATH);
  return { ok: true };
}
