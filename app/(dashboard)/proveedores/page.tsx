import type { Metadata } from "next";

import { CrudPage } from "@/components/crud/crud-page";
import type { CrudConfig } from "@/components/crud/types";
import { listProveedores } from "@/lib/actions/proveedores";

export const metadata: Metadata = { title: "Proveedores — Taller" };

const config: CrudConfig = {
  title: "Proveedores",
  singular: "proveedor",
  description: "Proveedores de repuestos.",
  fields: [
    { name: "nombre", label: "Nombre", type: "text", required: true },
    { name: "contacto", label: "Contacto", type: "text" },
    { name: "telefono", label: "Teléfono", type: "text" },
    { name: "email", label: "Correo", type: "email" },
    { name: "direccion", label: "Dirección", type: "textarea" },
  ],
  columns: ["nombre", "contacto", "telefono", "email"],
  create: { label: "crear", run: (_id, r) => import("@/lib/actions/proveedores").then((m) => m.createProveedor(r)) },
  update: { label: "editar", run: (id, r) => import("@/lib/actions/proveedores").then((m) => m.updateProveedor(id, r)) },
  delete: { label: "eliminar", run: (id) => import("@/lib/actions/proveedores").then((m) => m.deleteProveedor(id)) },
};

export default function ProveedoresPage() {
  return <CrudPage config={config} fetchRows={listProveedores} />;
}
