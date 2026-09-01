"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { describirCambio, etiquetaTabla } from "@/lib/auditoria-utils";
import type { LogAuditoria } from "@/lib/actions/auditoria";

const ACCIONES = [
  { value: "insert", label: "Crear", color: "bg-emerald-100 text-emerald-700" },
  { value: "update", label: "Editar", color: "bg-blue-100 text-blue-700" },
  { value: "delete", label: "Eliminar", color: "bg-red-100 text-red-700" },
];

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100";

interface Props {
  logs: LogAuditoria[];
  total: number;
  pagina: number;
  totalPaginas: number;
  usuarios: { id: string; nombre: string }[];
}

export function AuditoriaView({
  logs,
  total,
  pagina,
  totalPaginas,
  usuarios,
}: Props) {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [tabla, setTabla] = useState("");
  const [accion, setAccion] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  function aplicar() {
    const params = new URLSearchParams();
    if (usuario) params.set("usuario", usuario);
    if (tabla) params.set("tabla", tabla);
    if (accion) params.set("accion", accion);
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    router.push(`/auditoria?${params.toString()}`);
  }

  function irPagina(p: number) {
    const params = new URLSearchParams(window.location.search);
    params.set("pagina", String(p));
    router.push(`/auditoria?${params.toString()}`);
  }

  const tablas = [...new Set(logs.map((l) => l.tabla_afectada))].sort();

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:grid-cols-5">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Usuario</label>
          <select value={usuario} onChange={(e) => setUsuario(e.target.value)} className={inputClass}>
            <option value="">Todos</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Tabla</label>
          <select value={tabla} onChange={(e) => setTabla(e.target.value)} className={inputClass}>
            <option value="">Todas</option>
            {tablas.map((t) => (
              <option key={t} value={t}>
                {etiquetaTabla(t)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Acción</label>
          <select value={accion} onChange={(e) => setAccion(e.target.value)} className={inputClass}>
            <option value="">Todas</option>
            <option value="insert">Crear</option>
            <option value="update">Editar</option>
            <option value="delete">Eliminar</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Hasta</label>
          <div className="flex items-end gap-2">
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={inputClass} />
            <button
              type="button"
              onClick={aplicar}
              className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98]"
            >
              Filtrar
            </button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Módulo</th>
                <th className="px-4 py-3 font-medium">Acción</th>
                <th className="px-4 py-3 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                    No hay movimientos registrados con esos filtros.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="align-top transition hover:bg-zinc-50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">
                      {new Date(l.fecha).toLocaleString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {l.nombre_usuario}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {etiquetaTabla(l.tabla_afectada)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          ACCIONES.find((a) => a.value === l.accion)?.color ??
                          "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {ACCIONES.find((a) => a.value === l.accion)?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600">
                      {describirCambio(l)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      {totalPaginas > 1 ? (
        <div className="flex items-center justify-between text-sm text-zinc-600">
          <span>
            Página {pagina} de {totalPaginas} · {total} movimientos
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagina <= 1}
              onClick={() => irPagina(pagina - 1)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-40"
            >
              ← Anterior
            </button>
            <button
              type="button"
              disabled={pagina >= totalPaginas}
              onClick={() => irPagina(pagina + 1)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-40"
            >
              Siguiente →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}