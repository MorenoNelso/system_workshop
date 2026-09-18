import type { Metadata } from "next";

import { FacturaDetalleView } from "@/components/facturas/factura-detalle-view";
import { getFacturaById } from "@/lib/actions/facturas";
import { listMonedas } from "@/lib/actions/tasas";
import { getConfiguracion } from "@/lib/actions/config";
import { convertir, getTasasVigentes } from "@/lib/currency";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { safeQuery } from "@/lib/safe-query";

export const metadata: Metadata = { title: "Factura — Pacho Motos" };

export const instant = false;

export default async function FacturaDetallePage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const user = await getCurrentUser();
  if (!user) return null;

  const factura = await safeQuery(getFacturaById(id), null);
  if (!factura) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <p className="text-sm text-zinc-500">
          No se pudo cargar la factura. Sin conexión.
        </p>
      </div>
    );
  }

  const monedas = await safeQuery(listMonedas());

  let tasas = {};
  try {
    tasas = await getTasasVigentes(await createClient());
  } catch {
    // Offline
  }

  let config = { nombre_taller: "Pacho Motos", logo_watermark_url: "" as string | null };
  try {
    config = await getConfiguracion();
  } catch {
    // Offline
  }

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
      nombreTaller={config.nombre_taller}
      logoWatermarkUrl={config.logo_watermark_url}
    />
  );
}