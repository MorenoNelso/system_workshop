import type { Metadata } from "next";

import { listEmpleados, getResumenEmpleados } from "@/lib/actions/empleados";
import { listMonedas } from "@/lib/actions/tasas";
import { getCurrentUser } from "@/lib/auth/session";
import { safeQuery } from "@/lib/safe-query";
import { EmpleadosClient } from "./empleados-client";

export const metadata: Metadata = { title: "Empleados — Pacho Motos" };

export default async function EmpleadosPage() {
  const user = await getCurrentUser();
  const [empleados, monedas, resumen] = await Promise.all([
    safeQuery(listEmpleados()),
    safeQuery(listMonedas()),
    safeQuery(getResumenEmpleados()),
  ]);

  return (
    <EmpleadosClient
      initialRows={empleados}
      monedas={monedas}
      resumen={resumen}
      userRole={user?.rol ?? "colaborador"}
    />
  );
}
