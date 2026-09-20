"use server";

import { requireUser } from "@/lib/auth/session";
import { requireEliminar } from "@/lib/auth/permisos";
import { z } from "zod";
import {
  ordenDetalleManoObraSchema,
  ordenDetalleRepuestoSchema,
  ordenServicioSchema,
  validate,
} from "@/lib/schemas";
import {
  db,
  friendlyDbError,
  touch,
  type ActionResult,
} from "@/lib/actions/_crud-helpers";

const PATH = "/ordenes";

/* ------------------------------------------------------------------ */
/* Formas de los datos que consumen los componentes                    */
/* ------------------------------------------------------------------ */

export type EstadoOrden = "recibido" | "en_proceso" | "terminado" | "entregado";

export interface OrdenRow {
  id: string;
  estado: string;
  fecha_ingreso: string;
  diagnostico: string | null;
  observaciones: string | null;
  cliente: { nombre: string; telefono: string | null } | null;
  moto: { marca: string; modelo: string; placa: string | null } | null;
  empleado_asignado: { nombre: string } | null;
}

export interface RepuestoDetalleOrden {
  id: string;
  cantidad: number;
  precio_unitario_aplicado: number;
  repuesto: { nombre: string; sku: string | null } | null;
  moneda: { simbolo: string } | null;
}

export interface ManoObraDetalleOrden {
  id: string;
  descripcion: string;
  monto: number;
  porcentaje_comision_aplicado: number | null;
  comision_calculada: number | null;
  ayudante_monto: number | null;
  empleado: { nombre: string } | null;
  moneda: { simbolo: string } | null;
  ayudante: { nombre: string } | null;
}

export interface OrdenDetalle {
  id: string;
  estado: EstadoOrden;
  fecha_ingreso: string;
  diagnostico: string | null;
  observaciones: string | null;
  empleado_asignado_id: string | null;
  cliente: {
    nombre: string;
    telefono: string | null;
    documento?: string | null;
  } | null;
  moto: {
    marca: string;
    modelo: string;
    placa: string | null;
    cilindraje: string | null;
    color: string | null;
  } | null;
  repuestos: RepuestoDetalleOrden[];
  mano_obra: ManoObraDetalleOrden[];
}

export async function listOrdenes(): Promise<OrdenRow[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("ordenes_servicio")
    .select(
      "*, cliente:clientes(nombre, telefono), moto:motos(marca, modelo, placa), empleado_asignado:empleados(nombre)",
    )
    .order("fecha_ingreso", { ascending: false });
  if (error) return [];
  return (data ?? []) as unknown as OrdenRow[];
}

export async function getOrdenById(id: string): Promise<OrdenDetalle | null> {
  const supabase = await db();
  const { data: orden, error: ordenErr } = await supabase
    .from("ordenes_servicio")
    .select(
      "*, cliente:clientes(*), moto:motos(*), empleado_asignado:empleados(id, nombre)",
    )
    .eq("id", id)
    .single();

  if (ordenErr || !orden) return null;

  const [{ data: repuestos }, { data: manoObra }] = await Promise.all([
    supabase
      .from("orden_detalle_repuestos")
      .select("*, repuesto:repuestos(nombre, sku), moneda:monedas(simbolo, codigo)")
      .eq("orden_id", id),
    supabase
      .from("orden_detalle_mano_obra")
      .select("*, empleado:empleados(nombre), moneda:monedas(simbolo, codigo)")
      .eq("orden_id", id),
  ]);

  // Resolver nombres de ayudantes (no se puede hacer JOIN a la misma tabla dos veces)
  const ayudanteIds = [...new Set(
    (manoObra ?? [])
      .map((m: Record<string, unknown>) => m.ayudante_id)
      .filter((aid): aid is string => !!aid),
  )];
  const ayudantesMap: Record<string, string> = {};
  if (ayudanteIds.length > 0) {
    const { data: ayudantes } = await supabase
      .from("empleados")
      .select("id, nombre")
      .in("id", ayudanteIds);
    for (const a of ayudantes ?? []) {
      ayudantesMap[a.id] = a.nombre;
    }
  }

  const manoObraConAyudante = (manoObra ?? []).map((m: Record<string, unknown>) => ({
    ...m,
    ayudante: m.ayudante_id ? { nombre: ayudantesMap[m.ayudante_id as string] ?? null } : null,
  }));

  return {
    ...(orden as unknown as OrdenDetalle),
    repuestos: (repuestos ?? []) as unknown as RepuestoDetalleOrden[],
    mano_obra: manoObraConAyudante as unknown as ManoObraDetalleOrden[],
  };
}

export async function createOrden(raw: unknown): Promise<ActionResult> {
  const parsed = validate(ordenServicioSchema, raw);
  if (!parsed.ok) return parsed;
  const supabase = await db();
  const { data, error } = await supabase
    .from("ordenes_servicio")
    .insert(parsed.data)
    .select()
    .single();
  if (error) return { ok: false, error: friendlyDbError("crear la orden de servicio") };
  touch(PATH);
  return { ok: true, data };
}

export async function updateOrden(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = validate(ordenServicioSchema, raw);
  if (!parsed.ok) return parsed;
  const supabase = await db();
  const { data, error } = await supabase
    .from("ordenes_servicio")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();
  if (error) return { ok: false, error: friendlyDbError("actualizar la orden de servicio") };
  touch(PATH);
  touch(`${PATH}/${id}`);
  return { ok: true, data };
}

const estadoOrdenSchema = z.enum(["recibido", "en_proceso", "terminado", "entregado"]);

export async function updateEstadoOrden(
  id: string,
  estado: "recibido" | "en_proceso" | "terminado" | "entregado",
): Promise<ActionResult> {
  const parsedEstado = estadoOrdenSchema.safeParse(estado);
  if (!parsedEstado.success) {
    return { ok: false, error: "El estado proporcionado no es válido." };
  }

  const supabase = await db();
  const updateData: {
    estado: "recibido" | "en_proceso" | "terminado" | "entregado";
    fecha_entrega_real?: string | null;
  } = { estado };

  if (estado === "entregado") {
    updateData.fecha_entrega_real = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("ordenes_servicio")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) return { ok: false, error: friendlyDbError("cambiar el estado de la orden") };
  touch(PATH);
  touch(`${PATH}/${id}`);
  return { ok: true, data };
}

export async function deleteOrden(id: string): Promise<ActionResult> {
  await requireEliminar("ordenes");
  const supabase = await db();
  const { error } = await supabase.from("ordenes_servicio").delete().eq("id", id);
  if (error)
    return {
      ok: false,
      error: "No se pudo eliminar la orden. Es posible que tenga repuestos, mano de obra o facturas asociadas.",
    };
  touch(PATH);
  return { ok: true };
}

/* ========================================================================== */
/* DETALLE DE REPUESTOS (Snapshot de precio y descuento automático de stock)   */
/* ========================================================================== */

export async function agregarRepuestoAOrden(raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = validate(ordenDetalleRepuestoSchema, raw);
  if (!parsed.ok) return parsed;

  const { orden_id, repuesto_id, cantidad } = parsed.data;
  const supabase = await db();

  // 1. Obtener datos actuales del repuesto para validar stock y tomar snapshot
  const { data: repuesto, error: repError } = await supabase
    .from("repuestos")
    .select("id, nombre, stock_actual, precio_venta, precio_costo, moneda_id, activo")
    .eq("id", repuesto_id)
    .single();

  if (repError || !repuesto) {
    return { ok: false, error: "El repuesto seleccionado no existe." };
  }

  if (!repuesto.activo) {
    return { ok: false, error: "El repuesto seleccionado está inactivo." };
  }

  if (repuesto.stock_actual < cantidad) {
    return {
      ok: false,
      error: `Stock insuficiente para '${repuesto.nombre}'. Disponible: ${repuesto.stock_actual}, solicitado: ${cantidad}.`,
    };
  }

  // 2. Insertar detalle con snapshot de precio_venta, costo y moneda_id
  const { data: detalle, error: insError } = await supabase
    .from("orden_detalle_repuestos")
    .insert({
      orden_id,
      repuesto_id,
      cantidad,
      precio_unitario_aplicado: repuesto.precio_venta,
      precio_costo_aplicado: repuesto.precio_costo ?? null,
      moneda_id: repuesto.moneda_id,
    })
    .select()
    .single();

  if (insError) {
    return { ok: false, error: friendlyDbError("agregar el repuesto a la orden") };
  }

  // 3. Registrar movimiento de salida en inventario (el trigger de la DB descuenta el stock)
  await supabase.from("movimientos_inventario").insert({
    repuesto_id,
    tipo: "salida",
    cantidad,
    motivo: `Uso en orden de servicio`,
    orden_id,
    usuario_id: user.id,
  });

  touch(`${PATH}/${orden_id}`);
  touch("/repuestos");
  touch("/inventario");
  return { ok: true, data: detalle };
}

export async function eliminarRepuestoDeOrden(
  detalleId: string,
  ordenId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await db();

  // 1. Consultar el detalle para saber qué repuesto y cantidad devolver
  const { data: detalle, error: getErr } = await supabase
    .from("orden_detalle_repuestos")
    .select("repuesto_id, cantidad")
    .eq("id", detalleId)
    .single();

  if (getErr || !detalle) {
    return { ok: false, error: "No se encontró el registro del repuesto en la orden." };
  }

  // 2. Eliminar el registro del detalle
  const { error: delErr } = await supabase
    .from("orden_detalle_repuestos")
    .delete()
    .eq("id", detalleId);

  if (delErr) {
    return { ok: false, error: friendlyDbError("eliminar el repuesto de la orden") };
  }

  // 3. Registrar movimiento de entrada de reposición (el trigger suma de vuelta al stock)
  await supabase.from("movimientos_inventario").insert({
    repuesto_id: detalle.repuesto_id,
    tipo: "entrada",
    cantidad: detalle.cantidad,
    motivo: "Devolución / retiro de repuesto de orden de servicio",
    orden_id: ordenId,
    usuario_id: user.id,
  });

  touch(`${PATH}/${ordenId}`);
  touch("/repuestos");
  touch("/inventario");
  return { ok: true };
}

/* ========================================================================== */
/* DETALLE DE MANO DE OBRA (Snapshot de comisión y cálculo automático)         */
/* ========================================================================== */

export async function agregarManoObraAOrden(raw: unknown): Promise<ActionResult> {
  const parsed = validate(ordenDetalleManoObraSchema, raw);
  if (!parsed.ok) return parsed;

  const { orden_id, empleado_id, descripcion, monto, moneda_id } = parsed.data;
  const supabase = await db();

  // Validar que la orden esté en estado modificable
  const { data: orden } = await supabase
    .from("ordenes_servicio")
    .select("estado")
    .eq("id", orden_id)
    .single();
  if (!orden) return { ok: false, error: "La orden no existe." };
  if (orden.estado === "entregado") {
    return { ok: false, error: "No se puede agregar mano de obra a una orden entregada." };
  }

  // 1. Obtener comisión configurada en el empleado si no vino explícita
  let porcentajeComision = parsed.data.porcentaje_comision_aplicado ?? null;
  if (porcentajeComision === null || porcentajeComision === undefined) {
    const { data: empleado } = await supabase
      .from("empleados")
      .select("porcentaje_comision")
      .eq("id", empleado_id)
      .single();
    porcentajeComision = empleado?.porcentaje_comision ?? null;
  }

  // 2. Calcular la comisión: si hay monto_a_pagar, usarlo directamente;
  //    si no, calcular desde el porcentaje
  const montoAPagar = parsed.data.monto_a_pagar ?? null;
  let comisionCalculada: number | null = null;

  if (montoAPagar !== null && montoAPagar !== undefined) {
    // Monto manual: el mecánico gana lo que se especificó
    comisionCalculada = montoAPagar;
  } else if (porcentajeComision !== null && porcentajeComision !== undefined) {
    // Cálculo automático desde porcentaje
    comisionCalculada = Number(((monto * porcentajeComision) / 100).toFixed(2));
  }

  // 3. Datos del ayudante (opcional)
  const ayudanteId = parsed.data.ayudante_id ?? null;
  const ayudanteMonto = parsed.data.ayudante_monto ?? null;

  // 4. Insertar detalle de mano de obra
  const { data: detalle, error } = await supabase
    .from("orden_detalle_mano_obra")
    .insert({
      orden_id,
      empleado_id,
      descripcion,
      monto,
      moneda_id,
      porcentaje_comision_aplicado: porcentajeComision,
      comision_calculada: comisionCalculada,
      ayudante_id: ayudanteId,
      ayudante_monto: ayudanteMonto,
    })
    .select()
    .single();

  if (error) {
    return { ok: false, error: friendlyDbError("agregar la mano de obra a la orden") };
  }

  touch(`${PATH}/${orden_id}`);
  return { ok: true, data: detalle };
}

export async function eliminarManoObraDeOrden(
  detalleId: string,
  ordenId: string,
): Promise<ActionResult> {
  await requireEliminar("ordenes");
  const supabase = await db();
  const { error } = await supabase
    .from("orden_detalle_mano_obra")
    .delete()
    .eq("id", detalleId);

  if (error) {
    return { ok: false, error: friendlyDbError("eliminar la mano de obra") };
  }

  touch(`${PATH}/${ordenId}`);
  return { ok: true };
}
