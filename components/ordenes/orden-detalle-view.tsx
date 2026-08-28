"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  agregarManoObraAOrden,
  agregarRepuestoAOrden,
  eliminarManoObraDeOrden,
  eliminarRepuestoDeOrden,
  updateEstadoOrden,
} from "@/lib/actions/ordenes";

interface Props {
  orden: any;
  repuestosDisponibles: any[];
  mecanicos: any[];
  monedas: any[];
}

export function OrdenDetalleView({
  orden,
  repuestosDisponibles,
  mecanicos,
  monedas,
}: Props) {
  const router = useRouter();
  const [estado, setEstado] = useState(orden.estado);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  // Form states Repuesto
  const [modalRepuesto, setModalRepuesto] = useState(false);
  const [repuestoSeleccionadoId, setRepuestoSeleccionadoId] = useState("");
  const [cantidadRepuesto, setCantidadRepuesto] = useState(1);
  const [guardandoRepuesto, setGuardandoRepuesto] = useState(false);
  const [errorRepuesto, setErrorRepuesto] = useState<string | null>(null);

  // Form states Mano de Obra
  const [modalManoObra, setModalManoObra] = useState(false);
  const [mecanicoId, setMecanicoId] = useState(orden.empleado_asignado_id || "");
  const [descripcionMO, setDescripcionMO] = useState("");
  const [montoMO, setMontoMO] = useState<number | string>("");
  const [monedaMOId, setMonedaMOId] = useState(monedas[0]?.id || "");
  const [comisionMO, setComisionMO] = useState<number | string>("");
  const [guardandoMO, setGuardandoMO] = useState(false);
  const [errorMO, setErrorMO] = useState<string | null>(null);

  // Cuando cambia el mecánico seleccionado en el modal de mano de obra, actualizar su % sugerido
  const handleMecanicoChange = (id: string) => {
    setMecanicoId(id);
    const mec = mecanicos.find((m) => m.id === id);
    if (mec && mec.porcentaje_comision !== null) {
      setComisionMO(mec.porcentaje_comision);
    }
  };

  const repuestoObj = repuestosDisponibles.find((r) => r.id === repuestoSeleccionadoId);

  // Cambiar estado de la orden
  async function handleCambioEstado(nuevoEstado: "recibido" | "en_proceso" | "terminado" | "entregado") {
    setCambiandoEstado(true);
    const res = await updateEstadoOrden(orden.id, nuevoEstado);
    setCambiandoEstado(false);
    if (res.ok) {
      setEstado(nuevoEstado);
      router.refresh();
    } else {
      alert(res.error);
    }
  }

  // Agregar Repuesto
  async function handleAgregarRepuesto(e: React.FormEvent) {
    e.preventDefault();
    setGuardandoRepuesto(true);
    setErrorRepuesto(null);

    const res = await agregarRepuestoAOrden({
      orden_id: orden.id,
      repuesto_id: repuestoSeleccionadoId,
      cantidad: Number(cantidadRepuesto),
    });

    setGuardandoRepuesto(false);
    if (!res.ok) {
      setErrorRepuesto(res.error);
      return;
    }

    setModalRepuesto(false);
    setRepuestoSeleccionadoId("");
    setCantidadRepuesto(1);
    router.refresh();
  }

  // Eliminar Repuesto (restaura stock)
  async function handleEliminarRepuesto(detalleId: string, nombreRep: string) {
    if (!confirm(`¿Eliminar '${nombreRep}' de la orden? El stock será devuelto automáticamente al inventario.`)) {
      return;
    }
    const res = await eliminarRepuestoDeOrden(detalleId, orden.id);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    router.refresh();
  }

  // Agregar Mano de Obra
  async function handleAgregarManoObra(e: React.FormEvent) {
    e.preventDefault();
    setGuardandoMO(true);
    setErrorMO(null);

    const res = await agregarManoObraAOrden({
      orden_id: orden.id,
      empleado_id: mecanicoId,
      descripcion: descripcionMO,
      monto: Number(montoMO),
      moneda_id: monedaMOId,
      porcentaje_comision_aplicado: comisionMO !== "" ? Number(comisionMO) : null,
    });

    setGuardandoMO(false);
    if (!res.ok) {
      setErrorMO(res.error);
      return;
    }

    setModalManoObra(false);
    setDescripcionMO("");
    setMontoMO("");
    router.refresh();
  }

  // Eliminar Mano de Obra
  async function handleEliminarManoObra(detalleId: string) {
    if (!confirm("¿Eliminar este ítem de mano de obra?")) return;
    const res = await eliminarManoObraDeOrden(detalleId, orden.id);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    router.refresh();
  }

  // Cálculos de totales
  const totalRepuestos = (orden.repuestos || []).reduce(
    (acc: number, item: any) => acc + item.cantidad * Number(item.precio_unitario_aplicado),
    0
  );

  const totalManoObra = (orden.mano_obra || []).reduce(
    (acc: number, item: any) => acc + Number(item.monto),
    0
  );

  const totalComisiones = (orden.mano_obra || []).reduce(
    (acc: number, item: any) => acc + Number(item.comision_calculada || 0),
    0
  );

  const monedaSimbolo = orden.repuestos?.[0]?.moneda?.simbolo || orden.mano_obra?.[0]?.moneda?.simbolo || "$";

  return (
    <div className="flex flex-col gap-6">
      {/* Botón Volver y Cabecera */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/ordenes"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-100"
          >
            ←
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
                Orden #{orden.id.slice(0, 8).toUpperCase()}
              </h1>
              <span className="text-xs text-zinc-400 font-mono">({new Date(orden.fecha_ingreso).toLocaleDateString()})</span>
            </div>
            <p className="text-sm text-zinc-500">
              {orden.cliente?.nombre} • {orden.moto?.marca} {orden.moto?.modelo} {orden.moto?.placa ? `[${orden.moto?.placa}]` : ""}
            </p>
          </div>
        </div>

        {/* Selector de Estado */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">Estado:</span>
          <select
            value={estado}
            disabled={cambiandoEstado}
            onChange={(e) => handleCambioEstado(e.target.value as any)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="recibido">🟡 Recibido</option>
            <option value="en_proceso">🔵 En Proceso</option>
            <option value="terminado">🟣 Terminado</option>
            <option value="entregado">🟢 Entregado</option>
          </select>
        </div>
      </div>

      {/* Grid de Información de Cliente, Moto y Diagnóstico */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Cliente */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Cliente</h3>
          </div>
          <div className="mt-3 space-y-1 text-sm">
            <p className="font-medium text-zinc-900">{orden.cliente?.nombre}</p>
            <p className="text-zinc-500">📞 {orden.cliente?.telefono}</p>
            {orden.cliente?.documento && <p className="text-xs text-zinc-400">Doc: {orden.cliente.documento}</p>}
          </div>
        </div>

        {/* Motocicleta */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Motocicleta</h3>
          </div>
          <div className="mt-3 space-y-1 text-sm">
            <p className="font-medium text-zinc-900">{orden.moto?.marca} {orden.moto?.modelo}</p>
            <p className="text-zinc-500">Placa: <span className="font-mono font-medium">{orden.moto?.placa || "N/A"}</span></p>
            {orden.moto?.cilindraje && <p className="text-xs text-zinc-400">{orden.moto.cilindraje} cc • Color: {orden.moto.color || "N/A"}</p>}
          </div>
        </div>

        {/* Diagnóstico */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Diagnóstico</h3>
          </div>
          <div className="mt-3 text-sm text-zinc-700">
            <p className="italic">{orden.diagnostico || "Sin diagnóstico registrado."}</p>
            {orden.observaciones && (
              <p className="mt-2 text-xs text-zinc-500 border-t border-zinc-100 pt-2">
                <span className="font-medium">Observaciones:</span> {orden.observaciones}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* SECCIÓN 1: REPUESTOS UTILIZADOS (Snapshot & Stock Descontado) */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-zinc-900">
              Repuestos y Materiales Utilizados
            </h2>
            <p className="text-xs text-zinc-500">
              Se descuentan automáticamente del inventario y guardan el precio congelado (snapshot).
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setErrorRepuesto(null);
              setModalRepuesto(true);
            }}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
          >
            + Agregar Repuesto
          </button>
        </div>

        {/* Tabla de Repuestos */}
        <div className="overflow-x-auto rounded-xl border border-zinc-100">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Repuesto</th>
                <th className="px-4 py-2.5 font-medium text-center">Cantidad</th>
                <th className="px-4 py-2.5 font-medium text-right">Precio Snapshot</th>
                <th className="px-4 py-2.5 font-medium text-right">Subtotal</th>
                <th className="px-4 py-2.5 text-right font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(!orden.repuestos || orden.repuestos.length === 0) ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-xs text-zinc-400">
                    No se han agregado repuestos a esta orden.
                  </td>
                </tr>
              ) : (
                orden.repuestos.map((item: any) => (
                  <tr key={item.id} className="transition hover:bg-zinc-50">
                    <td className="px-4 py-2.5 font-medium text-zinc-800">
                      {item.repuesto?.nombre}
                      {item.repuesto?.sku && (
                        <span className="ml-2 font-mono text-xs text-zinc-400">({item.repuesto.sku})</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center font-medium text-zinc-700">
                      {item.cantidad}
                    </td>
                    <td className="px-4 py-2.5 text-right text-zinc-600">
                      {item.moneda?.simbolo || "$"} {Number(item.precio_unitario_aplicado).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-zinc-900">
                      {item.moneda?.simbolo || "$"} {(item.cantidad * Number(item.precio_unitario_aplicado)).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleEliminarRepuesto(item.id, item.repuesto?.nombre)}
                        className="rounded px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {orden.repuestos?.length > 0 && (
              <tfoot className="bg-zinc-50 font-medium">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-right text-zinc-600">Total Repuestos:</td>
                  <td className="px-4 py-2.5 text-right font-bold text-zinc-900">
                    {monedaSimbolo} {totalRepuestos.toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* SECCIÓN 2: MANO DE OBRA (Snapshot & Cálculo de Comisión) */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-zinc-900">
              Mano de Obra y Servicios
            </h2>
            <p className="text-xs text-zinc-500">
              Registra los trabajos realizados con cálculo automático de comisiones para los mecánicos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setErrorMO(null);
              setModalManoObra(true);
            }}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
          >
            + Agregar Mano de Obra
          </button>
        </div>

        {/* Tabla de Mano de Obra */}
        <div className="overflow-x-auto rounded-xl border border-zinc-100">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Mecánico</th>
                <th className="px-4 py-2.5 font-medium">Descripción del Servicio</th>
                <th className="px-4 py-2.5 font-medium text-right">% Comisión</th>
                <th className="px-4 py-2.5 font-medium text-right">Comisión Mecánico</th>
                <th className="px-4 py-2.5 font-medium text-right">Monto</th>
                <th className="px-4 py-2.5 text-right font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(!orden.mano_obra || orden.mano_obra.length === 0) ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-xs text-zinc-400">
                    No se han registrado servicios de mano de obra.
                  </td>
                </tr>
              ) : (
                orden.mano_obra.map((item: any) => (
                  <tr key={item.id} className="transition hover:bg-zinc-50">
                    <td className="px-4 py-2.5 font-medium text-zinc-900">
                      {item.empleado?.nombre}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-700">
                      {item.descripcion}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-zinc-500">
                      {item.porcentaje_comision_aplicado !== null ? `${item.porcentaje_comision_aplicado}%` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-semibold text-emerald-700">
                      {item.comision_calculada !== null ? `${item.moneda?.simbolo || "$"} ${Number(item.comision_calculada).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-zinc-900">
                      {item.moneda?.simbolo || "$"} {Number(item.monto).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleEliminarManoObra(item.id)}
                        className="rounded px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {orden.mano_obra?.length > 0 && (
              <tfoot className="bg-zinc-50 font-medium">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-right text-zinc-600">Total Comisiones:</td>
                  <td className="px-4 py-2.5 text-right font-bold text-emerald-700">
                    {monedaSimbolo} {totalComisiones.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-zinc-900">
                    {monedaSimbolo} {totalManoObra.toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* RESUMEN TOTAL DE LA ORDEN */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-900 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold">Resumen de la Orden</h3>
            <p className="text-xs text-zinc-400">Total estimado a facturar por repuestos y servicios.</p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-right">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-400">Repuestos</p>
              <p className="text-sm font-semibold">{monedaSimbolo} {totalRepuestos.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-400">Mano de Obra</p>
              <p className="text-sm font-semibold">{monedaSimbolo} {totalManoObra.toFixed(2)}</p>
            </div>
            <div className="border-l border-zinc-700 pl-6">
              <p className="text-xs uppercase tracking-wider text-pink-400 font-semibold">Total General</p>
              <p className="text-2xl font-black text-white">{monedaSimbolo} {(totalRepuestos + totalManoObra).toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: AGREGAR REPUESTO */}
      {modalRepuesto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="h-1 w-full bg-pink-400" />
            <div className="px-6 pt-5 pb-3">
              <h3 className="text-base font-semibold text-zinc-900">Agregar Repuesto a la Orden</h3>
              <p className="text-xs text-zinc-500">El stock se descontará automáticamente.</p>
            </div>

            {errorRepuesto && (
              <div className="mx-6 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                {errorRepuesto}
              </div>
            )}

            <form onSubmit={handleAgregarRepuesto} className="space-y-4 px-6 py-4">
              <div>
                <label className="text-xs font-medium text-zinc-700">Seleccionar Repuesto *</label>
                <select
                  required
                  value={repuestoSeleccionadoId}
                  onChange={(e) => setRepuestoSeleccionadoId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">— Seleccionar —</option>
                  {repuestosDisponibles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre} (Stock: {r.stock_actual} • Precio: ${r.precio_venta})
                    </option>
                  ))}
                </select>
              </div>

              {repuestoObj && (
                <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
                  <p>Stock disponible: <span className="font-semibold text-zinc-900">{repuestoObj.stock_actual}</span></p>
                  <p>Precio unitario: <span className="font-semibold text-zinc-900">${repuestoObj.precio_venta}</span></p>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-zinc-700">Cantidad *</label>
                <input
                  type="number"
                  min={1}
                  max={repuestoObj ? repuestoObj.stock_actual : 999}
                  required
                  value={cantidadRepuesto}
                  onChange={(e) => setCantidadRepuesto(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-4">
                <button
                  type="button"
                  onClick={() => setModalRepuesto(false)}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoRepuesto}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {guardandoRepuesto ? "Agregando..." : "Agregar Repuesto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR MANO DE OBRA */}
      {modalManoObra && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="h-1 w-full bg-pink-400" />
            <div className="px-6 pt-5 pb-3">
              <h3 className="text-base font-semibold text-zinc-900">Agregar Mano de Obra</h3>
              <p className="text-xs text-zinc-500">Se calculará la comisión del mecánico automáticamente.</p>
            </div>

            {errorMO && (
              <div className="mx-6 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                {errorMO}
              </div>
            )}

            <form onSubmit={handleAgregarManoObra} className="space-y-4 px-6 py-4">
              <div>
                <label className="text-xs font-medium text-zinc-700">Mecánico Responsable *</label>
                <select
                  required
                  value={mecanicoId}
                  onChange={(e) => handleMecanicoChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">— Seleccionar mecánico —</option>
                  {mecanicos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} {m.porcentaje_comision ? `(${m.porcentaje_comision}% com.)` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700">Descripción del Trabajo / Servicio *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Calibración de válvulas, cambio de kit de arrastre..."
                  value={descripcionMO}
                  onChange={(e) => setDescripcionMO(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-700">Monto / Precio *</label>
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    required
                    placeholder="0.00"
                    value={montoMO}
                    onChange={(e) => setMontoMO(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-700">Moneda *</label>
                  <select
                    required
                    value={monedaMOId}
                    onChange={(e) => setMonedaMOId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {monedas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.codigo} ({m.simbolo})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700">
                  % Comisión Aplicado (opcional, hereda del empleado si se deja vacío)
                </label>
                <input
                  type="number"
                  step={0.5}
                  min={0}
                  max={100}
                  placeholder="Ej: 30"
                  value={comisionMO}
                  onChange={(e) => setComisionMO(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {montoMO && comisionMO && (
                <div className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800">
                  Comisión calculada para el mecánico:{" "}
                  <span className="font-bold">
                    ${((Number(montoMO) * Number(comisionMO)) / 100).toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-4">
                <button
                  type="button"
                  onClick={() => setModalManoObra(false)}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoMO}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {guardandoMO ? "Guardando..." : "Guardar Mano de Obra"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
