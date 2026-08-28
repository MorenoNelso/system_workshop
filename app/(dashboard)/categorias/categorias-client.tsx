"use client";

import { CrudClient } from "@/components/crud/crud-client";
import type { CrudConfig } from "@/components/crud/types";
import {
  createCategoria,
  updateCategoria,
  deleteCategoria,
} from "@/lib/actions/categorias";

const config: CrudConfig = {
  title: "Categorías de repuesto",
  singular: "categoría",
  description: "Clasifica los repuestos.",
  fields: [{ name: "nombre", label: "Nombre", type: "text", required: true }],
  columns: ["nombre"],
  create: { label: "crear", run: (_id, r) => createCategoria(r) },
  update: { label: "editar", run: (id, r) => updateCategoria(id, r) },
  delete: { label: "eliminar", run: (id) => deleteCategoria(id) },
};

export function CategoriasClient({
  initialRows,
}: {
  initialRows: Record<string, unknown>[];
}) {
  return <CrudClient config={config} rows={initialRows} />;
}
