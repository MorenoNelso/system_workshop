"use client";

import { useMemo } from "react";
import { CrudClient } from "@/components/crud/crud-client";
import type { CrudConfig } from "@/components/crud/types";
import {
  createRepuesto,
  updateRepuesto,
  deleteRepuesto,
} from "@/lib/actions/repuestos";

interface Props {
  initialRows: Record<string, unknown>[];
  categorias: { id: string; nombre: string }[];
  proveedores: { id: string; nombre: string }[];
  monedas: { id: string; codigo: string; nombre: string; simbolo: string }[];
}

export function RepuestosClient({
  initialRows,
  categorias,
  proveedores,
  monedas,
}: Props) {
  const config: CrudConfig = useMemo(
    () => ({
      title: "Repuestos",
      singular: "repuesto",
      description: "Inventario de repuestos.",
      fields: [
        { name: "nombre", label: "Nombre", type: "text", required: true },
        { name: "sku", label: "SKU", type: "text" },
        {
          name: "categoria_id",
          label: "Categoría",
          type: "select",
          options: categorias.map((c) => ({ value: c.id, label: c.nombre })),
          selectLabel: (row) =>
            (row.categoria as { nombre?: string } | null)?.nombre ?? "—",
        },
        {
          name: "proveedor_id",
          label: "Proveedor",
          type: "select",
          options: proveedores.map((p) => ({ value: p.id, label: p.nombre })),
          selectLabel: (row) =>
            (row.proveedor as { nombre?: string } | null)?.nombre ?? "—",
        },
        {
          name: "stock_actual",
          label: "Stock actual",
          type: "number",
          min: 0,
          step: 1,
          required: true,
        },
        {
          name: "stock_minimo",
          label: "Stock mínimo",
          type: "number",
          min: 0,
          step: 1,
        },
        {
          name: "precio_costo",
          label: "Precio costo",
          type: "number",
          min: 0,
          step: 0.01,
        },
        {
          name: "precio_venta",
          label: "Precio venta",
          type: "number",
          min: 0,
          step: 0.01,
          required: true,
        },
        {
          name: "moneda_id",
          label: "Moneda",
          type: "select",
          required: true,
          options: monedas.map((m) => ({
            value: m.id,
            label: `${m.codigo} (${m.nombre})`,
          })),
          selectLabel: (row) =>
            (row.moneda as { simbolo?: string } | null)?.simbolo ?? "—",
        },
        { name: "activo", label: "Activo", type: "checkbox" },
      ],
      columns: [
        "nombre",
        "sku",
        "categoria_id",
        "stock_actual",
        "precio_venta",
        "moneda_id",
      ],
      create: { label: "crear", run: (_id, r) => createRepuesto(r) },
      update: { label: "editar", run: (id, r) => updateRepuesto(id, r) },
      delete: { label: "eliminar", run: (id) => deleteRepuesto(id) },
    }),
    [categorias, proveedores, monedas],
  );

  return <CrudClient config={config} rows={initialRows} />;
}
