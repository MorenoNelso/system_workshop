import { requireRole } from "@/lib/auth/session";
import { getGanancias } from "@/lib/actions/dashboard";
import { listMonedas } from "@/lib/actions/tasas";
import { safeQuery } from "@/lib/safe-query";
import ContabilidadView from "@/components/contabilidad/contabilidad-view";

export const metadata = {
  title: "Contabilidad — Pacho Taller",
};

export const instant = false;

export default async function ContabilidadPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await safeQuery(requireRole("administrador") as any, { id: "", email: "", rol: "administrador" });

  const [ganancias, monedas] = await Promise.all([
    safeQuery(getGanancias(), { hoy: [], diasAnteriores: [], moneda: { id: "", codigo: "", nombre: "", simbolo: "" }, gananciaTallerMes: 0, retirosMes: 0, deduccionesMes: 0, gananciaNetaMes: 0, duenoId: null }),
    safeQuery(listMonedas()),
  ]);

  return <ContabilidadView ganancias={ganancias} monedas={monedas} />;
}
