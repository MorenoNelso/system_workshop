import type { Metadata } from "next";

import { OrdenDetalleView } from "@/components/ordenes/orden-detalle-view";
import { getOrdenById } from "@/lib/actions/ordenes";
import { listRepuestos } from "@/lib/actions/repuestos";
import { listMecanicosActivos } from "@/lib/actions/empleados";
import { listMonedas } from "@/lib/actions/tasas";
import { requireUser } from "@/lib/auth/session";
import { safeQuery } from "@/lib/safe-query";

export const metadata: Metadata = { title: "Detalle de Orden — Pacho Motos" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrdenDetallePage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;
  const [orden, repuestos, mecanicos, monedas] = await Promise.all([
    safeQuery(getOrdenById(id), null),
    safeQuery(listRepuestos()),
    safeQuery(listMecanicosActivos()),
    safeQuery(listMonedas()),
  ]);

  if (!orden) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <p className="text-sm text-zinc-500">
          No se pudo cargar la orden. Sin conexión.
        </p>
      </div>
    );
  }

  // Filtrar repuestos activos para el selector
  const repuestosDisponibles = repuestos.filter((r) => r.activo);

  return (
    <OrdenDetalleView
      orden={orden}
      repuestosDisponibles={repuestosDisponibles}
      mecanicos={mecanicos}
      monedas={monedas}
      esAdmin={user.rol === "administrador"}
    />
  );
}
