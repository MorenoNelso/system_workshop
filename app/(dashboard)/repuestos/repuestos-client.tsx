"use client";

import { useMemo, useState } from "react";
import { CrudClient } from "@/components/crud/crud-client";
import type { CrudConfig } from "@/components/crud/types";
import {
  updateRepuesto,
  deleteRepuesto,
} from "@/lib/actions/repuestos";
import { registrarMovimiento } from "@/lib/actions/inventario";
import { executeOrEnqueue } from "@/lib/offline/queue";

interface Props {
  initialRows: Record<string, unknown>[];
  categorias: { id: string; nombre: string }[];
  proveedores: { id: string; nombre: string }[];
  monedas: { id: string; codigo: string; nombre: string; simbolo: string }[];
  userRole: string;
}

export function RepuestosClient({
  initialRows,
  categorias,
  proveedores,
  monedas,
  userRole,
}: Props) {
  const isAdmin = userRole === "administrador";
  const [entradaRepuesto, setEntradaRepuesto] = useState<Record<string, unknown> | null>(null);
  const [cantidad, setCantidad] = useState("1");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const config: CrudConfig = useMemo(
    () => ({
      title: "Repuestos",
      singular: "repuesto",
      description: "Inventario de repuestos. Usa '+ Entrada' para registrar stock que llega.",
      fields: [
        { name: "nombre", label: "Nombre", type: "text", required: true },
        {
          name: "calidad",
          label: "Calidad",
          type: "select",
          required: true,
          options: [
            { value: "generica", label: "Genérica" },
            { value: "original", label: "Original" },
          ],
          selectLabel: (row) =>
            row.calidad === "original" ? "Original" : row.calidad === "generica" ? "Genérica" : "—",
        },
        { name: "medida", label: "Medida / Talla", type: "text" },
        {
          name: "compatible_con",
          label: "Compatible con",
          type: "text",
          placeholder: "CG125, GN125, YBR125...",
        },
        {
          name: "categoria_id",
          label: "Categoría",
          type: "select",
          options: categorias.map((c) => ({ value: c.id, label: c.nombre })),
          selectLabel: (row) =>
            (row.categoria as { nombre?: string } | null)?.nombre ?? "—",
        },
        {
          name: "proveedor_id",
          label: "Proveedor",
          type: "select",
          options: proveedores.map((p) => ({ value: p.id, label: p.nombre })),
          selectLabel: (row) =>
            (row.proveedor as { nombre?: string } | null)?.nombre ?? "—",
        },
        {
          name: "stock_actual",
          label: "Stock actual",
          type: "number",
          min: 0,
          step: 1,
          required: true,
        },
        {
          name: "stock_minimo",
          label: "Stock mínimo",
          type: "number",
          min: 0,
          step: 1,
        },
        {
          name: "precio_costo",
          label: "Precio de entrada (costo)",
          type: "number",
          min: 0,
          step: 0.01,
        },
        {
          name: "precio_venta",
          label: "Precio de salida (venta)",
          type: "number",
          min: 0,
          step: 0.01,
          required: true,
        },
        {
          name: "moneda_id",
          label: "Moneda",
          type: "select",
          required: true,
          options: monedas.map((m) => ({
            value: m.id,
            label: `${m.codigo} (${m.nombre})`,
          })),
          selectLabel: (row) =>
            (row.moneda as { simbolo?: string } | null)?.simbolo ?? "—",
        },
        { name: "notas", label: "Notas", type: "textarea" },
        { name: "activo", label: "Activo", type: "checkbox" },
      ],
      columns: [
        "nombre",
        "calidad",
        "medida",
        "stock_actual",
        "precio_venta",
      ],
      searchFields: ["nombre", "medida", "compatible_con", "calidad"],
      create: {
        label: "crear",
        run: async (_id, r) => {
          const res = await executeOrEnqueue("createRepuesto", r);
          if (!res.ok) return { ok: false, error: res.error };
          if ("data" in res && res.data) return { ok: true, data: res.data };
          return { ok: true };
        },
      },
      update: { label: "editar", run: (id, r) => updateRepuesto(id, r) },
      delete: { label: "eliminar", run: (id) => deleteRepuesto(id) },
      hideDelete: !isAdmin,
      rowActions: [
        {
          label: "+ Entrada",
          className: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
          onClick: (row) => {
            setEntradaRepuesto(row);
            setCantidad("1");
            setMotivo("");
            setError(null);
            setSuccess(null);
          },
        },
      ],
    }),
    [categorias, proveedores, monedas, isAdmin],
  );

  async function guardarEntrada(e: React.FormEvent) {
    e.preventDefault();
    if (!entradaRepuesto) return;
    const id = String(entradaRepuesto.id);
    const cant = Number(cantidad);
    if (!Number.isInteger(cant) || cant <= 0) {
      setError("La cantidad debe ser un número entero mayor a 0.");
      return;
    }
    setGuardando(true);
    setError(null);
    const res = await registrarMovimiento({
      repuesto_id: id,
      tipo: "entrada",
      cantidad: String(cant),
      motivo: motivo.trim() || "Entrada de inventario",
    });
    setGuardando(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSuccess(`Stock de "${nombreEntrada}" actualizado (+${cant}).`);
    setEntradaRepuesto(null);
    setVersion((v) => v + 1);
  }

  const nombreEntrada = entradaRepuesto ? String(entradaRepuesto.nombre) : "";

  return (
    <div className="flex flex-col gap-4">
      <CrudClient key={version} config={config} rows={initialRows} />

      {/* Modal de entrada de stock */}
      {entradaRepuesto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setEntradaRepuesto(null)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-4">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
                Registrar entrada de stock
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                <span className="font-medium">{nombreEntrada}</span>
                {" · Stock actual: "}
                <span className="font-medium">{String(entradaRepuesto.stock_actual ?? 0)}</span>
              </p>
            </div>

            <form onSubmit={guardarEntrada} className="px-6 pb-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="cantidad" className="text-sm font-medium text-zinc-800">
                    Cantidad a agregar <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="cantidad"
                    type="number"
                    min={1}
                    step={1}
                    required
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="motivo" className="text-sm font-medium text-zinc-800">
                    Motivo
                  </label>
                  <input
                    id="motivo"
                    type="text"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ej: Compra a proveedor, devolución..."
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              </div>

              {error ? (
                <p role="alert" className="mt-3 text-sm text-red-600">
                  {error}
                </p>
              ) : null}

              <div className="mt-5 flex items-center justify-end gap-3 border-t border-zinc-200 pt-4">
                <button
                  type="button"
                  onClick={() => setEntradaRepuesto(null)}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 active:scale-[0.98]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
                >
                  {guardando ? "Guardando…" : "Agregar stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {success ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {success}
        </div>
      ) : null}
    </div>
  );
}