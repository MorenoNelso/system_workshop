import type { Metadata } from "next";

import { listProveedores } from "@/lib/actions/proveedores";
import { ProveedoresClient } from "./proveedores-client";

export const metadata: Metadata = { title: "Proveedores — Taller" };

export default async function ProveedoresPage() {
  const rows = await listProveedores();
  return <ProveedoresClient initialRows={rows} />;
}
