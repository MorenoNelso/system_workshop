"use client";

import { useMemo } from "react";
import { CrudClient } from "@/components/crud/crud-client";
import type { CrudConfig } from "@/components/crud/types";
import {
  updateCategoria,
  deleteCategoria,
} from "@/lib/actions/categorias";
import { executeOrEnqueue } from "@/lib/offline/queue";

interface Props {
  initialRows: Record<string, unknown>[];
  userRole: string;
}

export function CategoriasClient({ initialRows, userRole }: Props) {
  const isAdmin = userRole === "administrador";

  const config: CrudConfig = useMemo(
    () => ({
      title: "Categorías de repuesto",
      singular: "categoría",
      description: "Clasifica los repuestos.",
      fields: [{ name: "nombre", label: "Nombre", type: "text", required: true }],
      columns: ["nombre"],
      create: {
        label: "crear",
        run: async (_id, r) => {
          const res = await executeOrEnqueue("createCategoria", r);
          if (!res.ok) return { ok: false, error: res.error };
          if ("data" in res && res.data) return { ok: true, data: res.data };
          return { ok: true };
        },
      },
      update: { label: "editar", run: (id, r) => updateCategoria(id, r) },
      delete: { label: "eliminar", run: (id) => deleteCategoria(id) },
      hideDelete: !isAdmin,
    }),
    [isAdmin],
  );

  return <CrudClient config={config} rows={initialRows} />;
}
