import type { Metadata } from "next";

import { listClientes } from "@/lib/actions/clientes";
import { safeQuery } from "@/lib/safe-query";
import { ClientesClient } from "./clientes-client";

export const metadata: Metadata = { title: "Clientes — Pacho Motos" };

export default async function ClientesPage() {
  const rows = await safeQuery(listClientes());
  return <ClientesClient initialRows={rows} />;
}
