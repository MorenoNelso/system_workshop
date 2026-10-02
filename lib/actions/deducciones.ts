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
  await requireRole("administrador");
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
  const user = await requireRole("administrador");
  if (!(await rateLimitAdmin(user.id))) {
    return { ok: false, error: "Demasiadas peticiones. Espera unos minutos e intenta de nuevo." };
  }
  const supabase = await db();
  const { error } = await supabase.from("deducciones_mecanico").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyDbError("eliminar la deducción") };
  touch(PATH);
  return { ok: true };
}
