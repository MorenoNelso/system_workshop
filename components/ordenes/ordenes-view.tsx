"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteOrden } from "@/lib/actions/ordenes";
import { executeOrEnqueue } from "@/lib/offline/queue";

interface ClienteLite {
  id: string;
  nombre: string;
  telefono: string | null;
}

interface MotoLite {
  id: string;
  cliente_id: string | null;
  marca: string;
  modelo: string;
  placa: string | null;
}

interface EmpleadoLite {
  id: string;
  nombre: string;
  porcentaje_comision: number | null;
}

interface OrdenRow {
  id: string;
  estado: string;
  fecha_ingreso: string;
  diagnostico: string | null;
  observaciones: string | null;
  cliente: { nombre: string; telefono: string | null } | null;
  moto: { marca: string; modelo: string; placa: string | null } | null;
  empleado_asignado: { nombre: string } | null;
}

interface Props {
  initialOrdenes: OrdenRow[];
  clientes: ClienteLite[];
  motos: MotoLite[];
  empleados: EmpleadoLite[];
}

const ESTADOS = [
  { id: "todos", label: "Todas" },
  { id: "recibido", label: "Recibidas", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { id: "en_proceso", label: "En Proceso", color: "bg-brand-100 text-brand-800 border-brand-200" },
  { id: "terminado", label: "Terminadas", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { id: "entregado", label: "Entregadas", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
];

export function OrdenesView({ initialOrdenes, clientes, motos, empleados }: Props) {
  const router = useRouter();
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Motos disponibles en el modal (todas, sin filtrar por cliente)
  const [motosState, setMotosState] = useState(motos);
  // Alta rápida de moto desde la orden
  const [creandoMoto, setCreandoMoto] = useState(false);
  const [motoMarca, setMotoMarca] = useState("");
  const [motoModelo, setMotoModelo] = useState("");
  const [motoCilindraje, setMotoCilindraje] = useState("");
  const [motoColor, setMotoColor] = useState("");
  const [motoSel, setMotoSel] = useState("");
  const [guardandoMoto, setGuardandoMoto] = useState(false);
  const [errorMoto, setErrorMoto] = useState<string | null>(null);

  const motosFiltradasModal = motosState;

  const ordenesFiltradas = initialOrdenes.filter((o) => {
    const cumpleEstado = filtroEstado === "todos" || o.estado === filtroEstado;
    const term = busqueda.toLowerCase().trim();
    if (!term) return cumpleEstado;

    const cliente = o.cliente?.nombre?.toLowerCase() || "";
    const moto = `${o.moto?.marca || ""} ${o.moto?.modelo || ""} ${o.moto?.placa || ""}`.toLowerCase();
    const diagnostico = (o.diagnostico || "").toLowerCase();

    return cumpleEstado && (cliente.includes(term) || moto.includes(term) || diagnostico.includes(term));
  });

  async function handleCreate(formData: FormData) {
    setGuardando(true);
    setError(null);

    const raw = {
      cliente_id: formData.get("cliente_id"),
      moto_id: formData.get("moto_id"),
      empleado_asignado_id: formData.get("empleado_asignado_id") || null,
      estado: formData.get("estado") || "recibido",
      diagnostico: formData.get("diagnostico") || null,
      observaciones: formData.get("observaciones") || null,
      fecha_entrega_estimada: formData.get("fecha_entrega_estimada") || null,
    };

    const res = await executeOrEnqueue("createOrden", raw);
    setGuardando(false);

    if ("offline" in res && res.offline) {
      setError("Sin conexión. Se guardará cuando vuelva internet.");
      return;
    }
    if (!res.ok) {
      setError(res.error);
      return;
    }

    setModalOpen(false);
    router.refresh();
    const ordenData = res as { ok: true; data?: { id?: string } };
    if (ordenData.data?.id) {
      router.push(`/ordenes/${ordenData.data.id}`);
    }
  }

  async function handleCrearMoto() {
    if (!motoMarca.trim() || !motoModelo.trim()) {
      setErrorMoto("La marca y el modelo son obligatorios.");
      return;
    }
    setGuardandoMoto(true);
    setErrorMoto(null);
    // La moto se crea SIN cliente (el cliente es de la orden, no de la moto).
    const res = await executeOrEnqueue("createMoto", {
      marca: motoMarca,
      modelo: motoModelo,
      cilindraje: motoCilindraje || null,
      color: motoColor || null,
    });
    setGuardandoMoto(false);
    if ("offline" in res && res.offline) {
      setErrorMoto("Sin conexión. Se guardará cuando vuelva internet.");
      return;
    }
    if (!res.ok) {
      setErrorMoto(res.error);
      return;
    }
    const nueva = (res as { ok: true; data: MotoLite }).data;
    setMotosState((prev) => [...prev, nueva]);
    setMotoSel(nueva.id);
    setCreandoMoto(false);
    setMotoMarca("");
    setMotoModelo("");
    setMotoCilindraje("");
    setMotoColor("");
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Estás seguro de eliminar esta orden?")) return;
    const res = await deleteOrden(id);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  const getBadge = (estado: string) => {
    switch (estado) {
      case "recibido":
        return <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">Recibido</span>;
      case "en_proceso":
        return <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800">En Proceso</span>;
      case "terminado":
        return <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-800">Terminado</span>;
      case "entregado":
        return <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">Entregado</span>;
      default:
        return <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-700">{estado}</span>;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Órdenes de Servicio
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Recepción de motos, diagnósticos, repuestos utilizados y mano de obra.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setMotoSel("");
            setModalOpen(true);
          }}
          className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition active:scale-[0.98] hover:bg-brand-700"
        >
          + Nueva Orden de Servicio
        </button>
      </div>

      {/* Barra de filtros y búsqueda */}
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
            placeholder="Buscar por cliente, moto, placa..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </div>

      {/* Listado de Órdenes */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Moto</th>
                <th className="px-4 py-3 font-medium">Mecánico Asignado</th>
                <th className="px-4 py-3 font-medium">Fecha Ingreso</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {ordenesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    No se encontraron órdenes de servicio.
                  </td>
                </tr>
              ) : (
                ordenesFiltradas.map((orden) => (
                  <tr key={orden.id} className="transition hover:bg-zinc-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getBadge(orden.estado)}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      <div>{orden.cliente?.nombre || "—"}</div>
                      <div className="text-xs text-zinc-400">{orden.cliente?.telefono}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      <div className="font-medium">
                        {orden.moto?.marca} {orden.moto?.modelo}
                      </div>
                      {orden.moto?.placa && (
                        <span className="inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                          {orden.moto.placa}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {orden.empleado_asignado?.nombre || <span className="text-zinc-400 italic">Sin asignar</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {new Date(orden.fecha_ingreso).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/ordenes/${orden.id}`}
                          className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 active:scale-[0.98]"
                        >
                          Ver Detalle / Trabajar →
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(orden.id)}
                          className="rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nueva Orden */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="px-6 pt-5 pb-3">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
                Nueva Orden de Servicio
              </h2>
              <p className="text-xs text-zinc-500">
                Registra el ingreso de una motocicleta al taller.
              </p>
            </div>

            {error && (
              <div className="mx-6 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {error}
              </div>
            )}

            <form action={handleCreate} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
                {/* Cliente */}
                <div>
                  <label className="text-xs font-medium text-zinc-700">
                    Cliente <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="cliente_id"
                    required
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="">— Seleccionar cliente —</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} ({c.telefono})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Moto */}
                <div>
                  <label className="text-xs font-medium text-zinc-700">
                    Motocicleta <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      name="moto_id"
                      required
                      value={motoSel}
                      onChange={(e) => setMotoSel(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                    >
                      <option value="">— Seleccionar moto —</option>
                      {motosFiltradasModal.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.marca} {m.modelo} {m.placa ? `(Placa: ${m.placa})` : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setCreandoMoto(!creandoMoto);
                        setErrorMoto(null);
                      }}
                      className="mt-1 shrink-0 rounded-lg border border-brand-200 bg-white px-2.5 py-2 text-xs font-medium text-brand-700 transition hover:bg-brand-50 active:scale-[0.98]"
                    >
                      + Nueva
                    </button>
                  </div>

                  {creandoMoto ? (
                    <div className="mt-2 space-y-2 rounded-lg border border-brand-200 bg-brand-50/40 p-3">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Marca *"
                          value={motoMarca}
                          onChange={(e) => setMotoMarca(e.target.value)}
                          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                        />
                        <input
                          type="text"
                          placeholder="Modelo *"
                          value={motoModelo}
                          onChange={(e) => setMotoModelo(e.target.value)}
                          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                        />
                        <input
                          type="text"
                          placeholder="Cilindraje (opcional)"
                          value={motoCilindraje}
                          onChange={(e) => setMotoCilindraje(e.target.value)}
                          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                        />
                        <input
                          type="text"
                          placeholder="Color (opcional)"
                          value={motoColor}
                          onChange={(e) => setMotoColor(e.target.value)}
                          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                        />
                      </div>
                      {errorMoto && <p className="text-xs text-red-600">{errorMoto}</p>}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCrearMoto}
                          disabled={guardandoMoto}
                          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
                        >
                          {guardandoMoto ? "Guardando…" : "Guardar moto"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCreandoMoto(false)}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Mecánico asignado */}
                <div>
                  <label className="text-xs font-medium text-zinc-700">
                    Mecánico / Responsable Asignado
                  </label>
                  <select
                    name="empleado_asignado_id"
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="">— Sin asignar / Cualquiera —</option>
                    {empleados.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nombre} {emp.porcentaje_comision ? `(${emp.porcentaje_comision}% com.)` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Estado inicial */}
                <div>
                  <label className="text-xs font-medium text-zinc-700">Estado inicial</label>
                  <select
                    name="estado"
                    defaultValue="recibido"
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="recibido">Recibido</option>
                    <option value="en_proceso">En Proceso</option>
                  </select>
                </div>

                {/* Diagnóstico */}
                <div>
                  <label className="text-xs font-medium text-zinc-700">Diagnóstico / Motivo de ingreso</label>
                  <textarea
                    name="diagnostico"
                    rows={2}
                    placeholder="Ej: Cambio de aceite, sonido en motor, revisión de frenos..."
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                {/* Observaciones */}
                <div>
                  <label className="text-xs font-medium text-zinc-700">Observaciones / Estado al recibir</label>
                  <textarea
                    name="observaciones"
                    rows={2}
                    placeholder="Rayones en tanque, sin espejo izquierdo, etc."
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                {/* Fecha entrega estimada */}
                <div>
                  <label className="text-xs font-medium text-zinc-700">Fecha Estimada de Entrega</label>
                  <input
                    type="date"
                    name="fecha_entrega_estimada"
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                  />
                </div>
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
                  disabled={guardando}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
                >
                  {guardando ? "Creando orden..." : "Crear Orden"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
