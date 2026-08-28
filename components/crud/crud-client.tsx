"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { CrudConfig, Field } from "./types";

interface Props {
  config: CrudConfig;
  rows: Record<string, unknown>[];
}

type Row = Record<string, unknown>;

function valueOf(field: Field, row: Row): unknown {
  if (field.get) return field.get(row);
  return row[field.name];
}

/** Render del valor de una celda para la tabla. */
function cellText(field: Field, row: Row): string {
  if (field.selectLabel) return field.selectLabel(row) ?? "—";
  const v = row[field.name];
  if (v === null || v === undefined) return "—";
  if (field.type === "checkbox") return v ? "Sí" : "No";
  return String(v);
}

export function CrudClient({ config, rows: initialRows }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [pending, setPending] = useState<"create" | string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

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

  async function handleSubmit(formData: FormData) {
    const raw: Record<string, unknown> = {};
    for (const f of config.fields) {
      if (f.type === "checkbox") {
        raw[f.name] = formData.get(f.name) === "true";
      } else {
        const v = formData.get(f.name);
        raw[f.name] = v === "" ? "" : v;
      }
    }

    const isCreate = !editing;
    setError(null);

    if (isCreate) {
      // UI optimista: inserto fila provisional y cierro el formulario.
      const temp: Row = { __temp: true };
      for (const f of config.fields) temp[f.name] = raw[f.name];
      setRows((prev) => [temp, ...prev]);
      setFormOpen(false);
      setCreating(true);
      setPending("create");
      const res = await config.create.run("", raw);
      setCreating(false);
      setPending(null);
      if (!res.ok) {
        setRows((prev) => prev.filter((r) => r !== temp));
        setError(res.error);
        setFormOpen(true);
        return;
      }
      router.refresh();
    } else {
      const id = getRowId(editing);
      setRows((prev) =>
        prev.map((r) => (getRowId(r) === id ? { ...r, ...raw } : r)),
      );
      setFormOpen(false);
      setPending(id);
      const res = await config.update.run(id, raw);
      setPending(null);
      if (!res.ok) {
        setError(res.error);
        setFormOpen(true);
        return;
      }
      router.refresh();
    }
  }

  async function handleDelete(id: string) {
    setConfirmDelete(null);
    setPending(id);
    const res = await config.delete.run(id, {});
    setPending(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setRows((prev) => prev.filter((r) => getRowId(r) !== id));
    router.refresh();
  }

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
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition active:scale-[0.98] hover:bg-blue-700"
        >
          Nuevo {config.singular}
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
            {rows.length === 0 && pending !== "create" ? (
              <tr>
                <td
                  colSpan={colFields.length + 1}
                  className="px-4 py-10 text-center text-zinc-500"
                >
                  No hay {config.singular}s todavía.
                </td>
              </tr>
            ) : null}
            {rows.map((row, i) => {
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
                      <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => openEdit(row)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50 active:scale-[0.98] disabled:opacity-50"
                      >
                        Editar
                      </button>
                      {confirmDelete === id ? (
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs text-zinc-500">¿Borrar?</span>
                          <button
                            type="button"
                            onClick={() => handleDelete(id)}
                            className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-red-700 active:scale-[0.98]"
                          >
                            Sí
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            className="rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100"
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={pending !== null}
                          onClick={() => setConfirmDelete(id)}
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
            <div className="h-1 w-full bg-pink-400" aria-hidden="true" />
            <div className="px-6 pt-5">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
                {editing ? "Editar" : "Nuevo"} {config.singular}
              </h2>
            </div>

            <form
              ref={formRef}
              action={handleSubmit}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                {config.fields.map((f) => (
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
                  disabled={creating}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60"
                >
                  {creating ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
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
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
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
          defaultChecked={value === true}
          className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
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
