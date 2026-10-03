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

import { crudRoleOverrides, type RolUsuario } from "@/lib/role-utils";

interface Props {
  initialRows: Record<string, unknown>[];
  resumen: ResumenEmpleado[];
  userRole: RolUsuario;
}

export function EmpleadosClient({ initialRows, resumen, userRole }: Props) {
  const perms = crudRoleOverrides(userRole, {
    allowCreateForColaborador: false,
    allowEditForColaborador: false,
  });

  const resumenMap = useMemo(() => {
    const map: Record<string, ResumenEmpleado> = {};
    for (const r of resumen) {
      if (r.empleado_id) map[r.empleado_id] = r;
    }
    return map;
  }, [resumen]);

  const config: CrudConfig = useMemo(
    () => ({
      title: "Empleados y Mecánicos",
      singular: "empleado",
      description: "Gestiona el equipo de trabajo y comisiones.",
      fields: [
        {
          name: "nombre",
          label: "Nombre completo",
          type: "text",
          required: true,
          get: (row) => {
            const nombre = (row.nombre as string) ?? "";
            const usuario = (row.usuario as { rol?: string } | null)?.rol;
            const es = usuario === "administrador";
            return es ? `${nombre} — Dueño` : nombre;
          },
        },
        { name: "telefono", label: "Teléfono", type: "text" },
        // --- Comisión: siempre visible, editable por trabajo ---
        {
          name: "porcentaje_comision",
          label: "% Comisión por Trabajo",
          type: "number",
          min: 0,
          step: 1,
          placeholder: "Ej: 30",
          visible: () => true,
          get: (row) => {
            const porc = (row.porcentaje_comision as number) ?? 30;
            return `${porc}%`;
          },
        },
        {
          name: "_total_ganado",
          label: "Total Ganado",
          type: "text",
          visible: false,
          get: (row) => {
            const r = resumenMap[row.id as string];
            // "—" y no "$0.00": sin entrada no se sabe si es cero real
            // (empleado sin trabajos) o dato no cargado (colaborador).
            if (!r) return "—";
            return `$${r.total_ganado.toFixed(2)}`;
          },
        },
        { name: "activo", label: "Activo", type: "checkbox" },
      ],
      columns: [
        "nombre",
        "telefono",
        "porcentaje_comision",
        "_total_ganado",
        "activo",
      ],
      create: { label: "crear", run: (_id, r) => createEmpleado(r) },
      update: { label: "editar", run: (id, r) => updateEmpleado(id, r) },
      delete: { label: "eliminar", run: (id) => deleteEmpleado(id) },
      ...perms,
    }),
    [resumenMap, perms],
  );

  return <CrudClient config={config} rows={initialRows} />;
}
