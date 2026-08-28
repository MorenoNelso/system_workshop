"use client";

import type { VentaSemanal } from "@/lib/actions/dashboard";

interface Props {
  semanas: VentaSemanal[];
  simbolo: string;
}

export function VentasChart({ semanas, simbolo }: Props) {
  const maxTotal = Math.max(...semanas.map((s) => s.total), 0);
  const hayDatos = maxTotal > 0;
  const indiceActual = semanas.length - 1;
  const promedio = hayDatos
    ? semanas.reduce((acc, s) => acc + s.total, 0) / semanas.filter((s) => s.total > 0).length
    : 0;

  if (!hayDatos) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl bg-zinc-800/50">
        <p className="text-sm text-zinc-500">
          Aún no hay facturas en las últimas {semanas.length} semanas.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Línea de promedio */}
      {promedio > 0 && (
        <div
          className="pointer-events-none absolute left-0 right-0 z-0 border-t border-dashed border-zinc-700/60"
          style={{
            bottom: `calc(2.25rem + ${(promedio / maxTotal) * 100}% * 0.75)`,
          }}
        >
          <span className="absolute -top-2.5 right-0 bg-zinc-900 px-1.5 text-[9px] font-medium text-zinc-500">
            promedio {simbolo} {promedio.toFixed(0)}
          </span>
        </div>
      )}

      {/* Barras */}
      <div className="flex items-end gap-1 sm:gap-1.5" style={{ height: "12rem" }}>
        {semanas.map((s, i) => {
          const alturaPct = (s.total / maxTotal) * 100;
          const esActual = i === indiceActual;
          return (
            <div
              key={s.semanaInicio}
              className="group relative flex flex-1 flex-col items-center justify-end"
            >
              {/* Tooltip */}
              <div className="pointer-events-none absolute -top-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-800 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                {simbolo} {s.total.toLocaleString("es-CO", { maximumFractionDigits: 0 })}
                <span className="ml-1 text-zinc-400">· {s.cantidad} fact.</span>
              </div>

              {/* Barra */}
              <div
                className={`w-full rounded-t-sm transition-all duration-200 group-hover:brightness-125 ${
                  esActual ? "bg-blue-500" : "bg-zinc-600 group-hover:bg-zinc-500"
                }`}
                style={{
                  height: `${Math.max(alturaPct, s.total > 0 ? 2 : 0)}%`,
                  minHeight: s.total > 0 ? "3px" : "0",
                }}
              />

              {/* Etiqueta */}
              <span className="mt-1.5 text-[9px] tabular-nums text-zinc-500">
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}