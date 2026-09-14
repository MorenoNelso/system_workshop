"use server";

import { gastoSchema, validate } from "@/lib/schemas";
import { requireRole } from "@/lib/auth/session";
import {
  db,
  friendlyDbError,
  touch,
  type ActionResult,
} from "@/lib/actions/_crud-helpers";

const PATH = "/contabilidad";

export async function listGastos(
  fechaDesde?: string,
  fechaHasta?: string,
) {
  const supabase = await db();
  let query = supabase
    .from("gastos")
    .select("*, moneda:monedas(codigo, simbolo)")
    .order("fecha", { ascending: false });

  if (fechaDesde) query = query.gte("fecha", fechaDesde);
  if (fechaHasta) query = query.lte("fecha", fechaHasta);

  const { data, error } = await query;
  if (error) return [];
  return data;
}

export async function createGasto(raw: unknown): Promise<ActionResult> {
  await requireRole("administrador");
  const parsed = validate(gastoSchema, raw);
  if (!parsed.ok) return parsed;

  const supabase = await db();

  // Obtener el usuario actual para registrado_por
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no válida." };

  const { data, error } = await supabase
    .from("gastos")
    .insert({
      ...parsed.data,
      registrado_por: user.id,
    })
    .select()
    .single();

  if (error) return { ok: false, error: friendlyDbError("registrar el gasto") };
  touch(PATH);
  return { ok: true, data };
}

export async function deleteGasto(id: string): Promise<ActionResult> {
  await requireRole("administrador");
  const supabase = await db();
  const { error } = await supabase.from("gastos").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyDbError("eliminar el gasto") };
  touch(PATH);
  return { ok: true };
}

export async function getResumenGastos(
  mes?: number,
  anio?: number,
): Promise<{
  total: number;
  porCategoria: Record<string, number>;
}> {
  const supabase = await db();

  const now = new Date();
  const m = mes ?? now.getMonth() + 1;
  const a = anio ?? now.getFullYear();

  const fechaInicio = `${a}-${String(m).padStart(2, "0")}-01`;
  const fechaFin = new Date(a, m, 0).toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("gastos")
    .select("monto, moneda_id, categoria")
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin);

  if (error || !data) return { total: 0, porCategoria: {} };

  // Obtener moneda base y tasas para convertir
  const { data: monedas } = await supabase.from("monedas").select("id, codigo").order("codigo");
  const monedaBase = monedas?.[0];
  const { data: tasasRows } = await supabase
    .from("tasas_cambio")
    .select("moneda_origen_id, moneda_destino_id, tasa")
    .eq("activa", true);
  const tasas = (tasasRows ?? []) as { moneda_origen_id: string; moneda_destino_id: string; tasa: number }[];

  const convertirLocal = (monto: number, from: string, to: string): number => {
    if (from === to) return monto;
    const t = tasas.find((t) => t.moneda_origen_id === from && t.moneda_destino_id === to);
    return t ? monto * t.tasa : monto;
  };

  let total = 0;
  const porCategoria: Record<string, number> = {};
  for (const g of data) {
    const converted = convertirLocal(Number(g.monto), g.moneda_id, monedaBase?.id ?? g.moneda_id);
    total += converted;
    porCategoria[g.categoria] = (porCategoria[g.categoria] ?? 0) + converted;
  }

  return { total, porCategoria };
}
