"use server";

import { requireRole } from "@/lib/auth/session";
import { movimientoInventarioSchema, validate } from "@/lib/schemas";
import {
  db,
  friendlyDbError,
  touch,
  type ActionResult,
} from "@/lib/actions/_crud-helpers";

const PATH = "/inventario";

export interface MovimientoRow {
  id: string;
  tipo: "entrada" | "salida" | "ajuste";
  cantidad: number;
  motivo: string | null;
  fecha: string;
  repuesto: { nombre: string; sku: string | null } | null;
  usuario: { nombre: string; email: string } | null;
}

export async function listMovimientos(limit = 100): Promise<MovimientoRow[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("movimientos_inventario")
    .select(
      "*, repuesto:repuestos(nombre, sku), usuario:usuarios(nombre, email), orden:ordenes_servicio(id)",
    )
    .order("fecha", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as unknown as MovimientoRow[];
}

export async function registrarMovimiento(raw: unknown): Promise<ActionResult> {
  const user = await requireRole("administrador");
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
