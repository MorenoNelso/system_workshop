import type { Metadata } from "next";

import { FacturasView } from "@/components/facturas/facturas-view";
import { getTasasVigentes } from "@/lib/currency";
import {
  listFacturas,
  listOrdenesFacturables,
} from "@/lib/actions/facturas";
import { listMonedas } from "@/lib/actions/tasas";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Facturación — Taller" };

export default async function FacturasPage() {
  const user = await requireUser();
  const esAdmin = user.rol === "administrador";
  const [facturas, ordenesFacturables, monedas] = await Promise.all([
    listFacturas(),
    esAdmin ? listOrdenesFacturables() : Promise.resolve([]),
    listMonedas(),
  ]);

  const tasas = await getTasasVigentes(await createClient());

  return (
    <FacturasView
      facturas={facturas}
      ordenesFacturables={ordenesFacturables}
      monedas={monedas}
      tasas={tasas}
      esAdmin={esAdmin}
    />
  );
}