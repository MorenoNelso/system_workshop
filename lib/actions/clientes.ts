"use server";

import { clienteSchema, validate } from "@/lib/schemas";
import { requireEliminar } from "@/lib/auth/permisos";
import {
  db,
  friendlyDbError,
  touch,
  type ActionResult,
} from "@/lib/actions/_crud-helpers";

const PATH = "/clientes";

export async function listClientes() {
  const supabase = await db();
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .order("nombre");
  if (error) return [];
  return data;
}

export async function createCliente(raw: unknown): Promise<ActionResult> {
  const parsed = validate(clienteSchema, raw);
  if (!parsed.ok) return parsed;

  const supabase = await db();

  // Prevenir duplicados: verificar si ya existe un cliente con mismo nombre y teléfono
  const { data: existing } = await supabase
    .from("clientes")
    .select("id")
    .eq("nombre", parsed.data.nombre)
    .eq("telefono", parsed.data.telefono)
    .maybeSingle();

  if (existing) {
    // Ya existe — retornar el existente como si fuera nuevo (idempotente)
    const { data } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", existing.id)
      .single();
    return { ok: true, data };
  }

  const { data, error } = await supabase
    .from("clientes")
    .insert(parsed.data)
    .select()
    .single();
  if (error) return { ok: false, error: friendlyDbError("crear el cliente") };
  touch(PATH);
  return { ok: true, data };
}

export async function updateCliente(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = validate(clienteSchema, raw);
  if (!parsed.ok) return parsed;
  const supabase = await db();
  const { data, error } = await supabase
    .from("clientes")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();
  if (error) return { ok: false, error: friendlyDbError("actualizar el cliente") };
  touch(PATH);
  return { ok: true, data };
}

export async function deleteCliente(id: string): Promise<ActionResult> {
  await requireEliminar("clientes");
  const supabase = await db();
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error)
    return {
      ok: false,
      error: "No se pudo eliminar. Es posible que el cliente tenga registros asociados.",
    };
  touch(PATH);
  return { ok: true };
}
