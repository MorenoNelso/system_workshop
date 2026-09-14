import type { Metadata } from "next";

import { FacturasView } from "@/components/facturas/facturas-view";
import { getTasasVigentes } from "@/lib/currency";
import {
  listFacturas,
  listOrdenesFacturables,
} from "@/lib/actions/facturas";
import { listMonedas } from "@/lib/actions/tasas";
import { listClientes } from "@/lib/actions/clientes";
import { listRepuestos } from "@/lib/actions/repuestos";
import { listMecanicosActivos } from "@/lib/actions/empleados";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { safeQuery } from "@/lib/safe-query";

export const metadata: Metadata = { title: "Facturación — Pacho Motos" };

export default async function FacturasPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await safeQuery(requireUser() as any, { id: "", email: "", rol: "administrador" });

  // Ejecutar queries en paralelo con fallback vacío si fallan (offline)
  const [
    facturas,
    ordenesFacturables,
    monedas,
    clientes,
    repuestos,
    mecanicos,
  ] = await Promise.all([
    safeQuery(listFacturas()),
    safeQuery(listOrdenesFacturables()),
    safeQuery(listMonedas()),
    safeQuery(listClientes()),
    safeQuery(listRepuestos()),
    safeQuery(listMecanicosActivos()),
  ]);

  let tasas = {};
  try {
    tasas = await getTasasVigentes(await createClient());
  } catch {
    // Sin conexión: tasas vacías (offline)
  }

  const repuestosActivos = (repuestos as {
    id: string;
    nombre: string;
    stock_actual: number;
    precio_venta: number;
    moneda_id: string;
    activo: boolean;
    calidad: string;
    medida: string | null;
    compatible_con: string | null;
  }[]).filter((r) => r.activo && r.stock_actual > 0);

  return (
    <FacturasView
      facturas={facturas}
      ordenesFacturables={ordenesFacturables}
      monedas={monedas}
      tasas={tasas}
      clientes={clientes as { id: string; nombre: string; telefono: string }[]}
      repuestos={repuestosActivos}
      mecanicos={mecanicos as { id: string; nombre: string; porcentaje_comision: number | null }[]}
    />
  );
}
