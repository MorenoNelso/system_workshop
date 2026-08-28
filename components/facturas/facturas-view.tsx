"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createFactura } from "@/lib/actions/facturas";
import type {
  FacturaRow,
  MonedaRef,
  OrdenFacturable,
} from "@/lib/actions/facturas";
import { convertir, type TasasVigentes } from "@/lib/currency";

interface Props {
  facturas: FacturaRow[];
  ordenesFacturables: OrdenFacturable[];
  monedas: MonedaRef[];
  tasas: TasasVigentes;
  esAdmin: boolean;
}

const ESTADOS = [
  { id: "todas", label: "Todas" },
  { id: "pendiente", label: "Pendientes" },
  { id: "pagada", label: "Pagadas" },
  { id: "anulada", label: "Anuladas" },
];

function EstadoBadge({ estado }: { estado: string }) {
  switch (estado) {
    case "pendiente":
      return (
        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
          Pendiente
        </span>
      );
    case "pagada":
      return (
        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
          Pagada
        </span>
      );
    case "anulada":
      return (
        <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
          Anulada
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
          {estado}
        </span>
      );
  }
}

export function FacturasView({
  facturas,
  ordenesFacturables,
  monedas,
  tasas,
  esAdmin,
}: Props) {
  const router = useRouter();
  const [filtroEstado, setFiltroEstado] = useState("todas");
  const [busqueda, setBusqueda] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [ordenSeleccionadaId, setOrdenSeleccionadaId] = useState("");
  const [monedaId, setMonedaId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ordenSel = ordenesFacturables.find((o) => o.id === ordenSeleccionadaId);
  const monedaSel = monedas.find((m) => m.id === monedaId);

  const totalPreview =
    ordenSel && monedaSel
      ? Object.entries(ordenSel.subtotales_por_moneda).reduce(
          (acc, [curId, monto]) => {
            const conv = convertir(Number(monto), curId, monedaId, tasas);
            return acc + (conv ?? 0);
          },
          0,
        )
      : 0;

  const facturasFiltradas = facturas.filter((f) => {
    const cumpleEstado = filtroEstado === "todas" || f.estado_pago === filtroEstado;
    const term = busqueda.toLowerCase().trim();
    if (!term) return cumpleEstado;
    const cliente = f.cliente?.nombre?.toLowerCase() || "";
    const num = String(f.numero_consecutivo);
    return cumpleEstado && (cliente.includes(term) || num.includes(term));
  });

  async function handleGenerar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);

    const res = await createFactura({
      orden_id: ordenSeleccionadaId,
      moneda_id: monedaId,
    });
    setGuardando(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    setModalOpen(false);
    setOrdenSeleccionadaId("");
    router.refresh();
    const data = res.data as { id?: string } | undefined;
    if (data?.id) {
      router.push(`/facturas/${data.id}`);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Facturación
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Facturas digitales generadas desde órdenes terminadas o entregadas. Sin PDF por ahora.
          </p>
        </div>
        {esAdmin && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition active:scale-[0.98] hover:bg-blue-700"
          >
            + Generar Factura
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {ESTADOS.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setFiltroEstado(e.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                filtroEstado === e.id
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Buscar por número o cliente..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* Listado */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">N°</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Emisión</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {facturasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    No se encontraron facturas.
                  </td>
                </tr>
              ) : (
                facturasFiltradas.map((f) => (
                  <tr key={f.id} className="transition hover:bg-zinc-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-zinc-900">
                      #{String(f.numero_consecutivo).padStart(6, "0")}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      <div>{f.cliente?.nombre || "—"}</div>
                      <div className="text-xs text-zinc-400">{f.cliente?.telefono}</div>
                    </td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={f.estado_pago} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                      {f.moneda?.simbolo} {Number(f.total).toFixed(2)}
                      <div className="text-[11px] font-normal text-zinc-400">
                        {f.moneda?.codigo}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {new Date(f.fecha_emision).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/facturas/${f.id}`}
                        className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 active:scale-[0.98]"
                      >
                        Ver Factura →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Generar Factura */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="h-1 w-full bg-pink-400" aria-hidden="true" />
            <div className="px-6 pt-5 pb-3">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
                Generar Factura
              </h2>
              <p className="text-xs text-zinc-500">
                A partir de una orden terminada o entregada sin facturar.
              </p>
            </div>

            {error && (
              <div className="mx-6 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleGenerar} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
                {/* Orden */}
                <div>
                  <label className="text-xs font-medium text-zinc-700">
                    Orden de servicio <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={ordenSeleccionadaId}
                    onChange={(e) => setOrdenSeleccionadaId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">— Seleccionar orden —</option>
                    {ordenesFacturables.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.cliente?.nombre} — {o.moto?.marca} {o.moto?.modelo}{" "}
                        {o.moto?.placa ? `[${o.moto.placa}]` : ""}
                      </option>
                    ))}
                  </select>
                  {ordenesFacturables.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600">
                      No hay órdenes terminadas o entregadas sin facturar.
                    </p>
                  )}
                </div>

                {/* Preview de la orden seleccionada */}
                {ordenSel && (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Resumen de la orden
                    </p>
                    <div className="mt-2 space-y-1 text-sm text-zinc-700">
                      <p>
                        Cliente:{" "}
                        <span className="font-medium text-zinc-900">
                          {ordenSel.cliente?.nombre}
                        </span>
                      </p>
                      <p>
                        Moto:{" "}
                        <span className="font-medium text-zinc-900">
                          {ordenSel.moto?.marca} {ordenSel.moto?.modelo}
                        </span>
                      </p>
                      <p className="text-xs text-zinc-500">
                        {ordenSel.linea_repuestos} repuesto(s) ·{" "}
                        {ordenSel.linea_mano_obra} servicio(s) de mano de obra
                      </p>
                    </div>
                    {Object.keys(ordenSel.subtotales_por_moneda).length > 0 && (
                      <div className="mt-3 space-y-1 border-t border-zinc-200 pt-2 text-xs text-zinc-600">
                        <p className="font-semibold uppercase tracking-wide text-zinc-400">
                          Montos por moneda (snapshot)
                        </p>
                        {Object.entries(ordenSel.subtotales_por_moneda).map(
                          ([curId, monto]) => {
                            const mon = monedas.find((m) => m.id === curId);
                            return (
                              <p key={curId}>
                                {mon?.simbolo} {Number(monto).toFixed(2)}{" "}
                                <span className="text-zinc-400">({mon?.codigo})</span>
                              </p>
                            );
                          },
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Moneda de la factura */}
                <div>
                  <label className="text-xs font-medium text-zinc-700">
                    Moneda de la factura <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={monedaId}
                    onChange={(e) => setMonedaId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">— Seleccionar moneda —</option>
                    {monedas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.codigo} ({m.simbolo}) — {m.nombre}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-zinc-500">
                    El total se convierte con la tasa vigente y se guarda{" "}
                    <span className="font-medium">congelado</span> (nunca se recalcula).
                  </p>
                </div>

                {/* Total preview */}
                {ordenSel && monedaSel && (
                  <div className="rounded-xl bg-zinc-900 p-4 text-white">
                    <p className="text-xs uppercase tracking-wider text-zinc-400">
                      Total estimado
                    </p>
                    <p className="text-2xl font-black">
                      {monedaSel.simbolo} {totalPreview.toFixed(2)}
                    </p>
                    <p className="text-xs text-zinc-400">
                      Equivale al total de la orden convertido a {monedaSel.codigo}.
                    </p>
                  </div>
                )}
              </div>

              {/* Botones de acción fijos */}
              <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 active:scale-[0.98]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando || !ordenSel || !monedaSel}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60"
                >
                  {guardando ? "Generando..." : "Generar Factura"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}