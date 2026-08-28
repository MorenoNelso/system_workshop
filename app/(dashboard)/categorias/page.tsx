import type { Metadata } from "next";

import { CrudPage } from "@/components/crud/crud-page";
import type { CrudConfig } from "@/components/crud/types";
import { listCategorias } from "@/lib/actions/categorias";

export const metadata: Metadata = { title: "Categorías — Taller" };

const config: CrudConfig = {
  title: "Categorías de repuesto",
  singular: "categoría",
  description: "Clasifica los repuestos.",
  fields: [{ name: "nombre", label: "Nombre", type: "text", required: true }],
  columns: ["nombre"],
  create: { label: "crear", run: (_id, r) => import("@/lib/actions/categorias").then((m) => m.createCategoria(r)) },
  update: { label: "editar", run: (id, r) => import("@/lib/actions/categorias").then((m) => m.updateCategoria(id, r)) },
  delete: { label: "eliminar", run: (id) => import("@/lib/actions/categorias").then((m) => m.deleteCategoria(id)) },
};

export default function CategoriasPage() {
  return <CrudPage config={config} fetchRows={listCategorias} />;
}
