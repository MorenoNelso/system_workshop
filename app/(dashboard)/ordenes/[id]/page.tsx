import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrdenDetalleView } from "@/components/ordenes/orden-detalle-view";
import { getOrdenById } from "@/lib/actions/ordenes";
import { listRepuestos } from "@/lib/actions/repuestos";
import { listMecanicosActivos } from "@/lib/actions/empleados";
import { db } from "@/lib/actions/_crud-helpers";

export const metadata: Metadata = { title: "Detalle de Orden — Pacho Motos" };

interface PageProps {
  params: Promise<{ id: string }>;
}

async function listMonedas() {
  const supabase = await db();
  const { data } = await supabase.from("monedas").select("*").order("codigo");
  return data ?? [];
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
