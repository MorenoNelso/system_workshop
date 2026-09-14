import { describe, expect, it } from "vitest";

import { construirTasasVigentes, convertir, fmtMonto } from "@/lib/currency";

describe("construirTasasVigentes", () => {
  const U = () => crypto.randomUUID();

  it("deja la tasa más reciente por par (orden descendente ya aplicado)", () => {
    const filas = [
      { moneda_origen_id: "a", moneda_destino_id: "b", tasa: 1, fecha: "2026-01-01T00:00:00Z" },
      { moneda_origen_id: "a", moneda_destino_id: "b", tasa: 2, fecha: "2026-01-05T00:00:00Z" },
    ];
    const res = construirTasasVigentes(filas);
    expect(res["a:b"]).toBe(1); // primera fila = más reciente (orden desc)
  });

  it("mantiene pares distintos", () => {
    const filas = [
      { moneda_origen_id: "a", moneda_destino_id: "b", tasa: 10, fecha: "2026-01-01T00:00:00Z" },
      { moneda_origen_id: "b", moneda_destino_id: "a", tasa: 0.1, fecha: "2026-01-01T00:00:00Z" },
    ];
    const res = construirTasasVigentes(filas);
    expect(res["a:b"]).toBe(10);
    expect(res["b:a"]).toBe(0.1);
  });

  it("cadenas vacías devuelven mapa vacío", () => {
    expect(construirTasasVigentes([])).toEqual({});
  });

  it("convierte strings numéricos a number", () => {
    const filas = [
      { moneda_origen_id: U(), moneda_destino_id: U(), tasa: "3.5" as unknown as number, fecha: "2026-01-01T00:00:00Z" },
    ];
    const res = construirTasasVigentes(filas);
    expect(Object.values(res)[0]).toBe(3.5);
  });
});

describe("convertir", () => {
  const tasas = {
    "COP:USD": 0.00025,
    "USD:VES": 36.5,
    "VES:USD": 0.0274,
  };

  it("misma moneda devuelve el mismo monto", () => {
    expect(convertir(100, "COP", "COP", tasas)).toBe(100);
  });

  it("convierte con tasa directa", () => {
    expect(convertir(4000, "COP", "USD", tasas)).toBe(1);
    expect(convertir(100, "USD", "VES", tasas)).toBe(3650);
  });

  it("convierte usando la tasa inversa (divide)", () => {
    expect(convertir(36.5, "VES", "USD", tasas)).toBeCloseTo(1, 2);
  });

  it("devuelve null si no hay tasa para el par", () => {
    expect(convertir(100, "COP", "EUR", tasas)).toBeNull();
  });

  it("devuelve null si la tasa inversa es 0", () => {
    const tasasCero = { "USD:COP": 0 };
    expect(convertir(100, "COP", "USD", tasasCero)).toBeNull();
  });
});

describe("fmtMonto", () => {
  it("formatea con 2 decimales", () => {
    expect(fmtMonto(10)).toBe("10.00");
    expect(fmtMonto(10.5)).toBe("10.50");
  });

  it("maneja null y undefined", () => {
    expect(fmtMonto(null)).toBe("—");
    expect(fmtMonto(undefined)).toBe("—");
  });
});