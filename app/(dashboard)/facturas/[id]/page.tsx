import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FacturaDetalleView } from "@/components/facturas/factura-detalle-view";
import { getFacturaById } from "@/lib/actions/facturas";
import { listMonedas } from "@/lib/actions/tasas";
import { convertir, getTasasVigentes } from "@/lib/currency";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Factura — Taller" };

export default async function FacturaDetallePage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const user = await requireUser();
  const esAdmin = user.rol === "administrador";

  const factura = await getFacturaById(id);
  if (!factura) notFound();

  const monedas = await listMonedas();
  const tasas = await getTasasVigentes(await createClient());

  // Equivalencias del total en otras monedas (solo visual, tasa vigente).
  const equivalencias = monedas
    .filter((m) => m.id !== factura.moneda_id)
    .map((m) => ({
      moneda: m,
      total: convertir(Number(factura.total), factura.moneda_id, m.id, tasas),
    }));

  return (
    <FacturaDetalleView
      factura={factura}
      monedas={monedas}
      equivalencias={equivalencias}
      esAdmin={esAdmin}
    />
  );
}