import { getCurrentUser } from "@/lib/auth/session";

/**
 * Verifica si el usuario actual puede eliminar registros de un módulo.
 *
 * - Admin siempre puede eliminar todo.
 * - Colaborador solo puede eliminar si su campo `permisos` tiene
 *   `{ "eliminar_<modulo>": true }`.
 *
 * @param modulo Nombre del módulo (ej: "clientes", "motos", "ordenes")
 * @returns true si tiene permiso, false si no
 */
export async function puedeEliminar(modulo: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  if (user.rol === "administrador") return true;

  return user.permisos?.[`eliminar_${modulo}`] === true;
}

/**
 * Lanza error si el usuario no tiene permiso para eliminar en un módulo.
 * Usar en server actions antes de ejecutar la eliminación.
 */
export async function requireEliminar(modulo: string): Promise<void> {
  const allowed = await puedeEliminar(modulo);
  if (!allowed) {
    throw new Error(
      "No tienes permiso para eliminar registros de este módulo.",
    );
  }
}
