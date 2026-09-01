import type { Metadata } from "next";

import { listProveedores } from "@/lib/actions/proveedores";
import { ProveedoresClient } from "./proveedores-client";

export const metadata: Metadata = { title: "Proveedores — Pacho Motos" };

export default async function ProveedoresPage() {
  const rows = await listProveedores();
  return <ProveedoresClient initialRows={rows} />;
}
