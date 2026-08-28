import type { Metadata } from "next";

import { CrudPage } from "@/components/crud/crud-page";
import type { CrudConfig } from "@/components/crud/types";
import { listRepuestos } from "@/lib/actions/repuestos";
import { listCategorias } from "@/lib/actions/categorias";
import { listProveedores } from "@/lib/actions/proveedores";
import { db } from "@/lib/actions/_crud-helpers";

export const metadata: Metadata = { title: "Repuestos — Taller" };

async function listMonedas() {
  const supabase = await db();
  const { data } = await supabase.from("monedas").select("*").order("codigo");
  return data ?? [];
}

export default async function RepuestosPage() {
  const [categorias, proveedores, monedas] = await Promise.all([
    listCategorias(),
    listProveedores(),
    listMonedas(),
  ]);

  const config: CrudConfig = {
    title: "Repuestos",
    singular: "repuesto",
    description: "Inventario de repuestos.",
    fields: [
      { name: "nombre", label: "Nombre", type: "text", required: true },
      { name: "sku", label: "SKU", type: "text" },
      {
        name: "categoria_id",
        label: "Categoría",
        type: "select",
        options: categorias.map((c) => ({ value: c.id, label: c.nombre })),
        selectLabel: (row) => (row.categoria as { nombre?: string } | null)?.nombre ?? "—",
      },
      {
        name: "proveedor_id",
        label: "Proveedor",
        type: "select",
        options: proveedores.map((p) => ({ value: p.id, label: p.nombre })),
        selectLabel: (row) => (row.proveedor as { nombre?: string } | null)?.nombre ?? "—",
      },
      { name: "stock_actual", label: "Stock actual", type: "number", min: 0, step: 1, required: true },
      { name: "stock_minimo", label: "Stock mínimo", type: "number", min: 0, step: 1 },
      { name: "precio_costo", label: "Precio costo", type: "number", min: 0, step: 0.01 },
      { name: "precio_venta", label: "Precio venta", type: "number", min: 0, step: 0.01, required: true },
      {
        name: "moneda_id",
        label: "Moneda",
        type: "select",
        required: true,
        options: monedas.map((m) => ({ value: m.id, label: `${m.codigo} (${m.nombre})` })),
        selectLabel: (row) => (row.moneda as { simbolo?: string } | null)?.simbolo ?? "—",
      },
      { name: "activo", label: "Activo", type: "checkbox" },
    ],
    columns: ["nombre", "sku", "categoria_id", "stock_actual", "precio_venta", "moneda_id"],
    create: { label: "crear", run: (_id, r) => import("@/lib/actions/repuestos").then((m) => m.createRepuesto(r)) },
    update: { label: "editar", run: (id, r) => import("@/lib/actions/repuestos").then((m) => m.updateRepuesto(id, r)) },
    delete: { label: "eliminar", run: (id) => import("@/lib/actions/repuestos").then((m) => m.deleteRepuesto(id)) },
  };

  return <CrudPage config={config} fetchRows={listRepuestos} />;
}
