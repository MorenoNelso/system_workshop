import type { Metadata } from "next";

import { listEmpleados, getResumenEmpleados } from "@/lib/actions/empleados";
import { db } from "@/lib/actions/_crud-helpers";
import { getCurrentUser } from "@/lib/auth/session";
import { safeQuery } from "@/lib/safe-query";
import { EmpleadosClient } from "./empleados-client";

export const metadata: Metadata = { title: "Empleados — Pacho Motos" };

async function listMonedas() {
  const supabase = await db();
  const { data } = await supabase.from("monedas").select("*").order("codigo");
  return (data ?? []).map((m) => ({
    id: m.id,
    codigo: m.codigo,
    simbolo: m.simbolo,
  }));
}

export default async function EmpleadosPage() {
  const user = await safeQuery(getCurrentUser(), { id: "", email: "", nombre: "", rol: "administrador" as const, activo: true, permisos: null });
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
      userRole={user?.rol ?? "mecanico"}
    />
  );
}
