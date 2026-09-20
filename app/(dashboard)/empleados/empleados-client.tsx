"use client";

import { useMemo } from "react";
import { CrudClient } from "@/components/crud/crud-client";
import type { CrudConfig } from "@/components/crud/types";
import {
  createEmpleado,
  updateEmpleado,
  deleteEmpleado,
  type ResumenEmpleado,
} from "@/lib/actions/empleados";

import { crudRoleOverrides } from "@/lib/role-utils";

interface Props {
  initialRows: Record<string, unknown>[];
  monedas: { id: string; codigo: string; simbolo: string }[];
  resumen: ResumenEmpleado[];
  userRole: string;
}

export function EmpleadosClient({ initialRows, monedas, resumen, userRole }: Props) {
  const perms = crudRoleOverrides(userRole, { allowCreateForColaborador: false });

  const resumenMap = useMemo(() => {
    const map: Record<string, ResumenEmpleado> = {};
    for (const r of resumen) {
      map[r.empleado_id] = r;
    }
    return map;
  }, [resumen]);

  // El dueño NO cobra salario — solo los mecánicos tienen vinculación salarial
  const esDueno = (row: Record<string, unknown> | null) => {
    if (!row) return false;
    const usuario = row.usuario as { rol?: string } | null;
    return usuario?.rol === "administrador";
  };

  const config: CrudConfig = useMemo(
    () => ({
      title: "Empleados y Mecánicos",
      singular: "empleado",
      description:
        "Gestiona el equipo de trabajo, esquemas salariales y comisiones.",
      fields: [
        {
          name: "nombre",
          label: "Nombre completo",
          type: "text",
          required: true,
          get: (row) => {
            const nombre = row.nombre as string;
            const usuario = row.usuario as { rol?: string } | null;
            const es = usuario?.rol === "administrador";
            return es ? `${nombre} — Dueño` : nombre;
          },
        },
        {
          name: "documento",
          label: "Documento / Identificación",
          type: "text",
        },
        { name: "telefono", label: "Teléfono", type: "text" },
        // --- Campos de salario: SOLO para mecánicos, nunca para el dueño ---
        {
          name: "tipo_vinculacion",
          label: "Tipo de Vinculación",
          type: "select",
          required: true,
          visible: (row) => !esDueno(row),
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
          visible: (row) => !esDueno(row),
          get: (row) =>
            row.porcentaje_comision !== null &&
            row.porcentaje_comision !== undefined
              ? `${row.porcentaje_comision}%`
              : "—",
        },
        {
          name: "salario_base",
          label: "Salario Base",
          type: "number",
          min: 0,
          step: 0.01,
          visible: (row) => !esDueno(row),
        },
        {
          name: "moneda_salario_id",
          label: "Moneda de Salario",
          type: "select",
          visible: (row) => !esDueno(row),
          options: monedas.map((m) => ({
            value: m.id,
            label: `${m.codigo} (${m.simbolo})`,
          })),
          selectLabel: (row) =>
            (row.moneda_salario as { simbolo?: string } | null)?.simbolo ??
            "—",
        },
        {
          name: "_total_ganado",
          label: "Total Ganado",
          type: "text",
          get: (row) => {
            const r = resumenMap[row.id as string];
            if (!r) return "$0.00";
            return `$${r.total_ganado.toFixed(2)}`;
          },
        },
        {
          name: "_trabajos",
          label: "Trabajos",
          type: "text",
          get: (row) => {
            const r = resumenMap[row.id as string];
            return r ? String(r.cantidad_trabajos) : "0";
          },
        },
        { name: "activo", label: "Activo", type: "checkbox" },
      ],
      columns: [
        "nombre",
        "telefono",
        "tipo_vinculacion",
        "porcentaje_comision",
        "_total_ganado",
        "_trabajos",
        "activo",
      ],
      create: { label: "crear", run: (_id, r) => createEmpleado(r) },
      update: { label: "editar", run: (id, r) => updateEmpleado(id, r) },
      delete: { label: "eliminar", run: (id) => deleteEmpleado(id) },
      ...perms,
    }),
    [monedas, resumenMap, perms],
  );

  return <CrudClient config={config} rows={initialRows} />;
}
