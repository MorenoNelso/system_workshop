"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { anularFactura } from "@/lib/actions/facturas";
import { executeOrEnqueue } from "@/lib/offline/queue";
import type {
  FacturaDetail,
  ManoObraDetalle,
  MonedaRef,
  PagoRow,
  RepuestoDetalle,
} from "@/lib/actions/facturas";
import { fmtMonto } from "@/lib/currency";

interface Props {
  factura: FacturaDetail;
  monedas: MonedaRef[];
  equivalencias: { moneda: MonedaRef; total: number | null }[];
  nombreTaller?: string;
  logoWatermarkUrl?: string | null;
  esAdmin?: boolean;
}

function EstadoBadge({ estado }: { estado: string }) {
  switch (estado) {
    case "pendiente":
      return (
        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
          Pendiente
        </span>
      );
    case "cuotas":
      return (
        <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800">
          En cuotas
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

export function FacturaDetalleView({
  factura,
  monedas,
  equivalencias,
  nombreTaller = "Pacho Motos",
  logoWatermarkUrl = null,
  esAdmin = false,
}: Props) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalPago, setModalPago] = useState(false);
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [monedaPagoId, setMonedaPagoId] = useState(factura.moneda_id);
  const [montoPago, setMontoPago] = useState<string>(
    Number(factura.total).toFixed(2),
  );

  const [modalAnular, setModalAnular] = useState(false);
  const [motivoAnular, setMotivoAnular] = useState("");
  const esPagada = factura.estado_pago === "pagada";
  const monedaSimbolo = factura.moneda?.simbolo || "$";

  const equivalenciaPorMoneda: Record<string, number | null> = {
    [factura.moneda_id]: Number(factura.total),
  };
  for (const e of equivalencias) {
    equivalenciaPorMoneda[e.moneda.id] = e.total;
  }

  const monedaPago = monedas.find((m) => m.id === monedaPagoId);

  function cambiarMonedaPago(id: string) {
    setMonedaPagoId(id);
    const eq = equivalenciaPorMoneda[id];
    setMontoPago(eq === null || eq === undefined ? "" : eq.toFixed(2));
  }

  // Guard contra doble envío (doble Enter/tap): un pago duplicado sí mueve dinero.
  const enviandoRef = useRef(false);

  async function handlePagar(e: React.FormEvent) {
    e.preventDefault();
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setGuardando(true);
    setError(null);

    const res = await executeOrEnqueue("registrarPago", {
      factura_id: factura.id,
      monto: Number(montoPago),
      moneda_id: monedaPagoId,
      metodo_pago: metodoPago,
    });
    setGuardando(false);
    enviandoRef.current = false;

    if ("offline" in res && res.offline) {
      // Se cierra el modal para que no se reintente y duplique el pago al sincronizar
      setModalPago(false);
      setError("Sin conexión. El pago quedó en cola y se registrará cuando vuelva internet.");
      return;
    }
    if (!res.ok) {
      setError(res.error);
      return;
    }

    setModalPago(false);
    router.refresh();
  }

  const conCobros = esPagada || factura.estado_pago === "cuotas";

  async function handleAnular(e: React.FormEvent) {
    e.preventDefault();
    if (guardando || enviandoRef.current) return;
    const motivo = motivoAnular.trim();
    if (conCobros && !motivo) {
      setError("Para anular una factura con cobros indica el motivo de la anulación.");
      return;
    }
    if (
      !confirm(
        conCobros
          ? `¿Anular la factura por ${monedaSimbolo} ${Number(factura.total).toFixed(2)}? Se reversarán los cobros y quedará registrada como anulada. El efectivo debe devolverse a mano.`
          : "¿Anular esta factura? No podrá cobrarse después.",
      )
    )
      return;
    enviandoRef.current = true;
    setGuardando(true);
    setError(null);
    const res = await anularFactura(factura.id, conCobros ? motivo : undefined);
    setGuardando(false);
    enviandoRef.current = false;
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setModalAnular(false);
    setMotivoAnular("");
    router.refresh();
  }

  const totalRepuestos = (factura.repuestos ?? []).reduce(
    (acc: number, item: RepuestoDetalle) =>
      acc + item.cantidad * Number(item.precio_unitario_aplicado),
    0,
  );
  const totalManoObra = (factura.mano_obra ?? []).reduce(
    (acc: number, item: ManoObraDetalle) => acc + Number(item.monto),
    0,
  );

  return (
    <div className="relative flex flex-col gap-6">
      {/* Marca de agua del taller */}
      {logoWatermarkUrl ? (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoWatermarkUrl}
            alt=""
            className="h-[60%] w-auto opacity-[0.06]"
          />
        </div>
      ) : null}

      {/* Cabecera */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/facturas"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-100"
          >
            ←
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
                Factura #{String(factura.numero_consecutivo).padStart(6, "0")}
              </h1>
              <EstadoBadge estado={factura.estado_pago} />
            </div>
            <p className="text-sm text-zinc-500">
              <span className="font-medium">{nombreTaller}</span>
              {" · Emitida el "}
              {new Date(factura.fecha_emision).toLocaleDateString("es-ES", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
              {" · "}
              {factura.moneda?.codigo}
            </p>
          </div>
        </div>

        {/* Acciones por estado (anular: solo admin, el servidor también lo exige) */}
        {(factura.estado_pago === "pendiente" ||
          factura.estado_pago === "cuotas" ||
          factura.estado_pago === "pagada") && (
          <div className="flex items-center gap-2">
            {esAdmin && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMotivoAnular("");
                  setModalAnular(true);
                }}
                disabled={guardando}
                className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 active:scale-[0.98] disabled:opacity-60"
              >
                Anular
              </button>
            )}
            {(factura.estado_pago === "pendiente" || factura.estado_pago === "cuotas") && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  // Prefijar el saldo pendiente (no el total) al abrir.
                  setMontoPago(Number(factura.saldo_pendiente).toFixed(2));
                  setModalPago(true);
                }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
              >
                {factura.estado_pago === "cuotas" ? "Registrar Abono" : "Registrar Pago"}
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Información */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="border-b border-zinc-100 pb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Cliente
          </h3>
          <div className="mt-3 space-y-1 text-sm">
            <p className="font-medium text-zinc-900">{factura.cliente?.nombre}</p>
            <p className="flex items-center gap-1.5 text-zinc-500">
              <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              {factura.cliente?.telefono}
            </p>
            {factura.cliente?.email && (
              <p className="text-xs text-zinc-400">{factura.cliente.email}</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="border-b border-zinc-100 pb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {factura.orden ? "Orden de servicio" : "Tipo de venta"}
          </h3>
          <div className="mt-3 space-y-1 text-sm">
            {factura.orden ? (
              <>
                <p className="font-medium text-zinc-900">
                  {factura.orden?.moto?.marca} {factura.orden?.moto?.modelo}
                </p>
                <p className="text-zinc-500">
                  Placa:{" "}
                  <span className="font-mono font-medium">
                    {factura.orden?.moto?.placa || "N/A"}
                  </span>
                </p>
                <Link
                  href={`/ordenes/${factura.orden_id}`}
                  className="inline-block rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
                >
                  Ver orden →
                </Link>
              </>
            ) : (
              <>
                <p className="font-medium text-zinc-900">Venta directa</p>
                <p className="text-xs text-zinc-500">
                  Factura generada sin orden de servicio (trabajo pequeño).
                </p>
              </>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="border-b border-zinc-100 pb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Tasa aplicada (snapshot)
          </h3>
          <div className="mt-3 text-sm">
            {factura.tasa_aplicada !== null &&
            factura.tasa_aplicada !== undefined ? (
              <p className="font-mono font-medium text-zinc-900">
                1 unidad = {factura.tasa_aplicada} {factura.moneda?.codigo}
              </p>
            ) : (
              <p className="text-zinc-500 italic">
                Sin conversión (montos ya estaban en {factura.moneda?.codigo}).
              </p>
            )}
            <p className="mt-1 text-xs text-zinc-400">
              El total quedó congelado al emitir la factura y no se recalcula.
            </p>
          </div>
        </div>
      </div>

      {/* Repuestos */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">
          Repuestos facturados
        </h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-100">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Repuesto</th>
                <th className="px-4 py-2.5 font-medium text-center">Cant.</th>
                <th className="px-4 py-2.5 font-medium text-right">Precio snapshot</th>
                <th className="px-4 py-2.5 font-medium text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(factura.repuestos ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-xs text-zinc-400">
                    Sin repuestos.
                  </td>
                </tr>
              ) : (
                factura.repuestos.map((item: RepuestoDetalle) => (
                  <tr key={item.id} className="transition hover:bg-zinc-50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-zinc-800">
                        {item.repuesto?.nombre}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {item.repuesto?.calidad === "original" ? "Original" : item.repuesto?.calidad === "generica" ? "Genérica" : ""}
                        {item.repuesto?.medida ? ` · ${item.repuesto.medida}` : ""}
                        {item.repuesto?.compatible_con ? ` · ${item.repuesto.compatible_con}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center text-zinc-700">
                      {item.cantidad}
                    </td>
                    <td className="px-4 py-2.5 text-right text-zinc-600">
                      {item.moneda?.simbolo || "$"}{" "}
                      {Number(item.precio_unitario_aplicado).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-zinc-900">
                      {item.moneda?.simbolo || "$"}{" "}
                      {(item.cantidad * Number(item.precio_unitario_aplicado)).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {totalRepuestos > 0 && (
              <tfoot className="bg-zinc-50 font-medium">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-right text-zinc-600">
                    Total repuestos:
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-zinc-900">
                    {monedaSimbolo} {totalRepuestos.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Mano de obra */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">
          Mano de obra facturada
        </h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-100">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Mecánico</th>
                <th className="px-4 py-2.5 font-medium">Descripción</th>
                <th className="px-4 py-2.5 font-medium text-right">% Comisión</th>
                <th className="px-4 py-2.5 font-medium text-right">Comisión Mecánico</th>
                <th className="px-4 py-2.5 font-medium">Ayudante</th>
                <th className="px-4 py-2.5 font-medium text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(factura.mano_obra ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-xs text-zinc-400">
                    Sin mano de obra.
                  </td>
                </tr>
              ) : (
                factura.mano_obra.map((item: ManoObraDetalle) => (
                  <tr key={item.id} className="transition hover:bg-zinc-50">
                    <td className="px-4 py-2.5 font-medium text-zinc-900">
                      {item.empleado?.nombre}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-700">{item.descripcion}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-zinc-500">
                      {item.porcentaje_comision_aplicado !== null ? `${item.porcentaje_comision_aplicado}%` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-semibold text-emerald-700">
                      {item.comision_calculada !== null ? `${item.moneda?.simbolo || "$"} ${Number(item.comision_calculada).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-600">
                      {item.ayudante?.nombre ? (
                        <span>{item.ayudante.nombre} — {item.moneda?.simbolo || "$"} {Number(item.ayudante_monto).toFixed(2)}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-zinc-900">
                      {item.moneda?.simbolo || "$"} {Number(item.monto).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {totalManoObra > 0 && (
              <tfoot className="bg-zinc-50 font-medium">
                <tr>
                  <td colSpan={5} className="px-4 py-2.5 text-right text-zinc-600">
                    Total mano de obra:
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-zinc-900">
                    {monedaSimbolo} {totalManoObra.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Resumen + equivalencias */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-900 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-wrap items-center gap-6 text-right">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-400">
                Subtotal
              </p>
              <p className="text-sm font-semibold">
                {monedaSimbolo} {Number(factura.subtotal).toFixed(2)}
              </p>
            </div>
            <div className="border-l border-zinc-700 pl-6">
              <p className="text-xs uppercase tracking-wider text-white font-semibold">
                Total ({factura.moneda?.codigo})
              </p>
              <p className="text-2xl font-black">
                {monedaSimbolo} {Number(factura.total).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 lg:min-w-64">
            <p className="text-xs uppercase tracking-wider text-zinc-400">
              Equivalente aprox. (tasa vigente)
            </p>
            <div className="mt-2 space-y-1.5 text-sm">
              {equivalencias.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">Solo hay una moneda.</p>
              ) : (
                equivalencias.map((e) => (
                  <div key={e.moneda.id} className="flex items-center justify-between gap-4">
                    <span className="text-zinc-300">{e.moneda.codigo}</span>
                    <span className="font-semibold text-white">
                      {e.moneda.simbolo} {fmtMonto(e.total)}
                      {e.total === null && (
                        <span className="ml-1 text-[10px] font-normal text-amber-400">
                          (sin tasa)
                        </span>
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>
            <p className="mt-2 text-[10px] text-zinc-500">
              Solo visual. No altera los montos congelados de la factura.
            </p>
          </div>
        </div>
      </div>

      {/* Pagos */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">
          Pagos
        </h2>
        {factura.pagos?.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {factura.estado_pago === "pendiente"
              ? "Sin pagos registrados."
              : factura.estado_pago === "anulada"
                ? "Factura anulada, sin pagos."
                : "—"}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-100">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Fecha</th>
                  <th className="px-4 py-2.5 font-medium text-right">Monto</th>
                  <th className="px-4 py-2.5 font-medium">Método</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(factura.pagos ?? []).map((p: PagoRow) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5 text-xs text-zinc-500">
                      {new Date(p.fecha).toLocaleString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">
                      {monedas.find((m) => m.id === p.moneda_id)?.simbolo || "$"}{" "}
                      {Number(p.monto).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 capitalize text-zinc-700">
                      {p.metodo_pago}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Registrar Pago */}
      {modalPago && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="px-6 pt-5 pb-3">
              <h3 className="text-base font-semibold text-zinc-900">
                {factura.estado_pago === "cuotas" ? "Registrar abono" : "Registrar pago"}
              </h3>
              <p className="text-xs text-zinc-500">
                Saldo pendiente:{" "}
                <span className="font-bold text-zinc-900">
                  {monedaSimbolo} {Number(factura.saldo_pendiente).toFixed(2)}
                </span>{" "}
                de {monedaSimbolo} {Number(factura.total).toFixed(2)}. Se aceptan
                abonos parciales; al cubrir el saldo queda pagada.
              </p>
            </div>

            <form onSubmit={handlePagar} className="space-y-4 px-6 py-4">
              <div>
                <label className="text-xs font-medium text-zinc-700">
                  Método de pago <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700">
                  Moneda del pago <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={monedaPagoId}
                  onChange={(e) => cambiarMonedaPago(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                >
                  {monedas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.codigo} ({m.simbolo}) —{" "}
                      {equivalenciaPorMoneda[m.id] === null ||
                      equivalenciaPorMoneda[m.id] === undefined
                        ? "sin tasa"
                        : equivalenciaPorMoneda[m.id]!.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700">
                  Monto recibido <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  required
                  value={montoPago}
                  onChange={(e) => setMontoPago(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                />
                {monedaPago && montoPago !== "" && (
                  <p className="mt-1 text-xs text-zinc-500">
                    El total de la factura equivale a {monedaPago.simbolo}{" "}
                    {equivalenciaPorMoneda[monedaPago.id]?.toFixed(2) ?? "—"} en esta
                    moneda.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-4">
                <button
                  type="button"
                  onClick={() => setModalPago(false)}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 active:scale-[0.98]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando || montoPago === ""}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
                >
                  {guardando ? "Registrando..." : "Confirmar pago completo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Anular factura */}
      {modalAnular && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-zinc-900/40 p-4">
          <div className="my-auto max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="px-6 pt-5 pb-3">
              <h3 className="text-base font-semibold text-zinc-900">
                Anular factura #{String(factura.numero_consecutivo).padStart(6, "0")}
              </h3>
              <p className="text-xs text-zinc-500">
                {conCobros
                  ? "Tiene cobros: se reversarán y quedará registrada como anulada. El efectivo debe devolverse a mano."
                  : "No podrá cobrarse después."}
              </p>
            </div>

            <form onSubmit={handleAnular} className="space-y-4 px-6 py-4">
              {conCobros && (
                <div>
                  <label className="text-xs font-medium text-zinc-700">
                    Motivo de la anulación <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Ej: error de digitación en el monto de mano de obra"
                    value={motivoAnular}
                    onChange={(e) => setMotivoAnular(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-4">
                <button
                  type="button"
                  onClick={() => setModalAnular(false)}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 active:scale-[0.98]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando || (conCobros && !motivoAnular.trim())}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 active:scale-[0.98] disabled:opacity-60"
                >
                  {guardando ? "Anulando..." : "Sí, anular"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}