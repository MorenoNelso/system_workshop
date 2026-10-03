"use client";

import { useEffect } from "react";
import { registerActionHandler } from "@/lib/offline/queue";
import { createFactura, createFacturaDirecta, registrarPago } from "@/lib/actions/facturas";
import { createCliente, updateCliente } from "@/lib/actions/clientes";
import { createMoto, updateMoto } from "@/lib/actions/motos";
import { createRepuesto } from "@/lib/actions/repuestos";
import { createProveedor } from "@/lib/actions/proveedores";
import { createCategoria } from "@/lib/actions/categorias";
import {
  createOrden,
  updateEstadoOrden,
  agregarRepuestoAOrden,
  eliminarRepuestoDeOrden,
  agregarManoObraAOrden,
  eliminarManoObraDeOrden,
} from "@/lib/actions/ordenes";
import { createGasto, deleteGasto } from "@/lib/actions/gastos";
import { createDeduccion, deleteDeduccion } from "@/lib/actions/deducciones";
import { createEmpleado } from "@/lib/actions/empleados";
import { OfflineQueue } from "./offline-queue";

/**
 * Inicializa los handlers de la cola offline y renderiza el
 * componente de UI de la cola. Debe montarse una vez en el
 * dashboard layout.
 */
export function OfflineProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // ── Facturación ──
    registerActionHandler("createFactura", async (data) => {
      const result = await createFactura(data);
      return result;
    });

    registerActionHandler("createFacturaDirecta", async (data) => {
      const result = await createFacturaDirecta(data);
      return result;
    });

    registerActionHandler("registrarPago", async (data) => {
      const result = await registrarPago(data);
      return result;
    });

    // ── Catálogos ──
    registerActionHandler("createCliente", async (data) => {
      const result = await createCliente(data);
      return result;
    });

    registerActionHandler("updateCliente", async (data) => {
      const { id, ...rest } = data as Record<string, unknown> & { id: string };
      const result = await updateCliente(id, rest);
      return result;
    });

    registerActionHandler("createMoto", async (data) => {
      const result = await createMoto(data);
      return result;
    });

    registerActionHandler("updateMoto", async (data) => {
      const { id, ...rest } = data as Record<string, unknown> & { id: string };
      const result = await updateMoto(id, rest);
      return result;
    });

    registerActionHandler("createRepuesto", async (data) => {
      const result = await createRepuesto(data);
      return result;
    });

    registerActionHandler("createProveedor", async (data) => {
      const result = await createProveedor(data);
      return result;
    });

    registerActionHandler("createCategoria", async (data) => {
      const result = await createCategoria(data);
      return result;
    });

    // ── Órdenes de servicio ──
    registerActionHandler("createOrden", async (data) => {
      const result = await createOrden(data);
      return result;
    });

    registerActionHandler("updateEstadoOrden", async (data) => {
      const d = data as { orden_id: string; nuevo_estado: "recibido" | "en_proceso" | "terminado" | "entregado" };
      const result = await updateEstadoOrden(d.orden_id, d.nuevo_estado);
      return result;
    });

    registerActionHandler("agregarRepuestoAOrden", async (data) => {
      const result = await agregarRepuestoAOrden(data);
      return result;
    });

    registerActionHandler("eliminarRepuestoDeOrden", async (data) => {
      const d = data as { detalle_id: string; orden_id: string };
      const result = await eliminarRepuestoDeOrden(d.detalle_id, d.orden_id);
      return result;
    });

    registerActionHandler("agregarManoObraAOrden", async (data) => {
      const result = await agregarManoObraAOrden(data);
      return result;
    });

    registerActionHandler("eliminarManoObraDeOrden", async (data) => {
      const d = data as { detalle_id: string; orden_id: string };
      const result = await eliminarManoObraDeOrden(d.detalle_id, d.orden_id);
      return result;
    });

    // ── Contabilidad ──
    registerActionHandler("createGasto", async (data) => {
      const result = await createGasto(data);
      return result;
    });

    registerActionHandler("deleteGasto", async (data) => {
      const d = data as { id: string };
      const result = await deleteGasto(d.id);
      return result;
    });

    registerActionHandler("createDeduccion", async (data) => {
      const result = await createDeduccion(data);
      return result;
    });

    registerActionHandler("deleteDeduccion", async (data) => {
      const d = data as { id: string };
      const result = await deleteDeduccion(d.id);
      return result;
    });

    // ── Empleados ──
    registerActionHandler("createEmpleado", async (data) => {
      const result = await createEmpleado(data);
      return result;
    });
  }, []);

  return (
    <>
      {children}
      <OfflineQueue />
    </>
  );
}