"use client";

import { useState } from "react";
import { useActionState } from "react";

import {
  cambiarRolUsuario,
  crearUsuario,
  toggleUsuarioActivo,
  type CrearUsuarioState,
  type UsuarioRow,
} from "@/lib/actions/usuarios";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100";

function RolBadge({ rol }: { rol: string }) {
  return rol === "administrador" ? (
    <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
      Administrador
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
      Colaborador
    </span>
  );
}

export function UsuariosClient({ usuarios: initial }: { usuarios: UsuarioRow[] }) {
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>(initial);
  const [crearOpen, setCrearOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [state, formAction, pending] = useActionState<
    CrearUsuarioState,
    FormData
  >(crearUsuario, undefined);

  async function handleToggle(u: UsuarioRow) {
    setBusy(u.id);
    setError(null);
    const res = await toggleUsuarioActivo(u.id, !u.activo);
    setBusy(null);
    if (!res.ok) return setError(res.error ?? "Error");
    setUsuarios((prev) =>
      prev.map((x) => (x.id === u.id ? { ...x, activo: !x.activo } : x)),
    );
  }

  async function handleRol(u: UsuarioRow, rol: "administrador" | "colaborador") {
    setBusy(u.id);
    setError(null);
    const res = await cambiarRolUsuario(u.id, rol);
    setBusy(null);
    if (!res.ok) return setError(res.error ?? "Error");
    setUsuarios((prev) =>
      prev.map((x) => (x.id === u.id ? { ...x, rol } : x)),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCrearOpen(!crearOpen)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition active:scale-[0.98] hover:bg-brand-700"
        >
          {crearOpen ? "Cerrar" : "+ Nuevo usuario"}
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      {state?.message ? (
        <div
          role={state.ok ? "status" : "alert"}
          className={`rounded-md border px-3 py-2 text-sm ${
            state.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      {crearOpen ? (
        <form
          action={formAction}
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-zinc-900">
            Nuevo usuario
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="nombre" className="text-sm font-medium text-zinc-800">
                Nombre completo <span className="text-red-500">*</span>
              </label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                required
                placeholder="Ej: Juan Pérez"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-zinc-800">
                Correo <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="correo@ejemplo.com"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="rol" className="text-sm font-medium text-zinc-800">
                Rol <span className="text-red-500">*</span>
              </label>
              <select id="rol" name="rol" required className={inputClass}>
                <option value="colaborador">Colaborador (mecánico / recepción)</option>
                <option value="administrador">Administrador (dueño)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-zinc-800">
                Contraseña temporal <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="text"
                required
                minLength={10}
                placeholder="Mínimo 10 caracteres"
                className={inputClass}
              />
              <p className="text-xs text-zinc-400">
                El usuario la puede cambiar luego desde la recuperación de
                contraseña.
              </p>
            </div>
          </div>

          {state?.fieldErrors ? (
            <div className="mt-3 flex flex-col gap-1">
              {Object.values(state.fieldErrors)
                .flat()
                .map((msg, i) => (
                  <p key={i} className="text-xs text-red-600">
                    {msg}
                  </p>
                ))}
            </div>
          ) : null}

          <div className="mt-5 flex items-center justify-end gap-3 border-t border-zinc-200 pt-4">
            <button
              type="button"
              onClick={() => setCrearOpen(false)}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 active:scale-[0.98]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
            >
              {pending ? "Creando…" : "Crear usuario"}
            </button>
          </div>
        </form>
      ) : null}

      {/* Listado */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Correo</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {usuarios.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                    No hay usuarios todavía.
                  </td>
                </tr>
              ) : (
                usuarios.map((u) => (
                  <tr key={u.id} className="transition hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {u.nombre}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <RolBadge rol={u.rol} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          u.activo
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={busy === u.id}
                          onClick={() =>
                            handleRol(
                              u,
                              u.rol === "administrador" ? "colaborador" : "administrador",
                            )
                          }
                          className="rounded-md px-2 py-1 text-xs font-medium text-brand-600 transition hover:bg-brand-50 active:scale-[0.98] disabled:opacity-50"
                        >
                          {u.rol === "administrador" ? "Hacer colaborador" : "Hacer admin"}
                        </button>
                        <button
                          type="button"
                          disabled={busy === u.id}
                          onClick={() => handleToggle(u)}
                          className={`rounded-md px-2 py-1 text-xs font-medium transition active:scale-[0.98] disabled:opacity-50 ${
                            u.activo
                              ? "text-red-600 hover:bg-red-50"
                              : "text-emerald-600 hover:bg-emerald-50"
                          }`}
                        >
                          {u.activo ? "Desactivar" : "Activar"}
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
    </div>
  );
}