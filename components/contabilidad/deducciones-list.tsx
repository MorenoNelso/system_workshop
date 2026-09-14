"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { listDeducciones, deleteDeduccion } from "@/lib/actions/deducciones";

interface DeduccionRow {
  id: string;
  descripcion: string;
  costo: number;
  fecha: string;
  empleado: { nombre: string } | null;
  orden: { id: string } | null;
  moneda: { codigo: string; simbolo: string } | null;
}

export default function DeduccionesList() {
  const [deducciones, setDeducciones] = useState<DeduccionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    listDeducciones().then((data) => {
      setDeducciones(data as unknown as DeduccionRow[]);
      setLoading(false);
    });
  }, []);

  async function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteDeduccion(id);
      if (result.ok) {
        setDeducciones((prev) => prev.filter((d) => d.id !== id));
        router.refresh();
      } else {
        setError(result.error);
        setTimeout(() => setError(null), 4000);
      }
    });
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100" />
        ))}
      </div>
    );
  }

  if (deducciones.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No hay deducciones registradas este mes.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {error && (
        <div className="m-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Mecánico</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium">Orden</th>
              <th className="px-4 py-3 text-right font-medium">Costo</th>
              <th className="px-4 py-3 text-center font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {deducciones.map((d) => (
              <tr key={d.id}>
              <td className="px-4 py-3 text-zinc-500">{d.fecha}</td>
              <td className="px-4 py-3 font-medium text-zinc-900">
                {d.empleado?.nombre ?? "—"}
              </td>
              <td className="px-4 py-3 text-zinc-700">{d.descripcion}</td>
              <td className="px-4 py-3 text-zinc-500">
                {d.orden?.id ? `#${d.orden.id.slice(0, 8)}` : "—"}
              </td>
              <td className="px-4 py-3 text-right font-medium text-orange-600">
                -{d.moneda?.simbolo} {Number(d.costo).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  onClick={() => handleDelete(d.id)}
                  disabled={pending}
                  className="rounded-md px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 active:scale-[0.98] disabled:opacity-50"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
        </div>
    </div>
  );
}
