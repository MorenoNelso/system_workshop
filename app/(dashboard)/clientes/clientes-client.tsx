"use client";

import { CrudClient } from "@/components/crud/crud-client";
import type { CrudConfig } from "@/components/crud/types";
import {
  createCliente,
  updateCliente,
  deleteCliente,
} from "@/lib/actions/clientes";

const config: CrudConfig = {
  title: "Clientes",
  singular: "cliente",
  description: "Gestiona los clientes del taller.",
  fields: [
    { name: "nombre", label: "Nombre", type: "text", required: true },
    { name: "telefono", label: "Teléfono", type: "text", required: true },
    { name: "email", label: "Correo", type: "email" },
    { name: "documento", label: "Documento", type: "text" },
    { name: "direccion", label: "Dirección", type: "textarea" },
  ],
  columns: ["nombre", "telefono", "email", "documento"],
  create: { label: "crear", run: (_id, r) => createCliente(r) },
  update: { label: "editar", run: (id, r) => updateCliente(id, r) },
  delete: { label: "eliminar", run: (id) => deleteCliente(id) },
};

export function ClientesClient({
  initialRows,
}: {
  initialRows: Record<string, unknown>[];
}) {
  return <CrudClient config={config} rows={initialRows} />;
}
