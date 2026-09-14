"use server";

import { repuestoSchema, validate } from "@/lib/schemas";
import { requireEliminar } from "@/lib/auth/permisos";
import {
  db,
  friendlyDbError,
  runOnce,
  touch,
  type ActionResult,
} from "@/lib/actions/_crud-helpers";
import { requireUser } from "@/lib/auth/session";

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

  const key = `create:repuestos:${JSON.stringify(parsed.data)}`;

  return runOnce<ActionResult>(key, async () => {
    const user = await requireUser();
    const supabase = await db();

    // Autogenerar SKU si no viene: REP-XXXX secuencial.
    if (!parsed.data.sku) {
      const { data: maxRow } = await supabase
        .from("repuestos")
        .select("sku")
        .order("sku", { ascending: false })
        .limit(1)
        .maybeSingle();
      const ultimo = (maxRow as { sku: string | null } | null)?.sku;
      let num = 1;
      if (ultimo && /^REP-\d+$/.test(ultimo)) {
        num = Number(ultimo.replace("REP-", "")) + 1;
      }
      parsed.data.sku = `REP-${String(num).padStart(4, "0")}`;
    }

    // Si viene con stock inicial > 0, se registra una ENTRADA para que el
    // Kardex quede completo. El trigger `fn_actualizar_stock` suma el stock.
    const stockInicial = parsed.data.stock_actual ?? 0;
    const resto = { ...parsed.data };
    delete (resto as { stock_actual?: number }).stock_actual;

    const { data, error } = await supabase
      .from("repuestos")
      .insert({ ...resto, stock_actual: 0 })
      .select(
        "*, categoria:categorias_repuesto(nombre), proveedor:proveedores(nombre), moneda:monedas(simbolo)",
      )
      .single();
    if (error) return { ok: false, error: friendlyDbError("crear el repuesto") };

    if (stockInicial > 0 && data) {
      const { error: movErr } = await supabase
        .from("movimientos_inventario")
        .insert({
          repuesto_id: (data as { id: string }).id,
          tipo: "entrada",
          cantidad: stockInicial,
          motivo: "Stock inicial al crear el repuesto",
          usuario_id: user.id,
        });
      if (movErr) {
        // El repuesto ya existe; eliminamos el movimiento fallido no deja stock
        // inconsistente porque el trigger no corrió. Se revierte el repuesto.
        await supabase.from("repuestos").delete().eq("id", (data as { id: string }).id);
        return { ok: false, error: friendlyDbError("crear el repuesto") };
      }
    }

    touch(PATH);
    return { ok: true, data };
  });
}

export async function updateRepuesto(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = validate(repuestoSchema, raw);
  if (!parsed.ok) return parsed;
  const user = await requireUser();
  const supabase = await db();

  // Leer el stock actual para calcular el delta (si cambió).
  const { data: actual } = await supabase
    .from("repuestos")
    .select("stock_actual")
    .eq("id", id)
    .maybeSingle();

  const stockActual = (actual as { stock_actual: number } | null)?.stock_actual ?? 0;
  const nuevoStock = parsed.data.stock_actual ?? 0;
  const delta = nuevoStock - stockActual;

  // Si el stock cambió, NO se aplica en el update: se registra un AJUSTE y el
  // trigger `fn_actualizar_stock` aplica el delta al stock existente.
  const resto = { ...parsed.data };
  delete (resto as { stock_actual?: number }).stock_actual;

  const { data, error } = await supabase
    .from("repuestos")
    .update(resto)
    .eq("id", id)
    .select(
      "*, categoria:categorias_repuesto(nombre), proveedor:proveedores(nombre), moneda:monedas(simbolo)",
    )
    .single();
  if (error) return { ok: false, error: friendlyDbError("actualizar el repuesto") };

  if (delta !== 0) {
    const { error: movErr } = await supabase
      .from("movimientos_inventario")
      .insert({
        repuesto_id: id,
        tipo: "ajuste",
        cantidad: delta,
        motivo: "Ajuste manual de stock desde edición de repuesto",
        usuario_id: user.id,
      });
    if (movErr) {
      // Revertir el stock al valor anterior para no dejar inconsistencia.
      await supabase
        .from("repuestos")
        .update({ stock_actual: stockActual })
        .eq("id", id);
      return { ok: false, error: friendlyDbError("ajustar el stock") };
    }
  }

  touch(PATH);
  touch("/inventario");
  return { ok: true, data };
}

export async function deleteRepuesto(id: string): Promise<ActionResult> {
  await requireEliminar("repuestos");
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
