"use client";

import { useState } from "react";
import type { GananciasResultado } from "@/lib/actions/dashboard";
import GastosForm from "./gastos-form";
import GastosList from "./gastos-list";
import DeduccionesForm from "./deducciones-form";
import DeduccionesList from "./deducciones-list";

type Tab = "resumen" | "gastos" | "deducciones";

interface Moneda {
  id: string;
  codigo: string;
  simbolo: string;
  nombre: string;
}

export default function ContabilidadView({
  ganancias,
  monedas,
}: {
  ganancias: GananciasResultado;
  monedas: Moneda[];
}) {
  const [tab, setTab] = useState<Tab>("resumen");
  const [refreshKey, setRefreshKey] = useState(0);

  const fmt = (n: number) =>
    `${ganancias.moneda.simbolo} ${n.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const tabs: { key: Tab; label: string }[] = [
    { key: "resumen", label: "Resumen" },
    { key: "gastos", label: "Gastos Personales" },
    { key: "deducciones", label: "Deducciones Mecánicos" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
        Contabilidad
      </h1>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card label="Ganancia Taller" value={fmt(ganancias.gananciaTallerMes)} color="text-emerald-600" />
        <Card label="Retiros Dueño" value={fmt(ganancias.retirosMes)} color="text-red-500" />
        <Card label="Deducciones" value={fmt(ganancias.deduccionesMes)} color="text-amber-600" />
        <Card label="Ganancia Neta" value={fmt(ganancias.gananciaNetaMes)} color="text-brand-600" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "border-b-2 border-brand-600 text-brand-600"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido de tabs */}
      <div className="mt-2">
        {tab === "resumen" && (
          <div className="flex flex-col gap-6">
            <h2 className="text-base font-semibold text-zinc-900">
              Detalle de Hoy
            </h2>
            {ganancias.hoy.length === 0 ? (
              <p className="text-sm text-zinc-500">No hay ventas registradas hoy.</p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">N#</th>
                        <th className="px-4 py-3 text-right font-medium">Ingreso</th>
                        <th className="px-4 py-3 text-right font-medium">Egreso</th>
                        <th className="px-4 py-3 text-right font-medium">Mecánico</th>
                        <th className="px-4 py-3 text-right font-medium">Ganancia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {ganancias.hoy.map((v) => (
                        <tr key={v.facturaId}>
                          <td className="px-4 py-3 font-medium text-zinc-900">
                            {v.numero}
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-700">{fmt(v.ingreso)}</td>
                          <td className="px-4 py-3 text-right text-zinc-700">{fmt(v.egreso)}</td>
                          <td className="px-4 py-3 text-right text-zinc-700">{fmt(v.comisionMecanico)}</td>
                          <td className={`px-4 py-3 text-right font-medium ${v.ganancia >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {fmt(v.ganancia)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {ganancias.diasAnteriores.length > 0 && (
              <>
                <h2 className="text-base font-semibold text-zinc-900">
                  Días Anteriores
                </h2>
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">Fecha</th>
                          <th className="px-4 py-3 text-right font-medium">Ventas</th>
                          <th className="px-4 py-3 text-right font-medium">Ingreso</th>
                          <th className="px-4 py-3 text-right font-medium">Egreso</th>
                          <th className="px-4 py-3 text-right font-medium">Mecánico</th>
                          <th className="px-4 py-3 text-right font-medium">Ganancia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {ganancias.diasAnteriores.map((d) => (
                          <tr key={d.fecha}>
                            <td className="px-4 py-3 font-medium text-zinc-900">
                              {d.fecha}
                            </td>
                            <td className="px-4 py-3 text-right text-zinc-700">{d.cantidad}</td>
                            <td className="px-4 py-3 text-right text-zinc-700">{fmt(d.ingreso)}</td>
                            <td className="px-4 py-3 text-right text-zinc-700">{fmt(d.egreso)}</td>
                            <td className="px-4 py-3 text-right text-zinc-700">{fmt(d.comisionMecanico)}</td>
                            <td className={`px-4 py-3 text-right font-medium ${d.ganancia >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                              {fmt(d.ganancia)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab === "gastos" && (
          <div className="flex flex-col gap-6">
            <GastosForm onCreated={() => setRefreshKey((k) => k + 1)} monedas={monedas} />
            <GastosList key={refreshKey} />
          </div>
        )}

        {tab === "deducciones" && (
          <div className="flex flex-col gap-6">
            <DeduccionesForm onCreated={() => setRefreshKey((k) => k + 1)} monedas={monedas} />
            <DeduccionesList key={refreshKey} />
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
