"use server";

import { requireRole } from "@/lib/auth/session";
import { convertir, getTasasVigentes } from "@/lib/currency";
import { facturaCreateSchema, pagoSchema, validate } from "@/lib/schemas";
import {
  db,
  friendlyDbError,
  touch,
  type ActionResult,
} from "@/lib/actions/_crud-helpers";

const PATH = "/facturas";

const ESTADOS_CERRADOS = ["terminado", "entregado"] as const;

/* ------------------------------------------------------------------ */
/* Formas de los datos que consumen los componentes                    */
/* ------------------------------------------------------------------ */

export interface MonedaRef {
  id: string;
  codigo: string;
  simbolo: string;
  nombre: string;
}

export interface ClienteRef {
  nombre: string;
  telefono: string | null;
  email?: string | null;
}

export interface MotoRef {
  marca: string;
  modelo: string;
  placa: string | null;
}

export interface FacturaRow {
  id: string;
  orden_id: string;
  cliente_id: string;
  numero_consecutivo: number;
  subtotal: number;
  total: number;
  moneda_id: string;
  tasa_aplicada: number | null;
  estado_pago: "pendiente" | "pagada" | "anulada";
  fecha_emision: string;
  cliente: ClienteRef | null;
  moneda: MonedaRef | null;
}

export interface OrdenFacturable {
  id: string;
  cliente: ClienteRef | null;
  moto: MotoRef | null;
  subtotales_por_moneda: Record<string, number>;
  linea_repuestos: number;
  linea_mano_obra: number;
}

export interface RepuestoDetalle {
  id: string;
  cantidad: number;
  precio_unitario_aplicado: number;
  moneda: Pick<MonedaRef, "codigo" | "simbolo"> | null;
  repuesto: { nombre: string; sku: string | null } | null;
}

export interface ManoObraDetalle {
  id: string;
  descripcion: string;
  monto: number;
  moneda: Pick<MonedaRef, "codigo" | "simbolo"> | null;
  empleado: { nombre: string } | null;
}

export interface PagoRow {
  id: string;
  monto: number;
  moneda_id: string;
  metodo_pago: string | null;
  fecha: string;
}

export interface FacturaDetail extends FacturaRow {
  orden: { id: string; estado: string; moto: MotoRef | null } | null;
  repuestos: RepuestoDetalle[];
  mano_obra: ManoObraDetalle[];
  pagos: PagoRow[] | null;
}

/** Lista las facturas con datos del cliente, orden y moneda. */
export async function listFacturas(): Promise<FacturaRow[]> {
  const supabase = await db();
  const { data } = await supabase
    .from("facturas")
    .select(
      "*, cliente:clientes(nombre, telefono), orden:ordenes_servicio(id, estado), moneda:monedas(codigo, simbolo, nombre)",
    )
    .order("fecha_emision", { ascending: false });
  return (data ?? []) as unknown as FacturaRow[];
}

/**
 * Órdenes cerradas (terminadas o entregadas) que todavía no tienen factura.
 * Devuelve además los subtotales por moneda para el preview del modal.
 */
export async function listOrdenesFacturables(): Promise<OrdenFacturable[]> {
  const supabase = await db();

  const { data: ordenes } = await supabase
    .from("ordenes_servicio")
    .select(
      "*, cliente:clientes(nombre, telefono), moto:motos(marca, modelo, placa), factura:facturas(id)",
    )
    .in("estado", ESTADOS_CERRADOS)
    .order("fecha_ingreso", { ascending: false });

  const facturables = (ordenes ?? []).filter((o) => !o.factura);

  const conTotales = await Promise.all(
    facturables.map(async (o) => {
      const [{ data: repuestos }, { data: manoObra }] = await Promise.all([
        supabase
          .from("orden_detalle_repuestos")
          .select("cantidad, precio_unitario_aplicado, moneda_id")
          .eq("orden_id", o.id),
        supabase
          .from("orden_detalle_mano_obra")
          .select("monto, moneda_id")
          .eq("orden_id", o.id),
      ]);

      const porMoneda: Record<string, number> = {};
      for (const r of repuestos ?? []) {
        porMoneda[r.moneda_id] =
          (porMoneda[r.moneda_id] ?? 0) +
          r.cantidad * Number(r.precio_unitario_aplicado);
      }
      for (const m of manoObra ?? []) {
        porMoneda[m.moneda_id] = (porMoneda[m.moneda_id] ?? 0) + Number(m.monto);
      }

      return {
        ...o,
        subtotales_por_moneda: porMoneda,
        linea_repuestos: (repuestos ?? []).length,
        linea_mano_obra: (manoObra ?? []).length,
      };
    }),
  );

  return conTotales as unknown as OrdenFacturable[];
}

export async function getFacturaById(id: string): Promise<FacturaDetail | null> {
  const supabase = await db();

  const { data: factura, error } = await supabase
    .from("facturas")
    .select(
      "*, cliente:clientes(*), orden:ordenes_servicio(*, moto:motos(*)), moneda:monedas(codigo, simbolo, nombre), pagos:pagos(*)",
    )
    .eq("id", id)
    .single();
  if (error || !factura) return null;

  const [{ data: repuestos }, { data: manoObra }] = await Promise.all([
    supabase
      .from("orden_detalle_repuestos")
      .select("*, repuesto:repuestos(nombre, sku), moneda:monedas(codigo, simbolo)")
      .eq("orden_id", factura.orden_id),
    supabase
      .from("orden_detalle_mano_obra")
      .select("*, empleado:empleados(nombre), moneda:monedas(codigo, simbolo)")
      .eq("orden_id", factura.orden_id),
  ]);

  return {
    ...(factura as unknown as FacturaDetail),
    repuestos: (repuestos ?? []) as unknown as RepuestoDetalle[],
    mano_obra: (manoObra ?? []) as unknown as ManoObraDetalle[],
  };
}

/**
 * Genera una factura a partir de una orden cerrada (terminada/entregada).
 * Solo `administrador` (RLS también lo exige).
 *
 * - Convierte los montos de cada moneda a la moneda elegida con la tasa vigente.
 * - Guarda `total` y `tasa_aplicada` como SNAPSHOT: nunca se recalculan después.
 * - `numero_consecutivo` lo genera la BD (serial).
 */
export async function createFactura(raw: unknown): Promise<ActionResult> {
  await requireRole("administrador");

  const parsed = validate(facturaCreateSchema, raw);
  if (!parsed.ok) return parsed;

  const { orden_id, moneda_id } = parsed.data;
  const supabase = await db();

  const { data: orden, error: ordErr } = await supabase
    .from("ordenes_servicio")
    .select("*, factura:facturas(id)")
    .eq("id", orden_id)
    .single();

  if (ordErr || !orden) {
    return { ok: false, error: "La orden de servicio no existe." };
  }
  if (!ESTADOS_CERRADOS.some((s) => s === orden.estado)) {
    return {
      ok: false,
      error: "Solo se pueden facturar órdenes terminadas o entregadas.",
    };
  }
  if (orden.factura) {
    return { ok: false, error: "Esta orden ya tiene una factura asociada." };
  }

  const [{ data: repuestos }, { data: manoObra }] = await Promise.all([
    supabase
      .from("orden_detalle_repuestos")
      .select("cantidad, precio_unitario_aplicado, moneda_id")
      .eq("orden_id", orden_id),
    supabase
      .from("orden_detalle_mano_obra")
      .select("monto, moneda_id")
      .eq("orden_id", orden_id),
  ]);

  const lineas: { moneda_id: string; amount: number }[] = [
    ...(repuestos ?? []).map((r) => ({
      moneda_id: r.moneda_id,
      amount: r.cantidad * Number(r.precio_unitario_aplicado),
    })),
    ...(manoObra ?? []).map((m) => ({
      moneda_id: m.moneda_id,
      amount: Number(m.monto),
    })),
  ];

  if (lineas.length === 0) {
    return {
      ok: false,
      error: "La orden no tiene repuestos ni mano de obra para facturar.",
    };
  }

  const tasas = await getTasasVigentes(supabase);

  let total = 0;
  for (const linea of lineas) {
    const conv = convertir(linea.amount, linea.moneda_id, moneda_id, tasas);
    if (conv === null) {
      return {
        ok: false,
        error:
          "No hay tasa de cambio vigente para convertir los montos a la moneda de la factura. Regístrala primero en Tasas de Cambio.",
      };
    }
    total += conv;
  }

  // Snapshot de la tasa aplicada: solo si todos los montos vienen de una
  // misma moneda distinta a la de la factura.
  const monedasOrigen = [...new Set(lineas.map((l) => l.moneda_id))];
  let tasaAplicada: number | null = null;
  if (monedasOrigen.length === 1 && monedasOrigen[0] !== moneda_id) {
    tasaAplicada = convertir(1, monedasOrigen[0], moneda_id, tasas);
  }

  const totalFinal = Number(total.toFixed(2));

  const { data, error: insErr } = await supabase
    .from("facturas")
    .insert({
      orden_id,
      cliente_id: orden.cliente_id,
      subtotal: totalFinal,
      total: totalFinal,
      moneda_id,
      tasa_aplicada: tasaAplicada,
      estado_pago: "pendiente",
    })
    .select("*, moneda:monedas(codigo, simbolo, nombre)")
    .single();

  if (insErr) {
    return {
      ok: false,
      error:
        "No se pudo crear la factura. Verifica que la orden no esté ya facturada e intenta de nuevo.",
    };
  }

  touch(PATH);
  touch("/ordenes");
  return { ok: true, data };
}

/**
 * Registra el pago TOTAL de una factura (sin abonos). Valida que el monto
 * pagado, convertido a la moneda de la factura, cubra el total congelado.
 */
export async function registrarPago(raw: unknown): Promise<ActionResult> {
  await requireRole("administrador");

  const parsed = validate(pagoSchema, raw);
  if (!parsed.ok) return parsed;

  const { factura_id, monto, moneda_id, metodo_pago } = parsed.data;
  const supabase = await db();

  const { data: factura, error: fErr } = await supabase
    .from("facturas")
    .select("id, total, moneda_id, estado_pago")
    .eq("id", factura_id)
    .single();
  if (fErr || !factura) {
    return { ok: false, error: "La factura no existe." };
  }
  if (factura.estado_pago === "anulada") {
    return { ok: false, error: "No se puede pagar una factura anulada." };
  }
  if (factura.estado_pago === "pagada") {
    return { ok: false, error: "Esta factura ya está pagada." };
  }

  // Sin abonos: validar que el pago cubra el total congelado.
  const tasas = await getTasasVigentes(supabase);
  const pagadoEnMonedaFactura = convertir(
    monto,
    moneda_id,
    factura.moneda_id,
    tasas,
  );
  if (pagadoEnMonedaFactura === null) {
    return {
      ok: false,
      error:
        "No hay tasa de cambio vigente para esa moneda. Regístrala en Tasas de Cambio.",
    };
  }
  if (pagadoEnMonedaFactura < factura.total - 0.01) {
    return {
      ok: false,
      error: "El pago no cubre el total de la factura. Solo se aceptan pagos completos.",
    };
  }

  const { error: pagoErr } = await supabase.from("pagos").insert({
    factura_id,
    monto,
    moneda_id,
    metodo_pago,
  });
  if (pagoErr) {
    return { ok: false, error: friendlyDbError("registrar el pago") };
  }

  const { error: upErr } = await supabase
    .from("facturas")
    .update({ estado_pago: "pagada" })
    .eq("id", factura_id);
  if (upErr) {
    return { ok: false, error: friendlyDbError("actualizar el estado de la factura") };
  }

  touch(PATH);
  touch(`${PATH}/${factura_id}`);
  return { ok: true };
}

/** Anula una factura pendiente. Solo `administrador`. */
export async function anularFactura(id: string): Promise<ActionResult> {
  await requireRole("administrador");

  const supabase = await db();

  const { data: factura, error } = await supabase
    .from("facturas")
    .select("id, estado_pago")
    .eq("id", id)
    .single();
  if (error || !factura) {
    return { ok: false, error: "La factura no existe." };
  }
  if (factura.estado_pago === "anulada") {
    return { ok: false, error: "La factura ya está anulada." };
  }
  if (factura.estado_pago === "pagada") {
    return { ok: false, error: "No se puede anular una factura pagada." };
  }

  const { error: upErr } = await supabase
    .from("facturas")
    .update({ estado_pago: "anulada" })
    .eq("id", id);
  if (upErr) {
    return { ok: false, error: friendlyDbError("anular la factura") };
  }

  touch(PATH);
  touch(`${PATH}/${id}`);
  return { ok: true };
}