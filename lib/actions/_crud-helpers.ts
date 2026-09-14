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
 * Usa advisory locks de PostgreSQL — un lock distribuido a nivel de BD
 * que funciona entre cold starts en serverless. La clave se hashea a un
 * integer de 64 bits para pg_advisory_xact_lock.
 *
 * Si el lock no se puede adquirir (otra petición lo tiene), retorna null
 * para que el caller maneje la duplicación.
 */
function hashKeyToLock(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export async function runOnce<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const lockId = hashKeyToLock(key);
  const supabase = await createClient();

  // Intentar adquirir el lock sin bloquear (try)
  const { data: acquired, error } = await supabase.rpc("try_lock", {
    lock_id: lockId,
  });

  if (error || !acquired) {
    // Lock no disponible — otra petición está procesando la misma acción
    throw new Error(
      "Ya hay una solicitud en proceso para este registro. Espera un momento e intenta de nuevo.",
    );
  }

  return fn();
}
