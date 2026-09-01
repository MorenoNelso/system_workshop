import type { LogAuditoria } from "@/lib/actions/auditoria";

/** Formatea el cambio: claves modificadas con "antes → después". */
export function describirCambio(log: LogAuditoria): string {
  if (log.accion === "insert") return "Creó el registro";
  if (log.accion === "delete") return "Eliminó el registro";

  const antes = log.datos_anteriores ?? {};
  const despues = log.datos_nuevos ?? {};
  const cambios: string[] = [];
  for (const [clave, valorNuevo] of Object.entries(despues)) {
    if (clave === "id") continue;
    const valorAnterior = antes[clave];
    if (JSON.stringify(valorAnterior) !== JSON.stringify(valorNuevo)) {
      cambios.push(
        `${clave}: ${formatearValor(valorAnterior)} → ${formatearValor(valorNuevo)}`,
      );
    }
  }
  return cambios.length > 0 ? cambios.join(" · ") : "Modificó el registro";
}

function formatearValor(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "boolean") return v ? "sí" : "no";
  return String(v);
}

/** Etiqueta legible para cada tabla. */
export function etiquetaTabla(tabla: string): string {
  const mapa: Record<string, string> = {
    facturas: "Factura",
    pagos: "Pago",
    repuestos: "Repuesto",
    tasas_cambio: "Tasa de cambio",
    empleados: "Empleado",
  };
  return mapa[tabla] ?? tabla;
}