import type { Metadata } from "next";
import Link from "next/link";

import { VentasChart } from "@/components/dashboard/ventas-chart";
import { VentasRango } from "@/components/dashboard/ventas-rango";
import { GananciasView } from "@/components/dashboard/ganancias";
import { requireUser } from "@/lib/auth/session";
import {
  getAlertasStock,
  getIngresosPorMecanico,
  getMiProduccion,
  getResumenOrdenes,
  getVentasSemanales,
} from "@/lib/actions/dashboard";

export const metadata: Metadata = { title: "Dashboard — Pacho Motos" };

function fmt(n: number, simbolo: string): string {
  return `${simbolo} ${n.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
}

function PipelineBlock({
  label,
  count,
  dot,
}: {
  label: string;
  count: number;
  dot: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          {label}
        </span>
      </div>
      <span className="text-2xl font-black tabular-nums text-zinc-900">
        {count}
      </span>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const esAdmin = user.rol === "administrador";

  const [alertas, resumen, ventasSemanales, ingresosMecanicos, miProduccion] =
    await Promise.all([
      getAlertasStock(),
      getResumenOrdenes(),
      esAdmin ? getVentasSemanales(12) : Promise.resolve(null),
      esAdmin ? getIngresosPorMecanico() : Promise.resolve(null),
      !esAdmin ? getMiProduccion(user.id) : Promise.resolve(null),
    ]);

  const hoy = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const totalActivas =
    resumen.recibido + resumen.en_proceso + resumen.terminado;

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Hola, {user.nombre.split(" ")[0]}
          </h1>
          <p className="mt-0.5 text-sm capitalize text-zinc-500">{hoy}</p>
        </div>
        <Link
          href="/ordenes"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition active:scale-[0.98] hover:bg-brand-700"
        >
          + Nueva orden
        </Link>
      </div>

      {/* Alertas de stock bajo */}
      {alertas.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
          <div className="h-1 w-full bg-amber-400" aria-hidden="true" />
          <div className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
              Repuestos por reponer
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                {alertas.length}
              </span>
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {alertas.map((r) => (
                <Link
                  key={r.id}
                  href="/repuestos"
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition hover:shadow-sm ${
                    r.stock_actual === 0
                      ? "border-red-200 bg-red-50 text-red-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  <span className="font-medium">{r.nombre}</span>
                  <span className="text-xs tabular-nums">
                    {r.stock_actual === 0
                      ? "agotado"
                      : `${r.stock_actual} / mín ${r.stock_minimo}`}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <span className="text-sm font-medium text-emerald-800">
            Todo el inventario está en niveles saludables
          </span>
        </section>
      )}

      {/* Gráfico + Pipeline (admin) | Pipeline solo (colaborador) */}
      {esAdmin && ventasSemanales ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Gráfico de ventas — col-span-8 */}
          <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-sm lg:col-span-8">
            <div className="p-5 sm:p-6">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Ventas semanales
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Últimas 12 semanas · {ventasSemanales.moneda.codigo}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wider text-zinc-500">
                    Total del período
                  </p>
                  <p className="text-lg font-black tabular-nums text-white">
                    {fmt(
                      ventasSemanales.semanas.reduce((a, s) => a + s.total, 0),
                      ventasSemanales.moneda.simbolo,
                    )}
                  </p>
                </div>
              </div>
              <VentasChart
                semanas={ventasSemanales.semanas}
                simbolo={ventasSemanales.moneda.simbolo}
              />
            </div>
          </section>

          {/* Pipeline de órdenes — col-span-4 */}
          <section className="flex flex-col gap-3 lg:col-span-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Órdenes activas
              </h2>
              <span className="text-xs text-zinc-500">
                {totalActivas} en curso · {resumen.entregado} entregadas
              </span>
            </div>
            <PipelineBlock
              label="Recibido"
              count={resumen.recibido}
              dot="bg-amber-400"
            />
            <PipelineBlock
              label="En proceso"
              count={resumen.en_proceso}
              dot="bg-brand-500"
            />
            <PipelineBlock
              label="Terminado"
              count={resumen.terminado}
              dot="bg-purple-400"
            />
          </section>
        </div>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">
              Órdenes activas
            </h2>
            <span className="text-xs text-zinc-500">
              {totalActivas} en curso · {resumen.entregado} entregadas
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <PipelineBlock
              label="Recibido"
              count={resumen.recibido}
              dot="bg-amber-400"
            />
            <PipelineBlock
              label="En proceso"
              count={resumen.en_proceso}
              dot="bg-brand-500"
            />
            <PipelineBlock
              label="Terminado"
              count={resumen.terminado}
              dot="bg-purple-400"
            />
          </div>
        </section>
      )}

      {/* Reportes financieros (admin) o mi producción (colaborador) */}
      {esAdmin ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Ingresos por mecánico */}
          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="p-5">
              <h2 className="text-sm font-semibold text-zinc-900">
                Ingresos por mecánico
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Comisiones y mano de obra acumulada
              </p>

              {ingresosMecanicos && ingresosMecanicos.mecanicos.length > 0 ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-zinc-400">
                      <tr>
                        <th className="pb-2 font-medium">Mecánico</th>
                        <th className="pb-2 text-right font-medium">Servicios</th>
                        <th className="pb-2 text-right font-medium">Mano obra</th>
                        <th className="pb-2 text-right font-medium">Comisión</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {ingresosMecanicos.mecanicos.map((m) => (
                        <tr key={m.empleadoId}>
                          <td className="py-2.5 font-medium text-zinc-900">
                            {m.nombre}
                          </td>
                          <td className="py-2.5 text-right tabular-nums text-zinc-600">
                            {m.cantidadServicios}
                          </td>
                          <td className="py-2.5 text-right tabular-nums font-medium text-zinc-900">
                            {fmt(m.totalManoObra, ingresosMecanicos.moneda.simbolo)}
                          </td>
                          <td className="py-2.5 text-right tabular-nums font-bold text-emerald-700">
                            {fmt(m.totalComision, ingresosMecanicos.moneda.simbolo)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 text-sm text-zinc-500">
                  No hay servicios de mano de obra registrados todavía.
                </p>
              )}
            </div>
          </section>

          {/* Ventas por rango de fechas */}
          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="p-5">
              <h2 className="text-sm font-semibold text-zinc-900">
                Ventas por período
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Consulta el total facturado entre dos fechas
              </p>
              <div className="mt-4">
                {ingresosMecanicos && (
                  <VentasRango moneda={ingresosMecanicos.moneda} />
                )}
              </div>
            </div>
          </section>

          {/* Ganancias */}
          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="p-5">
              <h2 className="text-sm font-semibold text-zinc-900">
                Ganancias
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Ingresos menos egresos (costo de repuestos) y comisión de mecánicos.
              </p>
              <div className="mt-4">
                <GananciasView />
              </div>
            </div>
          </section>
        </div>
      ) : (
        /* Mi producción (colaborador) */
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="p-5">
            <h2 className="text-sm font-semibold text-zinc-900">
              Mi producción
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Tu trabajo y comisiones acumuladas
            </p>

            {miProduccion ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-zinc-50 p-4">
                  <p className="text-xs text-zinc-500">Órdenes asignadas</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-zinc-900">
                    {miProduccion.produccion.ordenesAsignadas}
                  </p>
                </div>
                <div className="rounded-xl bg-zinc-50 p-4">
                  <p className="text-xs text-zinc-500">Servicios</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-zinc-900">
                    {miProduccion.produccion.cantidadServicios}
                  </p>
                </div>
                <div className="rounded-xl bg-zinc-50 p-4">
                  <p className="text-xs text-zinc-500">Mano de obra</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">
                    {fmt(
                      miProduccion.produccion.totalManoObra,
                      miProduccion.moneda.simbolo,
                    )}
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-4">
                  <p className="text-xs text-emerald-600">Mis comisiones</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-emerald-700">
                    {fmt(
                      miProduccion.produccion.totalComision,
                      miProduccion.moneda.simbolo,
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                Tu usuario no está vinculado a un empleado. Pide al administrador
                que configure tu perfil en <Link href="/empleados" className="font-medium underline">Empleados</Link>.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
