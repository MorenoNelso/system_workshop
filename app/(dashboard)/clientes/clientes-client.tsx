"use client";

import { CrudClient } from "@/components/crud/crud-client";
import type { CrudConfig } from "@/components/crud/types";
import {
  updateCliente,
  deleteCliente,
} from "@/lib/actions/clientes";
import { executeOrEnqueue } from "@/lib/offline/queue";

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
  create: {
    label: "crear",
    run: async (_id, r) => {
      const res = await executeOrEnqueue("createCliente", r);
      if (!res.ok) return { ok: false, error: res.error };
      // Si se creó online, retornar los datos para que la UI reemplace la fila provisoria
      if ("data" in res && res.data) return { ok: true, data: res.data };
      return { ok: true };
    },
  },
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
