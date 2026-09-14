import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrdenDetalleView } from "@/components/ordenes/orden-detalle-view";
import { getOrdenById } from "@/lib/actions/ordenes";
import { listRepuestos } from "@/lib/actions/repuestos";
import { listMecanicosActivos } from "@/lib/actions/empleados";
import { listMonedas } from "@/lib/actions/tasas";

export const metadata: Metadata = { title: "Detalle de Orden — Pacho Motos" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrdenDetallePage({ params }: PageProps) {
  const { id } = await params;
  const [orden, repuestos, mecanicos, monedas] = await Promise.all([
    getOrdenById(id),
    listRepuestos(),
    listMecanicosActivos(),
    listMonedas(),
  ]);

  if (!orden) {
    notFound();
  }

  // Filtrar repuestos activos para el selector
  const repuestosDisponibles = repuestos.filter((r) => r.activo);

  return (
    <OrdenDetalleView
      orden={orden}
      repuestosDisponibles={repuestosDisponibles}
      mecanicos={mecanicos}
      monedas={monedas}
    />
  );
}
