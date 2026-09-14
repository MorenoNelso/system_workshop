/**
 * Sistema de cola de acciones offline.
 * Cuando el usuario está sin internet, las acciones se guardan en IndexedDB.
 * Cuando vuelve la conexión, se reenvían al servidor automáticamente.
 */
"use client";

import {
  enqueueAction,
  getPendingActions,
  markSynced,
  markFailed,
  markProcessing,
  getPendingCount,
  getPendingAndFailedActions,
  cleanupSyncedActions,
} from "./db";
import type { OfflineAction } from "./db";

type ActionHandler = (data: unknown) => Promise<{ ok: true; data?: unknown } | { ok: false; error: string }>;

const actionHandlers: Record<string, ActionHandler> = {};

let syncing = false;

/**
 * Registra un handler para un tipo de acción.
 * El handler es la función server action del cliente.
 */
export function registerActionHandler(
  action: string,
  handler: ActionHandler,
): void {
  actionHandlers[action] = handler;
}

/**
 * Intenta ejecutar una acción. Si falla por conexión, la encola.
 * Retorna { offline: true } si quedó en la cola.
 */
export async function executeOrEnqueue(
  action: string,
  data: unknown,
): Promise<{ ok: true; data?: unknown } | { ok: false; error: string } | { ok: true; offline: true }> {
  const handler = actionHandlers[action];
  if (!handler) {
    return { ok: false, error: `Acción desconocida: ${action}` };
  }

  try {
    const result = await handler(data);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNetworkError =
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      msg.includes("Network request failed") ||
      msg.includes("ERR_NETWORK") ||
      !navigator.onLine;

    if (isNetworkError) {
      console.log(`[offline] Encolando acción: ${action}`, data);
      await enqueueAction(action, data);
      return { ok: true, offline: true };
    }

    console.error(`[offline] Error no-network en ${action}:`, msg);
    return { ok: false, error: msg };
  }
}

/**
 * Sincroniza todas las acciones pendientes.
 * Retorna { synced: number, failed: number }.
 */
export async function syncPendingActions(): Promise<{
  synced: number;
  failed: number;
  errors: string[];
}> {
  if (syncing) return { synced: 0, failed: 0, errors: [] };
  syncing = true;

  try {
    const pending = await getPendingActions();
    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const action of pending) {
      const handler = actionHandlers[action.action];
      if (!handler) {
        await markFailed(action.id!, `Handler no registrado: ${action.action}`);
        failed++;
        errors.push(`Handler no registrado: ${action.action}`);
        continue;
      }

      // Marcar como "processing" ANTES de ejecutar para evitar
      // que otra instancia de sync la procese duplicadamente
      await markProcessing(action.id!);

      try {
        console.log(`[offline] Sincronizando: ${action.action}`, action.data);
        const result = await handler(action.data);
        console.log(`[offline] Resultado ${action.action}:`, result);
        if (result.ok) {
          await markSynced(action.id!);
          synced++;
        } else {
          await markFailed(action.id!, result.error || "Error del servidor");
          failed++;
          errors.push(`${action.action}: ${result.error}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await markFailed(action.id!, msg);
        failed++;
        errors.push(`${action.action}: ${msg}`);
      }
    }

    // Limpiar acciones viejas (synced + failed con >3 reintentos)
    await cleanupSyncedActions();

    return { synced, failed, errors };
  } finally {
    syncing = false;
  }
}

/**
 * Retorna el conteo de acciones pendientes.
 */
export { getPendingCount };

/**
 * Retorna todas las acciones pendientes y fallidas (para UI).
 */
export { getPendingAndFailedActions };
export type { OfflineAction };
