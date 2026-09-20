import type { Metadata } from "next";

import { listProveedores } from "@/lib/actions/proveedores";
import { requireRole } from "@/lib/auth/session";
import { safeQuery } from "@/lib/safe-query";
import { ProveedoresClient } from "./proveedores-client";

export const metadata: Metadata = { title: "Proveedores — Pacho Motos" };

export default async function ProveedoresPage() {
  const user = await requireRole("administrador");
  const rows = await safeQuery(listProveedores());
  return <ProveedoresClient initialRows={rows} userRole={user.rol} />;
}
