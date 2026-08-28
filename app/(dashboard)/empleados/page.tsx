import type { Metadata } from "next";

import { CrudPage } from "@/components/crud/crud-page";
import type { CrudConfig } from "@/components/crud/types";
import { listEmpleados } from "@/lib/actions/empleados";
import { db } from "@/lib/actions/_crud-helpers";

export const metadata: Metadata = { title: "Empleados — Taller" };

async function listMonedas() {
  const supabase = await db();
  const { data } = await supabase.from("monedas").select("*").order("codigo");
  return data ?? [];
}

export default async function EmpleadosPage() {
  const monedas = await listMonedas();

  const config: CrudConfig = {
    title: "Empleados y Mecánicos",
    singular: "empleado",
    description: "Gestiona el equipo de trabajo, esquemas salariales y comisiones.",
    fields: [
      { name: "nombre", label: "Nombre completo", type: "text", required: true },
      { name: "documento", label: "Documento / Identificación", type: "text" },
      { name: "telefono", label: "Teléfono", type: "text" },
      {
        name: "tipo_vinculacion",
        label: "Tipo de Vinculación",
        type: "select",
        required: true,
        options: [
          { value: "salario_fijo", label: "Salario Fijo" },
          { value: "comision", label: "Solo Comisión" },
          { value: "mixto", label: "Mixto (Salario + Comisión)" },
        ],
        selectLabel: (row) => {
          const t = row.tipo_vinculacion as string;
          if (t === "salario_fijo") return "Salario Fijo";
          if (t === "comision") return "Solo Comisión";
          if (t === "mixto") return "Mixto";
          return t ?? "—";
        },
      },
      {
        name: "porcentaje_comision",
        label: "% Comisión en Mano de Obra",
        type: "number",
        min: 0,
        step: 0.5,
        placeholder: "Ej: 30",
        get: (row) => row.porcentaje_comision !== null ? `${row.porcentaje_comision}%` : "—",
      },
      {
        name: "salario_base",
        label: "Salario Base",
        type: "number",
        min: 0,
        step: 0.01,
      },
      {
        name: "moneda_salario_id",
        label: "Moneda de Salario",
        type: "select",
        options: monedas.map((m) => ({ value: m.id, label: `${m.codigo} (${m.simbolo})` })),
        selectLabel: (row) => (row.moneda_salario as { simbolo?: string } | null)?.simbolo ?? "—",
      },
      { name: "activo", label: "Activo", type: "checkbox" },
    ],
    columns: ["nombre", "telefono", "tipo_vinculacion", "porcentaje_comision", "activo"],
    create: { label: "crear", run: (_id, r) => import("@/lib/actions/empleados").then((m) => m.createEmpleado(r)) },
    update: { label: "editar", run: (id, r) => import("@/lib/actions/empleados").then((m) => m.updateEmpleado(id, r)) },
    delete: { label: "eliminar", run: (id) => import("@/lib/actions/empleados").then((m) => m.deleteEmpleado(id)) },
  };

  return <CrudPage config={config} fetchRows={listEmpleados} />;
}
