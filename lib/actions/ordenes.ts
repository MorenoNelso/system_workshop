"use server";

import { requireUser } from "@/lib/auth/session";
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
  empleado: { nombre: string } | null;
  moneda: { simbolo: string } | null;
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
      "*, cliente:clientes(*), moto:motos(*), empleado_asignado:empleados(*)",
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

  return {
    ...(orden as unknown as OrdenDetalle),
    repuestos: (repuestos ?? []) as unknown as RepuestoDetalleOrden[],
    mano_obra: (manoObra ?? []) as unknown as ManoObraDetalleOrden[],
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

export async function updateEstadoOrden(
  id: string,
  estado: "recibido" | "en_proceso" | "terminado" | "entregado",
): Promise<ActionResult> {
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
    .select("id, nombre, stock_actual, precio_venta, moneda_id, activo")
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

  // 2. Insertar detalle con snapshot de precio_venta y moneda_id
  const { data: detalle, error: insError } = await supabase
    .from("orden_detalle_repuestos")
    .insert({
      orden_id,
      repuesto_id,
      cantidad,
      precio_unitario_aplicado: repuesto.precio_venta,
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

  // 2. Calcular la comisión snapshot
  const comisionCalculada =
    porcentajeComision !== null && porcentajeComision !== undefined
      ? Number(((monto * porcentajeComision) / 100).toFixed(2))
      : null;

  // 3. Insertar detalle de mano de obra
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
