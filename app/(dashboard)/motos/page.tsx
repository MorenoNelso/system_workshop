import type { Metadata } from "next";

import { CrudPage } from "@/components/crud/crud-page";
import type { CrudConfig } from "@/components/crud/types";
import { listMotos } from "@/lib/actions/motos";
import { listClientes } from "@/lib/actions/clientes";

export const metadata: Metadata = { title: "Motos — Taller" };

export default async function MotosPage() {
  const clientes = await listClientes();

  const config: CrudConfig = {
    title: "Motos",
    singular: "moto",
    description: "Registra las motos de los clientes.",
    fields: [
      {
        name: "cliente_id",
        label: "Cliente",
        type: "select",
        required: true,
        options: clientes.map((c) => ({
          value: c.id,
          label: c.nombre,
        })),
        selectLabel: (row) => (row.cliente as { nombre?: string } | null)?.nombre ?? "—",
      },
      { name: "marca", label: "Marca", type: "text", required: true },
      { name: "modelo", label: "Modelo", type: "text", required: true },
      { name: "anio", label: "Año", type: "number", min: 1900, step: 1 },
      { name: "placa", label: "Placa", type: "text" },
      { name: "cilindraje", label: "Cilindraje", type: "text" },
      { name: "color", label: "Color", type: "text" },
      { name: "notas", label: "Notas", type: "textarea" },
    ],
    columns: ["marca", "modelo", "placa", "cliente_id", "anio"],
    create: { label: "crear", run: (_id, r) => import("@/lib/actions/motos").then((m) => m.createMoto(r)) },
    update: { label: "editar", run: (id, r) => import("@/lib/actions/motos").then((m) => m.updateMoto(id, r)) },
    delete: { label: "eliminar", run: (id) => import("@/lib/actions/motos").then((m) => m.deleteMoto(id)) },
  };

  return <CrudPage config={config} fetchRows={listMotos} />;
}
