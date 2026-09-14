import { describe, expect, it } from "vitest";

import { validate } from "@/lib/schemas";
import {
  clienteSchema,
  repuestoSchema,
  empleadoSchema,
  facturaDirectaSchema,
} from "@/lib/schemas";

describe("clienteSchema", () => {
  it("acepta un cliente válido", () => {
    const res = validate(clienteSchema, {
      nombre: "Juan Pérez",
      telefono: "0416-777-77 77",
      email: "juan@correo.com",
      documento: "12345678",
      direccion: "Av. Principal",
    });
    expect(res.ok).toBe(true);
  });

  it("sanea el teléfono (solo dígitos y símbolos)", () => {
    const res = validate(clienteSchema, {
      nombre: "Juan",
      telefono: "0416!!!abc777",
      email: "",
      documento: "",
      direccion: "",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.telefono).toBe("0416777");
      expect(res.data.email).toBeNull();
    }
  });

  it("normaliza el email a minúsculas", () => {
    const res = validate(clienteSchema, {
      nombre: "Juan",
      telefono: "0416777",
      email: "  JUAN@CORREO.COM ",
      documento: "",
      direccion: "",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.email).toBe("juan@correo.com");
  });

  it("rechaza email inválido", () => {
    const res = validate(clienteSchema, {
      nombre: "Juan",
      telefono: "0416777",
      email: "no-es-correo",
      documento: "",
      direccion: "",
    });
    expect(res.ok).toBe(false);
  });

  it("rechaza nombre vacío", () => {
    const res = validate(clienteSchema, {
      nombre: "   ",
      telefono: "0416777",
      email: "",
      documento: "",
      direccion: "",
    });
    expect(res.ok).toBe(false);
  });
});

describe("repuestoSchema", () => {
  it("acepta un repuesto válido y convierte stock a número", () => {
    const res = validate(repuestoSchema, {
      nombre: "Bujía NGK",
      sku: "BG-01",
      categoria_id: crypto.randomUUID(),
      proveedor_id: crypto.randomUUID(),
      calidad: "original",
      medida: "110/90-16",
      compatible_con: "CG125, GN125",
      notas: "OEM 45B-H2310",
      stock_actual: "5",
      stock_minimo: "2",
      precio_costo: "1000",
      precio_venta: "2500",
      moneda_id: crypto.randomUUID(),
      activo: true,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.stock_actual).toBe(5);
      expect(res.data.precio_venta).toBe(2500);
      expect(res.data.calidad).toBe("original");
      expect(res.data.medida).toBe("110/90-16");
    }
  });

  it("calidad por defecto es generica y campos opcionales null", () => {
    const res = validate(repuestoSchema, {
      nombre: "Aceite",
      sku: "",
      categoria_id: "",
      proveedor_id: "",
      calidad: "",
      medida: "",
      compatible_con: "",
      notas: "",
      stock_actual: "0",
      stock_minimo: "1",
      precio_costo: "",
      precio_venta: "500",
      moneda_id: crypto.randomUUID(),
      activo: true,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.calidad).toBe("generica");
      expect(res.data.medida).toBeNull();
      expect(res.data.compatible_con).toBeNull();
    }
  });

  it("rechaza calidad inválida", () => {
    const res = validate(repuestoSchema, {
      nombre: "Bujía",
      sku: "",
      calidad: "reconstruida",
      stock_actual: "1",
      stock_minimo: "1",
      precio_venta: "500",
      moneda_id: crypto.randomUUID(),
      activo: true,
    });
    expect(res.ok).toBe(false);
  });

  it("convierte ids vacíos a null (selects opcionales)", () => {
    const res = validate(repuestoSchema, {
      nombre: "Aceite",
      sku: "",
      categoria_id: "",
      proveedor_id: "",
      stock_actual: "0",
      stock_minimo: "1",
      precio_costo: "",
      precio_venta: "500",
      moneda_id: crypto.randomUUID(),
      activo: true,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.categoria_id).toBeNull();
      expect(res.data.proveedor_id).toBeNull();
      expect(res.data.precio_costo).toBeNull();
    }
  });

  it("rechaza precio de venta negativo", () => {
    const res = validate(repuestoSchema, {
      nombre: "Bujía",
      sku: "",
      categoria_id: "",
      proveedor_id: "",
      stock_actual: "1",
      stock_minimo: "1",
      precio_costo: "",
      precio_venta: "-5",
      moneda_id: crypto.randomUUID(),
      activo: true,
    });
    expect(res.ok).toBe(false);
  });
});

describe("empleadoSchema", () => {
  it("acepta un empleado sin usuario_id (no se envía en el form)", () => {
    const res = validate(empleadoSchema, {
      nombre: "Luis A",
      documento: "123456",
      telefono: "0416777",
      tipo_vinculacion: "mixto",
      salario_base: "30000",
      moneda_salario_id: crypto.randomUUID(),
      porcentaje_comision: "10",
      activo: true,
    });
    expect(res.ok).toBe(true);
  });

  it("rechaza tipo de vinculación inválido", () => {
    const res = validate(empleadoSchema, {
      nombre: "Luis",
      documento: "",
      telefono: "",
      tipo_vinculacion: "otro",
      salario_base: "",
      moneda_salario_id: "",
      porcentaje_comision: "",
      activo: true,
    });
    expect(res.ok).toBe(false);
  });
});

describe("facturaDirectaSchema", () => {
  it("rechaza factura sin repuestos ni servicios", () => {
    const res = validate(facturaDirectaSchema, {
      cliente_id: crypto.randomUUID(),
      moneda_id: crypto.randomUUID(),
      repuestos: [],
      servicios: [],
    });
    expect(res.ok).toBe(false);
  });

  it("acepta factura con solo repuestos", () => {
    const res = validate(facturaDirectaSchema, {
      cliente_id: crypto.randomUUID(),
      moneda_id: crypto.randomUUID(),
      repuestos: [
        {
          repuesto_id: crypto.randomUUID(),
          cantidad: "2",
        },
      ],
      servicios: [],
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.repuestos[0].cantidad).toBe(2);
  });

  it("rechaza cantidad 0 en repuesto", () => {
    const res = validate(facturaDirectaSchema, {
      cliente_id: crypto.randomUUID(),
      moneda_id: crypto.randomUUID(),
      repuestos: [
        {
          repuesto_id: crypto.randomUUID(),
          cantidad: "0",
        },
      ],
      servicios: [],
    });
    expect(res.ok).toBe(false);
  });
});