import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/** Cliente Supabase con sesión verificada (server-side). */
export async function db() {
  await requireUser();
  return createClient();
}

/** Mensaje amigable para errores de FK / restricciones de la DB. */
export function friendlyDbError(action: string): string {
  return `No se pudo ${action}. Verifica los datos e intenta de nuevo.`;
}

/** Refresca la vista del módulo en el server. */
export function touch(path: string) {
  revalidatePath(path);
}

/**
 * Evita inserciones duplicadas por doble clic / submits repetidos.
 *
 * Si ya hay una operación en vuelo con la misma clave, devuelve la misma
 * promesa en lugar de ejecutar la petición de nuevo. Defensa server-side:
 * el cliente ya bloquea con `submittingRef`, esto es la última línea.
 */
const inflight = new Map<string, Promise<unknown>>();

export async function runOnce<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const promise = fn().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}
