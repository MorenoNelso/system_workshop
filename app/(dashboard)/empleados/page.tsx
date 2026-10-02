import type { Metadata } from "next";

import { listEmpleados, listEmpleadosPublicos, getResumenEmpleados } from "@/lib/actions/empleados";
import { getCurrentUser } from "@/lib/auth/session";
import { safeQuery } from "@/lib/safe-query";
import { EmpleadosClient } from "./empleados-client";

export const metadata: Metadata = { title: "Empleados — Pacho Motos" };

export default async function EmpleadosPage() {
  const user = await getCurrentUser();
  const esAdmin = user?.rol === "administrador";
  const [empleados, resumen] = await Promise.all([
    safeQuery(esAdmin ? listEmpleados() : listEmpleadosPublicos()),
    safeQuery(getResumenEmpleados()),
  ]);

  return (
    <EmpleadosClient
      initialRows={empleados}
      resumen={resumen}
      userRole={user?.rol ?? "colaborador"}
    />
  );
}
