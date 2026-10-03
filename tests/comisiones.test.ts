import { describe, expect, it } from "vitest";

import { calcularComision, repartirManoObra } from "@/lib/comisiones";

describe("calcularComision", () => {
  it("el monto fijo gana sobre el porcentaje", () => {
    expect(calcularComision(200, 30, 40)).toBe(40);
  });

  it("calcula el porcentaje con redondeo a 2 decimales", () => {
    expect(calcularComision(100, 30, null)).toBe(30);
    expect(calcularComision(200, 30, undefined)).toBe(60);
    expect(calcularComision(50, 30, null)).toBe(15);
    // 99.99 * 33.33 / 100 = 33.326667 → 33.33
    expect(calcularComision(99.99, 33.33, null)).toBe(33.33);
  });

  it("0 es válido y distinto de null", () => {
    expect(calcularComision(100, 0, null)).toBe(0);
    expect(calcularComision(100, 30, 0)).toBe(0);
  });

  it("sin porcentaje ni monto fijo devuelve null (no cero)", () => {
    expect(calcularComision(100, null, null)).toBeNull();
    expect(calcularComision(100, undefined, undefined)).toBeNull();
  });
});

describe("repartirManoObra", () => {
  it("reparte cliente/mecánico/ayudante/taller (modelo 2: 200/40/160)", () => {
    expect(repartirManoObra(200, 40, 0)).toEqual({ mecanico: 40, ayudante: 0, taller: 160 });
  });

  it("trata null como 0 y redondea el taller", () => {
    expect(repartirManoObra(100, null, null)).toEqual({ mecanico: 0, ayudante: 0, taller: 100 });
    expect(repartirManoObra(10, 3.33, 1.11)).toEqual({ mecanico: 3.33, ayudante: 1.11, taller: 5.56 });
  });
});
