import type { Metadata } from "next";

import { listMotos } from "@/lib/actions/motos";
import { listClientes } from "@/lib/actions/clientes";
import { MotosClient } from "./motos-client";

export const metadata: Metadata = { title: "Motos — Taller" };

export default async function MotosPage() {
  const [motos, clientes] = await Promise.all([listMotos(), listClientes()]);

  const clientOptions = clientes.map((c) => ({
    id: c.id,
    nombre: c.nombre,
  }));

  return <MotosClient initialRows={motos} clientes={clientOptions} />;
}
