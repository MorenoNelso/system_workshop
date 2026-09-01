import type { Metadata } from "next";

import { listClientes } from "@/lib/actions/clientes";
import { ClientesClient } from "./clientes-client";

export const metadata: Metadata = { title: "Clientes — Pacho Motos" };

export default async function ClientesPage() {
  const rows = await listClientes();
  return <ClientesClient initialRows={rows} />;
}
