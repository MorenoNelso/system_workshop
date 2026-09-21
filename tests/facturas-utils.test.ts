import { describe, expect, it } from "vitest";

import {
  ordenYaTieneFactura,
  ordenEsFacturable,
  esErrorFacturaDuplicada,
  calcularGanancia,
  ESTADOS_FACTURABLES,
} from "@/lib/facturas-utils";

describe("ordenYaTieneFactura", () => {
  it("false cuando es null", () => expect(ordenYaTieneFactura(null)).toBe(false));
  it("false cuando es undefined", () => expect(ordenYaTieneFactura(undefined)).toBe(false));
  it("false cuando el array está vacío", () => expect(ordenYaTieneFactura([])).toBe(false));
  it("true cuando el array tiene items", () => expect(ordenYaTieneFactura([{ id: "1" }])).toBe(true));
  it("true cuando es un objeto", () => expect(ordenYaTieneFactura({ id: "1" })).toBe(true));
});

describe("ordenEsFacturable", () => {
  it("true para terminado", () => expect(ordenEsFacturable("terminado")).toBe(true));
  it("true para entregado", () => expect(ordenEsFacturable("entregado")).toBe(true));
  it("false para recibido", () => expect(ordenEsFacturable("recibido")).toBe(false));
  it("false para en_proceso", () => expect(ordenEsFacturable("en_proceso")).toBe(false));
  it("false para estado desconocido", () => expect(ordenEsFacturable("xyz")).toBe(false));
  it("ESTADOS_FACTURABLES tiene exactamente 2 items", () => {
    expect(ESTADOS_FACTURABLES).toHaveLength(2);
  });
});

describe("esErrorFacturaDuplicada", () => {
  it("false para null", () => expect(esErrorFacturaDuplicada(null)).toBe(false));
  it("true para code 23505", () =>
    expect(esErrorFacturaDuplicada({ code: "23505", message: "" })).toBe(true));
  it("true para 'duplicate' en message", () =>
    expect(esErrorFacturaDuplicada({ message: "duplicate key" })).toBe(true));
  it("true para 'ya existe' en message", () =>
    expect(esErrorFacturaDuplicada({ message: "el registro ya existe" })).toBe(true));
  it("true para 'already exists' en message", () =>
    expect(esErrorFacturaDuplicada({ message: "row already exists" })).toBe(true));
  it("false para error no relacionado", () =>
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
    expect(result.ingreso).toBe(450);
    expect(result.egreso).toBe(120);
    expect(result.comision).toBe(30);
    expect(result.ganancia).toBe(300);
  });

  it("maneja arrays vacíos", () => {
    const result = calcularGanancia([], []);
    expect(result).toEqual({ ingreso: 0, egreso: 0, comision: 0, ganancia: 0 });
  });

  it("maneja precioCosto null", () => {
    const result = calcularGanancia(
      [{ cantidad: 1, precioVenta: 100, precioCosto: null }],
      [],
    );
    expect(result.ingreso).toBe(100);
    expect(result.egreso).toBe(0);
    expect(result.ganancia).toBe(100);
  });
});
