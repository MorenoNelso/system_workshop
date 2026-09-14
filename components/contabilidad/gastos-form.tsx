"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGasto } from "@/lib/actions/gastos";

const CATEGORIAS = [
  { value: "mercado", label: "Mercado" },
  { value: "ropa", label: "Ropa" },
  { value: "salud", label: "Salud" },
  { value: "educacion", label: "Educación" },
  { value: "transporte", label: "Transporte" },
  { value: "vivienda", label: "Vivienda" },
  { value: "otro", label: "Otro" },
];

interface Moneda {
  id: string;
  codigo: string;
  simbolo: string;
  nombre: string;
}

export default function GastosForm({ onCreated, monedas }: { onCreated: () => void; monedas: Moneda[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setError(null);
    const raw = {
      descripcion: formData.get("descripcion"),
      monto: formData.get("monto"),
      moneda_id: formData.get("moneda_id"),
      categoria: formData.get("categoria"),
      fecha: formData.get("fecha") || undefined,
    };

    startTransition(async () => {
      const result = await createGasto(raw);
      if (result.ok) {
        formRef.current?.reset();
        onCreated();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-zinc-900">
        Registrar Retiro Personal
      </h3>

      <form ref={formRef} action={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="descripcion" className="text-sm font-medium text-zinc-800">
              Descripción *
            </label>
            <input
              id="descripcion"
              name="descripcion"
              type="text"
              required
              maxLength={200}
              placeholder="Ej: Mercado semanal"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div>
            <label htmlFor="monto" className="text-sm font-medium text-zinc-800">
              Monto *
            </label>
            <input
              id="monto"
              name="monto"
              type="number"
              required
              min="0.01"
              step="0.01"
              placeholder="0"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div>
            <label htmlFor="moneda_id" className="text-sm font-medium text-zinc-800">
              Moneda *
            </label>
            <select
              id="moneda_id"
              name="moneda_id"
              required
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            >
              <option value="">Seleccionar...</option>
              {monedas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.codigo} ({m.simbolo})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="categoria" className="text-sm font-medium text-zinc-800">
              Categoría *
            </label>
            <select
              id="categoria"
              name="categoria"
              required
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            >
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="fecha" className="text-sm font-medium text-zinc-800">
              Fecha
            </label>
            <input
              id="fecha"
              name="fecha"
              type="date"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
