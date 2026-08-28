import type { Metadata } from "next";
import { listMovimientos } from "@/lib/actions/inventario";

export const metadata: Metadata = { title: "Movimientos de Inventario — Taller" };

interface MovimientoRow {
  id: string;
  tipo: "entrada" | "salida" | "ajuste";
  cantidad: number;
  motivo: string | null;
  fecha: string;
  repuesto: { nombre: string; sku: string | null } | null;
  usuario: { nombre: string; email: string } | null;
}

export default async function InventarioPage() {
  const movimientos = await listMovimientos();

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case "entrada":
        return <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">+ Entrada</span>;
      case "salida":
        return <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800 border border-rose-200">- Salida</span>;
      case "ajuste":
        return <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">~ Ajuste</span>;
      default:
        return <span className="text-xs text-zinc-600">{tipo}</span>;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Kardex / Movimientos de Inventario
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Historial de entradas, salidas por órdenes de servicio y ajustes de stock.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Repuesto</th>
                <th className="px-4 py-3 font-medium text-center">Cantidad</th>
                <th className="px-4 py-3 font-medium">Motivo / Detalle</th>
                <th className="px-4 py-3 font-medium">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {movimientos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                    No hay movimientos registrados en el inventario.
                  </td>
                </tr>
              ) : (
                movimientos.map((m: MovimientoRow) => (
                  <tr key={m.id} className="transition hover:bg-zinc-50">
                    <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
                      {new Date(m.fecha).toLocaleString("es-ES", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getTipoBadge(m.tipo)}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {m.repuesto?.nombre}
                      {m.repuesto?.sku && (
                        <span className="ml-1.5 font-mono text-xs text-zinc-400">({m.repuesto.sku})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-zinc-800">
                      {m.cantidad}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 text-xs">
                      {m.motivo || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {m.usuario?.nombre || m.usuario?.email || "Sistema"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
