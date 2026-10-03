/**
 * Cálculo de comisiones — lógica pura (sin Supabase), única fuente de verdad.
 * Usado por `agregarManoObraAOrden`, `createFacturaDirecta` y cubierto por tests.
 *
 * Prioridad (igual en ambos flujos):
 *  1. `montoAPagar` (monto fijo acordado) → se usa tal cual.
 *  2. `porcentaje` → `round(monto * % / 100, 2)`.
 *  3. Ninguno → `null` (sin comisión calculable, NO cero).
 *
 * Nota: `0` es un valor válido (comisión $0 explícita), distinto de `null`.
 */
export function calcularComision(
  monto: number,
  porcentaje: number | null | undefined,
  montoAPagar?: number | null | undefined,
): number | null {
  if (montoAPagar !== null && montoAPagar !== undefined) {
    return montoAPagar;
  }
  if (porcentaje !== null && porcentaje !== undefined) {
    return Number(((monto * porcentaje) / 100).toFixed(2));
  }
  return null;
}

/**
 * Reparto de una línea de mano de obra: lo que paga el cliente menos lo que
 * se llevan mecánico y ayudante queda en el taller. Todo en la misma moneda.
 */
export function repartirManoObra(
  monto: number,
  pagoMecanico: number | null,
  ayudaMonto: number | null,
): { mecanico: number; ayudante: number; taller: number } {
  const mecanico = pagoMecanico ?? 0;
  const ayudante = ayudaMonto ?? 0;
  return {
    mecanico,
    ayudante,
    taller: Number((monto - mecanico - ayudante).toFixed(2)),
  };
}
