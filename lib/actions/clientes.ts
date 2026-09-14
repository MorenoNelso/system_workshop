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

  // Prevenir duplicados: buscar cliente con mismo nombre y teléfono (case-insensitive)
  const { data: candidates } = await supabase
    .from("clientes")
    .select("id, nombre, telefono")
    .ilike("nombre", parsed.data.nombre.trim())
    .limit(20);

  const nombreLower = parsed.data.nombre.trim().toLowerCase();
  const telLower = parsed.data.telefono.trim().toLowerCase();
  const match = candidates?.find(
    (c) =>
      c.nombre.trim().toLowerCase() === nombreLower &&
      c.telefono.trim().toLowerCase() === telLower,
  );

  if (match) {
    // Ya existe — retornar el existente (idempotente)
    const { data } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", match.id)
      .single();
    return { ok: true, data };
  }

  const { id, ...insertData } = parsed.data;
  const { data, error } = await supabase
    .from("clientes")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(id ? { id, ...insertData } as any : insertData)
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
  const { id: _id, ...updateData } = parsed.data;
  const { data, error } = await supabase
    .from("clientes")
    .update(updateData)
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
