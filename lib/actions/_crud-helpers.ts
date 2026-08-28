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
