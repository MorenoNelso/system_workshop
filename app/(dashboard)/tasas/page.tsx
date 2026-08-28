import type { Metadata } from "next";

import { TasasView } from "@/components/tasas/tasas-view";
import { listMonedas, listTasasVigentes } from "@/lib/actions/tasas";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Tasas de Cambio — Taller" };

export default async function TasasPage() {
  await requireRole("administrador");
  const [tasas, monedas] = await Promise.all([listTasasVigentes(), listMonedas()]);

  return <TasasView tasas={tasas} monedas={monedas} />;
}