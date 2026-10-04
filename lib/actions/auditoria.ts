"use server";

import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/actions/_crud-helpers";

export interface LogAuditoria {
  id: string;
  usuario_id: string | null;
  nombre_usuario: string | null;
  tabla_afectada: string;
  accion: "insert" | "update" | "delete";
  datos_anteriores: Record<string, unknown> | null;
  datos_nuevos: Record<string, unknown> | null;
  fecha: string;
}

export interface AuditoriaFiltros {
  usuarioId?: string;
  tabla?: string;
  accion?: "insert" | "update" | "delete";
  desde?: string;
  hasta?: string;
  pagina?: number;
}

const POR_PAGINA = 50;

export interface ListaAuditoria {
  logs: LogAuditoria[];
  total: number;
  pagina: number;
  totalPaginas: number;
  /** Nombres resueltos para no mostrar UUIDs crudos en el detalle. */
  nombres: {
    clientes: Record<string, string>;
    facturas: Record<string, number>;
    monedas: Record<string, string>;
  };
}

/** Lista los registros de auditoría con filtros y paginación. Solo admin. */
export async function listLogs(
  filtros: AuditoriaFiltros = {},
): Promise<ListaAuditoria> {
  await requireRole("administrador");
  const supabase = await db();

  const pagina = Math.max(1, filtros.pagina ?? 1);
  const desde = pagina === 1 ? 0 : (pagina - 1) * POR_PAGINA;

  let query = supabase
    .from("logs_auditoria")
    .select(
      "id, usuario_id, tabla_afectada, accion, datos_anteriores, datos_nuevos, fecha, usuario:usuarios(nombre)",
      { count: "exact" },
    );

  if (filtros.usuarioId) query = query.eq("usuario_id", filtros.usuarioId);
  if (filtros.tabla) query = query.eq("tabla_afectada", filtros.tabla);
  if (filtros.accion) query = query.eq("accion", filtros.accion);
  if (filtros.desde) query = query.gte("fecha", new Date(filtros.desde).toISOString());
  if (filtros.hasta) {
    const fin = new Date(filtros.hasta);
    fin.setDate(fin.getDate() + 1);
    query = query.lt("fecha", fin.toISOString());
  }

  const { data, count } = await query
    .order("fecha", { ascending: false })
    .range(desde, desde + POR_PAGINA - 1);

  const total = count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  type FilaLog = {
    id: string;
    usuario_id: string | null;
    tabla_afectada: string;
    accion: "insert" | "update" | "delete";
    datos_anteriores: Record<string, unknown> | null;
    datos_nuevos: Record<string, unknown> | null;
    fecha: string;
    usuario: { nombre: string } | null;
  };
  const filas = ((data ?? []) as unknown as FilaLog[]).map((l) => ({
    id: l.id,
    usuario_id: l.usuario_id,
    nombre_usuario: l.usuario?.nombre ?? "Usuario eliminado",
    tabla_afectada: l.tabla_afectada,
    accion: l.accion,
    datos_anteriores: l.datos_anteriores,
    datos_nuevos: l.datos_nuevos,
    fecha: l.fecha,
  }));

  const logs: LogAuditoria[] = filas.map((l) => ({
    id: l.id,
    usuario_id: l.usuario_id,
    nombre_usuario: l.nombre_usuario,
    tabla_afectada: l.tabla_afectada,
    accion: l.accion,
    datos_anteriores: l.datos_anteriores,
    datos_nuevos: l.datos_nuevos,
    fecha: l.fecha,
  }));

  // Resolver nombres en lote para no mostrar UUIDs (best-effort: si falla,
  // el detalle usa textos genéricos en vez de romper el listado).
  const recoger = (clave: string): string[] => {
    const ids = new Set<string>();
    for (const l of filas) {
      for (const d of [l.datos_anteriores, l.datos_nuevos]) {
        const v = d?.[clave];
        if (typeof v === "string" && v) ids.add(v);
      }
    }
    return [...ids];
  };
  const nombres: ListaAuditoria["nombres"] = { clientes: {}, facturas: {}, monedas: {} };
  try {
    const [clientesIds, facturaIds, monedaIds] = [
      recoger("cliente_id"),
      recoger("factura_id"),
      recoger("moneda_id"),
    ];
    const [{ data: cli }, { data: fac }, { data: mon }] = await Promise.all([
      clientesIds.length > 0
        ? supabase.from("clientes").select("id, nombre").in("id", clientesIds)
        : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
      facturaIds.length > 0
        ? supabase.from("facturas").select("id, numero_consecutivo").in("id", facturaIds)
        : Promise.resolve({ data: [] as { id: string; numero_consecutivo: number }[] }),
      monedaIds.length > 0
        ? supabase.from("monedas").select("id, simbolo").in("id", monedaIds)
        : Promise.resolve({ data: [] as { id: string; simbolo: string }[] }),
    ]);
    for (const c of cli ?? []) nombres.clientes[c.id] = c.nombre;
    for (const f of fac ?? []) nombres.facturas[f.id] = f.numero_consecutivo;
    for (const m of mon ?? []) nombres.monedas[m.id] = m.simbolo;
  } catch {
    // Sin nombres: describirCambio usa textos genéricos. No bloquear el listado.
  }

  return { logs, total, pagina, totalPaginas, nombres };
}