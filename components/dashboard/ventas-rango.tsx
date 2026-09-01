"use client";

import { useState } from "react";

import {
  getVentasPorRango,
  type MonedaBase,
  type VentaRango,
} from "@/lib/actions/dashboard";

interface Props {
  moneda: MonedaBase;
}

function fechaDefault(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function VentasRango({ moneda }: Props) {
  const [fechaInicio, setFechaInicio] = useState(fechaDefault(-30));
  const [fechaFin, setFechaFin] = useState(fechaDefault(0));
  const [resultado, setResultado] = useState<VentaRango | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConsultar(e: React.FormEvent) {
    e.preventDefault();
    if (!fechaInicio || !fechaFin) return;
    setConsultando(true);
    setError(null);
    const res = await getVentasPorRango(fechaInicio, fechaFin);
    setConsultando(false);
    if (res === null) {
      setError("No se pudo consultar el reporte. Verifica tu permiso e intenta de nuevo.");
      return;
    }
    setResultado(res.resultado);
  }

  const fmt = (n: number) =>
    `${moneda.simbolo} ${n.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={handleConsultar}
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="fecha-inicio" className="text-xs font-medium text-zinc-700">
            Desde
          </label>
          <input
            id="fecha-inicio"
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            required
            disabled={consultando}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="fecha-fin" className="text-xs font-medium text-zinc-700">
            Hasta
          </label>
          <input
            id="fecha-fin"
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            required
            disabled={consultando}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={consultando}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition active:scale-[0.98] hover:bg-brand-700 disabled:opacity-60"
        >
          {consultando ? "Consultando…" : "Consultar"}
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {resultado && (
        <div className="grid grid-cols-2 gap-3 border-t border-zinc-100 pt-4">
          <div className="col-span-2 rounded-xl bg-zinc-900 p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-400">
              Total facturado
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-white">
              {fmt(resultado.totalFacturado)}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs text-zinc-500">Total cobrado</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-700">
              {fmt(resultado.totalCobrado)}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs text-zinc-500">Pendiente por cobrar</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-amber-700">
              {fmt(resultado.totalFacturado - resultado.totalCobrado)}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs text-zinc-500">Facturas</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-zinc-900">
              {resultado.cantidad}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs text-zinc-500">Pagadas / Pendientes</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-zinc-900">
              {resultado.pagadas} / {resultado.pendientes}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}