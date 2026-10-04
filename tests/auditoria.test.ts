import { describe, expect, it } from "vitest";

import { describirCambio, etiquetaTabla } from "@/lib/auditoria-utils";
import type { LogAuditoria } from "@/lib/actions/auditoria";

function log(parcial: Partial<LogAuditoria>): LogAuditoria {
  return {
    id: "log-1",
    usuario_id: null,
    nombre_usuario: "Admin",
    tabla_afectada: "facturas",
    accion: "insert",
    datos_anteriores: null,
    datos_nuevos: null,
    fecha: "2026-10-04T00:00:00.000Z",
    ...parcial,
  };
}

const ctx = {
  clientes: { "cli-1": "Juan Pérez" },
  facturas: { "fac-1": 21 },
  monedas: { "mon-1": "$" },
};

describe("describirCambio", () => {
  it("emisión de factura con número, total y cliente (sin UUIDs)", () => {
    const texto = describirCambio(
      log({
        tabla_afectada: "facturas",
        accion: "insert",
        datos_nuevos: {
          numero_consecutivo: 21,
          total: 526400,
          moneda_id: "mon-1",
          cliente_id: "cli-1",
          orden_id: "ord-9",
        },
      }),
      ctx,
    );
    expect(texto).toContain("#21");
    expect(texto).toContain("526400");
    expect(texto).toContain("Juan Pérez");
    expect(texto).not.toContain("ord-9");
    expect(texto).not.toContain("cli-1");
    expect(texto).not.toContain("mon-1");
  });

  it("registro de pago con método y factura", () => {
    const texto = describirCambio(
      log({
        tabla_afectada: "pagos",
        accion: "insert",
        datos_nuevos: {
          factura_id: "fac-1",
          monto: 100000,
          moneda_id: "mon-1",
          metodo_pago: "efectivo",
        },
      }),
      ctx,
    );
    expect(texto).toContain("100000");
    expect(texto).toContain("efectivo");
    expect(texto).toContain("#21");
  });

  it("cobro: pendiente → pagada", () => {
    const texto = describirCambio(
      log({
        tabla_afectada: "facturas",
        accion: "update",
        datos_anteriores: { estado_pago: "pendiente" },
        datos_nuevos: { estado_pago: "pagada", total: 50000, moneda_id: "mon-1" },
      }),
      ctx,
    );
    expect(texto).toContain("Cobró");
  });

  it("anulación con motivo y reversión", () => {
    const texto = describirCambio(
      log({
        tabla_afectada: "facturas",
        accion: "update",
        datos_anteriores: { estado_pago: "pagada" },
        datos_nuevos: {
          estado_pago: "anulada",
          operacion: "anular_pagada",
          motivo: "duplicada",
          pago_reversado: true,
          numero_consecutivo: 8,
        },
      }),
      ctx,
    );
    expect(texto).toContain("Anuló");
    expect(texto).toContain("#8");
    expect(texto).toContain("duplicada");
  });

  it("ajuste de stock legible", () => {
    const texto = describirCambio(
      log({
        tabla_afectada: "repuestos",
        accion: "update",
        datos_anteriores: { nombre: "Bujía", stock_actual: 8 },
        datos_nuevos: { nombre: "Bujía", stock_actual: 7 },
      }),
      ctx,
    );
    expect(texto).toContain("Bujía");
    expect(texto).toContain("8");
    expect(texto).toContain("7");
  });

  it("sin ctx usa textos genéricos (no rompe)", () => {
    const texto = describirCambio(
      log({
        tabla_afectada: "facturas",
        accion: "insert",
        datos_nuevos: { total: 1000 },
      }),
    );
    expect(typeof texto).toBe("string");
    expect(texto.length).toBeGreaterThan(0);
  });
});

describe("etiquetaTabla", () => {
  it("mapea tablas conocidas y devuelve el resto tal cual", () => {
    expect(etiquetaTabla("facturas")).toBe("Factura");
    expect(etiquetaTabla("deducciones_mecanico")).toBe("Deducción");
    expect(etiquetaTabla("tabla_rara")).toBe("tabla_rara");
  });
});
