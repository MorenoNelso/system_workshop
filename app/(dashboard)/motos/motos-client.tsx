"use client";

import { useMemo } from "react";
import { CrudClient } from "@/components/crud/crud-client";
import type { CrudConfig } from "@/components/crud/types";
import { createMoto, updateMoto, deleteMoto } from "@/lib/actions/motos";

interface Props {
  initialRows: Record<string, unknown>[];
  clientes: { id: string; nombre: string }[];
}

export function MotosClient({ initialRows, clientes }: Props) {
  const config: CrudConfig = useMemo(
    () => ({
      title: "Motos",
      singular: "moto",
      description: "Registra las motos de los clientes.",
      fields: [
        {
          name: "cliente_id",
          label: "Cliente (opcional)",
          type: "select",
          options: clientes.map((c) => ({
            value: c.id,
            label: c.nombre,
          })),
          selectLabel: (row) =>
            (row.cliente as { nombre?: string } | null)?.nombre ?? "—",
        },
        { name: "marca", label: "Marca", type: "text", required: true },
        { name: "modelo", label: "Modelo", type: "text", required: true },
        { name: "anio", label: "Año", type: "number", min: 1900, step: 1 },
        { name: "placa", label: "Placa", type: "text" },
        { name: "cilindraje", label: "Cilindraje", type: "text" },
        { name: "color", label: "Color", type: "text" },
        { name: "notas", label: "Notas", type: "textarea" },
      ],
      columns: ["marca", "modelo", "placa", "cliente_id", "anio"],
      create: { label: "crear", run: (_id, r) => createMoto(r) },
      update: { label: "editar", run: (id, r) => updateMoto(id, r) },
      delete: { label: "eliminar", run: (id) => deleteMoto(id) },
    }),
    [clientes],
  );

  return <CrudClient config={config} rows={initialRows} />;
}
