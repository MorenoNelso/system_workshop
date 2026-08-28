import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Rol } from "@/types/database.types";

export interface SessionUser {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
}

export type AuthState = {
  status: "anon" | "mfa_pending" | "authed";
};

/**
 * Estado de autenticación sin consultar la DB:
 * - "anon": sin sesión.
 * - "mfa_pending": sesión débil (login con contraseña OK, falta el paso 2FA).
 * - "authed": sesión completa.
 */
export async function getAuthState(): Promise<AuthState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "anon" };

  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
    return { status: "mfa_pending" };
  }

  return { status: "authed" };
}

/**
 * Devuelve el usuario autenticado con su rol leído de `public.usuarios`,
 * o `null` si no hay sesión (o si falta completar el 2FA). Memoizado con
 * `cache()` para reutilizar el resultado durante un mismo render.
 *
 * Uso: en Server Components, layouts y server actions. Nunca desde el cliente.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Sesión débil (2FA pendiente): no cuenta como autenticado.
  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") return null;

  const { data, error } = await supabase
    .from("usuarios")
    .select("id, email, nombre, rol, activo")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data || !data.activo) {
    // Si el usuario existe en Auth pero no en public.usuarios (o está inactivo),
    // cerramos la sesión para evitar bucles de redirección.
    await supabase.auth.signOut();
    return null;
  }

  return data;
});

/**
 * Exige sesión activa. Si no hay usuario, redirige a `/login`.
 * Uso en layouts / pages protegidos.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Exige que el usuario autenticado tenga alguno de los roles indicados.
 * Si no cumple, redirige al home. RLS es la última línea de defensa.
 */
export async function requireRole(
  ...roles: [Rol, ...Rol[]]
): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.rol)) redirect("/");
  return user;
}
