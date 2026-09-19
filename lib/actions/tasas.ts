"use server";

import { requireRole } from "@/lib/auth/session";
import { tasaCambioSchema, validate } from "@/lib/schemas";
import { rateLimitAdmin } from "@/lib/rate-limit";
import {
  db,
  friendlyDbError,
  touch,
  type ActionResult,
} from "@/lib/actions/_crud-helpers";

const PATH = "/tasas";

/** Monedas disponibles (para selects y etiquetas). */
export async function listMonedas() {
  const supabase = await db();
  const { data } = await supabase.from("monedas").select("*").order("codigo");
  return data ?? [];
}

/** Tasas vigentes (la más reciente por par) con nombre de monedas resueltos. */
export async function listTasasVigentes() {
  const supabase = await db();
  const monedas = await listMonedas();
  const porId = new Map(monedas.map((m) => [m.id, m]));

  const { data } = await supabase
    .from("tasas_cambio")
    .select("id, moneda_origen_id, moneda_destino_id, tasa, fuente, actualizado_por, fecha")
    .order("fecha", { ascending: false });

  const vistos = new Set<string>();
  const vigentes = [];
  for (const t of data ?? []) {
    const key = `${t.moneda_origen_id}:${t.moneda_destino_id}`;
    if (vistos.has(key)) continue;
    vistos.add(key);
    vigentes.push({
      ...t,
      origen: porId.get(t.moneda_origen_id) ?? null,
      destino: porId.get(t.moneda_destino_id) ?? null,
    });
  }
  return vigentes;
}

/**
 * Registra (o actualiza, insertando una nueva fila) la tasa de un par.
 * Solo `administrador`. Cada inserción guarda historial: la tasa vigente es
 * siempre la más reciente por par.
 */
export async function registrarTasa(raw: unknown): Promise<ActionResult> {
  const user = await requireRole("administrador");

  const allowed = await rateLimitAdmin(user.id);
  if (!allowed) return { ok: false, error: "Demasiadas solicitudes. Espera un momento e intenta de nuevo." };

  const parsed = validate(tasaCambioSchema, raw);
  if (!parsed.ok) return parsed;

  const supabase = await db();

  const { error } = await supabase.from("tasas_cambio").insert({
    moneda_origen_id: parsed.data.moneda_origen_id,
    moneda_destino_id: parsed.data.moneda_destino_id,
    tasa: parsed.data.tasa,
    fuente: "manual",
    actualizado_por: user.id,
  });
  if (error) {
    return { ok: false, error: friendlyDbError("registrar la tasa de cambio") };
  }

  touch(PATH);
  return { ok: true };
}