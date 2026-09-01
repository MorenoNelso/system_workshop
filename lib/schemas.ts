import { z } from "zod";

import {
  optionalText,
  sanitizeEmail,
  sanitizeParagraph,
  sanitizePhone,
  sanitizeText,
} from "@/lib/sanitize";

/** Valida `raw` contra un schema. Devuelve datos limpios o el primer error amigable. */
export function validate<T>(
  schema: z.ZodType<T>,
  raw: unknown,
): { ok: true; data: T } | { ok: false; error: string } {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0]?.message;
    return { ok: false, error: first ?? "Los datos enviados no son válidos." };
  }
  return { ok: true, data: result.data };
}

/* ---------- Preprocesadores ---------- */

const text = (max: number, required = true) =>
  z.preprocess(
    (v) => sanitizeText(v, max),
    required ? z.string().min(1) : z.string(),
  );

const paragraph = (max: number) =>
  z.preprocess((v) => sanitizeParagraph(v, max), z.string());

const optionalNullable = z.preprocess(
  (v) => optionalText(v),
  z.string().nullable(),
);

/** UUID obligatorio (select). */
const id = z.string().uuid();

/** UUID opcional: cadena vacía o ausente → null. */
const optionalId = z.preprocess(
  (v) =>
    v === undefined || (typeof v === "string" && v.trim() === "")
      ? null
      : v,
  z.string().uuid().nullable(),
);

const optionalNumber = z.preprocess(
  (v) =>
    v === undefined || v === null || (typeof v === "string" && v.trim() === "")
      ? null
      : Number(v),
  z.number().nullable(),
);

/* ---------- Schemas por módulo ---------- */

export const clienteSchema = z.object({
  nombre: text(100),
  telefono: z.preprocess(sanitizePhone, z.string().min(1).max(20)),
  email: z.preprocess(
    (v) => {
      const e = sanitizeEmail(v);
      return e === "" ? null : e;
    },
    z.string().email("El correo no es válido.").max(150).nullable(),
  ),
  documento: optionalNullable,
  direccion: paragraph(500).nullable(),
});

export const motoSchema = z.object({
  cliente_id: id,
  marca: text(50),
  modelo: text(50),
  anio: optionalNumber.refine(
    (v) => v === null || (Number.isInteger(v) && v >= 1900 && v <= 2100),
    { message: "El año no es válido." },
  ),
  placa: optionalNullable,
  cilindraje: optionalNullable,
  color: optionalNullable,
  notas: paragraph(500).nullable(),
});

export const categoriaSchema = z.object({
  nombre: text(60),
});

export const proveedorSchema = z.object({
  nombre: text(100),
  contacto: optionalNullable,
  telefono: optionalNullable,
  email: z.preprocess(
    (v) => {
      const e = sanitizeEmail(v);
      return e === "" ? null : e;
    },
    z.string().email("El correo no es válido.").max(150).nullable(),
  ),
  direccion: paragraph(500).nullable(),
});

export const repuestoSchema = z.object({
  nombre: text(150),
  sku: optionalNullable,
  categoria_id: optionalId,
  proveedor_id: optionalId,
  stock_actual: z.coerce
    .number({ message: "El stock debe ser un número." })
    .int()
    .min(0, "El stock no puede ser negativo.")
    .default(0),
  stock_minimo: z.coerce
    .number({ message: "El stock mínimo debe ser un número." })
    .int()
    .min(0)
    .default(1),
  precio_costo: optionalNumber,
  precio_venta: z.coerce
    .number({ message: "El precio de venta es obligatorio." })
    .min(0, "El precio no puede ser negativo."),
  moneda_id: id,
  activo: z.boolean().default(true),
});

export const empleadoSchema = z.object({
  usuario_id: optionalId,
  nombre: text(100),
  documento: optionalNullable,
  telefono: optionalNullable,
  tipo_vinculacion: z.enum(["salario_fijo", "comision", "mixto"], {
    message: "El tipo de vinculación debe ser salario fijo, comisión o mixto.",
  }),
  salario_base: optionalNumber,
  moneda_salario_id: optionalId,
  porcentaje_comision: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : Number(v)),
    z
      .number({ message: "El porcentaje de comisión debe ser un número." })
      .min(0, "El porcentaje no puede ser negativo.")
      .max(100, "El porcentaje no puede superar 100.")
      .nullable(),
  ),
  activo: z.boolean().default(true),
});

export const ordenServicioSchema = z.object({
  moto_id: id,
  cliente_id: id,
  empleado_asignado_id: optionalId,
  estado: z
    .enum(["recibido", "en_proceso", "terminado", "entregado"], {
      message: "Estado de orden no válido.",
    })
    .default("recibido"),
  diagnostico: paragraph(1000).nullable(),
  observaciones: paragraph(1000).nullable(),
  fecha_entrega_estimada: optionalNullable,
  fecha_entrega_real: optionalNullable,
});

export const ordenDetalleRepuestoSchema = z.object({
  orden_id: id,
  repuesto_id: id,
  cantidad: z.coerce
    .number({ message: "La cantidad debe ser un número entero mayor a 0." })
    .int()
    .min(1, "La cantidad mínima es 1."),
});

export const ordenDetalleManoObraSchema = z.object({
  orden_id: id,
  empleado_id: id,
  descripcion: text(200),
  monto: z.coerce
    .number({ message: "El monto es obligatorio." })
    .min(0, "El monto no puede ser negativo."),
  moneda_id: id,
  porcentaje_comision_aplicado: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : Number(v)),
    z.number().min(0).max(100).nullable().optional(),
  ),
});

export const movimientoInventarioSchema = z.object({
  repuesto_id: id,
  tipo: z.enum(["entrada", "salida", "ajuste"], {
    message: "El tipo de movimiento no es válido.",
  }),
  cantidad: z.coerce
    .number({ message: "La cantidad debe ser un número." })
    .int(),
  motivo: optionalNullable,
  orden_id: optionalId,
});

export const tasaCambioSchema = z
  .object({
    moneda_origen_id: id,
    moneda_destino_id: id,
    tasa: z.coerce
      .number({ message: "La tasa debe ser un número." })
      .positive("La tasa debe ser mayor a 0."),
  })
  .refine((d) => d.moneda_origen_id !== d.moneda_destino_id, {
    message: "La moneda de origen y destino deben ser distintas.",
    path: ["moneda_destino_id"],
  });

export const facturaCreateSchema = z.object({
  orden_id: id,
  moneda_id: id,
});

export const facturaDirectaSchema = z
  .object({
    cliente_id: id,
    moneda_id: id,
    repuestos: z
      .array(
        z.object({
          repuesto_id: id,
          cantidad: z.coerce
            .number({ message: "La cantidad debe ser un número entero mayor a 0." })
            .int()
            .min(1, "La cantidad mínima es 1."),
        }),
      )
      .default([]),
    servicios: z
      .array(
        z.object({
          descripcion: text(200),
          monto: z.coerce
            .number({ message: "El monto es obligatorio." })
            .min(0, "El monto no puede ser negativo."),
          moneda_id: id,
          empleado_id: optionalId,
        }),
      )
      .default([]),
  })
  .refine((d) => d.repuestos.length > 0 || d.servicios.length > 0, {
    message: "Agrega al menos un repuesto o un servicio para facturar.",
    path: ["repuestos"],
  });

export const pagoSchema = z.object({
  factura_id: id,
  monto: z.coerce
    .number({ message: "El monto es obligatorio." })
    .positive("El monto debe ser mayor a 0."),
  moneda_id: id,
  metodo_pago: z.enum(["efectivo", "transferencia", "tarjeta"], {
    message: "El método de pago no es válido.",
  }),
});

export type ClienteInput = z.infer<typeof clienteSchema>;
export type MotoInput = z.infer<typeof motoSchema>;
export type CategoriaInput = z.infer<typeof categoriaSchema>;
export type ProveedorInput = z.infer<typeof proveedorSchema>;
export type RepuestoInput = z.infer<typeof repuestoSchema>;
export type EmpleadoInput = z.infer<typeof empleadoSchema>;
export type OrdenServicioInput = z.infer<typeof ordenServicioSchema>;
export type OrdenDetalleRepuestoInput = z.infer<typeof ordenDetalleRepuestoSchema>;
export type OrdenDetalleManoObraInput = z.infer<typeof ordenDetalleManoObraSchema>;
export type MovimientoInventarioInput = z.infer<typeof movimientoInventarioSchema>;
export type TasaCambioInput = z.infer<typeof tasaCambioSchema>;
export type FacturaCreateInput = z.infer<typeof facturaCreateSchema>;
export type FacturaDirectaInput = z.infer<typeof facturaDirectaSchema>;
export type PagoInput = z.infer<typeof pagoSchema>;

