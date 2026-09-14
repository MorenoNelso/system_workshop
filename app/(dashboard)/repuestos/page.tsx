import type { Metadata } from "next";

import { listRepuestos } from "@/lib/actions/repuestos";
import { listCategorias } from "@/lib/actions/categorias";
import { listProveedores } from "@/lib/actions/proveedores";
import { db } from "@/lib/actions/_crud-helpers";
import { safeQuery } from "@/lib/safe-query";
import { RepuestosClient } from "./repuestos-client";

export const metadata: Metadata = { title: "Repuestos — Pacho Motos" };

async function listMonedas() {
  const supabase = await db();
  const { data } = await supabase.from("monedas").select("*").order("codigo");
  return (data ?? []).map((m) => ({
    id: m.id,
    codigo: m.codigo,
    nombre: m.nombre,
    simbolo: m.simbolo,
  }));
}

export default async function RepuestosPage() {
  const [repuestos, categorias, proveedores, monedas] = await Promise.all([
    safeQuery(listRepuestos()),
    safeQuery(listCategorias()),
    safeQuery(listProveedores()),
    safeQuery(listMonedas()),
  ]);

  const catOptions = categorias.map((c) => ({ id: c.id, nombre: c.nombre }));
  const provOptions = proveedores.map((p) => ({ id: p.id, nombre: p.nombre }));

  return (
    <RepuestosClient
      initialRows={repuestos}
      categorias={catOptions}
      proveedores={provOptions}
      monedas={monedas}
    />
  );
}
