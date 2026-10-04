"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { executeOrEnqueue } from "@/lib/offline/queue";
import type {
  FacturaRow,
  MonedaRef,
  OrdenFacturable,
} from "@/lib/actions/facturas";
import { convertir, type TasasVigentes } from "@/lib/currency";

interface ClienteLite {
  id: string;
  nombre: string;
  telefono: string;
}

interface RepuestoLite {
  id: string;
  nombre: string;
  stock_actual: number;
  precio_venta: number;
  moneda_id: string;
  calidad?: string;
  medida?: string | null;
  compatible_con?: string | null;
}

interface MecanicoLite {
  id: string;
  nombre: string;
  porcentaje_comision: number | null;
  /** Vinculado a un administrador: su comisión queda en el taller. */
  es_dueno?: boolean;
}

interface Props {
  facturas: FacturaRow[];
  ordenesFacturables: OrdenFacturable[];
  monedas: MonedaRef[];
  tasas: TasasVigentes;
  clientes: ClienteLite[];
  repuestos: RepuestoLite[];
  mecanicos: MecanicoLite[];
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

interface LineaRepuesto {
  repuesto_id: string;
  nombre: string;
  cantidad: number;
  precio: number;
  moneda_id: string;
  stock: number;
}

interface LineaServicio {
  descripcion: string;
  monto: number;
  moneda_id: string;
  empleado_id: string;
  porcentaje_comision_aplicado: number | null;
  monto_a_pagar: number | null;
}

export function FacturasView({
  facturas,
  ordenesFacturables,
  monedas,
  tasas,
  clientes,
  repuestos,
  mecanicos,
}: Props) {
  const router = useRouter();
  const [filtroEstado, setFiltroEstado] = useState("todas");
  const [busqueda, setBusqueda] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [ordenSeleccionadaId, setOrdenSeleccionadaId] = useState("");
  const [monedaId, setMonedaId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Segundo paso de confirmación antes de emitir (la factura no se edita después)
  const [confirmando, setConfirmando] = useState(false);

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

  // Guard contra doble envío (doble Enter/tap): el state no frena
  // dos submits en el mismo tick, el ref sí.
  const enviandoRef = useRef(false);

  async function handleGenerar(e: React.FormEvent) {
    e.preventDefault();
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setGuardando(true);
    setError(null);

    const res = await executeOrEnqueue("createFactura", {
      orden_id: ordenSeleccionadaId,
      moneda_id: monedaId,
    });
    setGuardando(false);
    enviandoRef.current = false;

    if (!res.ok) {
      setError(res.error ?? "No se pudo generar la factura. Revisa los datos e intenta de nuevo.");
      return;
    }

    if ("offline" in res && res.offline) {
      setError("Sin conexión. La factura se guardó y se enviará cuando vuelva internet.");
      setModalOpen(false);
      setConfirmando(false);
      setOrdenSeleccionadaId("");
      return;
    }

    setModalOpen(false);
    setConfirmando(false);
    setOrdenSeleccionadaId("");
    router.refresh();
    const facturaData = "data" in res ? (res.data as { id?: string }) : undefined;
    if (facturaData?.id) {
      router.push(`/facturas/${facturaData.id}`);
    }
  }

  /* --- Venta rápida --- */
  const [modalRapida, setModalRapida] = useState(false);
  const [clientesState, setClientesState] = useState(clientes);
  const [clienteRapidaId, setClienteRapidaId] = useState("");
  const [monedaRapidaId, setMonedaRapidaId] = useState("");
  const [lineasRepuestos, setLineasRepuestos] = useState<LineaRepuesto[]>([]);
  const [lineasServicios, setLineasServicios] = useState<LineaServicio[]>([]);
  const [guardandoRapida, setGuardandoRapida] = useState(false);
  const [errorRapida, setErrorRapida] = useState<string | null>(null);

  const [repSel, setRepSel] = useState("");
  const [repCant, setRepCant] = useState(1);

  const [srvDesc, setSrvDesc] = useState("");
  const [srvMonto, setSrvMonto] = useState<number | string>("");
  const [srvMonedaId, setSrvMonedaId] = useState("");
  const [srvMecanicoId, setSrvMecanicoId] = useState("");
  // Un solo modo de pago (antes % + override convivían y permitían guardar 0% sin darse cuenta)
  const [srvModoPago, setSrvModoPago] = useState<"porcentaje" | "fijo">("porcentaje");
  const [srvComision, setSrvComision] = useState<number | string>("");
  const [srvMontoAPagar, setSrvMontoAPagar] = useState<number | string>("");

  function handleSrvMecanicoChange(id: string) {
    setSrvMecanicoId(id);
    const mec = mecanicos.find((m) => m.id === id);
    if (mec && mec.porcentaje_comision !== null && mec.porcentaje_comision !== undefined) {
      setSrvComision(mec.porcentaje_comision);
      setSrvModoPago("porcentaje");
      setSrvMontoAPagar("");
    } else {
      setSrvComision("");
    }
  }

  const [creandoCliente, setCreandoCliente] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTelefono, setNuevoTelefono] = useState("");
  const [nuevoDireccion, setNuevoDireccion] = useState("");
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  const [errorCliente, setErrorCliente] = useState<string | null>(null);

  const monedaRapida = monedas.find((m) => m.id === monedaRapidaId);

  const totalRapida = (() => {
    let t = 0;
    for (const r of lineasRepuestos) {
      const c = convertir(r.precio * r.cantidad, r.moneda_id, monedaRapidaId, tasas);
      if (c !== null) t += c;
    }
    for (const s of lineasServicios) {
      const c = convertir(s.monto, s.moneda_id, monedaRapidaId, tasas);
      if (c !== null) t += c;
    }
    return t;
  })();

  const [confirmandoRapida, setConfirmandoRapida] = useState(false);

  function abrirRapida() {
    setErrorRapida(null);
    setConfirmandoRapida(false);
    setClienteRapidaId("");
    setMonedaRapidaId(monedas[0]?.id || "");
    setLineasRepuestos([]);
    setLineasServicios([]);
    setRepSel("");
    setRepCant(1);
    setSrvDesc("");
    setSrvMonto("");
    setSrvMonedaId(monedas[0]?.id || "");
    setSrvMecanicoId("");
    setSrvModoPago("porcentaje");
    setSrvComision("");
    setSrvMontoAPagar("");
    setModalRapida(true);
  }

  function abrirNuevoCliente() {
    setCreandoCliente(true);
    setNuevoNombre("");
    setNuevoTelefono("");
    setNuevoDireccion("");
    setErrorCliente(null);
  }

  async function handleCrearCliente(e: React.FormEvent) {
    e.preventDefault();
    if (guardandoCliente || enviandoRef.current) return;
    if (!nuevoNombre.trim() || !nuevoTelefono.trim()) {
      setErrorCliente("El nombre y el teléfono son obligatorios.");
      return;
    }
    enviandoRef.current = true;
    setGuardandoCliente(true);
    setErrorCliente(null);

    // Siempre generar un temp UUID: online se usa el real de Supabase,
    // offline se usa el temp y se pasa a la factura.
    // navigator.onLine puede ser true aunque la red esté caída.
    const tempId = crypto.randomUUID();

    const res = await executeOrEnqueue("createCliente", {
      id: tempId,
      nombre: nuevoNombre,
      telefono: nuevoTelefono,
      direccion: nuevoDireccion || null,
    });
    setGuardandoCliente(false);
    enviandoRef.current = false;

    if (!res.ok) {
      setErrorCliente(res.error ?? "No se pudo guardar el cliente. Verifica los datos e intenta de nuevo.");
      return;
    }

    if ("offline" in res && res.offline) {
      // Offline: agregar el cliente temporal a la lista y seleccionarlo
      const nuevo = { id: tempId, nombre: nuevoNombre, telefono: nuevoTelefono };
      setClientesState((prev) => [...prev, nuevo]);
      setClienteRapidaId(tempId);
      setCreandoCliente(false);
      return;
    }

    // Online: usar el ID real de Supabase (puede diferir del temp)
    const nuevo = "data" in res ? (res.data as { id: string; nombre: string; telefono: string }) : null;
    if (nuevo) {
      setClientesState((prev) => [...prev, nuevo]);
      setClienteRapidaId(nuevo.id);
    }
    setCreandoCliente(false);
  }

  function addRepuesto() {
    const r = repuestos.find((x) => x.id === repSel);
    if (!r) return;
    if (repCant < 1 || repCant > r.stock_actual) return;
    setConfirmandoRapida(false);
    setLineasRepuestos((prev) => [
      ...prev,
      {
        repuesto_id: r.id,
        nombre: r.nombre,
        cantidad: repCant,
        precio: r.precio_venta,
        moneda_id: r.moneda_id,
        stock: r.stock_actual,
      },
    ]);
    setRepSel("");
    setRepCant(1);
  }

  function removeRepuesto(idx: number) {
    setConfirmandoRapida(false);
    setLineasRepuestos((prev) => prev.filter((_, i) => i !== idx));
  }

  function addServicio() {
    if (!srvDesc.trim() || srvMonto === "" || Number(srvMonto) < 0) return;
    // Solo se envía UNA de las dos formas de pago, según el modo elegido
    const esPorcentaje = !srvMecanicoId || srvModoPago === "porcentaje";
    const porc = esPorcentaje && srvComision !== "" ? Number(srvComision) : null;
    const fijo = srvMecanicoId && !esPorcentaje && srvMontoAPagar !== "" ? Number(srvMontoAPagar) : null;
    if (srvMecanicoId && porc === null && fijo === null) return;
    setConfirmandoRapida(false);
    setLineasServicios((prev) => [
      ...prev,
      {
        descripcion: srvDesc.trim(),
        monto: Number(srvMonto),
        moneda_id: srvMonedaId,
        empleado_id: srvMecanicoId,
        porcentaje_comision_aplicado: porc,
        monto_a_pagar: fijo,
      },
    ]);
    setSrvDesc("");
    setSrvMonto("");
    setSrvMecanicoId("");
    setSrvModoPago("porcentaje");
    setSrvComision("");
    setSrvMontoAPagar("");
  }

  function removeServicio(idx: number) {
    setConfirmandoRapida(false);
    setLineasServicios((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleRapida(e: React.FormEvent) {
    e.preventDefault();
    if (guardandoRapida || enviandoRef.current) return;
    enviandoRef.current = true;
    setGuardandoRapida(true);
    setErrorRapida(null);

    const res = await executeOrEnqueue("createFacturaDirecta", {
      cliente_id: clienteRapidaId,
      moneda_id: monedaRapidaId,
      repuestos: lineasRepuestos.map((r) => ({
        repuesto_id: r.repuesto_id,
        cantidad: r.cantidad,
      })),
      servicios: lineasServicios.map((s) => ({
        descripcion: s.descripcion,
        monto: s.monto,
        moneda_id: s.moneda_id,
        empleado_id: s.empleado_id || null,
        porcentaje_comision_aplicado: s.porcentaje_comision_aplicado,
        monto_a_pagar: s.monto_a_pagar,
      })),
    });
    setGuardandoRapida(false);
    enviandoRef.current = false;

    if (!res.ok) {
      setErrorRapida(res.error ?? "No se pudo generar la venta. Revisa los datos e intenta de nuevo.");
      return;
    }

    if ("offline" in res && res.offline) {
      setErrorRapida("Sin conexión. La venta se guardó y se enviará cuando vuelva internet.");
      setModalRapida(false);
      setConfirmandoRapida(false);
      return;
    }

    setModalRapida(false);
    setConfirmandoRapida(false);
    router.refresh();
    const rapidaData = "data" in res ? (res.data as { id?: string }) : undefined;
    if (rapidaData?.id) {
      router.push(`/facturas/${rapidaData.id}`);
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
            Facturas digitales generadas desde órdenes o ventas rápidas. Sin PDF por ahora.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={abrirRapida}
            className="inline-flex items-center justify-center rounded-lg border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-700 shadow-sm transition active:scale-[0.98] hover:bg-brand-50"
          >
            + Venta rápida
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setConfirmando(false);
              setModalOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition active:scale-[0.98] hover:bg-brand-700"
          >
            + Desde orden
          </button>
        </div>
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
            className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-100"
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
                <th className="px-4 py-3 font-medium">Tipo</th>
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
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                    No se encontraron facturas.
                  </td>
                </tr>
              ) : (
                facturasFiltradas.map((f) => (
                  <tr key={f.id} className="transition hover:bg-zinc-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-zinc-900">
                      #{String(f.numero_consecutivo).padStart(6, "0")}
                    </td>
                    <td className="px-4 py-3">
                      {f.orden_id ? (
                        <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                          Orden
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                          Directa
                        </span>
                      )}
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
                        className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 active:scale-[0.98]"
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

      {/* Modal: Generar Factura desde Orden */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="px-6 pt-5 pb-3">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
                Generar Factura desde Orden
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
                <div>
                  <label className="text-xs font-medium text-zinc-700">
                    Orden de servicio <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={ordenSeleccionadaId}
                    onChange={(e) => {
                      setOrdenSeleccionadaId(e.target.value);
                      setConfirmando(false);
                    }}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
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

                <div>
                  <label className="text-xs font-medium text-zinc-700">
                    Moneda de la factura <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={monedaId}
                    onChange={(e) => {
                      setMonedaId(e.target.value);
                      setConfirmando(false);
                    }}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
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

                {ordenSel && monedaSel && (
                  <div className="rounded-xl bg-zinc-900 p-4 text-white">
                    <p className="text-xs uppercase tracking-wider text-zinc-400">
                      Total estimado
                    </p>
                    <p className="text-2xl font-black">
                      {monedaSel.simbolo} {totalPreview.toFixed(2)}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {ordenSel.linea_repuestos} repuesto(s) + {ordenSel.linea_mano_obra} servicio(s) · convertido a {monedaSel.codigo}.
                    </p>
                  </div>
                )}

                {confirmando && ordenSel && monedaSel && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-semibold">¿Emitir esta factura?</p>
                    <p className="mt-1">
                      {ordenSel.cliente?.nombre} pagará{" "}
                      <span className="font-bold">
                        {monedaSel.simbolo} {totalPreview.toFixed(2)}
                      </span>
                      . Quedará congelada y no se podrá editar; si hay un error
                      solo se corrige anulando.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setConfirmando(false);
                  }}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 active:scale-[0.98]"
                >
                  Cancelar
                </button>
                {!confirmando ? (
                  <button
                    type="button"
                    onClick={() => setConfirmando(true)}
                    disabled={guardando || !ordenSel || !monedaSel}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
                  >
                    Revisar y emitir
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={guardando || !ordenSel || !monedaSel}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
                  >
                    {guardando ? "Generando..." : "Sí, emitir factura"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Venta Rápida */}
      {modalRapida && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="px-6 pt-5 pb-3">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
                Venta rápida
              </h2>
              <p className="text-xs text-zinc-500">
                Factura directa sin orden de servicio. Para trabajos pequeños.
              </p>
            </div>

            {errorRapida && (
              <div className="mx-6 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {errorRapida}
              </div>
            )}

            <form onSubmit={handleRapida} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
                {/* Cliente + moneda */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-700">
                      Cliente <span className="text-red-500">*</span>
                    </label>
                    {creandoCliente ? (
                      <div className="mt-1 space-y-2 rounded-lg border border-brand-200 bg-brand-50/40 p-3">
                        <input
                          type="text"
                          placeholder="Nombre *"
                          value={nuevoNombre}
                          onChange={(e) => setNuevoNombre(e.target.value)}
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                        />
                        <input
                          type="text"
                          placeholder="Teléfono *"
                          value={nuevoTelefono}
                          onChange={(e) => setNuevoTelefono(e.target.value)}
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                        />
                        <textarea
                          placeholder="Dirección (opcional)"
                          rows={2}
                          value={nuevoDireccion}
                          onChange={(e) => setNuevoDireccion(e.target.value)}
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                        />
                        {errorCliente && (
                          <p className="text-xs text-red-600">{errorCliente}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCrearCliente}
                            disabled={guardandoCliente}
                            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
                          >
                            {guardandoCliente ? "Guardando…" : "Guardar cliente"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setCreandoCliente(false)}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          required
                          value={clienteRapidaId}
                          onChange={(e) => {
                            setClienteRapidaId(e.target.value);
                            setConfirmandoRapida(false);
                          }}
                          className="mt-1 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                        >
                          <option value="">— Seleccionar —</option>
                          {clientesState.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre} ({c.telefono})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={abrirNuevoCliente}
                          className="mt-1 shrink-0 rounded-lg border border-brand-200 bg-white px-2.5 py-2 text-xs font-medium text-brand-700 transition hover:bg-brand-50 active:scale-[0.98]"
                        >
                          + Nuevo
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-700">
                      Moneda de la factura <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={monedaRapidaId}
                      onChange={(e) => {
                        setMonedaRapidaId(e.target.value);
                        setConfirmandoRapida(false);
                      }}
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                    >
                      <option value="">— Seleccionar —</option>
                      {monedas.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.codigo} ({m.simbolo})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Repuestos */}
                <div className="rounded-xl border border-zinc-200">
                  <div className="border-b border-zinc-100 px-4 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Repuestos
                    </p>
                  </div>
                  <div className="flex items-end gap-2 px-4 py-3">
                    <div className="flex-1">
                      <label className="text-[10px] font-medium text-zinc-500">Repuesto</label>
                      <select
                        value={repSel}
                        onChange={(e) => setRepSel(e.target.value)}
                        className="mt-0.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                      >
                        <option value="">— Seleccionar —</option>
                        {repuestos
                          .filter((r) => !lineasRepuestos.some((lr) => lr.repuesto_id === r.id))
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.nombre} — {r.calidad === "original" ? "Original" : "Genérica"}
                              {r.medida ? ` · ${r.medida}` : ""}
                              {r.compatible_con ? ` · ${r.compatible_con}` : ""}
                              {" · $"}
                              {r.precio_venta} (Stock: {r.stock_actual})
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="w-20">
                      <label className="text-[10px] font-medium text-zinc-500">Cant.</label>
                      <input
                        type="number"
                        min={1}
                        max={repuestos.find((r) => r.id === repSel)?.stock_actual ?? 1}
                        value={repCant}
                        onChange={(e) => setRepCant(Number(e.target.value))}
                        className="mt-0.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addRepuesto}
                      disabled={!repSel}
                      className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-900 active:scale-[0.98] disabled:opacity-40"
                    >
                      Agregar
                    </button>
                  </div>
                  {lineasRepuestos.length > 0 && (
                    <div className="divide-y divide-zinc-100">
                      {lineasRepuestos.map((r, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                          <span className="text-zinc-800">
                            {r.nombre}{" "}
                            <span className="text-xs text-zinc-400">× {r.cantidad}</span>
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs tabular-nums text-zinc-500">
                              {monedas.find((m) => m.id === r.moneda_id)?.simbolo}{" "}
                              {(r.precio * r.cantidad).toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeRepuesto(i)}
                              className="text-xs font-medium text-red-600 transition hover:bg-red-50"
                            >
                              Quitar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Servicios */}
                <div className="rounded-xl border border-zinc-200">
                  <div className="border-b border-zinc-100 px-4 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Servicios / Mano de obra
                    </p>
                  </div>
                  <div className="space-y-2 px-4 py-3">
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] font-medium text-zinc-500">Descripción</label>
                        <input
                          type="text"
                          value={srvDesc}
                          onChange={(e) => setSrvDesc(e.target.value)}
                          placeholder="Ej: Cambio de aceite"
                          className="mt-0.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                        />
                      </div>
                      <div className="w-24">
                        <label className="text-[10px] font-medium text-zinc-500">Precio cliente</label>
                        <input
                          type="number"
                          step={0.01}
                          min={0}
                          value={srvMonto}
                          onChange={(e) => setSrvMonto(e.target.value)}
                          placeholder="0.00"
                          className="mt-0.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                        />
                      </div>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] font-medium text-zinc-500">Moneda</label>
                        <select
                          value={srvMonedaId}
                          onChange={(e) => setSrvMonedaId(e.target.value)}
                          className="mt-0.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                        >
                          {monedas.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.codigo} ({m.simbolo})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] font-medium text-zinc-500">Mecánico (opcional)</label>
                        <select
                          value={srvMecanicoId}
                          onChange={(e) => handleSrvMecanicoChange(e.target.value)}
                          className="mt-0.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                        >
                          <option value="">— Ninguno —</option>
                          {mecanicos.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.nombre}{" "}
                              {m.porcentaje_comision === null || m.porcentaje_comision === undefined
                                ? "(sin %)"
                                : `(${m.porcentaje_comision}%)`}
                              {m.es_dueno ? " — Dueño" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={addServicio}
                        disabled={!srvDesc.trim() || srvMonto === ""}
                        className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-900 active:scale-[0.98] disabled:opacity-40"
                      >
                        Agregar
                      </button>
                    </div>
                    {srvMecanicoId && (
                      <div className="rounded-lg bg-zinc-50 p-2">
                        <label className="text-[10px] font-medium text-zinc-500">¿Cómo se le paga? *</label>
                        <div className="mt-1 grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSrvModoPago("porcentaje")}
                            className={`rounded-md border px-2 py-1.5 text-xs font-medium transition ${srvModoPago === "porcentaje" ? "border-brand-600 bg-white text-brand-700" : "border-zinc-200 bg-white text-zinc-500"}`}
                          >
                            % del precio
                          </button>
                          <button
                            type="button"
                            onClick={() => setSrvModoPago("fijo")}
                            className={`rounded-md border px-2 py-1.5 text-xs font-medium transition ${srvModoPago === "fijo" ? "border-brand-600 bg-white text-brand-700" : "border-zinc-200 bg-white text-zinc-500"}`}
                          >
                            Monto fijo
                          </button>
                        </div>
                        {srvModoPago === "porcentaje" ? (
                          <div className="mt-1.5">
                            <label className="text-[10px] font-medium text-zinc-500">% de comisión *</label>
                            <input
                              type="number"
                              step={0.5}
                              min={0}
                              max={100}
                              value={srvComision}
                              onChange={(e) => setSrvComision(e.target.value)}
                              placeholder="Ej: 30"
                              className="mt-0.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                            />
                            {srvMonto !== "" && srvComision !== "" && (
                              <p className="mt-1 text-[11px] text-emerald-700">
                                Gana ${((Number(srvMonto) * Number(srvComision)) / 100).toFixed(2)}
                                {mecanicos.find((m) => m.id === srvMecanicoId)?.es_dueno
                                  ? " (dueño: queda en el taller)"
                                  : ""}
                                {Number(srvComision) === 0 ? " — ojo: comisión $0" : ""}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="mt-1.5">
                            <label className="text-[10px] font-medium text-zinc-500">Monto fijo que gana *</label>
                            <input
                              type="number"
                              step={0.01}
                              min={0}
                              value={srvMontoAPagar}
                              onChange={(e) => setSrvMontoAPagar(e.target.value)}
                              placeholder="Lo acordado"
                              className="mt-0.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                            />
                            <p className="mt-1 text-[11px] text-zinc-500">Para repartos con ayudante usa una orden.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {lineasServicios.length > 0 && (
                    <div className="divide-y divide-zinc-100">
                      {lineasServicios.map((s, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                          <span className="text-zinc-800">
                            {s.descripcion}
                            {s.empleado_id && (
                              <span className="ml-1.5 text-xs text-zinc-400">
                                · {mecanicos.find((m) => m.id === s.empleado_id)?.nombre}
                                {s.monto_a_pagar !== null && s.monto_a_pagar !== undefined
                                  ? ` · gana fijo $${Number(s.monto_a_pagar).toFixed(2)}`
                                  : s.porcentaje_comision_aplicado !== null && s.porcentaje_comision_aplicado !== undefined
                                    ? ` · ${s.porcentaje_comision_aplicado}% ($${((s.monto * Number(s.porcentaje_comision_aplicado)) / 100).toFixed(2)})`
                                    : ""}
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs tabular-nums text-zinc-500">
                              {monedas.find((m) => m.id === s.moneda_id)?.simbolo}{" "}
                              {s.monto.toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeServicio(i)}
                              className="text-xs font-medium text-red-600 transition hover:bg-red-50"
                            >
                              Quitar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Total preview */}
                {monedaRapida && (lineasRepuestos.length > 0 || lineasServicios.length > 0) && (
                  <div className="rounded-xl bg-zinc-900 p-4 text-white">
                    <p className="text-xs uppercase tracking-wider text-zinc-400">
                      Total estimado
                    </p>
                    <p className="text-2xl font-black">
                      {monedaRapida.simbolo} {totalRapida.toFixed(2)}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {lineasRepuestos.length} repuesto(s) + {lineasServicios.length} servicio(s) · el stock se descuenta al generar.
                    </p>
                  </div>
                )}

                {confirmandoRapida && monedaRapida && (lineasRepuestos.length > 0 || lineasServicios.length > 0) && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-semibold">¿Emitir esta factura?</p>
                    <p className="mt-1">
                      {clientesState.find((c) => c.id === clienteRapidaId)?.nombre} pagará{" "}
                      <span className="font-bold">
                        {monedaRapida.simbolo} {totalRapida.toFixed(2)}
                      </span>
                      {lineasServicios.some((s) => s.empleado_id) && (
                        <>
                          {" · mecánicos ganan "}
                          <span className="font-bold">
                            {monedaRapida.simbolo}{" "}
                            {lineasServicios
                              .reduce((acc, s) => {
                                if (!s.empleado_id) return acc;
                                if (s.monto_a_pagar !== null && s.monto_a_pagar !== undefined)
                                  return acc + Number(s.monto_a_pagar);
                                if (s.porcentaje_comision_aplicado !== null && s.porcentaje_comision_aplicado !== undefined)
                                  return acc + (s.monto * Number(s.porcentaje_comision_aplicado)) / 100;
                                return acc;
                              }, 0)
                              .toFixed(2)}
                          </span>
                        </>
                      )}
                      . Quedará congelada y no se podrá editar.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setModalRapida(false);
                    setConfirmandoRapida(false);
                  }}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 active:scale-[0.98]"
                >
                  Cancelar
                </button>
                {!confirmandoRapida ? (
                  <button
                    type="button"
                    onClick={() => setConfirmandoRapida(true)}
                    disabled={guardandoRapida || !clienteRapidaId || !monedaRapidaId || (lineasRepuestos.length === 0 && lineasServicios.length === 0)}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
                  >
                    Revisar y emitir
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={guardandoRapida || !clienteRapidaId || !monedaRapidaId || (lineasRepuestos.length === 0 && lineasServicios.length === 0)}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
                  >
                    {guardandoRapida ? "Generando..." : "Sí, emitir factura"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
