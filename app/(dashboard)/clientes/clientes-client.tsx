"use client";

import { useMemo } from "react";
import { CrudClient } from "@/components/crud/crud-client";
import type { CrudConfig } from "@/components/crud/types";
import {
  updateCliente,
  deleteCliente,
} from "@/lib/actions/clientes";
import { executeOrEnqueue } from "@/lib/offline/queue";

interface Props {
  initialRows: Record<string, unknown>[];
  userRole: string;
}

export function ClientesClient({ initialRows, userRole }: Props) {
  const isAdmin = userRole === "administrador";

  const config: CrudConfig = useMemo(
    () => ({
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
          if ("data" in res && res.data) return { ok: true, data: res.data };
          return { ok: true };
        },
      },
      update: { label: "editar", run: (id, r) => updateCliente(id, r) },
      delete: { label: "eliminar", run: (id) => deleteCliente(id) },
      hideDelete: !isAdmin,
    }),
    [isAdmin],
  );

  return <CrudClient config={config} rows={initialRows} />;
}
