import type { Metadata } from "next";

import { listCategorias } from "@/lib/actions/categorias";
import { requireRole } from "@/lib/auth/session";
import { safeQuery } from "@/lib/safe-query";
import { CategoriasClient } from "./categorias-client";

export const metadata: Metadata = { title: "Categorías — Pacho Motos" };

export default async function CategoriasPage() {
  const user = await requireRole("administrador");
  const rows = await safeQuery(listCategorias());
  return <CategoriasClient initialRows={rows} userRole={user.rol} />;
}
