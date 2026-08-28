import type { Metadata } from "next";

import { listCategorias } from "@/lib/actions/categorias";
import { CategoriasClient } from "./categorias-client";

export const metadata: Metadata = { title: "Categorías — Taller" };

export default async function CategoriasPage() {
  const rows = await listCategorias();
  return <CategoriasClient initialRows={rows} />;
}
