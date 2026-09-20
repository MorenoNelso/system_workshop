import type { Metadata } from "next";

import { listMotos } from "@/lib/actions/motos";
import { listClientes } from "@/lib/actions/clientes";
import { requireRole } from "@/lib/auth/session";
import { safeQuery } from "@/lib/safe-query";
import { MotosClient } from "./motos-client";

export const metadata: Metadata = { title: "Motos — Pacho Motos" };

export default async function MotosPage() {
  const user = await requireRole("administrador");
  const [motos, clientes] = await Promise.all([safeQuery(listMotos()), safeQuery(listClientes())]);

  const clientOptions = clientes.map((c) => ({
    id: c.id,
    nombre: c.nombre,
  }));

  return <MotosClient initialRows={motos} clientes={clientOptions} userRole={user.rol} />;
}
