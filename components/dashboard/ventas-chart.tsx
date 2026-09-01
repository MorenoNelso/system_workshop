"use client";

import { useState } from "react";
import type { VentaSemanal } from "@/lib/actions/dashboard";

interface Props {
  semanas: VentaSemanal[];
  simbolo: string;
}

export function VentasChart({ semanas, simbolo }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const hayDatos = semanas.some((s) => s.total > 0);
  const maxTotal = Math.max(...semanas.map((s) => s.total), 1);

  if (!hayDatos) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl bg-zinc-800/50">
        <p className="text-sm text-zinc-500">
          Aún no hay facturas en las últimas {semanas.length} semanas.
        </p>
      </div>
    );
  }

  const W = 600;
  const H = 180;
  const padX = 10;
  const padTop = 14;
  const padBottom = 10;
  const chartW = W - padX * 2;
  const chartH = H - padTop - padBottom;
  const stepX = chartW / Math.max(semanas.length - 1, 1);

  const pts = semanas.map((s, i) => ({
    x: padX + i * stepX,
    y: padTop + chartH - (s.total / maxTotal) * chartH,
    data: s,
  }));

  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  const areaPath =
    `${linePath} L ${pts[pts.length - 1].x.toFixed(2)} ${(padTop + chartH).toFixed(2)} L ${pts[0].x.toFixed(2)} ${(padTop + chartH).toFixed(2)} Z`;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-48 w-full sm:h-56"
        preserveAspectRatio="none"
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="vLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <linearGradient id="vArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={areaPath} fill="url(#vArea)" />
        <path
          d={linePath}
          fill="none"
          stroke="url(#vLine)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {hoverIdx !== null && (
          <line
            x1={pts[hoverIdx].x}
            y1={padTop}
            x2={pts[hoverIdx].x}
            y2={padTop + chartH}
            stroke="#22d3ee"
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.4}
            vectorEffect="non-scaling-stroke"
          />
        )}

        {pts.map((p, i) => (
          <rect
            key={i}
            x={p.x - stepX / 2}
            y={0}
            width={stepX}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
          />
        ))}
      </svg>

      {hoverIdx !== null && (
        <>
          <div
            className="pointer-events-none absolute z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400 shadow-[0_0_8px_2px_rgba(34,211,238,0.6)]"
            style={{
              left: `${(pts[hoverIdx].x / W) * 100}%`,
              top: `${(pts[hoverIdx].y / H) * 100}%`,
            }}
          />
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs shadow-lg"
            style={{
              left: `${(pts[hoverIdx].x / W) * 100}%`,
              top: 0,
            }}
          >
            <p className="font-semibold text-white">
              {simbolo}{" "}
              {pts[hoverIdx].data.total.toLocaleString("es-CO", {
                maximumFractionDigits: 0,
              })}
            </p>
            <p className="text-zinc-400">
              {pts[hoverIdx].data.cantidad} fact. · {pts[hoverIdx].data.label}
            </p>
          </div>
        </>
      )}

      <div className="mt-1.5 flex justify-between px-1">
        {semanas.map((s, i) => (
          <span
            key={s.semanaInicio}
            className={`text-[9px] tabular-nums transition-colors ${
              hoverIdx === i ? "text-cyan-400" : "text-zinc-500"
            }`}
          >
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
