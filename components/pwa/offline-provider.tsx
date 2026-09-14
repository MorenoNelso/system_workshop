"use client";

import { useEffect } from "react";
import { registerActionHandler } from "@/lib/offline/queue";
import { createFactura, createFacturaDirecta, registrarPago } from "@/lib/actions/facturas";
import { createCliente } from "@/lib/actions/clientes";
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

    registerActionHandler("createCliente", async (data) => {
      const result = await createCliente(data);
      return result;
    });

    registerActionHandler("registrarPago", async (data) => {
      const result = await registrarPago(data);
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