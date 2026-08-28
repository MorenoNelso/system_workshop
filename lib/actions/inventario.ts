"use server";

import { requireUser } from "@/lib/auth/session";
import { movimientoInventarioSchema, validate } from "@/lib/schemas";
import {
  db,
  friendlyDbError,
  touch,
  type ActionResult,
} from "@/lib/actions/_crud-helpers";

const PATH = "/inventario";

export async function listMovimientos(limit = 100) {
  const supabase = await db();
  const { data, error } = await supabase
    .from("movimientos_inventario")
    .select(
      "*, repuesto:repuestos(nombre, sku), usuario:usuarios(nombre, email), orden:ordenes_servicio(id)",
    )
    .order("fecha", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data;
}

export async function registrarMovimiento(raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = validate(movimientoInventarioSchema, raw);
  if (!parsed.ok) return parsed;

  const supabase = await db();
  const { data, error } = await supabase
    .from("movimientos_inventario")
    .insert({
      ...parsed.data,
      usuario_id: user.id,
    })
    .select()
    .single();

  if (error) {
    return { ok: false, error: friendlyDbError("registrar el movimiento de inventario") };
  }

  touch(PATH);
  touch("/repuestos");
  return { ok: true, data };
}
