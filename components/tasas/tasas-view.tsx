"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { registrarTasa } from "@/lib/actions/tasas";

interface MonedaLite {
  id: string;
  codigo: string;
  simbolo: string;
  nombre: string;
}

interface TasaVigente {
  id: string;
  tasa: number;
  fuente: string;
  fecha: string;
  origen: MonedaLite | null;
  destino: MonedaLite | null;
}

interface Props {
  tasas: TasaVigente[];
  monedas: MonedaLite[];
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function TasasView({ tasas, monedas }: Props) {
  const router = useRouter();
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [tasa, setTasa] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const opcionesDestino =
    origen === "" ? monedas : monedas.filter((m) => m.id !== origen);

  const monedaOrigen = monedas.find((m) => m.id === origen);
  const monedaDestino = monedas.find((m) => m.id === destino);

  async function handleRegistrar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setExito(null);

    const res = await registrarTasa({ moneda_origen_id: origen, moneda_destino_id: destino, tasa: Number(tasa) });
    setGuardando(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    setExito(
      `Tasa guardada: 1 ${monedaOrigen?.codigo} = ${Number(tasa).toFixed(4)} ${monedaDestino?.codigo}.`,
    );
    setTasa("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Tasas de Cambio
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Actualización <span className="font-medium">manual</span> (nunca automática). La tasa vigente de un par es la más reciente.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Formulario */}
        <form
          onSubmit={handleRegistrar}
          className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2"
        >
          <div>
            <h2 className="text-base font-semibold tracking-tight text-zinc-900">
              Registrar / actualizar tasa
            </h2>
            <p className="text-xs text-zinc-500">
              Expresa cuántas unidades del destino equivalen a 1 unidad del origen.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-700">
                Moneda origen <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={origen}
                onChange={(e) => setOrigen(e.target.value)}
                className={`${inputClass} mt-1`}
              >
                <option value="">— Seleccionar —</option>
                {monedas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.codigo} ({m.simbolo})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-700">
                Moneda destino <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                className={`${inputClass} mt-1`}
              >
                <option value="">— Seleccionar —</option>
                {opcionesDestino.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.codigo} ({m.simbolo})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700">
              Tasa <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="any"
              min={0.000001}
              required
              placeholder="Ej: 4000"
              value={tasa}
              onChange={(e) => setTasa(e.target.value)}
              className={`${inputClass} mt-1`}
            />
            {monedaOrigen && monedaDestino && tasa !== "" && (
              <p className="mt-1 text-xs text-zinc-500">
                1 {monedaOrigen.codigo} = {Number(tasa).toFixed(4)}{" "}
                {monedaDestino.codigo}
              </p>
            )}
          </div>

          {error && (
            <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {exito && (
            <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {exito}
            </div>
          )}

          <div className="flex items-center justify-end border-t border-zinc-100 pt-4">
            <button
              type="submit"
              disabled={guardando}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60"
            >
              {guardando ? "Guardando..." : "Guardar tasa"}
            </button>
          </div>

          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Registra también los pares inversos (ej. COP→USD y USD→COP) para poder
            convertir en ambos sentidos en pantalla.
          </p>
        </form>

        {/* Tabla de tasas vigentes */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm lg:col-span-3">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Par</th>
                  <th className="px-4 py-3 text-right font-medium">Tasa vigente</th>
                  <th className="px-4 py-3 font-medium">Actualizado</th>
                  <th className="px-4 py-3 font-medium">Fuente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {tasas.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-zinc-500">
                      Aún no hay tasas registradas. Agrega la primera a la izquierda.
                    </td>
                  </tr>
                ) : (
                  tasas.map((t) => (
                    <tr key={t.id} className="transition hover:bg-zinc-50">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        1 {t.origen?.codigo}
                        <span className="mx-1 text-zinc-400">→</span>
                        {t.destino?.codigo}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                        {Number(t.tasa).toFixed(4)}{" "}
                        <span className="text-xs font-normal text-zinc-400">
                          {t.destino?.codigo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {new Date(t.fecha).toLocaleString("es-ES", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-xs capitalize text-zinc-600">
                        {t.fuente || "manual"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}