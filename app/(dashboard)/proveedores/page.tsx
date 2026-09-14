import type { Metadata } from "next";

import { listProveedores } from "@/lib/actions/proveedores";
import { safeQuery } from "@/lib/safe-query";
import { ProveedoresClient } from "./proveedores-client";

export const metadata: Metadata = { title: "Proveedores — Pacho Motos" };

export default async function ProveedoresPage() {
  const rows = await safeQuery(listProveedores());
  return <ProveedoresClient initialRows={rows} />;
}
