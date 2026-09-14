/**
 * Lógica pura de facturación (testeable sin Supabase).
 */

/**
 * Indica si una orden ya tiene una factura asociada.
 *
 * Supabase devuelve una relación 1:1 como array `[]` cuando no hay fila,
 * o `null` si no se pidió la relación. Esta función normaliza ambos casos.
 */
export function ordenYaTieneFactura(factura: unknown): boolean {
  if (factura === null || factura === undefined) return false;
  if (Array.isArray(factura)) return factura.length > 0;
  return Boolean(factura);
}

/**
 * Estados de orden que permiten facturar (terminada o entregada).
 */
export const ESTADOS_FACTURABLES = ["terminado", "entregado"] as const;

export function ordenEsFacturable(estado: string): boolean {
  return (ESTADOS_FACTURABLES as readonly string[]).includes(estado);
}

/**
 * Determina si un error de insert es una violación de unicidad (23505),
 * es decir, que la orden ya fue facturada por otra petición concurrente.
 */
export function esErrorFacturaDuplicada(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  return /duplicate|unique|ya existe|already exists/i.test(error.message ?? "");
}

export interface LineaGananciaRepuesto {
  cantidad: number;
  precioVenta: number;
  precioCosto: number | null;
}

export interface LineaGananciaManoObra {
  monto: number;
  comision: number | null;
}

/**
 * Calcula la ganancia de una venta:
 * ingreso = venta de repuestos + mano de obra
 * egreso  = costo de repuestos vendidos
 * ganancia del taller = ingreso − egreso − comisión del mecánico.
 */
export function calcularGanancia(
  repuestos: LineaGananciaRepuesto[],
  manoObra: LineaGananciaManoObra[],
): { ingreso: number; egreso: number; comision: number; ganancia: number } {
  let ingreso = 0;
  let egreso = 0;
  for (const r of repuestos) {
    ingreso += r.precioVenta * r.cantidad;
    if (r.precioCosto !== null) egreso += r.precioCosto * r.cantidad;
  }
  let comision = 0;
  for (const m of manoObra) {
    ingreso += m.monto;
    if (m.comision !== null) comision += m.comision;
  }
  return { ingreso, egreso, comision, ganancia: ingreso - egreso - comision };
}