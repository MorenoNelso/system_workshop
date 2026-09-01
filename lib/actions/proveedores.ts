"use server";

import { proveedorSchema, validate } from "@/lib/schemas";
import {
  db,
  friendlyDbError,
  runOnce,
  touch,
  type ActionResult,
} from "@/lib/actions/_crud-helpers";

const PATH = "/proveedores";

export async function listProveedores() {
  const supabase = await db();
  const { data, error } = await supabase
    .from("proveedores")
    .select("*")
    .order("nombre");
  if (error) return [];
  return data;
}

export async function createProveedor(raw: unknown): Promise<ActionResult> {
  const parsed = validate(proveedorSchema, raw);
  if (!parsed.ok) return parsed;

  // Deduplicación en vuelo: si el mismo proveedor llega por un doble clic,
  // la segunda petición espera el resultado de la primera en vez de insertar.
  const key = `create:proveedores:${JSON.stringify(parsed.data)}`;

  return runOnce<ActionResult>(key, async () => {
    const supabase = await db();
    const { data, error } = await supabase
      .from("proveedores")
      .insert(parsed.data)
      .select()
      .single();
    if (error) return { ok: false, error: friendlyDbError("crear el proveedor") };
    touch(PATH);
    return { ok: true, data };
  });
}

export async function updateProveedor(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = validate(proveedorSchema, raw);
  if (!parsed.ok) return parsed;
  const supabase = await db();
  const { data, error } = await supabase
    .from("proveedores")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();
  if (error) return { ok: false, error: friendlyDbError("actualizar el proveedor") };
  touch(PATH);
  return { ok: true, data };
}

export async function deleteProveedor(id: string): Promise<ActionResult> {
  const supabase = await db();
  const { error } = await supabase
    .from("proveedores")
    .delete()
    .eq("id", id);
  if (error)
    return {
      ok: false,
      error: "No se pudo eliminar. Es posible que tenga repuestos asociados.",
    };
  touch(PATH);
  return { ok: true };
}
