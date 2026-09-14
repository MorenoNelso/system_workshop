import { requireRole } from "@/lib/auth/session";
import { getGanancias } from "@/lib/actions/dashboard";
import { listMonedas } from "@/lib/actions/tasas";
import ContabilidadView from "@/components/contabilidad/contabilidad-view";

export const metadata = {
  title: "Contabilidad — Pacho Taller",
};

export const instant = false;

export default async function ContabilidadPage() {
  await requireRole("administrador");

  const [ganancias, monedas] = await Promise.all([
    getGanancias(),
    listMonedas(),
  ]);

  return <ContabilidadView ganancias={ganancias} monedas={monedas} />;
}
