"use client";

import { CrudClient } from "@/components/crud/crud-client";
import type { CrudConfig } from "@/components/crud/types";
import {
  updateProveedor,
  deleteProveedor,
} from "@/lib/actions/proveedores";
import { executeOrEnqueue } from "@/lib/offline/queue";

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
  create: {
    label: "crear",
    run: async (_id, r) => {
      const res = await executeOrEnqueue("createProveedor", r);
      if (!res.ok) return { ok: false, error: res.error };
      if ("data" in res && res.data) return { ok: true, data: res.data };
      return { ok: true };
    },
  },
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
