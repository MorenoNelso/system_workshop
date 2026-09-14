"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDeduccion } from "@/lib/actions/deducciones";
import { listMecanicosActivos } from "@/lib/actions/empleados";

interface Mecanico {
  id: string;
  nombre: string;
}

interface Moneda {
  id: string;
  codigo: string;
  simbolo: string;
  nombre: string;
}

export default function DeduccionesForm({ onCreated, monedas }: { onCreated: () => void; monedas: Moneda[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mecanicos, setMecanicos] = useState<Mecanico[]>([]);
  const router = useRouter();

  useEffect(() => {
    listMecanicosActivos().then((data) => {
      setMecanicos(data as Mecanico[]);
    });
  }, []);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const raw = {
      empleado_id: formData.get("empleado_id"),
      orden_id: formData.get("orden_id") || undefined,
      descripcion: formData.get("descripcion"),
      costo: formData.get("costo"),
      moneda_id: formData.get("moneda_id"),
      fecha: formData.get("fecha") || undefined,
    };

    startTransition(async () => {
      const result = await createDeduccion(raw);
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
        Registrar Deducción
      </h3>

      <form ref={formRef} action={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="empleado_id" className="text-sm font-medium text-zinc-800">
              Mecánico *
            </label>
            <select
              id="empleado_id"
              name="empleado_id"
              required
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            >
              <option value="">Seleccionar mecánico...</option>
              {mecanicos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>

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
              placeholder="Ej: Grasa para cambio de aceite"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div>
            <label htmlFor="costo" className="text-sm font-medium text-zinc-800">
              Costo *
            </label>
            <input
              id="costo"
              name="costo"
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
            <label htmlFor="orden_id" className="text-sm font-medium text-zinc-800">
              Orden (opcional)
            </label>
            <input
              id="orden_id"
              name="orden_id"
              type="text"
              placeholder="ID de la orden si aplica"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
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
