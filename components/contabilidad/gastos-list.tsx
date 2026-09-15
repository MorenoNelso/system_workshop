"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { listGastos } from "@/lib/actions/gastos";
import { executeOrEnqueue } from "@/lib/offline/queue";

interface GastoRow {
  id: string;
  descripcion: string;
  monto: number;
  fecha: string;
  categoria: string;
  moneda: { codigo: string; simbolo: string } | null;
}

export default function GastosList() {
  const [gastos, setGastos] = useState<GastoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    listGastos().then((data) => {
      setGastos(data as unknown as GastoRow[]);
      setLoading(false);
    });
  }, []);

  async function handleDelete(id: string) {
    startTransition(async () => {
      const result = await executeOrEnqueue("deleteGasto", { id });
      if ("offline" in result && result.offline) {
        setError("Sin conexión. Se guardará cuando vuelva internet.");
        setTimeout(() => setError(null), 4000);
        return;
      }
      if (result.ok) {
        setGastos((prev) => prev.filter((g) => g.id !== id));
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

  if (gastos.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No hay gastos registrados este mes.
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
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 text-right font-medium">Monto</th>
              <th className="px-4 py-3 text-center font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {gastos.map((g) => (
              <tr key={g.id}>
              <td className="px-4 py-3 text-zinc-500">{g.fecha}</td>
              <td className="px-4 py-3 font-medium text-zinc-900">
                {g.descripcion}
              </td>
              <td className="px-4 py-3 capitalize text-zinc-700">{g.categoria}</td>
              <td className="px-4 py-3 text-right font-medium text-red-600">
                -{g.moneda?.simbolo} {Number(g.monto).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  onClick={() => handleDelete(g.id)}
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
