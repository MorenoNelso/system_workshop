/**
 * Envuelve una Promise para que no crashee la página offline.
 * Si la promesa falla (Supabase inalcanzable), retorna un fallback vacío.
 * Perfecto para Server Components que leen de la DB.
 */
export async function safeQuery<T>(
  promise: Promise<T>,
  fallback?: T,
): Promise<T> {
  try {
    return await promise;
  } catch {
    return (fallback ?? ([] as unknown as T));
  }
}
