import { describe, expect, it } from "vitest";

import {
  ordenYaTieneFactura,
  ordenEsFacturable,
  esErrorFacturaDuplicada,
  calcularGanancia,
  ESTADOS_FACTURABLES,
} from "@/lib/facturas-utils";

describe("ordenYaTieneFactura", () => {
  it("false when null", () => expect(ordenYaTieneFactura(null)).toBe(false));
  it("false when undefined", () => expect(ordenYaTieneFactura(undefined)).toBe(false));
  it("false when empty array", () => expect(ordenYaTieneFactura([])).toBe(false));
  it("true when array with items", () => expect(ordenYaTieneFactura([{ id: "1" }])).toBe(true));
  it("true when object", () => expect(ordenYaTieneFactura({ id: "1" })).toBe(true));
});

describe("ordenEsFacturable", () => {
  it("true for terminado", () => expect(ordenEsFacturable("terminado")).toBe(true));
  it("true for entregado", () => expect(ordenEsFacturable("entregado")).toBe(true));
  it("false for recibido", () => expect(ordenEsFacturable("recibido")).toBe(false));
  it("false for en_proceso", () => expect(ordenEsFacturable("en_proceso")).toBe(false));
  it("false for unknown", () => expect(ordenEsFacturable("xyz")).toBe(false));
  it("ESTADOS_FACTURABLES has exactly 2 items", () => {
    expect(ESTADOS_FACTURABLES).toHaveLength(2);
  });
});

describe("esErrorFacturaDuplicada", () => {
  it("false for null", () => expect(esErrorFacturaDuplicada(null)).toBe(false));
  it("true for code 23505", () =>
    expect(esErrorFacturaDuplicada({ code: "23505", message: "" })).toBe(true));
  it("true for 'duplicate' in message", () =>
    expect(esErrorFacturaDuplicada({ message: "duplicate key" })).toBe(true));
  it("true for 'ya existe' in message", () =>
    expect(esErrorFacturaDuplicada({ message: "el registro ya existe" })).toBe(true));
  it("true for 'already exists' in message", () =>
    expect(esErrorFacturaDuplicada({ message: "row already exists" })).toBe(true));
  it("false for unrelated error", () =>
    expect(esErrorFacturaDuplicada({ code: "23503", message: "foreign key" })).toBe(false));
});

describe("calcularGanancia", () => {
  it("calcula ingreso, egreso, comision y ganancia", () => {
    const result = calcularGanancia(
      [
        { cantidad: 2, precioVenta: 100, precioCosto: 60 },
        { cantidad: 1, precioVenta: 50, precioCosto: null },
      ],
      [{ monto: 200, comision: 30 }],
    );
    expect(result.ingreso).toBe(450); // 200 + 50 + 200
    expect(result.egreso).toBe(120); // 120 + 0
    expect(result.comision).toBe(30);
    expect(result.ganancia).toBe(300); // 450 - 120 - 30
  });

  it("handles empty arrays", () => {
    const result = calcularGanancia([], []);
    expect(result).toEqual({ ingreso: 0, egreso: 0, comision: 0, ganancia: 0 });
  });

  it("handles null precioCosto", () => {
    const result = calcularGanancia(
      [{ cantidad: 1, precioVenta: 100, precioCosto: null }],
      [],
    );
    expect(result.ingreso).toBe(100);
    expect(result.egreso).toBe(0);
    expect(result.ganancia).toBe(100);
  });
});
