import type { LogAuditoria } from "@/lib/actions/auditoria";
import { fmtMonto } from "@/lib/currency";

type Datos = Record<string, unknown>;

/** Nombres resueltos en lote para no mostrar UUIDs crudos. Todo opcional. */
export interface AuditoriaCtx {
  clientes?: Record<string, string>;
  facturas?: Record<string, number>;
  monedas?: Record<string, string>;
}

/** Claves técnicas que nunca se muestran tal cual (UUIDs, snapshots internos). */
const IDS_TECNICOS = new Set([
  "id",
  "orden_id",
  "cliente_id",
  "moneda_id",
  "usuario_id",
  "factura_id",
  "empleado_id",
  "repuesto_id",
  "registrado_por",
  "tasa_aplicada",
  "fecha_emision",
]);

/** Claves que representan dinero y se formatean con símbolo. */
const ES_DINERO = /monto|total|costo|precio|comision/i;

function dinero(v: unknown, monedaId: unknown, ctx: AuditoriaCtx): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const sim =
    typeof monedaId === "string" ? (ctx.monedas?.[monedaId] ?? "$") : "$";
  return `${sim} ${fmtMonto(n)}`;
}

function fmtValor(clave: string, v: unknown, monedaId: unknown, ctx: AuditoriaCtx): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (ES_DINERO.test(clave)) return dinero(v, monedaId, ctx);
  if (clave === "estado_pago" || clave === "estado") return etiquetaEstado(String(v));
  return String(v);
}

function etiquetaEstado(estado: string): string {
  const mapa: Record<string, string> = {
    pendiente: "pendiente",
    cuotas: "en cuotas",
    pagada: "pagada",
    anulada: "anulada",
    recibido: "recibida",
    en_proceso: "en proceso",
    terminado: "terminada",
    entregado: "entregada",
  };
  return mapa[estado] ?? estado;
}

function nombreCliente(d: Datos, ctx: AuditoriaCtx): string {
  const id = d.cliente_id;
  if (typeof id === "string" && ctx.clientes?.[id]) return ctx.clientes[id];
  return "el cliente";
}

function numeroFactura(d: Datos, ctx: AuditoriaCtx): string {
  const n = d.numero_consecutivo;
  if (typeof n === "number") return `#${n}`;
  const fid = d.factura_id ?? d.id;
  if (typeof fid === "string" && ctx.facturas?.[fid] !== undefined) {
    return `#${ctx.facturas[fid]}`;
  }
  return "la factura";
}

function monedaDe(...dss: Datos[]): unknown {
  for (const d of dss) {
    if (typeof d.moneda_id === "string") return d.moneda_id;
  }
  return null;
}

/** Frase legible de lo que pasó. Nunca muestra UUIDs crudos. */
export function describirCambio(log: LogAuditoria, ctx: AuditoriaCtx = {}): string {
  const antes: Datos = log.datos_anteriores ?? {};
  const despues: Datos = log.datos_nuevos ?? {};
  const tabla = log.tabla_afectada;

  if (log.accion === "insert") {
    if (tabla === "facturas") {
      return `Emitió factura ${numeroFactura(despues, ctx)} por ${dinero(despues.total, despues.moneda_id, ctx)} a ${nombreCliente(despues, ctx)}`;
    }
    if (tabla === "pagos") {
      const metodo =
        typeof despues.metodo_pago === "string" && despues.metodo_pago
          ? ` (${despues.metodo_pago})`
          : "";
      return `Registró pago de ${dinero(despues.monto, despues.moneda_id, ctx)}${metodo} en factura ${numeroFactura(despues, ctx)}`;
    }
    if (tabla === "repuestos") {
      const nombre = typeof despues.nombre === "string" ? despues.nombre : "repuesto";
      return `Creó el repuesto ${nombre}`;
    }
    if (tabla === "empleados") {
      const nombre = typeof despues.nombre === "string" ? despues.nombre : "empleado";
      return `Registró al empleado ${nombre}`;
    }
    if (tabla === "tasas_cambio") return "Registró tasa de cambio";
    return "Creó el registro";
  }

  if (log.accion === "delete") {
    if (tabla === "facturas") return `Eliminó factura ${numeroFactura(antes, ctx)}`;
    if (tabla === "pagos") {
      return `Eliminó pago de ${dinero(antes.monto, antes.moneda_id, ctx)} en factura ${numeroFactura(antes, ctx)}`;
    }
    if (tabla === "repuestos" && typeof antes.nombre === "string") {
      return `Eliminó el repuesto ${antes.nombre}`;
    }
    if (tabla === "empleados" && typeof antes.nombre === "string") {
      return `Eliminó al empleado ${antes.nombre}`;
    }
    return "Eliminó el registro";
  }

  // update
  if (tabla === "facturas") {
    if (typeof despues.operacion === "string" && despues.operacion.startsWith("anular")) {
      const motivo =
        typeof despues.motivo === "string" && despues.motivo ? ` — motivo: ${despues.motivo}` : "";
      const reverso =
        despues.pago_reversado === true ? " (pago reversado)" : "";
      return `Anuló factura ${numeroFactura(despues, ctx)}${reverso}${motivo}`;
    }
    if (antes.estado_pago === "pendiente" && despues.estado_pago === "pagada") {
      return `Cobró factura ${numeroFactura(despues, ctx)} por ${dinero(despues.total, despues.moneda_id, ctx)}`;
    }
    if (antes.estado_pago !== despues.estado_pago && despues.estado_pago !== undefined) {
      return `Cambió factura ${numeroFactura(despues, ctx)} a ${etiquetaEstado(String(despues.estado_pago))}`;
    }
  }
  if (tabla === "repuestos" && antes.stock_actual !== despues.stock_actual) {
    const nombre =
      typeof despues.nombre === "string"
        ? despues.nombre
        : typeof antes.nombre === "string"
          ? antes.nombre
          : "repuesto";
    return `Ajustó stock de ${nombre}: ${fmtValor("n", antes.stock_actual, null, ctx)} → ${fmtValor("n", despues.stock_actual, null, ctx)}`;
  }

  // Genérico: solo campos relevantes (sin ids técnicos).
  const moneda = monedaDe(despues, antes);
  const cambios: string[] = [];
  for (const [clave, valorNuevo] of Object.entries(despues)) {
    if (IDS_TECNICOS.has(clave) || clave === "operacion" || clave === "motivo" || clave === "pago_reversado")
      continue;
    const valorAnterior = antes[clave];
    if (JSON.stringify(valorAnterior) !== JSON.stringify(valorNuevo)) {
      const etiqueta = clave === "estado_pago" || clave === "estado" ? "estado" : clave.replace(/_/g, " ");
      cambios.push(
        `${etiqueta}: ${fmtValor(clave, valorAnterior, moneda, ctx)} → ${fmtValor(clave, valorNuevo, moneda, ctx)}`,
      );
    }
  }
  if (cambios.length > 0) return cambios.slice(0, 3).join(" · ");
  const nombreEntidad =
    (typeof despues.nombre === "string" && despues.nombre) ||
    (typeof antes.nombre === "string" && antes.nombre);
  return nombreEntidad ? `Modificó ${nombreEntidad}` : "Modificó el registro";
}

/** Etiqueta legible para cada tabla. */
export function etiquetaTabla(tabla: string): string {
  const mapa: Record<string, string> = {
    facturas: "Factura",
    pagos: "Pago",
    repuestos: "Repuesto",
    tasas_cambio: "Tasa de cambio",
    empleados: "Empleado",
    factura_detalle_servicios: "Servicio facturado",
    factura_detalle_repuestos: "Repuesto facturado",
    ordenes_servicio: "Orden",
    orden_detalle_repuestos: "Repuesto en orden",
    orden_detalle_mano_obra: "Mano de obra",
    clientes: "Cliente",
    motos: "Moto",
    deducciones_mecanico: "Deducción",
    gastos: "Gasto",
    usuarios: "Usuario",
    monedas: "Moneda",
    categorias_repuesto: "Categoría",
    proveedores: "Proveedor",
  };
  return mapa[tabla] ?? tabla;
}
