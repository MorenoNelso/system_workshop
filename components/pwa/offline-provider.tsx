"use client";

import { useEffect } from "react";
import { registerActionHandler } from "@/lib/offline/queue";
import { createFactura, createFacturaDirecta, registrarPago } from "@/lib/actions/facturas";
import { createCliente } from "@/lib/actions/clientes";
import { createMoto } from "@/lib/actions/motos";
import { createRepuesto } from "@/lib/actions/repuestos";
import { createProveedor } from "@/lib/actions/proveedores";
import { createCategoria } from "@/lib/actions/categorias";
import { OfflineQueue } from "./offline-queue";

/**
 * Inicializa los handlers de la cola offline y renderiza el
 * componente de UI de la cola. Debe montarse una vez en el
 * dashboard layout.
 */
export function OfflineProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
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

    registerActionHandler("createCliente", async (data) => {
      const result = await createCliente(data);
      return result;
    });

    registerActionHandler("createMoto", async (data) => {
      const result = await createMoto(data);
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
  }, []);

  return (
    <>
      {children}
      <OfflineQueue />
    </>
  );
}