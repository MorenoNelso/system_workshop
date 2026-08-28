"use client";

import { CrudClient } from "@/components/crud/crud-client";
import type { CrudConfig } from "@/components/crud/types";
import {
  createProveedor,
  updateProveedor,
  deleteProveedor,
} from "@/lib/actions/proveedores";

const config: CrudConfig = {
  title: "Proveedores",
  singular: "proveedor",
  description: "Proveedores de repuestos.",
  fields: [
    { name: "nombre", label: "Nombre", type: "text", required: true },
    { name: "contacto", label: "Contacto", type: "text" },
    { name: "telefono", label: "Teléfono", type: "text" },
    { name: "email", label: "Correo", type: "email" },
    { name: "direccion", label: "Dirección", type: "textarea" },
  ],
  columns: ["nombre", "contacto", "telefono", "email"],
  create: { label: "crear", run: (_id, r) => createProveedor(r) },
  update: { label: "editar", run: (id, r) => updateProveedor(id, r) },
  delete: { label: "eliminar", run: (id) => deleteProveedor(id) },
};

export function ProveedoresClient({
  initialRows,
}: {
  initialRows: Record<string, unknown>[];
}) {
  return <CrudClient config={config} rows={initialRows} />;
}
