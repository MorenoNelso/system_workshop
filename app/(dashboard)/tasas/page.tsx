import type { Metadata } from "next";

import { TasasView } from "@/components/tasas/tasas-view";
import { listMonedas, listTasasVigentes } from "@/lib/actions/tasas";
import { requireRole } from "@/lib/auth/session";
import { safeQuery } from "@/lib/safe-query";

export const metadata: Metadata = { title: "Tasas de Cambio — Pacho Motos" };

export default async function TasasPage() {
  await requireRole("administrador");
  const [tasas, monedas] = await Promise.all([safeQuery(listTasasVigentes()), safeQuery(listMonedas())]);

  return <TasasView tasas={tasas} monedas={monedas} />;
}