import { describe, expect, it } from "vitest";

import { calcularGanancia } from "@/lib/facturas-utils";

describe("calcularGanancia", () => {
  it("repuesto sin mano de obra: ganancia = venta - costo", () => {
    const res = calcularGanancia(
      [{ cantidad: 1, precioVenta: 15, precioCosto: 10 }],
      [],
    );
    expect(res.ingreso).toBe(15);
    expect(res.egreso).toBe(10);
    expect(res.ganancia).toBe(5);
  });

  it("repuesto + trabajo sin mecánico: ganancia = 7 (15-10+2)", () => {
    const res = calcularGanancia(
      [{ cantidad: 1, precioVenta: 15, precioCosto: 10 }],
      [{ monto: 2, comision: null }],
    );
    expect(res.ingreso).toBe(17);
    expect(res.ganancia).toBe(7);
  });

  it("repuesto + trabajo hecho por mecánico que se lleva el trabajo: ganancia del taller = 5", () => {
    const res = calcularGanancia(
      [{ cantidad: 1, precioVenta: 15, precioCosto: 10 }],
      [{ monto: 2, comision: 2 }],
    );
    expect(res.ingreso).toBe(17);
    expect(res.egreso).toBe(10);
    expect(res.comision).toBe(2);
    expect(res.ganancia).toBe(5);
  });

  it("múltiples unidades y repuestos", () => {
    const res = calcularGanancia(
      [
        { cantidad: 2, precioVenta: 15, precioCosto: 10 },
        { cantidad: 1, precioVenta: 8, precioCosto: 4 },
      ],
      [{ monto: 5, comision: 1 }],
    );
    // ingreso: 2*15 + 8 + 5 = 43
    // egreso: 2*10 + 4 = 24
    // comision: 1
    expect(res.ingreso).toBe(43);
    expect(res.egreso).toBe(24);
    expect(res.comision).toBe(1);
    expect(res.ganancia).toBe(18);
  });

  it("repuesto sin costo registrado: egreso no suma", () => {
    const res = calcularGanancia(
      [{ cantidad: 1, precioVenta: 15, precioCosto: null }],
      [],
    );
    expect(res.egreso).toBe(0);
    expect(res.ganancia).toBe(15);
  });

  it("solo mano de obra (sin repuestos)", () => {
    const res = calcularGanancia([], [{ monto: 10, comision: null }]);
    expect(res.ingreso).toBe(10);
    expect(res.ganancia).toBe(10);
  });
});