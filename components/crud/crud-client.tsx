"use client";

import { useMemo, useRef, useState } from "react";

import type { CrudConfig, Field } from "./types";

interface Props {
  config: CrudConfig;
  rows: Record<string, unknown>[];
}

function isFieldVisible(
  field: Field,
  row: Record<string, unknown> | null,
): boolean {
  if (field.visible === undefined) return true;
  if (typeof field.visible === "boolean") return field.visible;
  return field.visible(row);
}

type Row = Record<string, unknown>;

/** Valor crudo para el formulario (sin formato de display). */
function valueOf(field: Field, row: Row): unknown {
  return row[field.name];
}

/** Render del valor de una celda para la tabla. */
function cellText(field: Field, row: Row): string {
  if (field.selectLabel) return field.selectLabel(row) ?? "—";
  if (field.get) return String(field.get(row));
  const v = row[field.name];
  if (v === null || v === undefined) return "—";
  if (field.type === "checkbox") return v ? "Sí" : "No";
  return String(v);
}

export function CrudClient({ config, rows: initialRows }: Props) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [busqueda, setBusqueda] = useState("");
  const [pending, setPending] = useState<"create" | string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const submittingRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const colFields = useMemo(
    () => config.columns.map((n) => config.fields.find((f) => f.name === n)!),
    [config],
  );

  const openCreate = () => {
    setEditing(null);
    setError(null);
    setFormOpen(true);
  };
  const openEdit = (row: Row) => {
    setEditing(row);
    setError(null);
    setFormOpen(true);
  };

  const getRowId = (row: Row): string =>
    config.getId ? config.getId(row) : String(row.id);

  function showSuccess(msg: string) {
    setSuccess(msg);
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccess(null), 4000);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;

    const formData = new FormData(e.currentTarget);

    // Cerrar el formulario de inmediato (primer clic): la tarea corre en
    // segundo plano y el usuario puede seguir trabajando.
    setFormOpen(false);
    setError(null);
    setSuccess(null);

    const raw: Record<string, unknown> = {};
    for (const f of config.fields) {
      if (!isFieldVisible(f, editing)) continue;
      if (f.type === "checkbox") {
        raw[f.name] = formData.get(f.name) === "true";
      } else {
        const v = formData.get(f.name);
        raw[f.name] = v === "" ? "" : v;
      }
    }

    const isCreate = !editing;

    if (isCreate) {
      // UI optimista: inserto fila provisional.
      const temp: Row = { __temp: true };
      for (const f of config.fields) temp[f.name] = raw[f.name];
      setRows((prev) => [temp, ...prev]);
      setFormOpen(false);
      setCreating(true);
      setPending("create");
      const res = await config.create.run("", raw);
      setCreating(false);
      setPending(null);
      submittingRef.current = false;
      if (!res.ok) {
        setRows((prev) => prev.filter((r) => r !== temp));
        setError(res.error);
        setFormOpen(true);
        return;
      }
      // Reemplazo la fila provisional por la fila real devuelta por la DB.
      const saved = (res as { ok: true; data?: Row }).data;
      if (saved) {
        setRows((prev) => prev.map((r) => (r === temp ? saved : r)));
      }
      showSuccess(`${config.singular} guardado correctamente.`);
    } else {
      const id = getRowId(editing);
      setRows((prev) =>
        prev.map((r) => (getRowId(r) === id ? { ...r, ...raw } : r)),
      );
      setFormOpen(false);
      setPending(id);
      const res = await config.update.run(id, raw);
      setPending(null);
      submittingRef.current = false;
      if (!res.ok) {
        setError(res.error);
        setFormOpen(true);
        return;
      }
      showSuccess(`${config.singular} actualizado correctamente.`);
    }
  }

  async function handleDelete(row: Row) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    const id = getRowId(row);
    setConfirmDelete(null);
    setPending(id);
    try {
      const res = await config.delete.run(id, {});
      setPending(null);
      submittingRef.current = false;
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRows((prev) => prev.filter((r) => getRowId(r) !== id));
      showSuccess(`${config.singular} eliminado correctamente.`);
    } catch (err) {
      setPending(null);
      submittingRef.current = false;
      setError(
        err instanceof Error ? err.message : "No se pudo eliminar, intenta de nuevo",
      );
    }
  }

  const rowsFiltradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    const searchFields = config.searchFields;
    if (!term || !searchFields || searchFields.length === 0) return rows;
    return rows.filter((row) =>
      searchFields.some((name) =>
        String(row[name] ?? "").toLowerCase().includes(term),
      ),
    );
  }, [rows, busqueda, config.searchFields]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            {config.title}
          </h1>
          {config.description ? (
            <p className="mt-0.5 text-sm text-zinc-500">{config.description}</p>
          ) : null}
        </div>
        {!config.hideCreate && (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition active:scale-[0.98] hover:bg-brand-700"
          >
            Nuevo {config.singular}
          </button>
        )}
      </div>

      {config.searchFields && config.searchFields.length > 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={`Buscar por ${config.searchFields.join(", ")}...`}
            className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-100"
          />
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          <svg
            className="h-4 w-4 shrink-0 text-emerald-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
          {success}
        </div>
      ) : null}

      {/* Tabla con skeleton mientras carga */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              {colFields.map((f) => (
                <th key={f.name} className="px-4 py-3 font-medium">
                  {f.label}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rowsFiltradas.length === 0 && pending !== "create" ? (
              <tr>
                <td
                  colSpan={colFields.length + 1}
                  className="px-4 py-10 text-center text-zinc-500"
                >
                  {busqueda.trim() ? "Sin resultados para la búsqueda." : `No hay ${config.singular}s todavía.`}
                </td>
              </tr>
            ) : null}
            {rowsFiltradas.map((row, i) => {
              const id = getRowId(row);
              const isTemp = row.__temp === true;
              return (
                <tr
                  key={isTemp ? `temp-${i}` : id}
                  className="transition hover:bg-zinc-50"
                >
                  {colFields.map((f) => (
                    <td key={f.name} className="px-4 py-3 text-zinc-700">
                      {cellText(f, row)}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {config.rowActions?.map((a) => (
                        <button
                          key={a.label}
                          type="button"
                          disabled={pending !== null}
                          onClick={() => a.onClick(row)}
                          className={`rounded-md px-2 py-1 text-xs font-medium transition active:scale-[0.98] disabled:opacity-50 ${a.className ?? ""}`}
                        >
                          {a.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => openEdit(row)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-brand-600 transition hover:bg-brand-50 active:scale-[0.98] disabled:opacity-50"
                      >
                        Editar
                      </button>
                      {!config.hideDelete && (
                        <button
                          type="button"
                          disabled={pending !== null}
                          onClick={() => setConfirmDelete(row)}
                          className="rounded-md px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 active:scale-[0.98] disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de formulario */}
      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="px-6 pt-5">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
                {editing ? "Editar" : "Nuevo"} {config.singular}
              </h2>
            </div>

            <form
              ref={formRef}
              onSubmit={handleSubmit}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                {config.fields
                  .filter((f) => isFieldVisible(f, editing))
                  .map((f) => (
                    <FieldInput
                      key={f.name}
                      field={f}
                      value={editing ? valueOf(f, editing) : undefined}
                    />
                  ))}
              </div>

              {/* Botones de acción en posición fija (abajo a la derecha) */}
              <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 active:scale-[0.98]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending !== null || creating}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
                >
                  {creating ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Modal de confirmación de borrado (centrado) */}
      {confirmDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-4">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
                ¿Borrar {config.singular}?
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Esta acción es definitiva y no se puede deshacer.
              </p>
            </div>

            <div className="mx-6 overflow-hidden rounded-xl border border-zinc-200">
              <table className="min-w-full text-sm">
                <tbody className="divide-y divide-zinc-100">
                  {colFields.map((f) => {
                    const val = cellText(f, confirmDelete);
                    if (val === "—") return null;
                    return (
                      <tr key={f.name}>
                        <th className="w-2/5 bg-zinc-50 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                          {f.label}
                        </th>
                        <td className="px-4 py-2.5 text-zinc-900">
                          {val}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 active:scale-[0.98]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDelete)}
                disabled={pending !== null}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 active:scale-[0.98] disabled:opacity-60"
              >
                {pending !== null ? "Borrando…" : "Sí, borrar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FieldInput({
  field,
  value,
}: {
  field: Field;
  value: unknown;
}) {
  const baseClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100";
  const stringVal =
    value === null || value === undefined ? "" : String(value);

  if (field.type === "select") {
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={field.name} className="text-sm font-medium text-zinc-800">
          {field.label}
        </label>
        <select
          id={field.name}
          name={field.name}
          required={field.required}
          defaultValue={stringVal}
          className={baseClass}
        >
          <option value="">— Seleccionar —</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={field.name} className="text-sm font-medium text-zinc-800">
          {field.label}
        </label>
        <textarea
          id={field.name}
          name={field.name}
          rows={3}
          defaultValue={stringVal}
          className={baseClass}
        />
      </div>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm text-zinc-800">
        <input
          type="checkbox"
          name={field.name}
          value="true"
          defaultChecked={value === true}
          className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-600"
        />
        {field.label}
      </label>
    );
  }

  const inputType = field.type === "email" ? "email" : field.type === "number" ? "number" : "text";

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={field.name} className="text-sm font-medium text-zinc-800">
        {field.label}
        {field.required ? <span className="text-red-500"> *</span> : null}
      </label>
      <input
        id={field.name}
        name={field.name}
        type={inputType}
        required={field.required}
        placeholder={field.placeholder}
        defaultValue={stringVal}
        min={field.min}
        step={field.step}
        className={baseClass}
      />
    </div>
  );
}
