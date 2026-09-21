import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

/**
 * Motor de conversión de monedas.
 *
 * Las tasas se ingresan SIEMPRE de forma manual (nunca automáticas). Cada fila
 * de `tasas_cambio` representa: "1 unidad de moneda_origen = `tasa` unidades
 * de moneda_destino". La tasa "vigente" de un par es la más reciente por fecha.
 *
 * Regla de oro: la conversión a la tasa vigente es solo para MOSTRAR
 * equivalencias en pantalla. Los montos guardados en documentos (facturas,
 * detalles de orden) nunca se recalculan: usan su snapshot `tasa_aplicada`.
 */

export type TasasVigentes = Record<string, number>;

/**
 * Devuelve las tasas vigentes (la más reciente por par origen→destino).
 * Mapa con clave "origenId:destinoId" → tasa.
 */
export async function getTasasVigentes(
  supabase: SupabaseClient<Database>,
): Promise<TasasVigentes> {
  const { data } = await supabase
    .from("tasas_cambio")
    .select("moneda_origen_id, moneda_destino_id, tasa, fecha")
    .order("fecha", { ascending: false });

  return construirTasasVigentes(data ?? []);
}

/**
 * Lógica pura: filtra las filas de tasas y deja la más reciente por par.
 * Separada de la consulta para poder testearla sin Supabase.
 */
export function construirTasasVigentes(
  filas: { moneda_origen_id: string; moneda_destino_id: string; tasa: number; fecha: string }[],
): TasasVigentes {
  const tasas: TasasVigentes = {};
  const vistos = new Set<string>();
  for (const t of filas) {
    const key = `${t.moneda_origen_id}:${t.moneda_destino_id}`;
    if (!vistos.has(key)) {
      vistos.add(key);
      tasas[key] = Number(t.tasa);
    }
  }
  return tasas;
}

/**
 * Convierte un monto de una moneda a otra usando las tasas vigentes.
 * Busca primero el par directo y, si no existe, el inverso.
 * Devuelve `null` si no hay forma de convertir (falta registrar la tasa).
 */
export function convertir(
  monto: number,
  fromId: string,
  toId: string,
  tasas: TasasVigentes,
): number | null {
  if (fromId === toId) return monto;

  const directa = tasas[`${fromId}:${toId}`];
  if (directa !== undefined) return monto * directa;

  const inversa = tasas[`${toId}:${fromId}`];
  if (inversa !== undefined && inversa !== 0) return monto / inversa;

  return null;
}

/** Formatea un número con 2 decimales (punto decimal) para mostrar. */
export function fmtMonto(monto: number | null | undefined): string {
  if (monto === null || monto === undefined) return "—";
  return Number(monto).toFixed(2);
}

export async function getMonedaBaseYTasas(
  supabase: SupabaseClient<Database>,
): Promise<{ monedaBase: { id: string; codigo: string } | undefined; tasas: TasasVigentes }> {
  const { data: monedas } = await supabase.from("monedas").select("id, codigo").order("codigo");
  const monedaBase = monedas?.[0];
  const tasas = await getTasasVigentes(supabase);
  return { monedaBase, tasas };
}