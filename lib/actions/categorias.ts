"use server";

import { categoriaSchema, validate } from "@/lib/schemas";
import {
  db,
  friendlyDbError,
  runOnce,
  touch,
  type ActionResult,
} from "@/lib/actions/_crud-helpers";

const PATH = "/categorias";

export async function listCategorias() {
  const supabase = await db();
  const { data, error } = await supabase
    .from("categorias_repuesto")
    .select("*")
    .order("nombre");
  if (error) return [];
  return data;
}

export async function createCategoria(raw: unknown): Promise<ActionResult> {
  const parsed = validate(categoriaSchema, raw);
  if (!parsed.ok) return parsed;

  const key = `create:categorias:${JSON.stringify(parsed.data)}`;

  return runOnce<ActionResult>(key, async () => {
    const supabase = await db();
    const { data, error } = await supabase
      .from("categorias_repuesto")
      .insert(parsed.data)
      .select()
      .single();
    if (error)
      return {
        ok: false,
        error: error.code === "23505"
          ? "Ya existe una categoría con ese nombre."
          : friendlyDbError("crear la categoría"),
      };
    touch(PATH);
    return { ok: true, data };
  });
}

export async function updateCategoria(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = validate(categoriaSchema, raw);
  if (!parsed.ok) return parsed;
  const supabase = await db();
  const { data, error } = await supabase
    .from("categorias_repuesto")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();
  if (error)
    return {
      ok: false,
      error: error.code === "23505"
        ? "Ya existe una categoría con ese nombre."
        : friendlyDbError("actualizar la categoría"),
    };
  touch(PATH);
  return { ok: true, data };
}

export async function deleteCategoria(id: string): Promise<ActionResult> {
  const supabase = await db();
  const { error } = await supabase
    .from("categorias_repuesto")
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
