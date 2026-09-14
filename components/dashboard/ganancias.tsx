import {
  getGanancias,
  type GananciaDia,
  type GananciaVenta,
  type MonedaBase,
} from "@/lib/actions/dashboard";

function fmt(n: number, simbolo: string): string {
  return `${simbolo} ${n.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
}

export async function GananciasView() {
  const data = await getGanancias();
  const moneda: MonedaBase = data.moneda;

  const totalHoy = data.hoy.reduce((a, v) => a + v.ganancia, 0);
  const totalHoyIng = data.hoy.reduce((a, v) => a + v.ingreso, 0);
  const totalHoyEgr = data.hoy.reduce((a, v) => a + v.egreso, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Resumen del día */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">Ingreso (hoy)</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-zinc-900">
            {fmt(totalHoyIng, moneda.simbolo)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">Egreso (hoy)</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-red-600">
            {fmt(totalHoyEgr, moneda.simbolo)}
          </p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3">
          <p className="text-xs text-emerald-600">Ganancia (hoy)</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-700">
            {fmt(totalHoy, moneda.simbolo)}
          </p>
        </div>
      </div>

      {/* Detalle del día actual */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Hoy — detalle por factura
        </h3>
        {data.hoy.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Sin ventas hoy todavía.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">N°</th>
                  <th className="px-4 py-2.5 text-right font-medium">Ingreso</th>
                  <th className="px-4 py-2.5 text-right font-medium">Egreso</th>
                  <th className="px-4 py-2.5 text-right font-medium">Mecánico</th>
                  <th className="px-4 py-2.5 text-right font-medium">Ganancia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.hoy.map((v: GananciaVenta) => (
                  <tr key={v.facturaId} className="transition hover:bg-zinc-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">
                      #{String(v.numero).padStart(6, "0")}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700">
                      {fmt(v.ingreso, moneda.simbolo)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">
                      {fmt(v.egreso, moneda.simbolo)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">
                      {fmt(v.comisionMecanico, moneda.simbolo)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-emerald-700">
                      {fmt(v.ganancia, moneda.simbolo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Días anteriores — solo total por día */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Días anteriores — total por día
        </h3>
        {data.diasAnteriores.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Sin ventas en días anteriores.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Fecha</th>
                  <th className="px-4 py-2.5 text-center font-medium">Ventas</th>
                  <th className="px-4 py-2.5 text-right font-medium">Ingreso</th>
                  <th className="px-4 py-2.5 text-right font-medium">Egreso</th>
                  <th className="px-4 py-2.5 text-right font-medium">Ganancia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.diasAnteriores.map((d: GananciaDia) => (
                  <tr key={d.fecha} className="transition hover:bg-zinc-50">
                    <td className="px-4 py-2.5 text-zinc-700">
                      {new Date(d.fecha + "T00:00:00").toLocaleDateString("es-ES", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-center tabular-nums text-zinc-500">
                      {d.cantidad}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700">
                      {fmt(d.ingreso, moneda.simbolo)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">
                      {fmt(d.egreso, moneda.simbolo)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-emerald-700">
                      {fmt(d.ganancia, moneda.simbolo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}