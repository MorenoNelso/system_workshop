import { getCurrentUser } from "@/lib/auth/session";

/**
 * Verifica si el usuario actual puede eliminar registros de un módulo.
 * Solo el administrador puede eliminar registros.
 *
 * @param modulo Nombre del módulo (ej: "clientes", "motos", "ordenes")
 * @returns true si tiene permiso, false si no
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function puedeEliminar(_modulo: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return user.rol === "administrador";
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
