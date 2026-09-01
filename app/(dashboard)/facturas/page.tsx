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

export const metadata: Metadata = { title: "Facturación — Pacho Motos" };

export default async function FacturasPage() {
  const user = await requireUser();
  const esAdmin = user.rol === "administrador";

  const [
    facturas,
    ordenesFacturables,
    monedas,
    clientes,
    repuestos,
    mecanicos,
  ] = await Promise.all([
    listFacturas(),
    esAdmin ? listOrdenesFacturables() : Promise.resolve([]),
    listMonedas(),
    esAdmin ? listClientes() : Promise.resolve([]),
    esAdmin ? listRepuestos() : Promise.resolve([]),
    esAdmin ? listMecanicosActivos() : Promise.resolve([]),
  ]);

  const tasas = await getTasasVigentes(await createClient());

  const repuestosActivos = (repuestos as { id: string; nombre: string; stock_actual: number; precio_venta: number; moneda_id: string; activo: boolean }[])
    .filter((r) => r.activo && r.stock_actual > 0);

  return (
    <FacturasView
      facturas={facturas}
      ordenesFacturables={ordenesFacturables}
      monedas={monedas}
      tasas={tasas}
      esAdmin={esAdmin}
      clientes={clientes as { id: string; nombre: string; telefono: string }[]}
      repuestos={repuestosActivos}
      mecanicos={mecanicos as { id: string; nombre: string; porcentaje_comision: number | null }[]}
    />
  );
}
