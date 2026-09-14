"use server";

import { motoSchema, validate } from "@/lib/schemas";
import { requireEliminar } from "@/lib/auth/permisos";
import {
  db,
  friendlyDbError,
  runOnce,
  touch,
  type ActionResult,
} from "@/lib/actions/_crud-helpers";

const PATH = "/motos";

export async function listMotos() {
  const supabase = await db();
  const { data, error } = await supabase
    .from("motos")
    .select("*, cliente:clientes(nombre)")
    .order("marca");
  if (error) return [];
  return data;
}

export async function createMoto(raw: unknown): Promise<ActionResult> {
  const parsed = validate(motoSchema, raw);
  if (!parsed.ok) return parsed;

  const key = `create:motos:${JSON.stringify(parsed.data)}`;

  return runOnce<ActionResult>(key, async () => {
    const supabase = await db();
    const { data, error } = await supabase
      .from("motos")
      .insert(parsed.data)
      .select("*, cliente:clientes(nombre)")
      .single();
    if (error) return { ok: false, error: friendlyDbError("crear la moto") };
    touch(PATH);
    return { ok: true, data };
  });
}

export async function updateMoto(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = validate(motoSchema, raw);
  if (!parsed.ok) return parsed;
  const supabase = await db();
  const { data, error } = await supabase
    .from("motos")
    .update(parsed.data)
    .eq("id", id)
    .select("*, cliente:clientes(nombre)")
    .single();
  if (error) return { ok: false, error: friendlyDbError("actualizar la moto") };
  touch(PATH);
  return { ok: true, data };
}

export async function deleteMoto(id: string): Promise<ActionResult> {
  await requireEliminar("motos");
  const supabase = await db();
  const { error } = await supabase.from("motos").delete().eq("id", id);
  if (error)
    return {
      ok: false,
      error: "No se pudo eliminar. Es posible que la moto tenga órdenes asociadas.",
    };
  touch(PATH);
  return { ok: true };
}
