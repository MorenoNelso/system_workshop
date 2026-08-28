import type { Metadata } from "next";

import { CrudPage } from "@/components/crud/crud-page";
import type { CrudConfig } from "@/components/crud/types";
import { listClientes } from "@/lib/actions/clientes";

export const metadata: Metadata = { title: "Clientes — Taller" };

const config: CrudConfig = {
  title: "Clientes",
  singular: "cliente",
  description: "Gestiona los clientes del taller.",
  fields: [
    { name: "nombre", label: "Nombre", type: "text", required: true },
    { name: "telefono", label: "Teléfono", type: "text", required: true },
    { name: "email", label: "Correo", type: "email" },
    { name: "documento", label: "Documento", type: "text" },
    { name: "direccion", label: "Dirección", type: "textarea" },
  ],
  columns: ["nombre", "telefono", "email", "documento"],
  create: { label: "crear", run: (_id, r) => import("@/lib/actions/clientes").then((m) => m.createCliente(r)) },
  update: { label: "editar", run: (id, r) => import("@/lib/actions/clientes").then((m) => m.updateCliente(id, r)) },
  delete: { label: "eliminar", run: (id) => import("@/lib/actions/clientes").then((m) => m.deleteCliente(id)) },
};

export default function ClientesPage() {
  return <CrudPage config={config} fetchRows={listClientes} />;
}
