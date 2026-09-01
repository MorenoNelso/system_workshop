import type { Metadata } from "next";

import { OrdenesView } from "@/components/ordenes/ordenes-view";
import { listOrdenes } from "@/lib/actions/ordenes";
import { listClientes } from "@/lib/actions/clientes";
import { listMotos } from "@/lib/actions/motos";
import { listMecanicosActivos } from "@/lib/actions/empleados";

export const metadata: Metadata = { title: "Órdenes de Servicio — Pacho Motos" };

export default async function OrdenesPage() {
  const [ordenes, clientes, motos, empleados] = await Promise.all([
    listOrdenes(),
    listClientes(),
    listMotos(),
    listMecanicosActivos(),
  ]);

  return (
    <OrdenesView
      initialOrdenes={ordenes}
      clientes={clientes}
      motos={motos}
      empleados={empleados}
    />
  );
}
