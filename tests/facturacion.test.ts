import { describe, expect, it } from "vitest";

import {
  esErrorFacturaDuplicada,
  ordenEsFacturable,
  ordenYaTieneFactura,
} from "@/lib/facturas-utils";
import { validate, facturaCreateSchema } from "@/lib/schemas";

const U = () => crypto.randomUUID();

describe("ordenYaTieneFactura", () => {
  it("no tiene factura cuando Supabase devuelve array vacío", () => {
    expect(ordenYaTieneFactura([])).toBe(false);
  });

  it("no tiene factura cuando la relación es null", () => {
    expect(ordenYaTieneFactura(null)).toBe(false);
    expect(ordenYaTieneFactura(undefined)).toBe(false);
  });

  it("tiene factura cuando el array tiene filas", () => {
    expect(ordenYaTieneFactura([{ id: U() }])).toBe(true);
  });

  it("tiene factura cuando la relación es un objeto", () => {
    expect(ordenYaTieneFactura({ id: U() })).toBe(true);
  });
});

describe("ordenEsFacturable", () => {
  it("permite facturar órdenes terminadas o entregadas", () => {
    expect(ordenEsFacturable("terminado")).toBe(true);
    expect(ordenEsFacturable("entregado")).toBe(true);
  });

  it("bloquea órdenes en otros estados", () => {
    expect(ordenEsFacturable("recibido")).toBe(false);
    expect(ordenEsFacturable("en_proceso")).toBe(false);
  });
});

describe("esErrorFacturaDuplicada", () => {
  it("detecta violación de unicidad (23505)", () => {
    expect(esErrorFacturaDuplicada({ code: "23505", message: "duplicate key" })).toBe(true);
  });

  it("detecta por mensaje duplicado", () => {
    expect(esErrorFacturaDuplicada({ message: "ya existe la factura" })).toBe(true);
    expect(esErrorFacturaDuplicada({ message: "duplicate key value violates unique" })).toBe(true);
  });

  it("no detecta errores comunes", () => {
    expect(esErrorFacturaDuplicada({ code: "23503", message: "foreign key" })).toBe(false);
    expect(esErrorFacturaDuplicada(null)).toBe(false);
  });
});

describe("facturaCreateSchema", () => {
  it("acepta orden + moneda válidos", () => {
    const res = validate(facturaCreateSchema, {
      orden_id: U(),
      moneda_id: U(),
    });
    expect(res.ok).toBe(true);
  });

  it("rechaza si falta la orden", () => {
    const res = validate(facturaCreateSchema, {
      orden_id: "",
      moneda_id: U(),
    });
    expect(res.ok).toBe(false);
  });

  it("rechaza UUIDs inválidos", () => {
    const res = validate(facturaCreateSchema, {
      orden_id: "no-es-uuid",
      moneda_id: U(),
    });
    expect(res.ok).toBe(false);
  });
});