"use server";

import { gastoSchema, validate } from "@/lib/schemas";
import { requireRole } from "@/lib/auth/session";
import { rateLimitAdmin } from "@/lib/rate-limit";
import { convertir, getMonedaBaseYTasas } from "@/lib/currency";
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
  await requireRole("administrador");
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
  const user = await requireRole("administrador");

  const allowed = await rateLimitAdmin(user.id);
  if (!allowed) return { ok: false, error: "Demasiadas solicitudes. Espera un momento e intenta de nuevo." };

  const parsed = validate(gastoSchema, raw);
  if (!parsed.ok) return parsed;

  const supabase = await db();

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
  const user = await requireRole("administrador");
  if (!(await rateLimitAdmin(user.id))) {
    return { ok: false, error: "Demasiadas peticiones. Espera unos minutos e intenta de nuevo." };
  }
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
  await requireRole("administrador");
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

  // Obtener moneda base y tasas vigentes (ordenadas por fecha)
  const { monedaBase, tasas: tasasMap } = await getMonedaBaseYTasas(supabase);

  let total = 0;
  const porCategoria: Record<string, number> = {};
  for (const g of data) {
    const converted = convertir(Number(g.monto), g.moneda_id, monedaBase?.id ?? g.moneda_id, tasasMap);
    const monto = converted ?? Number(g.monto);
    total += monto;
    porCategoria[g.categoria] = (porCategoria[g.categoria] ?? 0) + monto;
  }

  return { total, porCategoria };
}
