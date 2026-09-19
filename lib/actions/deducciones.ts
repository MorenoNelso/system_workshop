"use server";

import { deduccionSchema, validate } from "@/lib/schemas";
import { requireRole } from "@/lib/auth/session";
import { rateLimitAdmin } from "@/lib/rate-limit";
import {
  db,
  friendlyDbError,
  touch,
  type ActionResult,
} from "@/lib/actions/_crud-helpers";

const PATH = "/contabilidad";

export async function listDeducciones(
  empleadoId?: string,
  fechaDesde?: string,
  fechaHasta?: string,
) {
  const supabase = await db();
  let query = supabase
    .from("deducciones_mecanico")
    .select("*, empleado:empleados(nombre), orden:ordenes_servicio(id), moneda:monedas(codigo, simbolo)")
    .order("fecha", { ascending: false });

  if (empleadoId) query = query.eq("empleado_id", empleadoId);
  if (fechaDesde) query = query.gte("fecha", fechaDesde);
  if (fechaHasta) query = query.lte("fecha", fechaHasta);

  const { data, error } = await query;
  if (error) return [];
  return data;
}

export async function createDeduccion(raw: unknown): Promise<ActionResult> {
  const user = await requireRole("administrador");

  const allowed = await rateLimitAdmin(user.id);
  if (!allowed) return { ok: false, error: "Demasiadas solicitudes. Espera un momento e intenta de nuevo." };

  const parsed = validate(deduccionSchema, raw);
  if (!parsed.ok) return parsed;

  const supabase = await db();

  const { data, error } = await supabase
    .from("deducciones_mecanico")
    .insert({
      ...parsed.data,
      orden_id: parsed.data.orden_id || null,
      registrado_por: user.id,
    })
    .select()
    .single();

  if (error) return { ok: false, error: friendlyDbError("registrar la deducción") };
  touch(PATH);
  return { ok: true, data };
}

export async function deleteDeduccion(id: string): Promise<ActionResult> {
  await requireRole("administrador");
  const supabase = await db();
  const { error } = await supabase.from("deducciones_mecanico").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyDbError("eliminar la deducción") };
  touch(PATH);
  return { ok: true };
}

export async function getDeduccionesPorMecanico(
  mes?: number,
  anio?: number,
): Promise<
  Array<{
    empleadoId: string;
    empleadoNombre: string;
    totalDeducciones: number;
    cantidad: number;
  }>
> {
  const supabase = await db();

  const now = new Date();
  const m = mes ?? now.getMonth() + 1;
  const a = anio ?? now.getFullYear();

  const fechaInicio = `${a}-${String(m).padStart(2, "0")}-01`;
  const fechaFin = new Date(a, m, 0).toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("deducciones_mecanico")
    .select("empleado_id, costo, moneda_id, empleado:empleados(nombre)")
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin);

  if (error || !data) return [];

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

  const mapa = new Map<string, { empleadoNombre: string; total: number; cantidad: number }>();

  for (const d of data) {
    const converted = convertirLocal(Number(d.costo), d.moneda_id, monedaBase?.id ?? d.moneda_id);
    const existing = mapa.get(d.empleado_id);
    if (existing) {
      existing.total += converted;
      existing.cantidad += 1;
    } else {
      mapa.set(d.empleado_id, {
        empleadoNombre: (d.empleado as unknown as { nombre: string })?.nombre ?? "Desconocido",
        total: converted,
        cantidad: 1,
      });
    }
  }

  return Array.from(mapa.entries())
    .map(([empleadoId, v]) => ({
      empleadoId,
      empleadoNombre: v.empleadoNombre,
      totalDeducciones: v.total,
      cantidad: v.cantidad,
    }))
    .sort((a, b) => b.totalDeducciones - a.totalDeducciones);
}
